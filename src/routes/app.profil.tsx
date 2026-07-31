import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Save, Camera, X, Upload, Trash2, ArrowLeft } from "lucide-react";
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
  const [userId, setUserId] = useState<string | null>(null);

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    bio: "",
    city: "",
    country: "",
    birth_date: "",
    gender: "",
    denomination: "",
    practice_level: "",
    baptized: "",
    church_attendance: "",
    seeking_gender: "",
    marriage_intent: "",
    has_children: "",
    wants_children: "",
    photos: [] as string[],
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate({ to: "/login" });
        return;
      }
      setUserId(user.id);
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (data) {
        setForm({
          first_name: data.first_name || "",
          last_name: data.last_name || "",
          bio: data.bio || "",
          city: data.city || "",
          country: data.country || "",
          birth_date: data.birth_date || "",
          gender: data.gender || "",
          denomination: data.denomination || "",
          practice_level: data.practice_level || "",
          baptized: data.baptized || "",
          church_attendance: data.church_attendance || "",
          seeking_gender: data.seeking_gender || "all",
          marriage_intent: data.marriage_intent || "",
          has_children: data.has_children || "",
          wants_children: data.wants_children || "",
          photos: data.photos || [],
        });
      }
      setLoading(false);
    }
    load();
  }, [navigate]);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (!userId) return;
      
      const { error } = await supabase.from('profiles').update({
        first_name: form.first_name,
        last_name: form.last_name,
        bio: form.bio,
        city: form.city,
        country: form.country,
        birth_date: form.birth_date,
        gender: form.gender,
        denomination: form.denomination,
        practice_level: form.practice_level,
        baptized: form.baptized,
        church_attendance: form.church_attendance,
        seeking_gender: form.seeking_gender,
        marriage_intent: form.marriage_intent,
        has_children: form.has_children,
        wants_children: form.wants_children,
        photos: form.photos,
      }).eq('id', userId);

      if (error) throw error;
      toast.success("Profil mis à jour !");
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de la mise à jour");
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !userId) return;
    const file = e.target.files[0];
    
    // Quick validation
    if (!file.type.startsWith('image/')) {
      toast.error("Veuillez sélectionner une image valide.");
      return;
    }
    
    setUploadingImage(true);
    toast.info("Upload en cours...", { id: "uploading" });
    
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const filePath = `${userId}/${Date.now()}.${ext}`;
      
      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(filePath, file, { contentType: file.type });
        
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('photos').getPublicUrl(filePath);
      
      const newPhotos = [...form.photos, publicUrlData.publicUrl];
      setForm({ ...form, photos: newPhotos });
      
      // Auto-save photos
      await supabase.from('profiles').update({ photos: newPhotos }).eq('id', userId);
      
      toast.success("Photo ajoutée avec succès");
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de l'upload de l'image");
    } finally {
      toast.dismiss("uploading");
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removePhoto = async (index: number) => {
    if (!userId) return;
    const newPhotos = [...form.photos];
    newPhotos.splice(index, 1);
    setForm({ ...form, photos: newPhotos });
    
    try {
      await supabase.from('profiles').update({ photos: newPhotos }).eq('id', userId);
      toast.success("Photo supprimée");
    } catch (err) {
      toast.error("Erreur lors de la suppression");
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-pulse">Chargement...</div></div>;
  }

  return (
    <div className="px-4 pt-4 pb-12 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate({ to: "/app" })} className="w-10 h-10 rounded-full border border-border flex items-center justify-center hover:bg-secondary transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-serif text-2xl font-semibold">Mon Profil</h1>
      </div>
      
      {/* PHOTOS SECTION */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-3">Mes Photos</h2>
        <div className="grid grid-cols-3 gap-2">
          {form.photos.map((photo, idx) => (
            <div key={idx} className="relative aspect-[3/4] rounded-xl overflow-hidden bg-secondary">
              <img src={photo} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
              {idx === 0 && (
                <div className="absolute bottom-1 left-1 bg-primary/90 text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded backdrop-blur-sm">
                  PROFIL
                </div>
              )}
              <button 
                onClick={() => removePhoto(idx)}
                className="absolute top-1 right-1 w-6 h-6 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-destructive transition-colors backdrop-blur-sm"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          {form.photos.length < 6 && (
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingImage}
              className="aspect-[3/4] rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 hover:bg-secondary/50 hover:border-primary/50 transition-all text-muted-foreground"
            >
              {uploadingImage ? <span className="animate-spin text-xl">↻</span> : <Camera className="w-6 h-6" />}
              <span className="text-xs font-medium">Ajouter</span>
            </button>
          )}
        </div>
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handlePhotoUpload} 
          accept="image/*" 
          className="hidden" 
        />
        <p className="text-xs text-muted-foreground mt-2">La première photo est votre photo principale.</p>
      </div>

      <div className="space-y-6 bg-card border border-border/50 rounded-3xl p-5 sm:p-6 mb-6 shadow-soft">
        
        {/* IDENTITÉ */}
        <div className="space-y-4">
          <h3 className="font-serif text-lg font-medium text-primary">Identité</h3>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Prénom</label>
              <Input 
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Nom</label>
              <Input 
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
              />
            </div>
          </div>
          
          <div>
            <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Date de naissance</label>
            <Input 
              type="date"
              value={form.birth_date}
              onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Ville</label>
              <Input 
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Pays</label>
              <Input 
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
              />
            </div>
          </div>
          
          <div>
            <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Genre</label>
            <select 
              value={form.gender}
              onChange={(e) => setForm({ ...form, gender: e.target.value })}
              className="w-full h-10 px-3 py-2 rounded-xl border border-input bg-background text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">Non précisé</option>
              <option value="male">Homme</option>
              <option value="female">Femme</option>
            </select>
          </div>
        </div>

        <div className="h-px bg-border/50 w-full" />

        {/* À PROPOS */}
        <div className="space-y-4">
          <h3 className="font-serif text-lg font-medium text-primary">À propos de moi</h3>
          <div>
            <Textarea 
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              className="w-full min-h-[100px] text-sm resize-none rounded-xl"
              placeholder="Décrivez-vous, parlez de vos passions, de votre foi..."
            />
          </div>
        </div>

        <div className="h-px bg-border/50 w-full" />

        {/* FOI */}
        <div className="space-y-4">
          <h3 className="font-serif text-lg font-medium text-primary">Foi & Pratique</h3>
          
          <div>
            <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Confession / Dénomination</label>
            <select 
              value={form.denomination}
              onChange={(e) => setForm({ ...form, denomination: e.target.value })}
              className="w-full h-10 px-3 py-2 rounded-xl border border-input bg-background text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
            <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Niveau de pratique</label>
            <select 
              value={form.practice_level}
              onChange={(e) => setForm({ ...form, practice_level: e.target.value })}
              className="w-full h-10 px-3 py-2 rounded-xl border border-input bg-background text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">Non précisé</option>
              <option value="pratiquant">Pratiquant régulier</option>
              <option value="occasionnel">Occasionnel</option>
              <option value="croyant">Croyant non pratiquant</option>
              <option value="decouverte">En découverte</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Êtes-vous baptisé(e) ?</label>
            <select 
              value={form.baptized}
              onChange={(e) => setForm({ ...form, baptized: e.target.value })}
              className="w-full h-10 px-3 py-2 rounded-xl border border-input bg-background text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">Non précisé</option>
              <option value="oui">Oui</option>
              <option value="non">Non</option>
              <option value="prevu">Prévu prochainement</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Fréquentation de l'église</label>
            <select 
              value={form.church_attendance}
              onChange={(e) => setForm({ ...form, church_attendance: e.target.value })}
              className="w-full h-10 px-3 py-2 rounded-xl border border-input bg-background text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">Non précisé</option>
              <option value="hebdomadaire">Toutes les semaines</option>
              <option value="mensuel">Quelques fois par mois</option>
              <option value="fetes">Seulement aux fêtes</option>
              <option value="jamais">Presque jamais</option>
            </select>
          </div>
        </div>

        <div className="h-px bg-border/50 w-full" />

        {/* RECHERCHE */}
        <div className="space-y-4">
          <h3 className="font-serif text-lg font-medium text-primary">Critères & Intentions</h3>
          
          <div>
            <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Je recherche</label>
            <select 
              value={form.seeking_gender}
              onChange={(e) => setForm({ ...form, seeking_gender: e.target.value })}
              className="w-full h-10 px-3 py-2 rounded-xl border border-input bg-background text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="all">Peu importe</option>
              <option value="female">Des femmes</option>
              <option value="male">Des hommes</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Intention de mariage</label>
            <select 
              value={form.marriage_intent}
              onChange={(e) => setForm({ ...form, marriage_intent: e.target.value })}
              className="w-full h-10 px-3 py-2 rounded-xl border border-input bg-background text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">Non précisé</option>
              <option value="serieux">Je cherche le mariage</option>
              <option value="ouvert">Je suis ouvert(e) à l'idée</option>
              <option value="pas_maintenant">Pas pour le moment</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Avez-vous des enfants ?</label>
            <select 
              value={form.has_children}
              onChange={(e) => setForm({ ...form, has_children: e.target.value })}
              className="w-full h-10 px-3 py-2 rounded-xl border border-input bg-background text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">Non précisé</option>
              <option value="oui">Oui</option>
              <option value="non">Non</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Voulez-vous des enfants ?</label>
            <select 
              value={form.wants_children}
              onChange={(e) => setForm({ ...form, wants_children: e.target.value })}
              className="w-full h-10 px-3 py-2 rounded-xl border border-input bg-background text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">Non précisé</option>
              <option value="oui">Oui</option>
              <option value="non">Non</option>
              <option value="ouvert">Je suis ouvert(e)</option>
              <option value="plus">Pas d'autres enfants</option>
            </select>
          </div>
        </div>

      </div>

      <div className="sticky bottom-20 z-10 pt-2 pb-4 bg-gradient-to-t from-background via-background to-transparent">
        <button 
          onClick={handleSave}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 h-14 rounded-2xl bg-primary text-primary-foreground font-semibold shadow-[0_8px_30px_rgb(0,0,0,0.12)] shadow-primary/20 hover:bg-primary/90 transition-colors"
        >
          {saving ? <span className="animate-spin text-xl">↻</span> : <Save className="w-5 h-5" />}
          Enregistrer toutes les modifications
        </button>
      </div>

    </div>
  );
}
