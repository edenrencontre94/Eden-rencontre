import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "motion/react";
import { useState, useRef, useMemo, type ReactElement } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Heart,
  Church,
  Search,
  Camera,
  Upload,
  X,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import logoAsset from "@/assets/agapemeet-logo.png.asset.json";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

type Photo = { id: string; url: string; name: string };

// ---------- Gender icons (primary blue) ----------
function ManIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <circle cx="32" cy="14" r="8" fill="currentColor" />
      <path
        d="M20 46c0-8 5.4-14 12-14s12 6 12 14v10h-6V44h-2v18h-8V44h-2v12h-6V46z"
        fill="currentColor"
      />
    </svg>
  );
}
function WomanIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <circle cx="32" cy="14" r="8" fill="currentColor" />
      <path
        d="M32 22c-6.5 0-11 4.5-12.5 11L15 46h8l1.5-10h1L22 62h8l1.2-16h1.6L34 62h8l-3.5-26h1L41 46h8l-4.5-13C43 26.5 38.5 22 32 22z"
        fill="currentColor"
      />
    </svg>
  );
}

function GenderChoice({
  active,
  onClick,
  label,
  icon: Icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: (props: { className?: string }) => ReactElement;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex flex-col items-center justify-center gap-2 rounded-2xl border-2 py-5 px-4 transition-all ${
        active
          ? "border-primary bg-primary/5 shadow-elegant"
          : "border-border hover:border-primary/40 bg-background"
      }`}
      aria-pressed={active}
    >
      <Icon
        className={`w-10 h-10 transition-colors ${
          active ? "text-primary" : "text-primary/60 group-hover:text-primary"
        }`}
      />
      <span
        className={`text-sm font-medium ${
          active ? "text-foreground" : "text-muted-foreground"
        }`}
      >
        {label}
      </span>
    </button>
  );
}

type OnboardingData = {
  firstName: string;
  source: string;
  lastName: string;
  birthDate: string;
  gender: string;
  city: string;
  country: string;
  bio: string;
  denomination: string;
  practiceLevel: string;
  baptized: string;
  churchAttendance: string;
  seekingGender: string;
  ageRange: [number, number];
  distance: number;
  marriageIntent: string;
  wantsChildren: string;
  photos: Photo[];
};

const initialData: OnboardingData = {
  firstName: "",
  source: "",
  lastName: "",
  birthDate: "",
  gender: "",
  city: "",
  country: "",
  bio: "",
  denomination: "",
  practiceLevel: "",
  baptized: "",
  churchAttendance: "",
  seekingGender: "",
  ageRange: [22, 35],
  distance: 50,
  marriageIntent: "",
  wantsChildren: "",
  photos: [],
};

const steps = [
  { id: 1, title: "Profil", subtitle: "Faisons connaissance", icon: Heart },
  { id: 2, title: "Foi", subtitle: "Votre confession", icon: Church },
  { id: 3, title: "Recherche", subtitle: "Vos critères", icon: Search },
  { id: 4, title: "Photos", subtitle: "Montrez-vous", icon: Camera },
];

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Créer votre profil — AgapeMeet" },
      {
        name: "description",
        content:
          "Créez votre profil AgapeMeet en 4 étapes : identité, foi, critères de recherche et photos. Une rencontre chrétienne sérieuse commence ici.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Créer votre profil — AgapeMeet" },
      {
        property: "og:description",
        content:
          "Rejoignez AgapeMeet et créez votre profil en 4 étapes simples.",
      },
    ],
  }),
  component: OnboardingPage,
});

function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<OnboardingData>(initialData);
  const [submitted, setSubmitted] = useState(false);

  const update = <K extends keyof OnboardingData>(
    key: K,
    value: OnboardingData[K],
  ) => setData((d) => ({ ...d, [key]: value }));

  const canNext = useMemo(() => {
    if (step === 1)
      return (
        data.firstName.trim().length >= 2 &&
        data.lastName.trim().length >= 2 &&
        data.birthDate !== "" &&
        data.gender !== "" &&
        data.city.trim().length >= 2 &&
        data.country !== ""
      );
    if (step === 2)
      return (
        data.denomination !== "" &&
        data.practiceLevel !== "" &&
        data.baptized !== "" &&
        data.churchAttendance !== ""
      );
    if (step === 3)
      return (
        data.seekingGender !== "" &&
        data.marriageIntent !== "" &&
        data.wantsChildren !== ""
      );
    if (step === 4) return data.photos.length >= 2;
    return false;
  }, [step, data]);

  const progress = (step / steps.length) * 100;

  const handleNext = () => {
    if (!canNext) {
      toast.error("Veuillez compléter tous les champs requis");
      return;
    }
    if (step < 4) setStep(step + 1);
    else {
      try {
        localStorage.setItem(
          "agapemeet_onboarding",
          JSON.stringify({ ...data, photos: data.photos.map((p) => p.name) }),
        );
      } catch {}
      setSubmitted(true);
      toast.success("Profil créé avec succès !");
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  if (submitted) return <SuccessScreen data={data} />;
  if (!data.source)
    return (
      <SourceScreen
        onSelect={(s) => update("source", s)}
      />
    );

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-secondary/30">
      {/* Header */}
      <header className="border-b border-border/40 backdrop-blur-md bg-background/80 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <img src={logoAsset.url} alt="AgapeMeet" className="w-10 h-10 object-contain" />
            <span className="font-serif text-xl font-semibold">AgapeMeet</span>
          </Link>
          <span className="text-sm text-muted-foreground">
            Étape {step} <span className="text-foreground/40">/ 4</span>
          </span>
        </div>
      </header>

      {/* Progress */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-8">
        <div className="hidden sm:flex items-center justify-between mb-6">
          {steps.map((s, i) => {
            const active = step === s.id;
            const done = step > s.id;
            const Icon = s.icon;
            return (
              <div key={s.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all ${
                      done
                        ? "bg-primary border-primary text-primary-foreground"
                        : active
                          ? "bg-background border-primary text-primary shadow-elegant scale-110"
                          : "bg-background border-border text-muted-foreground"
                    }`}
                  >
                    {done ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                  </div>
                  <div className="mt-2 text-center">
                    <div
                      className={`text-sm font-medium ${active ? "text-foreground" : "text-muted-foreground"}`}
                    >
                      {s.title}
                    </div>
                    <div className="text-xs text-muted-foreground hidden md:block">
                      {s.subtitle}
                    </div>
                  </div>
                </div>
                {i < steps.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-2 mb-6 transition-colors ${
                      done ? "bg-primary" : "bg-border"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
        <div className="sm:hidden mb-6">
          <Progress value={progress} className="h-2" />
          <div className="mt-2 text-sm text-muted-foreground">
            {steps[step - 1].title} — {steps[step - 1].subtitle}
          </div>
        </div>
      </div>

      {/* Card */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 pb-24">
        <div className="bg-card rounded-3xl shadow-elegant border border-border/50 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.25 }}
              className="p-6 sm:p-10"
            >
              {step === 1 && <StepProfile data={data} update={update} />}
              {step === 2 && <StepFaith data={data} update={update} />}
              {step === 3 && <StepSearch data={data} update={update} />}
              {step === 4 && <StepPhotos data={data} update={update} />}
            </motion.div>
          </AnimatePresence>

          {/* Nav */}
          <div className="px-6 sm:px-10 py-5 border-t border-border/50 bg-secondary/30 flex items-center justify-between">
            <Button
              type="button"
              variant="ghost"
              onClick={handleBack}
              disabled={step === 1}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Retour
            </Button>
            <Button
              type="button"
              onClick={handleNext}
              size="lg"
              className="gap-2 bg-gradient-to-r from-primary to-primary/80 hover:opacity-95 shadow-elegant"
            >
              {step === 4 ? "Terminer" : "Continuer"}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Vos informations sont confidentielles et servent uniquement à vous
          proposer des profils compatibles.
        </p>
      </main>
    </div>
  );
}

// ---------- Step 1 : Profile ----------
function StepProfile({
  data,
  update,
}: {
  data: OnboardingData;
  update: <K extends keyof OnboardingData>(k: K, v: OnboardingData[K]) => void;
}) {
  return (
    <div>
      <StepHeader
        eyebrow="Étape 1"
        title="Créez votre profil"
        description="Ces informations apparaîtront sur votre profil."
      />
      <div className="grid sm:grid-cols-2 gap-5 mt-8">
        <Field label="Prénom" htmlFor="firstName">
          <Input
            id="firstName"
            maxLength={50}
            value={data.firstName}
            onChange={(e) => update("firstName", e.target.value)}
            placeholder="Marie"
          />
        </Field>
        <Field label="Nom" htmlFor="lastName">
          <Input
            id="lastName"
            maxLength={50}
            value={data.lastName}
            onChange={(e) => update("lastName", e.target.value)}
            placeholder="Dupont"
          />
        </Field>
        <Field label="Date de naissance" htmlFor="birthDate">
          <Input
            id="birthDate"
            type="date"
            value={data.birthDate}
            max={new Date(
              new Date().setFullYear(new Date().getFullYear() - 18),
            )
              .toISOString()
              .split("T")[0]}
            onChange={(e) => update("birthDate", e.target.value)}
          />
        </Field>
        <Field label="Genre">
          <div className="grid grid-cols-2 gap-3">
            <GenderChoice
              active={data.gender === "femme"}
              onClick={() => update("gender", "femme")}
              label="Femme"
              icon={WomanIcon}
            />
            <GenderChoice
              active={data.gender === "homme"}
              onClick={() => update("gender", "homme")}
              label="Homme"
              icon={ManIcon}
            />
          </div>
        </Field>
        <Field label="Ville" htmlFor="city">
          <Input
            id="city"
            maxLength={80}
            value={data.city}
            onChange={(e) => update("city", e.target.value)}
            placeholder="Abidjan"
          />
        </Field>
        <Field label="Pays" htmlFor="country">
          <Select value={data.country} onValueChange={(v) => update("country", v)}>
            <SelectTrigger id="country">
              <SelectValue placeholder="Sélectionner" />
            </SelectTrigger>
            <SelectContent>
              {[
                "Côte d'Ivoire",
                "Sénégal",
                "Cameroun",
                "Bénin",
                "Togo",
                "Mali",
                "Burkina Faso",
                "Gabon",
                "Congo",
                "RD Congo",
                "Rwanda",
                "France",
                "Belgique",
                "Canada",
                "Suisse",
                "Autre",
              ].map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Présentation (optionnel)" htmlFor="bio">
            <Textarea
              id="bio"
              maxLength={500}
              value={data.bio}
              onChange={(e) => update("bio", e.target.value)}
              placeholder="Parlez de vous, vos passions, votre foi, ce que vous recherchez..."
              rows={4}
            />
            <div className="text-xs text-muted-foreground text-right mt-1">
              {data.bio.length}/500
            </div>
          </Field>
        </div>
      </div>
    </div>
  );
}

// ---------- Step 2 : Faith ----------
function StepFaith({
  data,
  update,
}: {
  data: OnboardingData;
  update: <K extends keyof OnboardingData>(k: K, v: OnboardingData[K]) => void;
}) {
  const denominations = [
    "Catholique",
    "Protestant Évangélique",
    "Pentecôtiste",
    "Baptiste",
    "Méthodiste",
    "Adventiste",
    "Orthodoxe",
    "Non-dénominationnel",
    "Autre",
  ];
  return (
    <div>
      <StepHeader
        eyebrow="Étape 2"
        title="Votre foi"
        description="Le cœur de votre profil : votre relation avec Dieu."
      />
      <div className="grid gap-6 mt-8">
        <Field label="Confession / Dénomination">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {denominations.map((d) => (
              <ChoiceChip
                key={d}
                active={data.denomination === d}
                onClick={() => update("denomination", d)}
                label={d}
              />
            ))}
          </div>
        </Field>

        <Field label="Niveau de pratique">
          <div className="grid sm:grid-cols-2 gap-2">
            {[
              { v: "tres-pratiquant", l: "Très pratiquant" },
              { v: "pratiquant", l: "Pratiquant" },
              { v: "croyant", l: "Croyant, peu pratiquant" },
              { v: "en-recherche", l: "En recherche spirituelle" },
            ].map((o) => (
              <ChoiceChip
                key={o.v}
                active={data.practiceLevel === o.v}
                onClick={() => update("practiceLevel", o.v)}
                label={o.l}
              />
            ))}
          </div>
        </Field>

        <div className="grid sm:grid-cols-2 gap-5">
          <Field label="Baptisé(e) ?">
            <div className="grid grid-cols-2 gap-2">
              {[
                { v: "oui", l: "Oui" },
                { v: "non", l: "Non" },
              ].map((o) => (
                <ChoiceChip
                  key={o.v}
                  active={data.baptized === o.v}
                  onClick={() => update("baptized", o.v)}
                  label={o.l}
                />
              ))}
            </div>
          </Field>
          <Field label="Fréquence à l'église">
            <Select
              value={data.churchAttendance}
              onValueChange={(v) => update("churchAttendance", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="plusieurs-semaine">Plusieurs fois / semaine</SelectItem>
                <SelectItem value="hebdo">Chaque semaine</SelectItem>
                <SelectItem value="mensuel">Quelques fois par mois</SelectItem>
                <SelectItem value="occasionnel">Occasionnellement</SelectItem>
                <SelectItem value="rarement">Rarement</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
      </div>
    </div>
  );
}

// ---------- Step 3 : Search ----------
function StepSearch({
  data,
  update,
}: {
  data: OnboardingData;
  update: <K extends keyof OnboardingData>(k: K, v: OnboardingData[K]) => void;
}) {
  return (
    <div>
      <StepHeader
        eyebrow="Étape 3"
        title="Vos critères de recherche"
        description="Aidez-nous à vous proposer les profils les plus compatibles."
      />
      <div className="grid gap-6 mt-8">
        <Field label="Je recherche">
          <div className="grid grid-cols-2 gap-3">
            <GenderChoice
              active={data.seekingGender === "femme"}
              onClick={() => update("seekingGender", "femme")}
              label="Une femme"
              icon={WomanIcon}
            />
            <GenderChoice
              active={data.seekingGender === "homme"}
              onClick={() => update("seekingGender", "homme")}
              label="Un homme"
              icon={ManIcon}
            />
          </div>
        </Field>

        <Field
          label={`Tranche d'âge : ${data.ageRange[0]} – ${data.ageRange[1]} ans`}
        >
          <div className="px-2 pt-3">
            <Slider
              min={18}
              max={70}
              step={1}
              value={data.ageRange}
              onValueChange={(v) => update("ageRange", [v[0], v[1]] as [number, number])}
            />
          </div>
        </Field>

        <Field label={`Distance maximale : ${data.distance} km`}>
          <div className="px-2 pt-3">
            <Slider
              min={5}
              max={500}
              step={5}
              value={[data.distance]}
              onValueChange={(v) => update("distance", v[0])}
            />
          </div>
        </Field>

        <Field label="Intention par rapport au mariage">
          <div className="grid sm:grid-cols-3 gap-2">
            {[
              { v: "1-2ans", l: "Dans 1 à 2 ans" },
              { v: "2-5ans", l: "Dans 2 à 5 ans" },
              { v: "ouvert", l: "Ouvert, sans échéance" },
            ].map((o) => (
              <ChoiceChip
                key={o.v}
                active={data.marriageIntent === o.v}
                onClick={() => update("marriageIntent", o.v)}
                label={o.l}
              />
            ))}
          </div>
        </Field>

        <Field label="Souhaitez-vous des enfants ?">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { v: "oui", l: "Oui" },
              { v: "peut-etre", l: "Peut-être" },
              { v: "deja", l: "J'en ai déjà" },
              { v: "non", l: "Non" },
            ].map((o) => (
              <ChoiceChip
                key={o.v}
                active={data.wantsChildren === o.v}
                onClick={() => update("wantsChildren", o.v)}
                label={o.l}
              />
            ))}
          </div>
        </Field>
      </div>
    </div>
  );
}

// ---------- Step 4 : Photos ----------
function StepPhotos({
  data,
  update,
}: {
  data: OnboardingData;
  update: <K extends keyof OnboardingData>(k: K, v: OnboardingData[K]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const MAX = 6;
  const GenderAvatar =
    data.gender === "femme" ? WomanIcon : data.gender === "homme" ? ManIcon : null;

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files);
    const remaining = MAX - data.photos.length;
    if (remaining <= 0) {
      toast.error(`Vous ne pouvez ajouter que ${MAX} photos maximum.`);
      return;
    }
    const toAdd = arr.slice(0, remaining);
    const readers = toAdd.map(
      (file) =>
        new Promise<Photo>((resolve, reject) => {
          if (!file.type.startsWith("image/")) {
            reject(new Error("Type de fichier invalide"));
            return;
          }
          if (file.size > 8 * 1024 * 1024) {
            reject(new Error("Fichier trop volumineux (max 8 Mo)"));
            return;
          }
          const r = new FileReader();
          r.onload = () =>
            resolve({
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              url: String(r.result),
              name: file.name,
            });
          r.onerror = () => reject(new Error("Lecture impossible"));
          r.readAsDataURL(file);
        }),
    );
    Promise.allSettled(readers).then((results) => {
      const ok = results
        .filter(
          (r): r is PromiseFulfilledResult<Photo> => r.status === "fulfilled",
        )
        .map((r) => r.value);
      const failed = results.filter((r) => r.status === "rejected");
      if (ok.length) update("photos", [...data.photos, ...ok]);
      if (failed.length) toast.error(`${failed.length} fichier(s) ignoré(s)`);
    });
  };

  const remove = (id: string) =>
    update(
      "photos",
      data.photos.filter((p) => p.id !== id),
    );

  return (
    <div>
      <StepHeader
        eyebrow="Étape 4"
        title="Ajoutez vos photos"
        description="Minimum 2 photos, jusqu'à 6. La première sera votre photo principale."
      />

      <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 gap-4">
        {data.photos.length === 0 && GenderAvatar && (
          <div className="relative aspect-[3/4] rounded-2xl overflow-hidden border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-secondary/40 flex flex-col items-center justify-center gap-3">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center ring-4 ring-primary/10">
              <GenderAvatar className="w-10 h-10 text-primary" />
            </div>
            <span className="text-xs font-medium text-primary/80">
              Aperçu de profil
            </span>
            <span className="absolute top-2 left-2 text-[10px] font-semibold px-2 py-1 rounded-full bg-primary/10 text-primary">
              Placeholder
            </span>
          </div>
        )}
        {data.photos.map((p, i) => (
          <div
            key={p.id}
            className="relative aspect-[3/4] rounded-2xl overflow-hidden group border border-border/60"
          >
            <img
              src={p.url}
              alt={`Photo ${i + 1}`}
              className="w-full h-full object-cover"
            />
            {i === 0 && (
              <div className="absolute top-2 left-2 text-xs font-semibold px-2 py-1 rounded-full bg-primary text-primary-foreground shadow-elegant">
                Principale
              </div>
            )}
            <button
              type="button"
              aria-label="Supprimer la photo"
              onClick={() => remove(p.id)}
              className="absolute top-2 right-2 w-8 h-8 rounded-full bg-background/90 hover:bg-background flex items-center justify-center shadow-soft transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}

        {data.photos.length < MAX && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="aspect-[3/4] rounded-2xl border-2 border-dashed border-border hover:border-primary hover:bg-secondary/40 transition-all flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary"
          >
            <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
              <Upload className="w-5 h-5" />
            </div>
            <span className="text-sm font-medium">Ajouter</span>
            <span className="text-xs">{data.photos.length}/{MAX}</span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <div className="mt-6 rounded-xl bg-secondary/50 border border-border/50 p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground mb-1">Conseils pour vos photos</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Un portrait clair et souriant en photo principale.</li>
          <li>Des photos récentes qui vous ressemblent.</li>
          <li>Pas de lunettes de soleil sur toutes vos photos.</li>
        </ul>
      </div>
    </div>
  );
}

// ---------- Success ----------
function SuccessScreen({ data }: { data: OnboardingData }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-b from-background to-secondary/40">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-lg w-full bg-card rounded-3xl shadow-elegant border border-border/50 p-10 text-center"
      >
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary/70 mx-auto flex items-center justify-center shadow-elegant">
          <Sparkles className="w-10 h-10 text-primary-foreground" />
        </div>
        <h1 className="font-serif text-3xl mt-6">
          Bienvenue{data.firstName ? `, ${data.firstName}` : ""} !
        </h1>
        <p className="text-muted-foreground mt-3">
          Votre profil AgapeMeet est prêt. Nous préparons vos premières
          suggestions de compatibilité.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/">
            <Button size="lg" variant="outline" className="w-full sm:w-auto">
              Retour à l'accueil
            </Button>
          </Link>
          <Link to="/app">
            <Button
              size="lg"
              className="bg-gradient-to-r from-primary to-primary/80 shadow-elegant w-full sm:w-auto"
            >
              Découvrir des profils
            </Button>
          </Link>
        </div>
      </motion.div>
    </div>
  );
}

// ---------- Shared ----------
function StepHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center sm:text-left">
      <div className="text-xs uppercase tracking-widest text-primary font-semibold">
        {eyebrow}
      </div>
      <h2 className="font-serif text-3xl sm:text-4xl mt-2">{title}</h2>
      <p className="text-muted-foreground mt-2">{description}</p>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={htmlFor} className="mb-2 block text-sm font-medium">
        {label}
      </Label>
      {children}
    </div>
  );
}

function ChoiceChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-3 rounded-xl text-sm font-medium border transition-all text-left ${
        active
          ? "border-primary bg-primary/5 text-foreground shadow-soft"
          : "border-border bg-background hover:border-primary/40 hover:bg-secondary/40 text-foreground/80"
      }`}
    >
      <span className="flex items-center justify-between gap-2">
        {label}
        {active && <Check className="w-4 h-4 text-primary shrink-0" />}
      </span>
    </button>
  );
}