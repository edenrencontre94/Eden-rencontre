import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const APP_ID = Deno.env.get("AGORA_APP_ID") ?? "";
const APP_CERT = Deno.env.get("AGORA_APP_CERTIFICATE") ?? "";

// ── Agora AccessToken2 (version 007) ──────────────────────────────────────
//
// Format officiel :
//   "007" + base64( zlib_deflate( pack_string(signature) + signingInfo ) )
//
//   signingInfo = pack_string(appId)
//               + uint32(issueTs) + uint32(expire) + uint32(salt)
//               + uint16(nbServices) + services…
//
//   service RTC = uint16(1) + map(privilèges) + pack_string(canal) + pack_string(uid)
//
//   clé de signature = HMAC( key=uint32(salt),
//                            msg=HMAC(key=uint32(issueTs), msg=appCertificate) )
//   signature        = HMAC( key=cléDeSignature, msg=signingInfo )
//
// Points critiques : l'App ID DOIT figurer dans le corps du token (Agora l'y lit,
// sinon « invalid vendor key, can not find appid »), et le tout DOIT être
// compressé en zlib — c'est pourquoi tout vrai token commence par « 007eJx ».
// Tous les entiers sont en little-endian.

const SERVICE_TYPE_RTC = 1;
const PRIVILEGE_JOIN_CHANNEL = 1;
const PRIVILEGE_PUBLISH_AUDIO = 2;
const PRIVILEGE_PUBLISH_VIDEO = 3;
const PRIVILEGE_PUBLISH_DATA = 4;

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((sum, a) => sum + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    out.set(a, offset);
    offset += a.length;
  }
  return out;
}

function packUint16(v: number): Uint8Array {
  const buf = new ArrayBuffer(2);
  new DataView(buf).setUint16(0, v, true);
  return new Uint8Array(buf);
}

function packUint32(v: number): Uint8Array {
  const buf = new ArrayBuffer(4);
  new DataView(buf).setUint32(0, v, true);
  return new Uint8Array(buf);
}

function packBytes(bytes: Uint8Array): Uint8Array {
  return concat(packUint16(bytes.length), bytes);
}

function packString(s: string): Uint8Array {
  return packBytes(new TextEncoder().encode(s));
}

/** uint16(nb) puis, triés par clé, uint16(privilège) + uint32(expiration) */
function packMapUint32(map: Map<number, number>): Uint8Array {
  const entries = [...map.entries()].sort((a, b) => a[0] - b[0]);
  return concat(
    packUint16(entries.length),
    ...entries.flatMap(([k, v]) => [packUint16(k), packUint32(v)]),
  );
}

async function hmacSha256(key: Uint8Array, message: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, message));
}

/** Compression zlib (RFC 1950) — « deflate » inclut l'en-tête, contrairement à « deflate-raw ». */
async function zlibDeflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new CompressionStream("deflate");
  const writer = stream.writable.getWriter();
  writer.write(data);
  writer.close();

  const chunks: Uint8Array[] = [];
  const reader = stream.readable.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  return concat(...chunks);
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

async function buildToken(channelName: string, uid: string, expireSecs = 3600): Promise<string> {
  const issueTs = Math.floor(Date.now() / 1000);
  const salt = Math.floor(Math.random() * 99999999) + 1; // même plage que l'implémentation officielle

  // Un uid à 0 signifie « n'importe quel uid » et se code par une chaîne vide.
  // Le client rejoint avec un uid null (attribué par Agora), donc le token ne
  // doit surtout pas être lié à un uid précis.
  const uidStr = !uid || uid === "0" ? "" : uid;

  const privileges = new Map<number, number>([
    [PRIVILEGE_JOIN_CHANNEL, expireSecs],
    [PRIVILEGE_PUBLISH_AUDIO, expireSecs],
    [PRIVILEGE_PUBLISH_VIDEO, expireSecs],
    [PRIVILEGE_PUBLISH_DATA, expireSecs],
  ]);

  const rtcService = concat(
    packUint16(SERVICE_TYPE_RTC),
    packMapUint32(privileges),
    packString(channelName),
    packString(uidStr),
  );

  const signingInfo = concat(
    packString(APP_ID),
    packUint32(issueTs),
    packUint32(expireSecs),
    packUint32(salt),
    packUint16(1), // un seul service
    rtcService,
  );

  const encoder = new TextEncoder();
  const step1 = await hmacSha256(packUint32(issueTs), encoder.encode(APP_CERT));
  const signingKey = await hmacSha256(packUint32(salt), step1);
  const signature = await hmacSha256(signingKey, signingInfo);

  const content = concat(packBytes(signature), signingInfo);
  return "007" + toBase64(await zlibDeflate(content));
}

// ── CORS ──────────────────────────────────────────────────────────────────
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!APP_ID || !APP_CERT) {
      return new Response(
        JSON.stringify({ error: "Agora credentials not configured on server" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (APP_ID.length !== 32) {
      return new Response(
        JSON.stringify({ error: `AGORA_APP_ID invalide : ${APP_ID.length} caractères au lieu de 32` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { channelName, uid = "0", expireSecs = 3600 } = await req.json();

    if (!channelName) {
      return new Response(
        JSON.stringify({ error: "channelName is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const token = await buildToken(channelName, String(uid), expireSecs);

    return new Response(
      JSON.stringify({ token, appId: APP_ID }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Token generation error:", err);
    return new Response(
      JSON.stringify({ error: "Failed to generate token" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
