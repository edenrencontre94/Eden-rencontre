import { useState } from "react";
import { Flag, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { REPORT_REASONS, motifErrorMessage, type ReportReason } from "@/lib/motifs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

/**
 * Signalement avec motif obligatoire.
 *
 * `reportUser()` était appelé sans motif depuis /demandes et /messages :
 * la modération recevait « quelqu'un a signalé quelqu'un », sans savoir
 * quoi vérifier ni quelle urgence accorder. Un signalement pour « personne
 * mineure » et un pour « propos déplacés » n'appellent pas le même délai
 * de traitement.
 */
export function ReportDialog({
  open,
  onOpenChange,
  reportedId,
  reportedName,
  context = "profile",
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  reportedId: string;
  reportedName?: string;
  context?: "profile" | "message" | "community_post" | "call";
  onDone?: () => void;
}) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);

  const needsDetails = reason === "autre";
  const canSend = reason !== null && (!needsDetails || details.trim().length >= 10);

  const submit = async () => {
    if (!reason) return;
    setSending(true);
    try {
      const { error } = await supabase.rpc("submit_report", {
        p_reported_id: reportedId,
        p_reason: reason,
        p_details: details.trim() || null,
        p_context: context,
      });
      if (error) throw error;

      toast.success("Signalement transmis", {
        description: reason === "mineur"
          ? "Ce signalement est traité en priorité absolue."
          : "Notre équipe examine chaque signalement.",
      });
      setReason(null);
      setDetails("");
      onOpenChange(false);
      onDone?.();
    } catch (err: any) {
      console.error("[signalement]", err);
      toast.error(motifErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!sending) onOpenChange(o); }}>
      <DialogContent className="rounded-2xl max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif flex items-center gap-2">
            <Flag className="w-5 h-5 text-destructive" />
            Signaler {reportedName ? reportedName : "ce membre"}
          </DialogTitle>
          <DialogDescription>
            Votre signalement est confidentiel. La personne concernée n'en est
            pas informée.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {REPORT_REASONS.map(r => (
            <button
              key={r.key}
              onClick={() => setReason(r.key)}
              className={`w-full text-left rounded-xl border p-3 transition-colors ${
                reason === r.key
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-secondary/50"
              }`}
            >
              <div className="flex items-start gap-2.5">
                <span
                  className={`mt-1 w-3.5 h-3.5 rounded-full border-2 shrink-0 ${
                    reason === r.key ? "border-primary bg-primary" : "border-muted-foreground/40"
                  }`}
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{r.label}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{r.hint}</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Le champ libre s'ouvre pour tous les motifs, pas seulement
            « Autre » : un détail concret aide à trancher, même quand la
            catégorie est claire. Il n'est obligatoire que pour « Autre ». */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Précisions {needsDetails ? "(obligatoires)" : "(facultatives)"}
          </label>
          <textarea
            value={details}
            onChange={e => setDetails(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Ce que vous avez observé, une date, un message reçu…"
            className="mt-1.5 w-full px-3 py-2.5 rounded-xl bg-background border border-border text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          {needsDetails && details.trim().length < 10 && (
            <p className="text-[11px] text-muted-foreground mt-1">
              Au moins 10 caractères — « Autre » sans explication n'aide personne.
            </p>
          )}
        </div>

        {reason === "mineur" && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 flex gap-2.5">
            <ShieldAlert className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed">
              Ce signalement est traité en priorité absolue. Si vous pensez
              qu'un mineur est en danger, contactez également les autorités
              locales.
            </p>
          </div>
        )}

        <DialogFooter className="gap-2">
          <button
            onClick={() => onOpenChange(false)}
            disabled={sending}
            className="px-4 py-2 rounded-xl border border-border text-sm hover:bg-secondary disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            onClick={submit}
            disabled={!canSend || sending}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-destructive text-destructive-foreground text-sm font-semibold disabled:opacity-50"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Flag className="w-4 h-4" />}
            Envoyer le signalement
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
