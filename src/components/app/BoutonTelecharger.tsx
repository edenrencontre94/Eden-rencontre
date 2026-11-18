import { useEffect, useState } from "react";
import { Copy, Download } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { estInstalle, useInstall } from "@/lib/install";
import { EtapesIOS } from "@/components/app/EtapesIOS";
import logoAsset from "@/assets/logo.png";

/**
 * Bouton « Télécharger l'application », toujours visible.
 *
 * Les invitations existantes (bandeau, carte, entrée de menu) ne
 * s'affichent que si le navigateur a signalé l'installabilité. Or une
 * bonne partie des visiteurs arrivent par un lien partagé sur WhatsApp
 * ou Facebook, dont le navigateur intégré ne permet pas d'installer :
 * pour eux, aucun bouton n'apparaissait.
 *
 * Ici le bouton est toujours là (sauf dans l'application déjà installée) :
 * - installation possible → la boîte de dialogue native s'ouvre ;
 * - iPhone → les gestes Safari ;
 * - navigateur intégré (WhatsApp, Facebook…) → ouvrir dans Chrome/Safari ;
 * - sinon → la marche à suivre par le menu du navigateur.
 */

function navigateurIntegre(): boolean {
  if (typeof navigator === "undefined") return false;
  return /FBAN|FBAV|FB_IAB|Instagram|WhatsApp|WA4A|Line\/|Snapchat|TikTok|; wv\)/i.test(
    navigator.userAgent,
  );
}

export function BoutonTelecharger({
  variante = "plein",
  className = "",
}: {
  variante?: "plein" | "contour" | "icone";
  className?: string;
}) {
  const { possible, ios, installer } = useInstall();
  const [ouvert, setOuvert] = useState(false);
  // Calculé après le montage : le rendu serveur ne connaît ni l'appareil
  // ni le mode d'affichage, et un écart provoquerait une erreur d'hydratation.
  const [pret, setPret] = useState(false);
  const [installeIci, setInstalleIci] = useState(false);
  const [integre, setIntegre] = useState(false);

  useEffect(() => {
    setInstalleIci(estInstalle());
    setIntegre(navigateurIntegre());
    setPret(true);
  }, []);

  if (!pret || installeIci) return null;

  const cliquer = async () => {
    if (possible && !ios && !integre) {
      const ok = await installer();
      if (ok) toast.success("Eden Rencontre est installé sur votre appareil");
      return;
    }
    setOuvert(true);
  };

  const copierLien = async () => {
    try {
      await navigator.clipboard.writeText("https://edenrencontres.com");
      toast.success("Lien copié : collez-le dans Chrome ou Safari");
    } catch {
      toast.message("Copiez ce lien : edenrencontres.com");
    }
  };

  const styles = {
    plein:
      "inline-flex items-center gap-2 rounded-full bg-gold text-gold-foreground px-7 py-4 text-base font-semibold shadow-soft hover:brightness-105 active:scale-[0.98] transition",
    contour:
      "inline-flex items-center gap-2 rounded-full border border-primary/40 bg-background text-primary px-4 py-2 text-sm font-semibold hover:bg-primary/5 active:scale-[0.98] transition",
    icone:
      "w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shadow-soft transition-transform hover:scale-105",
  }[variante];

  return (
    <>
      <button
        type="button"
        onClick={cliquer}
        className={`${styles} ${className}`}
        aria-label="Télécharger l'application"
        title="Télécharger l'application"
      >
        <Download className={variante === "icone" ? "w-4 h-4" : "w-4 h-4 shrink-0"} />
        {variante !== "icone" && <span>Télécharger l'application</span>}
      </button>

      <Dialog open={ouvert} onOpenChange={setOuvert}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <img src={logoAsset} alt="" className="w-12 h-12 rounded-xl mb-1" />
            <DialogTitle className="font-serif text-left">
              Installer Eden Rencontre
            </DialogTitle>
            <DialogDescription className="text-left">
              Gratuit, sans Play Store ni App Store. L'icône apparaît sur votre
              écran d'accueil et vous recevez vos messages en notification.
            </DialogDescription>
          </DialogHeader>

          <div className="pt-1 space-y-3 text-sm">
            {integre ? (
              <>
                <p className="text-muted-foreground leading-relaxed">
                  Vous êtes dans le navigateur de <strong className="text-foreground">WhatsApp
                  ou Facebook</strong>, qui ne permet pas d'installer d'application.
                </p>
                <ol className="list-decimal pl-5 space-y-1.5 text-muted-foreground">
                  <li>Appuyez sur <strong className="text-foreground">⋮</strong> (ou <strong className="text-foreground">…</strong>) en haut à droite.</li>
                  <li>Choisissez <strong className="text-foreground">Ouvrir dans Chrome</strong>{ios ? " (ou Safari)" : ""}.</li>
                  <li>Appuyez à nouveau sur <strong className="text-foreground">Télécharger l'application</strong>.</li>
                </ol>
                <button
                  type="button"
                  onClick={copierLien}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 font-medium hover:bg-secondary transition"
                >
                  <Copy className="w-4 h-4" /> Copier le lien du site
                </button>
              </>
            ) : ios ? (
              <EtapesIOS />
            ) : (
              <ol className="list-decimal pl-5 space-y-1.5 text-muted-foreground">
                <li>
                  <strong className="text-foreground">Sur Android</strong> : ouvrez le menu
                  {" "}<strong className="text-foreground">⋮</strong> de Chrome, puis
                  {" "}<strong className="text-foreground">Installer l'application</strong>
                  {" "}(ou <strong className="text-foreground">Ajouter à l'écran d'accueil</strong>).
                </li>
                <li>
                  <strong className="text-foreground">Sur ordinateur</strong> : cliquez sur l'icône
                  d'installation à droite de la barre d'adresse.
                </li>
              </ol>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
