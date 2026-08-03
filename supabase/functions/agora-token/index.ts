import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const APP_ID = Deno.env.get("AGORA_APP_ID") ?? "";
const APP_CERT = Deno.env.get("AGORA_APP_CERTIFICATE") ?? "";

// ── Agora AccessToken2 builder (v007) ──────────────────────────────────────
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

function concat(...arrays: Uint8Array[]): Uint8Array {
  const totalLen = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const a of arrays) {
    result.set(a, offset);
    offset += a.length;
  }
  return result;
}

async function buildToken(
  channelName: string,
  uid: string,
  expireSecs = 3600
): Promise<string> {
  const issueTs = Math.floor(Date.now() / 1000);
  const salt = Math.floor(Math.random() * 0x7fffffff) + 1;

  // Signing info: salt + issueTs + expire
  const signingInfo = concat(
    packUint32(salt),
    packUint32(issueTs),
    packUint32(expireSecs)
  );

  // HMAC-SHA256(appCertificate, signingInfo)
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(APP_CERT),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuffer = await crypto.subtle.sign("HMAC", key, signingInfo);
  const sig = new Uint8Array(sigBuffer);

  // Privileges: JOIN=1, PUBLISH_AUDIO=2, PUBLISH_VIDEO=3, PUBLISH_DATA=4
  const privileges: [number, number][] = [
    [1, expireSecs],
    [2, expireSecs],
    [3, expireSecs],
    [4, expireSecs],
  ];
  const privParts = privileges.flatMap(([k, v]) => [packUint16(k), packUint32(v)]);
  const packedPrivileges = concat(packUint16(privileges.length), ...privParts);

  // RTC service (serviceType = 1)
  const rtcService = concat(
    packUint16(1),            // kServiceTypeRtc
    packString(channelName),
    packString(uid),
    packedPrivileges
  );

  // Final token body
  const body = concat(
    packBytes(sig),
    packUint32(salt),
    packUint32(issueTs),
    packUint32(expireSecs),
    packUint16(1),            // 1 service
    rtcService
  );

  return "007" + btoa(String.fromCharCode(...body));
}

// ── CORS headers ──────────────────────────────────────────────────────────
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
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { channelName, uid = "0", expireSecs = 3600 } = await req.json();

    if (!channelName) {
      return new Response(
        JSON.stringify({ error: "channelName is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = await buildToken(channelName, uid, expireSecs);

    return new Response(
      JSON.stringify({ token, appId: APP_ID }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Token generation error:", err);
    return new Response(
      JSON.stringify({ error: "Failed to generate token" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
