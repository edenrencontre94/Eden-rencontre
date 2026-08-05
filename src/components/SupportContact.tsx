import { MessageCircle, Mail } from "lucide-react";
import { useSetting } from "@/lib/appSettings";

/**
 * Coordonnées de l'assistance, réglées dans /admin/parametres.
 *
 * Un composant unique pour les trois emplacements — pied de page, tunnel de
 * paiement, page d'aide. Dupliquer le balisage aurait garanti qu'un jour le
 * numéro soit corrigé à deux endroits sur trois.
 *
 * Le numéro n'est jamais affiché : seul un bouton l'est. Une suite de
 * chiffres invite à recopier à la main — et à se tromper ; un bouton ouvre
 * la conversation.
 */

/** wa.me n'accepte que des chiffres : ni « + », ni espaces, ni tirets. */
function waLink(raw?: string) {
  const digits = (raw ?? "").replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : null;
}

export function useSupportContact() {
  const email = useSetting<string>("support_email", "");
  const whatsapp = useSetting<string>("support_whatsapp", "");
  const hours = useSetting<string>("support_hours", "");
  const responseTime = useSetting<string>("support_response_time", "");
  return { email, whatsapp, wa: waLink(whatsapp), hours, responseTime };
}

/** Bouton WhatsApp seul. `message` préremplit la conversation. */
export function WhatsAppButton({
  message,
  label = "Écrire sur WhatsApp",
  className = "",
  compact,
}: {
  message?: string;
  label?: string;
  className?: string;
  compact?: boolean;
}) {
  const { wa } = useSupportContact();
  if (!wa) return null;

  // Le message prérempli évite au membre d'avoir à tout réexpliquer, et
  // nous arrive avec le contexte : sans lui, la moitié des conversations
  // commencent par « bonjour » puis un silence.
  const href = message ? `${wa}?text=${encodeURIComponent(message)}` : wa;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={
        className ||
        `inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition-colors ${
          compact ? "px-3.5 py-2 text-sm" : "px-5 py-3"
        }`
      }
    >
      <MessageCircle className={compact ? "w-4 h-4" : "w-5 h-5"} />
      {label}
    </a>
  );
}

/** Bouton e-mail seul. */
export function EmailButton({
  subject,
  label,
  compact,
}: {
  subject?: string;
  label?: string;
  compact?: boolean;
}) {
  const { email } = useSupportContact();
  if (!email) return null;

  const href = subject ? `mailto:${email}?subject=${encodeURIComponent(subject)}` : `mailto:${email}`;

  return (
    <a
      href={href}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card font-semibold hover:bg-secondary transition-colors ${
        compact ? "px-3.5 py-2 text-sm" : "px-5 py-3"
      }`}
    >
      <Mail className={compact ? "w-4 h-4" : "w-5 h-5"} />
      {label ?? email}
    </a>
  );
}

/**
 * Bloc complet : les deux canaux, plus horaires et délai annoncé.
 * Un canal dont le réglage est vide n'apparaît pas — annoncer une adresse
 * que personne ne relève est pire que de n'en annoncer aucune.
 */
export function SupportContactBlock({
  title = "Un souci ? Parlons-en",
  description,
  message,
  subject,
  compact,
}: {
  title?: string;
  description?: string;
  message?: string;
  subject?: string;
  compact?: boolean;
}) {
  const { email, wa, hours, responseTime } = useSupportContact();
  if (!email && !wa) return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="font-serif font-semibold">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{description}</p>
      )}

      <div className="mt-4 flex flex-wrap gap-2.5">
        <WhatsAppButton message={message} compact={compact} />
        <EmailButton subject={subject} label="Envoyer un e-mail" compact={compact} />
      </div>

      {(hours || responseTime) && (
        <p className="text-[11px] text-muted-foreground mt-3.5 pt-3.5 border-t border-border/60">
          {[hours, responseTime].filter(Boolean).join(" · ")}
        </p>
      )}
    </div>
  );
}
