import { ShieldAlert, Mail, MessageCircle } from "lucide-react";
import logo from "@/assets/logo.png";
import { supabase } from "@/lib/supabase";
import { useNavigate } from "@tanstack/react-router";
import { useSupportContact } from "@/components/SupportContact";

/**
 * Écran affiché à un compte suspendu.
 *
 * Le MOTIF est communiqué, et l'échéance aussi. Une suspension muette
 * produit un ticket furieux et une réputation détestable ; expliquée, une
 * partie des cas se règle sans intervention.
 *
 * Le recours reste ouvert : une sanction sans voie d'appel est une erreur
 * qu'on ne peut plus corriger.
 */
export function SuspendedScreen({ until, reason, permanent }: {
  until?: string | null;
  reason?: string | null;
  permanent?: boolean;
}) {
  const navigate = useNavigate();
  const { email, wa } = useSupportContact();

  const finLisible = until && !permanent
    ? new Date(until).toLocaleDateString("fr-FR", {
        day: "numeric", month: "long", year: "numeric",
      })
    : null;

  const sujet = encodeURIComponent("Contestation d'une suspension de compte");
  const message = encodeURIComponent(
    "Bonjour, mon compte Eden Rencontre est suspendu et je souhaite en discuter.",
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/30 flex items-center justify-center px-6 py-12">
      <div className="max-w-md w-full text-center">
        <img src={logo} alt="Eden Rencontre" className="w-14 h-14 object-contain mx-auto" />

        <div className="mt-6 w-14 h-14 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
          <ShieldAlert className="w-7 h-7" />
        </div>

        <h1 className="mt-5 text-2xl font-serif font-bold">Compte suspendu</h1>

        <p className="mt-3 text-muted-foreground leading-relaxed">
          {permanent
            ? "L'accès à votre compte a été suspendu par notre équipe."
            : finLisible
              ? `L'accès à votre compte est suspendu jusqu'au ${finLisible}.`
              : "L'accès à votre compte est temporairement suspendu."}
        </p>

        {reason && (
          <div className="mt-5 rounded-2xl border border-border bg-card p-4 text-left">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Motif
            </p>
            <p className="text-sm mt-1.5 leading-relaxed">{reason}</p>
          </div>
        )}

        <div className="mt-5 rounded-2xl bg-secondary/60 p-4 text-left">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Vos conversations, votre profil et votre abonnement sont conservés.
            {!permanent && " Ils vous seront rendus à la levée de la suspension."}
          </p>
        </div>

        {/* La voie de recours est offerte, pas seulement mentionnée. */}
        {(email || wa) && (
          <>
            <p className="mt-6 text-sm font-medium">
              Vous pensez qu'il s'agit d'une erreur ?
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2.5">
              {wa && (
                <a
                  href={`${wa}?text=${message}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors"
                >
                  <MessageCircle className="w-4 h-4" /> Nous écrire
                </a>
              )}
              {email && (
                <a
                  href={`mailto:${email}?subject=${sujet}`}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-card text-sm font-semibold hover:bg-secondary transition-colors"
                >
                  <Mail className="w-4 h-4" /> Par e-mail
                </a>
              )}
            </div>
          </>
        )}

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
