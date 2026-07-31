import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { LogOut, Save, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/app/profil")({
  head: () => ({
    meta: [{ title: "Mon Profil — AgapeMeet" }],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<any>(null);

  const [form, setForm] = useState({
    bio: "",
    city: "",
    denomination: "",
    seeking_gender: "",
  });

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate({ to: "/login" });
        return;
      }
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (data) {
        setProfile(data);
        setForm({
          bio: data.bio || "",
          city: data.city || "",
          denomination: data.denomination || "",
          seeking_gender: data.seeking_gender || "all",
        });
      }
      setLoading(false);
    }
    load();
  }, [navigate]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { error } = await supabase.from('profiles').update({
        bio: form.bio,
        city: form.city,
        denomination: form.denomination,
        seeking_gender: form.seeking_gender,
      }).eq('id', user.id);

      if (error) throw error;
      toast.success("Profil mis à jour !");
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de la mise à jour");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Chargement...</div>;
  }

  return (
    <div className="px-4 pt-4 pb-12">
      <h1 className="font-serif text-2xl font-semibold mb-6">Mon Profil</h1>
      
      {profile && (
        <div className="flex flex-col items-center mb-8">
          <img 
            src={profile.photos?.[0] || "https://placehold.co/400x600/1a1a2e/gold?text=😊"} 
            alt="Profil" 
            className="w-24 h-24 rounded-full object-cover border-4 border-background shadow-lg mb-3"
          />
          <h2 className="text-xl font-bold">{profile.first_name}</h2>
          <p className="text-sm text-muted-foreground">{profile.city}</p>
        </div>
      )}

      <div className="space-y-5 bg-card border border-border/50 rounded-2xl p-4 mb-6 shadow-soft">
        <div>
          <label className="block text-sm font-semibold mb-1">À propos de moi</label>
          <Textarea 
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            className="w-full min-h-[100px] text-sm"
          />
        </div>
        
        <div>
          <label className="block text-sm font-semibold mb-1">Ville</label>
          <Input 
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
            className="text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1">Confession / Dénomination</label>
          <select 
            value={form.denomination}
            onChange={(e) => setForm({ ...form, denomination: e.target.value })}
            className="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="">Non précisé</option>
            <option value="catholique">Catholique</option>
            <option value="protestant">Protestant</option>
            <option value="evangelique">Évangélique</option>
            <option value="orthodoxe">Orthodoxe</option>
            <option value="autre">Autre</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1">Sexe recherché</label>
          <select 
            value={form.seeking_gender}
            onChange={(e) => setForm({ ...form, seeking_gender: e.target.value })}
            className="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="all">Tout le monde</option>
            <option value="female">Femmes</option>
            <option value="male">Hommes</option>
          </select>
        </div>

        <button 
          onClick={handleSave}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-3 mt-4 rounded-xl bg-primary text-primary-foreground font-semibold shadow-elegant"
        >
          {saving ? <span className="animate-spin text-xl">↻</span> : <Save className="w-5 h-5" />}
          Enregistrer les modifications
        </button>
      </div>

      <button 
        onClick={handleLogout}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-destructive/10 text-destructive font-semibold hover:bg-destructive/20 transition-colors"
      >
        <LogOut className="w-5 h-5" />
        Se déconnecter
      </button>
    </div>
  );
}
