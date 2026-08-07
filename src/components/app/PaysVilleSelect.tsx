import { useMemo, useState } from "react";
import { Check, ChevronDown, Search, MapPin } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  PAYS, PAYS_PRIORITAIRES, paysParNom, normaliser, drapeauUrl,
} from "@/content/pays";
import { villesDe, aDesVilles } from "@/content/villes";

/**
 * Sélection du pays puis de la ville.
 *
 * Deux listes déroulantes classiques ne suffisaient plus : à 195 pays et
 * une cinquantaine de villes par pays, faire défiler devient pénible sur
 * un téléphone. Les deux champs sont donc cherchables.
 */

/** Drapeau réel, recadré en rond. */
function Drapeau({ code, taille = "w-6 h-6" }: { code: string; taille?: string }) {
  const [echec, setEchec] = useState(false);

  // Un drapeau manquant ne doit pas laisser une icône cassée dans la
  // liste : on retombe sur le code du pays, qui reste lisible.
  if (echec) {
    return (
      <span className={`${taille} rounded-full bg-secondary shrink-0 grid place-items-center text-[9px] font-bold text-muted-foreground`}>
        {code}
      </span>
    );
  }

  return (
    <img
      src={drapeauUrl(code)}
      alt=""
      aria-hidden
      loading="lazy"
      onError={() => setEchec(true)}
      /* object-cover recadre le rectangle du drapeau au centre du cercle :
         sans lui, l'image serait écrasée et les proportions fausses. */
      className={`${taille} rounded-full object-cover shrink-0 ring-1 ring-border/60`}
    />
  );
}

function Champ({
  ouvert, setOuvert, children, contenu, id,
}: {
  ouvert: boolean;
  setOuvert: (v: boolean) => void;
  children: React.ReactNode;
  contenu: React.ReactNode;
  id?: string;
}) {
  return (
    <Popover open={ouvert} onOpenChange={setOuvert}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={ouvert}
          className="w-full h-11 px-3 flex items-center gap-2.5 rounded-xl border border-input bg-background text-sm text-left hover:bg-secondary/50 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {children}
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 ml-auto" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="p-0 w-[--radix-popover-trigger-width] min-w-[16rem]"
      >
        {contenu}
      </PopoverContent>
    </Popover>
  );
}

/* ─────────────────────────── Pays ─────────────────────────── */

export function PaysSelect({
  value, onChange, id,
}: {
  value: string;              // nom français, tel que stocké en base
  onChange: (nom: string) => void;
  id?: string;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [q, setQ] = useState("");
  const choisi = paysParNom(value);

  const { prioritaires, autres } = useMemo(() => {
    const r = normaliser(q);
    const filtres = r
      ? PAYS.filter(p => normaliser(p.nom).includes(r))
      : PAYS;
    return {
      // En tête tant qu'on n'a pas tapé : la quasi-totalité des membres
      // trouve son pays sans faire défiler. Dès qu'une recherche est en
      // cours, ce classement n'a plus de sens et tout est fusionné.
      prioritaires: r ? [] : PAYS.filter(p => PAYS_PRIORITAIRES.includes(p.code)),
      autres: r ? filtres : filtres.filter(p => !PAYS_PRIORITAIRES.includes(p.code)),
    };
  }, [q]);

  const Ligne = ({ code, nom }: { code: string; nom: string }) => (
    <button
      type="button"
      onClick={() => { onChange(nom); setOuvert(false); setQ(""); }}
      className="w-full px-3 py-2 flex items-center gap-2.5 text-sm text-left hover:bg-secondary rounded-lg transition-colors"
    >
      <Drapeau code={code} />
      <span className="truncate">{nom}</span>
      {value === nom && <Check className="w-4 h-4 text-primary ml-auto shrink-0" />}
    </button>
  );

  return (
    <Champ
      id={id}
      ouvert={ouvert}
      setOuvert={setOuvert}
      contenu={
        <div>
          <div className="flex items-center gap-2 px-3 border-b border-border">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              autoFocus
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Rechercher un pays…"
              className="w-full py-2.5 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="max-h-72 overflow-y-auto p-1.5">
            {prioritaires.length > 0 && (
              <>
                {prioritaires.map(p => <Ligne key={p.code} {...p} />)}
                <div className="my-1.5 border-t border-border/60" />
                <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Tous les pays
                </p>
              </>
            )}
            {autres.map(p => <Ligne key={p.code} {...p} />)}
            {prioritaires.length === 0 && autres.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                Aucun pays ne correspond.
              </p>
            )}
          </div>
        </div>
      }
    >
      {choisi ? (
        <>
          <Drapeau code={choisi.code} />
          <span className="truncate">{choisi.nom}</span>
        </>
      ) : (
        <span className="text-muted-foreground">Sélectionner un pays</span>
      )}
    </Champ>
  );
}

