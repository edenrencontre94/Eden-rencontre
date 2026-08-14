import { Wrench } from "lucide-react";
import logo from "@/assets/logo.png";
import { supabase } from "@/lib/supabase";
import { useNavigate } from "@tanstack/react-router";
import { useSetting } from "@/lib/appSettings";

/**
 * Affiché lorsque le mode maintenance est actif.
 *
 * Le bouton de déconnexion est délibérément conservé : sans lui, un membre
 * dont la session pose problème resterait bloqué sur cet écran sans aucun
 * recours, y compris après la fin de la maintenance.
 */
const DEFAULT_MESSAGE =
  "Nous améliorons Eden Rencontre en ce moment même. L'application sera de nouveau " +
  "accessible d'ici peu – vos conversations et votre profil sont intacts.";

export function MaintenanceScreen() {
  const navigate = useNavigate();
  const message = useSetting<string>("maintenance_message", DEFAULT_MESSAGE);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/30 flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <img src={logo} alt="Eden Rencontre" className="w-14 h-14 object-contain mx-auto" />

        <div className="mt-6 w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
          <Wrench className="w-7 h-7" />
        </div>

        <h1 className="mt-5 text-2xl font-serif font-bold">Maintenance en cours</h1>

        <p className="mt-3 text-muted-foreground leading-relaxed whitespace-pre-line">
          {message ?? DEFAULT_MESSAGE}
        </p>

        <p className="mt-6 text-sm text-muted-foreground">
          « Il y a un temps pour tout, un temps pour toute chose sous les cieux. »
          <span className="block mt-1 text-xs">Ecclésiaste 3.1</span>
        </p>

        <button
          onClick={async () => {
            await supabase.auth.signOut();
            navigate({ to: "/login" });
          }}
          className="mt-8 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors"
        >
          Se déconnecter
        </button>
      </div>
    </div>
  );
}
