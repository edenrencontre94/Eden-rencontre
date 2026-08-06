import { GraduationCap, Ruler, Heart, Sparkles, ShieldAlert, Smile, UserCheck } from "lucide-react";
import {
  formatHeight, hasAnyExtra, MARITAL_LABELS, type ProfileExtras as Extras,
} from "@/lib/profilChamps";

/**
 * Les champs complémentaires, en bas de la carte de profil.
 *
 * Trois blocs plutôt qu'une liste de huit lignes : au-delà de trois ou
 * quatre informations d'affilée, on ne lit plus, on fait défiler.
 *
 * Un bloc entièrement vide n'est pas affiché — un intitulé sans contenu
 * donne l'impression d'un profil bâclé, ce qui dessert son auteur.
 */
export function ProfileExtrasBlocks({ p }: { p: Partial<Extras> }) {
  if (!hasAnyExtra(p)) return null;

  const chemin = Boolean(
    p.marital_status || p.marriage_vision?.trim() || p.looking_for?.trim() || p.dealbreakers?.length,
  );
  const qui = Boolean(p.education || p.height_cm || p.interests?.length);
  const sincerite = Boolean(p.qualities?.length || p.flaws?.length);

  return (
    <div className="divide-y divide-border/40">
      {chemin && (
        <Block title="Mon chemin vers le mariage">
          {p.marital_status && (
            <Facet
              icon={UserCheck}
              label="Situation"
              value={MARITAL_LABELS[p.marital_status] ?? p.marital_status}
            />
          )}
          {p.marriage_vision?.trim() && (
            <Prose icon={Heart} label="Ma vision du mariage" text={p.marriage_vision} />
          )}
          {p.looking_for?.trim() && (
            <Prose icon={Sparkles} label="Ce que je recherche" text={p.looking_for} />
          )}
          {!!p.dealbreakers?.length && (
            <Tags
              icon={ShieldAlert}
              label="Ce que je n'accepte pas"
              items={p.dealbreakers}
              tone="destructive"
            />
          )}
        </Block>
      )}

      {qui && (
        <Block title="Qui je suis">
          {(p.education || p.height_cm) && (
            <div className="flex flex-wrap gap-4">
              {p.education && <Facet icon={GraduationCap} label="Études" value={p.education} />}
              {p.height_cm && <Facet icon={Ruler} label="Taille" value={formatHeight(p.height_cm)} />}
            </div>
          )}
          {!!p.interests?.length && (
            <Tags label="Centres d'intérêt" items={p.interests} />
          )}
        </Block>
      )}

      {sincerite && (
        <Block title="En toute sincérité">
          {!!p.qualities?.length && (
            <Tags icon={Smile} label="Mes qualités" items={p.qualities} tone="emerald" />
          )}
          {/* Les défauts sont affichés avec la même dignité que les
              qualités : les grisr reviendrait à punir l'honnêteté. */}
          {!!p.flaws?.length && <Tags label="Mes défauts" items={p.flaws} />}
        </Block>
      )}
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="px-5 py-4 space-y-3.5">
      <h3 className="text-[10px] uppercase tracking-wider font-semibold text-primary">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Prose({ icon: Icon, label, text }: { icon: any; label: string; text: string }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1">
        <Icon className="w-3.5 h-3.5" /> {label}
      </div>
      <p className="text-sm leading-relaxed text-foreground/85 whitespace-pre-line">{text}</p>
    </div>
  );
}

function Facet({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-4 h-4 text-primary shrink-0" />
      <div>
        <div className="text-[10px] text-muted-foreground leading-none">{label}</div>
        <div className="text-sm font-medium mt-0.5">{value}</div>
      </div>
    </div>
  );
}

function Tags({ icon: Icon, label, items, tone }: {
  icon?: any; label: string; items: string[]; tone?: "destructive" | "emerald";
}) {
  const cls =
    tone === "destructive"
      ? "bg-destructive/8 text-destructive border-destructive/20"
      : tone === "emerald"
        ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20"
        : "bg-primary/8 text-primary border-primary/20";

  return (
    <div>
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1.5">
        {Icon && <Icon className="w-3.5 h-3.5" />} {label}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map(t => (
          <span
            key={t}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium border ${cls}`}
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}
