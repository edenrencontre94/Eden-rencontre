import { useState } from "react";
import { Smartphone } from "lucide-react";
import { toast } from "sonner";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useInstall } from "@/lib/install";
import { EtapesIOS } from "@/components/app/EtapesIOS";
import logoAsset from "@/assets/logo.png";

/**
 * « Installer l'application » dans le menu du profil.
 *
 * Le bandeau automatique n'apparaît qu'au 3áµ‰ passage, et se tait 60
 * jours après un refus – de bonnes règles, mais qui laissaient sans
 * recours quiconque décidait d'installer à un autre moment.
 *
 * Ici, l'entrée est disponible en permanence : elle ne vient pas vers
 * l'utilisateur, c'est lui qui la cherche.
 */
export function InstallMenuItem() {
  const { possible, ios, installer } = useInstall();
  const [ouvert, setOuvert] = useState(false);

  // L'entrée disparaît une fois l'application installée, et n'apparaît
  // pas là où l'installation est impossible (Firefox notamment) : une
  // ligne de menu qui ne fait rien use la confiance.
  if (!possible) return null;

  const cliquer = async (e: Event) => {
    if (ios) {
      // `preventDefault` : sans lui, le menu se referme et emporte la
      // boîte de dialogue avec lui.
      e.preventDefault();
      setOuvert(true);
      return;
    }
    const ok = await installer();
    if (ok) toast.success("Eden Rencontre est installé sur votre appareil");
  };

  return (
    <>
      <DropdownMenuItem
        onSelect={cliquer}
        className="rounded-xl cursor-pointer hover:bg-secondary"
      >
        <span className="flex items-center gap-3 py-2.5 px-2 w-full">
          <Smartphone className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium">Installer l'application</span>
        </span>
      </DropdownMenuItem>

      <Dialog open={ouvert} onOpenChange={setOuvert}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <img src={logoAsset} alt="" className="w-12 h-12 rounded-xl mb-1" />
            <DialogTitle className="font-serif text-left">
              Ajouter à l'écran d'accueil
            </DialogTitle>
            <DialogDescription className="text-left">
              Sur iPhone, l'installation se fait depuis Safari en trois
              gestes. Elle débloque aussi les notifications.
            </DialogDescription>
          </DialogHeader>

          <div className="pt-1">
            <EtapesIOS />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
