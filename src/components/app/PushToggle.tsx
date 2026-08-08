import { useEffect, useState } from "react";
import { BellRing, BellOff, Loader2, Smartphone, AlertTriangle, Check } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { activerPush, desactiverPush, etatPush, type EtatPush } from "@/lib/push";

/**
 * Activation des notifications sur l'appareil.
 *
 * La demande d'autorisation ne part JAMAIS toute seule : elle est
 * déclenchée par ce bouton. Demander au chargement fait refuser la
 * majorité des gens — et un refus est presque définitif, seuls les
 * réglages du navigateur permettent d'y revenir.
 */
export function PushToggle() {
  const [etat, setEtat] = useState<EtatPush | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { etatPush().then(setEtat); }, []);

  const basculer = async () => {
    setBusy(true);

    if (etat === "actif") {
      const ok = await desactiverPush();
      setBusy(false);
      if (!ok) { toast.error("La désactivation a échoué"); return; }
      setEtat("inactif");
      toast.success("Notifications désactivées sur cet appareil");
      return;
    }

    const { ok, raison } = await activerPush();
    setBusy(false);

    if (ok) {
      setEtat("actif");
      toast.success("Notifications activées", {
        description: "Vous serez prévenu des messages et des nouveaux matchs.",
      });
      return;
    }

    if (raison) setEtat(raison);

    toast.error(
      raison === "refuse"
        ? "Notifications bloquées par votre navigateur"
        : raison === "non_configure"
          ? "Notifications non configurées"
          : "Activation impossible",
      {
        description:
          raison === "refuse"
            ? "Autorisez-les dans les réglages du site, puis réessayez."
            : raison === "non_configure"
              ? "Prévenez l'assistance."
              : "Votre navigateur ne prend pas en charge cette fonctionnalité.",
        duration: 7000,
      },
    );
  };

  if (etat === null) {
    return <div className="h-24 rounded-3xl bg-secondary animate-pulse" />;
  }

  // iPhone : Apple n'autorise les notifications que si l'application est
  // ajoutée à l'écran d'accueil. Le dire explicitement, plutôt que de
  // laisser un interrupteur qui ne fonctionnerait jamais.
  if (etat === "ios_a_installer") {
    return (
      <Encadre
        icone={<Smartphone className="w-5 h-5" />}
        titre="Ajoutez AgapeMeet à votre écran d'accueil"
        ton="info"
      >
        Sur iPhone, les notifications ne fonctionnent qu'une fois
        l'application installée. Appuyez sur <strong>Partager</strong> dans
        Safari, puis sur <strong>Sur l'écran d'accueil</strong>. Revenez
        ensuite ici.
      </Encadre>
    );
  }

  if (etat === "non_supporte") {
    return (
      <Encadre
        icone={<BellOff className="w-5 h-5" />}
        titre="Notifications indisponibles"
        ton="neutre"
      >
        Votre navigateur ne les prend pas en charge. Essayez Chrome sur
        Android, ou installez l'application depuis votre navigateur.
      </Encadre>
    );
  }

  if (etat === "refuse") {
    return (
      <Encadre
        icone={<AlertTriangle className="w-5 h-5" />}
        titre="Notifications bloquées"
        ton="alerte"
      >
        Vous les avez refusées pour ce site. Nous ne pouvons pas le
        redemander : ouvrez le cadenas 🔒 à gauche de l'adresse, autorisez
        les notifications, puis rechargez la page.
      </Encadre>
    );
  }

  const actif = etat === "actif";

  return (
    <div
      className={`rounded-3xl border p-5 shadow-soft transition-colors ${
        actif ? "border-primary/40 bg-primary/5" : "border-border/50 bg-card"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={`w-10 h-10 rounded-xl shrink-0 flex items-center justify-center ${
              actif ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"
            }`}
          >
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <BellRing className="w-5 h-5" />}
          </div>
          <div className="min-w-0">
            <h2 className="font-serif text-lg font-medium">Sur cet appareil</h2>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Soyez prévenu d'un message, d'un match ou d'un appel, même
              lorsque l'application est fermée.
            </p>
          </div>
        </div>

        <Switch checked={actif} disabled={busy || etat === "non_configure"} onCheckedChange={basculer} />
      </div>

      {actif && (
        <div className="mt-4 pt-4 border-t border-border/50 flex flex-wrap gap-x-4 gap-y-1.5">
          {["Nouveaux messages", "Nouveaux matchs", "Super Likes", "Appels entrants"].map(l => (
            <span key={l} className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <Check className="w-3 h-3 text-primary" /> {l}
            </span>
          ))}
        </div>
      )}

      {etat === "non_configure" && (
        <p className="text-[11px] text-muted-foreground mt-3">
          Fonctionnalité non configurée sur ce serveur.
        </p>
      )}
    </div>
  );
}

function Encadre({
  icone, titre, ton, children,
}: {
  icone: React.ReactNode;
  titre: string;
  ton: "info" | "alerte" | "neutre";
  children: React.ReactNode;
}) {
  const cls =
    ton === "alerte"
      ? "border-destructive/40 bg-destructive/5 text-destructive"
      : ton === "info"
        ? "border-primary/40 bg-primary/5 text-primary"
        : "border-border/60 bg-secondary/40 text-muted-foreground";

  return (
    <div className={`rounded-3xl border p-5 ${cls.split(" ").slice(0, 2).join(" ")}`}>
      <div className="flex items-start gap-3">
        <span className={`shrink-0 mt-0.5 ${cls.split(" ")[2]}`}>{icone}</span>
        <div className="min-w-0">
          <p className="font-medium text-sm text-foreground">{titre}</p>
          <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{children}</p>
        </div>
      </div>
    </div>
  );
}
