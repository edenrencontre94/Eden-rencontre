import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Heart, User, Check, X, ShieldAlert } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import { toast } from "sonner";
import { ReportDialog } from "@/components/app/ReportDialog";
import {
  dismissLike,
  fetchBlockedIds,
  fetchDismissedIds,
} from "@/lib/moderation";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app/demandes")({
  head: () => ({
    meta: [
      { title: "Demandes — Eden Rencontre" },
      { name: "description", content: "Vos demandes en attente." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RequestsPage,
});

type RequestEntry = {
  id: string;
  actor_id: string;
  action: "like" | "super_like";
  created_at: string;
  profile: {
    id: string;
    first_name: string;
    last_name: string | null;
    birth_date: string | null;
    city: string | null;
    photos: string[] | null;
  };
};

function getAge(birthDate: string | null) {
  if (!birthDate) return 0;
  const b = new Date(birthDate);
  if (Number.isNaN(b.getTime())) return 0;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age > 0 && age < 120 ? age : 0;
}

function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "a l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `il y a ${days} j`;
  return `le ${new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}`;
}

function RequestsPage() {
  const [requests, setRequests] = useState<RequestEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [reportTarget, setReportTarget] = useState<{ id: string; name?: string } | null>(null);

  useEffect(() => {
    async function loadRequests() {
      setLoading(true);
      try {
        const user = await getCurrentUser();
        if (!user) return;

        const [
          { data: swipesData },
          blockedIds,
          dismissedIds,
          { data: matchesData },
        ] = await Promise.all([
          supabase
            .from("swipes")
            .select("id, actor_id, action, created_at, profiles!swipes_actor_id_fkey(id, first_name, last_name, birth_date, city, photos)")
            .eq("target_id", user.id)
            .in("action", ["like", "super_like"])
            .order("created_at", { ascending: false }),
          fetchBlockedIds(),
          fetchDismissedIds(),
          supabase
            .from("matches")
            .select("user1_id, user2_id")
            .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`),
        ]);

        const hidden = new Set([...blockedIds, ...dismissedIds]);
        const matchedIds = new Set(
          (matchesData ?? []).map((m: any) =>
            m.user1_id === user.id ? m.user2_id : m.user1_id,
          ),
        );

        if (swipesData) {
          const allRequests = swipesData
            .filter((s: any) => !hidden.has(s.actor_id) && !matchedIds.has(s.actor_id))
            .map((s: any) => ({
              id: s.id,
              actor_id: s.actor_id,
              action: s.action as "like" | "super_like",
              created_at: s.created_at,
              profile: s.profiles,
            }));
          setRequests(allRequests);
        }
      } catch (err) {
        console.error("Erreur chargement demandes:", err);
        toast.error("Impossible de charger les demandes");
      } finally {
        setLoading(false);
      }
    }
    loadRequests();
  }, []);

  const removeRequest = (id: string) => {
    setRequests((prev) => prev.filter((r) => r.id !== id));
  };

  const markProcessing = (id: string, val: boolean) => {
    setProcessingIds((prev) => {
      const next = new Set(prev);
      val ? next.add(id) : next.delete(id);
      return next;
    });
  };

  const acceptRequest = async (entry: RequestEntry) => {
    if (processingIds.has(entry.id)) return;
    markProcessing(entry.id, true);
    removeRequest(entry.id);

    const user = await getCurrentUser();
    if (!user) { markProcessing(entry.id, false); return; }

    const { error } = await supabase.from("swipes").upsert(
      { actor_id: user.id, target_id: entry.actor_id, action: "like" },
      { onConflict: "actor_id,target_id" },
    );

    if (error) {
      console.error("[demandes] acceptation:", error);
      toast.error("Erreur lors de l'acceptation, veuillez reessayer");
      setRequests((prev) => [entry, ...prev]);
    } else {
      toast.success(`C'est un match avec ${entry.profile?.first_name} !`);
    }
    markProcessing(entry.id, false);
  };

  const declineRequest = async (entry: RequestEntry) => {
    if (processingIds.has(entry.id)) return;
    markProcessing(entry.id, true);
    removeRequest(entry.id);

    const ok = await dismissLike(entry.actor_id);
    if (!ok) {
      toast.error("Erreur lors du refus");
      setRequests((prev) => [entry, ...prev]);
    }
    markProcessing(entry.id, false);
  };

  const handleReport = (entry: RequestEntry) => {
    setReportTarget({ id: entry.actor_id, name: entry.profile?.first_name ?? undefined });
  };

  return (
    <div className="min-h-screen bg-background pb-20 pt-6 px-4 max-w-2xl mx-auto flex flex-col">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold font-serif text-foreground">Demandes</h1>
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
          <Heart className="w-6 h-6 fill-current" />
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : requests.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-card rounded-2xl border border-border shadow-sm">
          <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-6">
            <Heart className="w-10 h-10 text-muted-foreground/50" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Aucune demande</h2>
          <p className="text-muted-foreground">
            Continuez a utiliser l'application pour recevoir de nouvelles demandes de connexion.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AnimatePresence>
            {requests.map((req) => (
              <motion.div
                key={req.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.2 } }}
                className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm flex flex-col relative"
              >
                <div className="relative h-64 w-full bg-muted overflow-hidden">
                  {req.profile?.photos?.[0] ? (
                    <img src={req.profile.photos[0]} alt={req.profile.first_name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-purple-500/20">
                      <User className="w-16 h-16 text-primary/50" />
                    </div>
                  )}

                  {req.action === "super_like" && (
                    <div className="absolute top-3 left-3 bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 shadow-md z-10">
                      Super Like
                    </div>
                  )}

                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 pt-12 z-10">
                    <h3 className="text-white font-bold text-xl drop-shadow-md">
                      {req.profile?.first_name}{getAge(req.profile?.birth_date) > 0 ? `, ${getAge(req.profile?.birth_date)}` : ""}
                    </h3>
                    <p className="text-white/80 text-sm mt-1">
                      {req.profile?.city || "Ville inconnue"} {String.fromCharCode(8226)} {timeAgo(req.created_at)}
                    </p>
                  </div>
                </div>

                <div className="p-4 flex gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="flex-1 h-12 rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20"
                    onClick={() => declineRequest(req)}
                  >
                    <X className="w-6 h-6" />
                  </Button>
                  <Button
                    variant="default"
                    size="icon"
                    className="flex-1 h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
                    onClick={() => acceptRequest(req)}
                  >
                    <Check className="w-6 h-6" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-12 w-12 rounded-xl text-muted-foreground hover:text-foreground"
                    onClick={() => handleReport(req)}
                    title="Signaler ou bloquer"
                  >
                    <ShieldAlert className="w-5 h-5" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {reportTarget && (
        <ReportDialog
          open={!!reportTarget}
          onOpenChange={(o) => { if (!o) setReportTarget(null); }}
          reportedId={reportTarget.id}
          reportedName={reportTarget.name}
        />
      )}
    </div>
  );
}
