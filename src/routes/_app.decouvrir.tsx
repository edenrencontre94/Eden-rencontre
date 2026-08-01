import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion, useMotionValue, useTransform, AnimatePresence } from "motion/react";
import { useEffect, useState, useMemo, useRef } from "react";
import { supabase } from "@/lib/supabase";
import {
  X,
  Heart,
  Star,
  Undo2,
  Zap,
  CheckCircle2,
  Crown,
  MapPin,
  Church,
  BookOpen,
  Info,
  SlidersHorizontal,
  Sparkles,
  MessageCircle,
  UserPlus
} from "lucide-react";
import { type Profile } from "@/lib/mock-data";
import { toast } from "sonner";
import { useSubscription } from "@/lib/subscription";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_app/decouvrir")({
  head: () => ({
    meta: [
      { title: "Découvrir — AgapeMeet" },
      { name: "description", content: "Swipez et découvrez des profils compatibles." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DiscoverPage,
});

function DiscoverPage() {
  const [deck, setDeck] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [history, setHistory] = useState<{ id: string; action: string }[]>([]);
  const [detail, setDetail] = useState<Profile | null>(null);
  
  // Filtres
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    onlineOnly: false,
    verifiedOnly: false,
    distance: 50,
    city: "",
    denomination: "",
  });
  const [userProfile, setUserProfile] = useState<any>(null);

  const navigate = useNavigate();
  const { superLikesLeft, boostsLeft, consumeSuperLike, consumeBoost } = useSubscription();
  const [showMessageModal, setShowMessageModal] = useState<Profile | null>(null);
  const [messageText, setMessageText] = useState("");

  const upsell = (message: string) => {
    toast.error(message, {
      action: { label: "Voir les formules", onClick: () => navigate({ to: "/abonnement" }) },
    });
  };

  const current = deck[index];
  const next = deck[index + 1];

  useEffect(() => {
    async function loadProfiles() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }

        // Get user profile for seeking_gender
        const { data: currentUserData } = await supabase.from('profiles').select('seeking_gender').eq('id', user.id).single();
        if (currentUserData) {
          setUserProfile(currentUserData);
        }

        const { data: swipesData } = await supabase
          .from('swipes')
          .select('target_id')
          .eq('swiper_id', user.id);
        
        const swipedIds = swipesData?.map((s: any) => s.target_id) || [];

        let query = supabase
          .from('profiles')
          .select('*')
          .neq('id', user.id)
          .limit(100); // Fetch more so we can filter locally

        if (swipedIds.length > 0) {
          query = query.not('id', 'in', `(${swipedIds.join(',')})`);
        }
        
        // Sexe recherché de base
        if (currentUserData && currentUserData.seeking_gender && currentUserData.seeking_gender !== "all") {
          query = query.eq('gender', currentUserData.seeking_gender);
        }

        const { data, error } = await query;
        if (error) throw error;

        if (data) {
          const formatted: Profile[] = data.map((p: any) => ({
            id: p.id,
            firstName: p.first_name || "Membre",
            age: p.birth_date ? new Date().getFullYear() - new Date(p.birth_date).getFullYear() : 25,
            city: p.city || "Ville inconnue",
            country: p.country || "",
            denomination: p.denomination || "Non précisé",
            compatibility: Math.floor(Math.random() * 20) + 80,
            verified: p.is_verified || false,
            premium: false,
            lastActive: "Récemment",
            photo: p.photos && p.photos.length > 0 ? p.photos[0] : 'https://placehold.co/400x600/1a1a2e/gold?text=😊',
            photos: p.photos || [],
            bio: p.bio || "Pas de bio.",
            profession: "Profession non précisée",
            education: "Études",
            height: "1m70",
            languages: ["Français"],
            interests: [],
            passions: [],
            marriageVision: p.marriage_intent || "",
            favoriteVerse: "",
            church: p.church_attendance || "",
            faithImportance: p.practice_level || "",
            // No mock online status
            online: false
          }));
          setDeck(formatted);
        }
      } catch (err) {
        console.error("Erreur chargement profils:", err);
      } finally {
        setLoading(false);
      }
    }
    loadProfiles();
  }, []);

  // Application des filtres côté client
  const filteredDeck = useMemo(() => {
    return deck.filter(p => {
      if (filters.onlineOnly && !(p as any).online) return false;
      if (filters.verifiedOnly && !p.verified) return false;
      if (filters.city && !p.city.toLowerCase().includes(filters.city.toLowerCase())) return false;
      if (filters.denomination && p.denomination.toLowerCase() !== filters.denomination.toLowerCase()) return false;
      // Distance is mocked visually for now
      return true;
    });
  }, [deck, filters]);

  const currentFiltered = filteredDeck[index];
  const nextFiltered = filteredDeck[index + 1];

  useEffect(() => {
    async function logVisit() {
      if (!currentFiltered) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (user && user.id !== currentFiltered.id) {
        await supabase.from('profile_visits').upsert({
          visitor_id: user.id,
          visited_id: currentFiltered.id,
          created_at: new Date().toISOString()
        }, { onConflict: 'visitor_id,visited_id' });
      }
    }
    const timer = setTimeout(logVisit, 1500); // Only log if they look at it for 1.5s
    return () => clearTimeout(timer);
  }, [currentFiltered?.id]);

  const swipe = async (action: "left" | "right" | "super") => {
    if (!currentFiltered) return;
    if (action === "super" && !consumeSuperLike()) {
      upsell("Plus de Super Likes aujourd'hui");
      return;
    }
    setHistory((h) => [...h, { id: currentFiltered.id, action }]);
    if (action === "right") toast.success(`Vous aimez ${currentFiltered.firstName}`);
    if (action === "super") toast.success(`Super Like envoyé à ${currentFiltered.firstName} ⭐`);
    setIndex((i) => i + 1);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const dbAction = action === "left" ? "pass" : action === "right" ? "like" : "superlike";
        await supabase.from('swipes').insert({
          swiper_id: user.id,
          target_id: currentFiltered.id,
          action: dbAction
        });

        if (dbAction === 'like' || dbAction === 'superlike') {
          const { data: matchCheck } = await supabase
            .from('swipes')
            .select('id')
            .eq('swiper_id', currentFiltered.id)
            .eq('target_id', user.id)
            .in('action', ['like', 'superlike'])
            .maybeSingle();

          if (matchCheck) {
            toast.success(`C'est un match avec ${currentFiltered.firstName} ! 🎉`, { duration: 5000 });
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const rewind = () => {
    if (history.length === 0) {
      toast.info("Rien à annuler");
      return;
    }
    setHistory((h) => h.slice(0, -1));
    setIndex((i) => Math.max(0, i - 1));
    toast.info("Action annulée");
  };

  const boost = () => {
    if (!consumeBoost()) {
      upsell("Boost réservé aux membres Alliance");
      return;
    }
    toast.success("Boost activé pour 30 minutes ⚡");
  };

  // ── Message pré-match ──
  const sendPreMatchMessage = async () => {
    if (!showMessageModal || !messageText.trim()) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      // Enregistrer le like + message dans la table swipes
      await supabase.from('swipes').insert({
        swiper_id: user.id,
        target_id: showMessageModal.id,
        action: 'like',
        message: messageText.trim()
      }).select();
      toast.success(`Message envoyé à ${showMessageModal.firstName} ! 💌`);
      setHistory(h => [...h, { id: showMessageModal.id, action: 'right' }]);
      setIndex(i => i + 1);
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de l'envoi");
    } finally {
      setShowMessageModal(null);
      setMessageText("");
    }
  };

  // ── Ajouter aux contacts ──
  const addContact = async () => {
    if (!currentFiltered) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('swipes').insert({
        swiper_id: user.id,
        target_id: currentFiltered.id,
        action: 'like'
      });
      setHistory(h => [...h, { id: currentFiltered.id, action: 'right' }]);
      setIndex(i => i + 1);
      toast.success(`${currentFiltered.firstName} ajouté(e) à vos contacts ! 👤`);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="px-4 pt-4 relative">
      <div className="flex items-center justify-between mb-4">
        <div className="text-left">
          <h1 className="font-serif text-2xl font-semibold">Découvrir</h1>
          <p className="text-xs text-muted-foreground">Trouvez votre âme sœur</p>
        </div>
        <button 
          onClick={() => setShowFilters(true)}
          className="w-10 h-10 rounded-full bg-secondary text-foreground flex items-center justify-center hover:bg-secondary/80 transition-colors shadow-sm"
        >
          <SlidersHorizontal className="w-5 h-5" />
        </button>
      </div>
      
      <div className="text-center mb-4">
        <div className="inline-flex items-center gap-3 px-3 py-1 rounded-full bg-secondary/60 border border-border/60 text-[11px] font-medium">
          <span className="inline-flex items-center gap-1">
            <Star className="w-3 h-3 text-primary" fill="currentColor" />
            {superLikesLeft === -1 ? "∞" : superLikesLeft} Super Likes
          </span>
          <span className="w-px h-3 bg-border" />
          <span className="inline-flex items-center gap-1">
            <Zap className="w-3 h-3 text-gold" />
            {boostsLeft === -1 ? "∞" : boostsLeft} Boosts
          </span>
        </div>
      </div>

      <div className="relative h-[560px] max-h-[70vh] w-full mx-auto max-w-md">
        {loading ? (
          <div className="absolute inset-0 rounded-3xl bg-secondary animate-pulse flex items-center justify-center border border-border">
            <span className="text-muted-foreground font-medium">Recherche de profils...</span>
          </div>
        ) : filteredDeck.length === 0 || !currentFiltered ? (
          <div className="absolute inset-0 rounded-3xl bg-card border-2 border-dashed border-border flex flex-col items-center justify-center p-8 text-center shadow-soft">
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-serif text-xl font-semibold mb-2">Plus aucun profil</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Vous avez vu tous les profils correspondant à vos critères pour le moment.
            </p>
            <button
              onClick={() => setIndex(0)}
              className="px-6 py-2 rounded-full bg-primary text-primary-foreground font-semibold text-sm shadow-elegant"
            >
              Revoir depuis le début
            </button>
          </div>
        ) : (
          <AnimatePresence>
            {nextFiltered && (
              <SwipeCard
                key={nextFiltered.id}
                profile={nextFiltered}
                active={false}
                onSwipe={() => {}}
                onDetail={() => setDetail(nextFiltered)}
              />
            )}
            {currentFiltered && (
              <SwipeCard
                key={currentFiltered.id}
                profile={currentFiltered}
                active={true}
                onSwipe={swipe}
                onDetail={() => setDetail(currentFiltered)}
              />
            )}
          </AnimatePresence>
        )}
      </div>

      <div className="flex items-center justify-center gap-3 mt-8 mb-4 max-w-[400px] mx-auto">
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={rewind}
            className="w-12 h-12 rounded-full border-2 border-gold bg-background flex items-center justify-center text-gold hover:bg-gold/10 transition-transform active:scale-95 shadow-sm"
          >
            <Undo2 className="w-5 h-5" />
          </button>
          <span className="text-[10px] text-muted-foreground font-medium">Retour</span>
        </div>
        
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={() => swipe("left")}
            className="w-14 h-14 rounded-full border-2 border-muted-foreground/50 bg-background flex items-center justify-center text-muted-foreground hover:bg-muted/50 transition-transform active:scale-95 shadow-sm"
          >
            <X className="w-6 h-6" />
          </button>
          <span className="text-[10px] text-muted-foreground font-medium">Passer</span>
        </div>

        <div className="flex flex-col items-center gap-1">
          <button
            onClick={() => swipe("super")}
            className="w-14 h-14 rounded-full border-2 border-primary bg-background flex items-center justify-center text-primary hover:bg-primary/10 transition-transform active:scale-95 shadow-sm"
          >
            <Star className="w-6 h-6" fill="currentColor" />
          </button>
          <span className="text-[10px] text-primary font-medium">Super like</span>
        </div>

        <div className="flex flex-col items-center gap-1">
          <button
            onClick={() => swipe("right")}
            className="w-[72px] h-[72px] rounded-full border-2 border-gold bg-background shadow-[0_4px_15px_var(--color-gold)]/30 flex items-center justify-center text-gold hover:scale-105 hover:bg-gold/10 transition-all active:scale-95"
          >
            <Heart className="w-9 h-9" fill="currentColor" />
          </button>
          <span className="text-[10px] text-gold font-medium">J'adore</span>
        </div>

        <div className="flex flex-col items-center gap-1">
          <button
            onClick={() => currentFiltered ? setShowMessageModal(currentFiltered) : toast.info("Chargement…")}
            className="w-14 h-14 rounded-full border-2 border-primary/60 bg-background flex items-center justify-center text-primary/80 hover:bg-primary/10 transition-transform active:scale-95 shadow-sm"
          >
            <MessageCircle className="w-6 h-6" />
          </button>
          <span className="text-[10px] text-muted-foreground font-medium">Message</span>
        </div>

        <div className="flex flex-col items-center gap-1">
          <button
            onClick={addContact}
            className="w-12 h-12 rounded-full border-2 border-primary/80 bg-background flex items-center justify-center text-primary hover:bg-primary/10 transition-transform active:scale-95 shadow-sm"
          >
            <UserPlus className="w-5 h-5" />
          </button>
          <span className="text-[10px] text-muted-foreground font-medium">Ajouter</span>
        </div>
      </div>

      {/* Modal message pré-match */}
      <AnimatePresence>
        {showMessageModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm"
              onClick={() => { setShowMessageModal(null); setMessageText(""); }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed inset-x-4 bottom-24 z-50 bg-card border border-border rounded-3xl p-5 shadow-elegant"
            >
              <div className="flex items-center gap-3 mb-4">
                <img src={showMessageModal.photo} className="w-12 h-12 rounded-full object-cover" alt="" />
                <div>
                  <div className="font-semibold">{showMessageModal.firstName}, {showMessageModal.age}</div>
                  <div className="text-xs text-muted-foreground">Envoyer un message pour briser la glace ✨</div>
                </div>
              </div>
              <textarea
                value={messageText}
                onChange={e => setMessageText(e.target.value)}
                placeholder={`Dites bonjour à ${showMessageModal.firstName}…`}
                rows={3}
                className="w-full px-4 py-3 rounded-2xl bg-secondary border border-border resize-none text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => { setShowMessageModal(null); setMessageText(""); }}
                  className="flex-1 py-2.5 rounded-full border border-border text-sm font-medium hover:bg-secondary"
                >
                  Annuler
                </button>
                <button
                  onClick={sendPreMatchMessage}
                  disabled={!messageText.trim()}
                  className="flex-1 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-semibold shadow-elegant disabled:opacity-40"
                >
                  Envoyer 💌
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {detail && <ProfileDetailModal profile={detail} onClose={() => setDetail(null)} />}
      </AnimatePresence>

      {/* FILTRES DRAWER */}
      <AnimatePresence>
        {showFilters && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm"
              onClick={() => setShowFilters(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 z-50 bg-background rounded-t-[32px] p-6 max-h-[90vh] overflow-y-auto shadow-[0_-10px_40px_rgba(0,0,0,0.1)]"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-serif text-2xl font-semibold">Filtres</h3>
                <button onClick={() => setShowFilters(false)} className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <Label htmlFor="online" className="text-base cursor-pointer">En ligne actuellement</Label>
                  <Switch 
                    id="online" 
                    checked={filters.onlineOnly} 
                    onCheckedChange={(c) => setFilters(f => ({ ...f, onlineOnly: c }))} 
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="verified" className="text-base flex items-center gap-2 cursor-pointer">
                    Profils vérifiés <CheckCircle2 className="w-4 h-4 text-blue-500" />
                  </Label>
                  <Switch 
                    id="verified" 
                    checked={filters.verifiedOnly} 
                    onCheckedChange={(c) => setFilters(f => ({ ...f, verifiedOnly: c }))} 
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <Label className="text-base">Distance maximale (km)</Label>
                    <span className="font-bold text-primary">{filters.distance} km</span>
                  </div>
                  <input 
                    type="range" 
                    min="1" 
                    max="100" 
                    value={filters.distance} 
                    onChange={(e) => setFilters(f => ({ ...f, distance: parseInt(e.target.value) }))}
                    className="w-full accent-primary" 
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-base">Ville</Label>
                  <Input 
                    placeholder="Ex: Paris" 
                    value={filters.city} 
                    onChange={(e) => setFilters(f => ({ ...f, city: e.target.value }))} 
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-base">Confession / Dénomination</Label>
                  <select 
                    value={filters.denomination} 
                    onChange={(e) => setFilters(f => ({ ...f, denomination: e.target.value }))}
                    className="w-full h-11 px-3 py-2 rounded-xl border border-input bg-background text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-transparent transition-all"
                  >
                    <option value="">Toutes les confessions</option>
                    <option value="catholique">Catholique</option>
                    <option value="protestant">Protestant</option>
                    <option value="evangelique">Évangélique</option>
                    <option value="orthodoxe">Orthodoxe</option>
                    <option value="autre">Autre</option>
                  </select>
                </div>
                
                <button 
                  onClick={() => setShowFilters(false)}
                  className="w-full py-3.5 rounded-full bg-primary text-primary-foreground font-semibold shadow-elegant mt-4 hover:bg-primary/90 transition-colors"
                >
                  Appliquer les filtres
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function SwipeCard({
  profile,
  active,
  onSwipe,
  onDetail,
}: {
  profile: Profile;
  active: boolean;
  onSwipe: (dir: "left" | "right" | "super") => void;
  onDetail: () => void;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-10, 10]);
  const opacity = useTransform(x, [-200, -150, 0, 150, 200], [0, 1, 1, 1, 0]);

  const swipeLeftOpacity = useTransform(x, [-50, -150], [0, 1]);
  const swipeRightOpacity = useTransform(x, [50, 150], [0, 1]);

  return (
    <motion.div
      style={active ? { x, rotate, opacity } : {}}
      drag={active ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={(e, { offset, velocity }) => {
        const swipeThreshold = 100;
        if (offset.x > swipeThreshold) onSwipe("right");
        else if (offset.x < -swipeThreshold) onSwipe("left");
      }}
      className={`absolute inset-0 rounded-3xl overflow-hidden bg-card shadow-elegant border border-border/40 ${
        active ? "z-20 cursor-grab active:cursor-grabbing" : "z-10 scale-[0.98] opacity-80"
      }`}
    >
      <img src={profile.photo} alt={profile.firstName} className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/10" />

      {active && (
        <>
          <motion.div style={{ opacity: swipeLeftOpacity }} className="absolute top-12 right-8 z-30">
            <div className="border-4 border-destructive text-destructive font-black text-4xl px-4 py-2 rounded-xl rotate-12 bg-black/40 backdrop-blur-sm">
              NOPE
            </div>
          </motion.div>
          <motion.div style={{ opacity: swipeRightOpacity }} className="absolute top-12 left-8 z-30">
            <div className="border-4 border-primary text-primary font-black text-4xl px-4 py-2 rounded-xl -rotate-12 bg-black/40 backdrop-blur-sm">
              LIKE
            </div>
          </motion.div>
        </>
      )}

      <div className="absolute inset-x-0 bottom-0 p-6 text-white pointer-events-none">
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-semibold">
            {profile.compatibility}% Compatible
          </span>
          {profile.verified && (
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-500 text-white shadow-soft">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </span>
          )}
          {(profile as any).online && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/80 backdrop-blur-md text-[10px] font-bold shadow-soft">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> En ligne
            </span>
          )}
        </div>
        <h2 className="font-serif text-3xl font-bold flex items-baseline gap-2 text-shadow-sm">
          {profile.firstName}, {profile.age}
        </h2>
        <div className="flex flex-col gap-1 mt-2 text-sm opacity-90 text-shadow-sm">
          <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {profile.city}</div>
          <div className="flex items-center gap-1.5"><Church className="w-3.5 h-3.5" /> {profile.denomination}</div>
          <div className="flex items-center gap-1.5 opacity-80"><BookOpen className="w-3.5 h-3.5" /> {profile.bio.substring(0, 50)}...</div>
        </div>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onDetail(); }}
        className="absolute bottom-6 right-6 w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/30 transition-colors z-40 pointer-events-auto"
        aria-label="Voir le profil"
      >
        <Info className="w-5 h-5" />
      </button>
    </motion.div>
  );
}

function ProfileDetailModal({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm overflow-y-auto"
    >
      <div className="min-h-full max-w-md mx-auto bg-background relative pb-24 shadow-2xl">
        <div className="relative aspect-[3/4] md:aspect-[4/5]">
          <img src={profile.photo} alt={profile.firstName} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/40 backdrop-blur flex items-center justify-center text-white"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="absolute bottom-0 inset-x-0 p-6 pb-2">
            <h2 className="font-serif text-4xl font-bold flex items-center gap-2">
              {profile.firstName}, {profile.age}
              {profile.verified && <CheckCircle2 className="w-6 h-6 text-blue-500" />}
            </h2>
            <div className="flex items-center gap-2 text-muted-foreground mt-1 text-sm font-medium">
              <span>{profile.city}</span>
              <span>•</span>
              <span className="text-primary">{profile.compatibility}% Compatible</span>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-8">
          <section>
            <h3 className="font-serif text-lg font-semibold mb-3 flex items-center gap-2">
              <Church className="w-5 h-5 text-primary" /> Foi & Vision
            </h3>
            <div className="space-y-3 bg-secondary/30 p-4 rounded-2xl border border-border/50">
              <div><span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Dénomination</span><p className="font-medium">{profile.denomination}</p></div>
              <div><span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Vision du mariage</span><p className="font-medium text-sm leading-relaxed">{profile.marriageVision}</p></div>
            </div>
          </section>
          <section>
            <h3 className="font-serif text-lg font-semibold mb-2">À propos</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{profile.bio}</p>
          </section>
          {profile.photos.length > 1 && (
            <section>
              <h3 className="font-serif text-lg font-semibold mb-3">Photos</h3>
              <div className="grid grid-cols-2 gap-3">
                {profile.photos.slice(1).map((photo, i) => (
                  <img key={i} src={photo} alt="" className="w-full aspect-[3/4] object-cover rounded-2xl shadow-sm" />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </motion.div>
  );
}