/* ─────────────────────────── Ville ────────────────────────── */

export function VilleSelect({
  value, onChange, pays, id,
}: {
  value: string;
  onChange: (ville: string) => void;
  pays: string;               // nom français du pays
  id?: string;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [q, setQ] = useState("");
  const code = paysParNom(pays)?.code;
  const villes = useMemo(() => villesDe(code), [code]);

  const filtrees = useMemo(() => {
    const r = normaliser(q);
    return r ? villes.filter(v => normaliser(v).includes(r)) : villes;
  }, [villes, q]);

  const saisieLibre = q.trim();
  // Proposer la saisie libre seulement si elle n'existe pas déjà dans la
  // liste : sinon on afficherait deux fois « Lomé ».
  const proposerLibre =
    saisieLibre.length >= 2 &&
    !villes.some(v => normaliser(v) === normaliser(saisieLibre));

  if (!pays) {
    return (
      <button
        id={id}
        type="button"
        disabled
        className="w-full h-11 px-3 flex items-center gap-2 rounded-xl border border-input bg-secondary/30 text-sm text-muted-foreground cursor-not-allowed"
      >
        <MapPin className="w-4 h-4 shrink-0" />
        Choisissez d'abord un pays
      </button>
    );
  }

  return (
    <Champ
      id={id}
      ouvert={ouvert}
      setOuvert={setOuvert}
      contenu={
        <div>
          <div className="flex items-center gap-2 px-3 border-b border-border">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              autoFocus
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder={aDesVilles(code) ? "Rechercher votre ville…" : "Saisissez votre ville…"}
              className="w-full py-2.5 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          <div className="max-h-72 overflow-y-auto p-1.5">
            {filtrees.map(v => (
              <button
                key={v}
                type="button"
                onClick={() => { onChange(v); setOuvert(false); setQ(""); }}
                className="w-full px-3 py-2 flex items-center gap-2 text-sm text-left hover:bg-secondary rounded-lg transition-colors"
              >
                <span className="truncate">{v}</span>
                {value === v && <Check className="w-4 h-4 text-primary ml-auto shrink-0" />}
              </button>
            ))}

            {/* Aucune liste ne couvre tous les villages. Refuser une ville
                absente reviendrait à refuser le membre. */}
            {proposerLibre && (
              <>
                {filtrees.length > 0 && <div className="my-1.5 border-t border-border/60" />}
                <button
                  type="button"
                  onClick={() => { onChange(saisieLibre); setOuvert(false); setQ(""); }}
                  className="w-full px-3 py-2 flex items-center gap-2 text-sm text-left hover:bg-secondary rounded-lg transition-colors"
                >
                  <MapPin className="w-4 h-4 text-primary shrink-0" />
                  <span className="truncate">
                    Utiliser « <span className="font-medium">{saisieLibre}</span> »
                  </span>
                </button>
              </>
            )}

            {filtrees.length === 0 && !proposerLibre && (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                {aDesVilles(code)
                  ? "Aucune ville ne correspond. Saisissez le nom complet pour l'ajouter."
                  : "Saisissez le nom de votre ville."}
              </p>
            )}
          </div>
        </div>
      }
    >
      {value ? (
        <>
          <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="truncate">{value}</span>
        </>
      ) : (
        <span className="text-muted-foreground">Sélectionner une ville</span>
      )}
    </Champ>
  );
}
