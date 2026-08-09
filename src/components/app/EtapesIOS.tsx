import { Share, Plus, BellRing } from "lucide-react";

/**
 * La marche à suivre sur iPhone.
 *
 * Safari n'expose AUCUNE API d'installation — Apple ne l'implémente pas.
 * Aucun bouton ne peut donc déclencher quoi que ce soit : la seule voie
 * est le geste manuel, qu'il faut montrer plutôt que sous-entendre.
 *
 * Partagé par le bandeau et l'entrée de menu : deux rédactions
 * divergentes pour la même manipulation finiraient par se contredire.
 */
export function EtapesIOS() {
  return (
    <div className="space-y-2.5">
      <Etape n={1} icone={<Share className="w-3.5 h-3.5" />}>
        Appuyez sur <strong>Partager</strong> en bas de Safari
      </Etape>
      <Etape n={2} icone={<Plus className="w-3.5 h-3.5" />}>
        Choisissez <strong>Sur l'écran d'accueil</strong>
      </Etape>
      <Etape n={3} icone={<BellRing className="w-3.5 h-3.5" />}>
        Rouvrez depuis l'icône : les notifications deviennent possibles
      </Etape>
    </div>
  );
}

function Etape({
  n, icone, children,
}: {
  n: number;
  icone: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5 text-xs">
      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">
        {n}
      </span>
      <span className="text-primary shrink-0">{icone}</span>
      <span className="text-muted-foreground min-w-0">{children}</span>
    </div>
  );
}
