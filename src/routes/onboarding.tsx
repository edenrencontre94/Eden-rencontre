import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "motion/react";
import { useState, useEffect, useRef, useMemo, type ReactElement } from "react";
import { Heart, Search, Camera, Church, ArrowRight, ArrowLeft, Upload, X, Sparkles, Check } from "lucide-react";
import { Music2, Instagram, Facebook, Youtube, Users, MoreHorizontal, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import logoAsset from "@/assets/logo.png";
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
import { PaysSelect, VilleSelect } from "@/components/app/PaysVilleSelect";
import { DENOMINATIONS_CONNUES, MARITAL_STATUSES } from "@/lib/profilChamps";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { getSessionUser } from "@/lib/auth";
import { useTranslation } from "@/lib/i18n";
import type { TranslationKey } from "@/locales/translations";

type Photo = { id: string; url: string; name: string };

// ---------- Gender icons (primary blue) ----------
function ManIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      {/* Head + shoulders silhouette with short hair */}
      <path
        d="M20 22c0-7 5.5-13 12-13s12 6 12 13c0 2-.4 4-1 6 1 .5 1.5 1.5 1.5 2.5 0 1.5-1 3-2.5 3.5C40.5 39 36.8 43 32 43s-8.5-4-10-9c-1.5-.5-2.5-2-2.5-3.5 0-1 .5-2 1.5-2.5-.6-2-1-4-1-6z"
        fill="currentColor"
      />
      <path
        d="M14 58c0-8 7-14 18-14s18 6 18 14v2H14v-2z"
        fill="currentColor"
      />
    </svg>
  );
}
function WomanIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      {/* Head + shoulders silhouette with long hair */}
      <path
        d="M18 34c0-3 1-5 2.5-6.5C19.5 26 19 24 19 22c0-8 5.8-14 13-14s13 6 13 14c0 2-.5 4-1.5 5.5C45 29 46 31 46 34c0 2-1 4-3 5-1.4 5-5.6 8.5-11 8.5s-9.6-3.5-11-8.5c-2-1-3-3-3-5z"
        fill="currentColor"
      />
      <path
        d="M14 60c0-9 8-15 18-15s18 6 18 15H14z"
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
  source: string;
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
  maritalStatus: string;
  marriageIntent: string;
  hasChildren: string;
  wantsChildren: string;
  photos: Photo[];
};

const initialData: OnboardingData = {
  source: "",
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
  maritalStatus: "",
  marriageIntent: "",
  hasChildren: "",
  wantsChildren: "",
  photos: [],
};

const stepDefs: { id: number; titleKey: TranslationKey; subKey: TranslationKey; icon: any }[] = [
  { id: 1, titleKey: "onboarding.step1_title", subKey: "onboarding.step1_sub", icon: Heart },
  { id: 2, titleKey: "onboarding.step2_title", subKey: "onboarding.step2_sub", icon: Church },
  { id: 3, titleKey: "onboarding.step3_title", subKey: "onboarding.step3_sub", icon: Search },
  { id: 4, titleKey: "onboarding.step4_title", subKey: "onboarding.step4_sub", icon: Camera },
];

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Créer votre profil — Eden Rencontre" },
      {
        name: "description",
        content:
          "Créez votre profil Eden Rencontre en 4 étapes : identité, foi, critères de recherche et photos. Une rencontre chrétienne sérieuse commence ici.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Créer votre profil — Eden Rencontre" },
      {
        property: "og:description",
        content:
          "Rejoignez Eden Rencontre et créez votre profil en 4 étapes simples.",
      },
    ],
  }),
  component: OnboardingPage,
});

function OnboardingPage() {
  const { t } = useTranslation();
  const [step, setStep] = useState<number>(() => {
    if (typeof window === "undefined") return 1;
    try {
      const saved = localStorage.getItem("eden_onboarding_step");
      return saved ? parseInt(saved, 10) : 1;
    } catch {
      return 1;
    }
  });
  const [data, setData] = useState<OnboardingData>(() => {
    if (typeof window === "undefined") return initialData;
    try {
      const saved = localStorage.getItem("eden_onboarding_data");
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...initialData, ...parsed, photos: [] };
      }
    } catch {}
    return initialData;
  });
  const [submitted, setSubmitted] = useState(false);

  // Sauvegarder dans localStorage à chaque changement
  useEffect(() => {
    try {
      localStorage.setItem("eden_onboarding_step", String(step));
    } catch {}
  }, [step]);

  useEffect(() => {
    // Ne pas sauvegarder les photos (fichiers locaux)
    const { photos, ...toSave } = data;
    try {
      localStorage.setItem("eden_onboarding_data", JSON.stringify(toSave));
    } catch {}
  }, [data]);

  const update = <K extends keyof OnboardingData>(
    key: K,
    value: OnboardingData[K],
  ) => setData((d) => ({ ...d, [key]: value }));

  const canNext = useMemo(() => {
    if (step === 1) {
      const isAdult = (() => {
        if (!data.birthDate) return false;
        const birth = new Date(data.birthDate);
        const today = new Date();
        const age = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        return age > 18 || (age === 18 && m >= 0 && (m > 0 || today.getDate() >= birth.getDate()));
      })();
      return (
        data.birthDate !== "" &&
        isAdult &&
        data.gender !== "" &&
        data.city.trim().length >= 2 &&
        data.country !== "" &&
        data.bio.trim().length >= 10
      );
    }
    if (step === 2)
      return (
        // .trim() : « Autre » ouvre un champ libre, et des espaces seuls
        // laisseraient passer une confession vide.
        data.denomination.trim() !== "" &&
        data.practiceLevel !== "" &&
        data.baptized !== "" &&
        data.churchAttendance !== ""
      );
    if (step === 3)
      return (
        data.seekingGender !== "" &&
        data.maritalStatus !== "" &&
        data.marriageIntent !== "" &&
        data.hasChildren !== "" &&
        data.wantsChildren !== ""
      );
    if (step === 4) return true; // La photo est facultative
    return false;
  }, [step, data]);

  const progress = (step / stepDefs.length) * 100;

  const handleNext = async () => {
    if (!canNext) {
      toast.error(t("onboarding.err_complete_fields"));
      return;
    }
    if (step < 4) {
      setStep(step + 1);
    } else {
      try {
        const { supabase } = await import('@/lib/supabase');
        
        // Récupérer la session active (getSession inclut le token JWT pour RLS)
        let userId: string | null = null;
        let firstName = "";
        let lastName = "";

        // 1. Essayer la session active (token JWT présent â†’ auth.uid() fonctionnel côté BDD)
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          userId = session.user.id;
          firstName = session.user.user_metadata?.first_name || "";
          lastName = session.user.user_metadata?.last_name || "";
        } else {
          // 2. Fallback : getUser() rafraîchit le token si possible
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            userId = user.id;
            firstName = user.user_metadata?.first_name || "";
            lastName = user.user_metadata?.last_name || "";
          } else {
            // 3. Fallback legacy : refreshToken via helper
            const legacyUser = await getSessionUser();
            if (legacyUser) {
              userId = legacyUser.id;
              firstName = legacyUser.user_metadata?.first_name || "";
              lastName = legacyUser.user_metadata?.last_name || "";
            } else {
              // 4. Dernier recours : sessionStorage (inscription sans confirmation d'email)
              if (typeof window !== "undefined") {
                try {
                  userId = sessionStorage.getItem("eden_pending_user_id");
                  firstName = sessionStorage.getItem("eden_pending_first_name") || "";
                  lastName = sessionStorage.getItem("eden_pending_last_name") || "";
                } catch {}
              }
            }
          }
        }

        if (!userId) throw new Error("Erreur: Utilisateur non connecté. Veuillez vous inscrire d'abord.");

        toast.info(t("onboarding.saving"), { id: "saving" });

        const uploadedPhotos = [];
        let dernierEchec: string | null = null;

        for (const [index, photo] of data.photos.entries()) {
          try {
            const res = await fetch(photo.url);
            const blob = await res.blob();
            const ext = photo.name.split('.').pop() || 'jpg';
            const filePath = `${userId}/${Date.now()}-${index}.${ext}`;

            const { error: uploadError } = await supabase.storage
              .from('photos')
              .upload(filePath, blob, { contentType: blob.type });

            if (uploadError) {
              console.error("[onboarding] téléversement refusé :", uploadError);
              dernierEchec = uploadError.message;
              continue;
            }

            const { data: publicUrlData } = supabase.storage.from('photos').getPublicUrl(filePath);
            uploadedPhotos.push(publicUrlData.publicUrl);
          } catch (e: any) {
            console.error("[onboarding] téléversement impossible :", e);
            dernierEchec = e?.message ?? "erreur réseau";
          }
        }

        if (data.photos.length > 0 && uploadedPhotos.length === 0) {
          toast.dismiss("saving");
          toast.error("Votre photo n'a pas pu être envoyée", {
            description: dernierEchec
              ? `${dernierEchec} — vérifiez votre connexion et réessayez.`
              : "Vérifiez votre connexion et réessayez.",
            duration: 8000,
          });
          return;
        }

        if (uploadedPhotos.length < data.photos.length) {
          toast.warning(
            `${data.photos.length - uploadedPhotos.length} photo(s) n'ont pas pu être envoyées`,
            { description: "Vous pourrez les ajouter depuis votre profil." },
          );
        }

        const { error: profileError } = await supabase.from('profiles').insert({
          id: userId,
          first_name: firstName,
          last_name: lastName,
          birth_date: data.birthDate,
          gender: data.gender,
          city: data.city,
          country: data.country,
          bio: data.bio,
          denomination: data.denomination.trim(),
          practice_level: data.practiceLevel,
          baptized: data.baptized,
          church_attendance: data.churchAttendance,
          seeking_gender: data.seekingGender,
          marital_status: data.maritalStatus,
          marriage_intent: data.marriageIntent,
          has_children: data.hasChildren,
          wants_children: data.wantsChildren,
          acquisition_source: data.source || null,
          photos: uploadedPhotos
        });

        if (profileError) throw profileError;

        import("@/lib/meta").then(async m => {
          await m.rattacherProvenance();
          await m.suivreMeta("CompleteRegistration");

          const { data: pct } = await supabase.rpc("my_profile_completion");
          if (typeof pct === "number" && pct >= 60) await m.suivreMeta("CompleteProfile");
        });

        toast.dismiss("saving");
        if (typeof window !== "undefined") {
          try {
            sessionStorage.removeItem("eden_pending_user_id");
            sessionStorage.removeItem("eden_pending_first_name");
            sessionStorage.removeItem("eden_pending_last_name");
            localStorage.removeItem("eden_onboarding_step");
            localStorage.removeItem("eden_onboarding_data");
          } catch {}
        }
        setSubmitted(true);
        toast.success(t("onboarding.saved_success"));

      } catch (error: any) {
        toast.dismiss("saving");
        toast.error("Erreur lors de l'inscription : " + error.message);
      }
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
        onBack={() => {}}
      />
    );

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-secondary/30">
      <header className="border-b border-border/40 backdrop-blur-md bg-background/80 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <img src={logoAsset} alt="Eden Rencontre" className="w-10 h-10 object-contain" />
            <span className="font-serif text-xl font-semibold">Eden Rencontre</span>
          </Link>
          <span className="text-sm text-muted-foreground">
            {t("onboarding.step")} {step} <span className="text-foreground/40">/ {stepDefs.length}</span>
          </span>
        </div>
      </header>

      {/* Progress */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-8">
        <div className="hidden sm:flex items-center justify-between mb-6">
          {stepDefs.map((s, i) => {
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
                      {t(s.titleKey)}
                    </div>
                    <div className="text-xs text-muted-foreground hidden md:block">
                      {t(s.subKey)}
                    </div>
                  </div>
                </div>
                {i < stepDefs.length - 1 && (
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
            {t(stepDefs[step - 1].titleKey)} — {t(stepDefs[step - 1].subKey)}
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

          <div className="px-6 sm:px-10 py-5 border-t border-border/50 bg-secondary/30 flex items-center justify-between">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }}>
              <Button
                type="button"
                variant="ghost"
                onClick={handleBack}
                disabled={step === 1}
                className="gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                {t("onboarding.btn_back")}
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }}>
              <Button
                type="button"
                onClick={handleNext}
                size="lg"
                className="gap-2 bg-gradient-to-r from-primary to-primary/80 hover:opacity-95 shadow-elegant"
              >
                {step === 4 ? (data.photos.length > 0 ? t("onboarding.btn_finish") : t("onboarding.step4.add_photo_later")) : t("onboarding.btn_continue")}
                {step < 4 && <ArrowRight className="w-4 h-4" />}
              </Button>
            </motion.div>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          {t("onboarding.privacy_notice")}
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
  const { t } = useTranslation();
  return (
    <div>
      <StepHeader
        eyebrow={`${t("onboarding.step")} 1`}
        title={t("onboarding.step1_header_title")}
        description={t("onboarding.step1_header_desc")}
      />
      <div className="grid sm:grid-cols-2 gap-5 mt-8">
        <div className="sm:col-span-2">
          <Field label={t("onboarding.birthdate")} htmlFor="birthDate">
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
          {data.birthDate && (() => {
            const birth = new Date(data.birthDate);
            const today = new Date();
            const age = today.getFullYear() - birth.getFullYear();
            const m = today.getMonth() - birth.getMonth();
            const isAdult = age > 18 || (age === 18 && m >= 0 && (m > 0 || today.getDate() >= birth.getDate()));
            if (!isAdult) return (
              <div className="mt-2 flex items-center gap-2 px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm font-medium">
                <span>⛔</span>
                <span>{t("onboarding.min_age_err")}</span>
              </div>
            );
            return null;
          })()}
        </div>
        <div className="sm:col-span-2">
          <Field label={t("onboarding.gender")}>
            <div className="grid grid-cols-2 gap-3">
              <GenderChoice
                active={data.gender === "femme"}
                onClick={() => update("gender", "femme")}
                label={t("onboarding.gender_woman")}
                icon={WomanIcon}
              />
              <GenderChoice
                active={data.gender === "homme"}
                onClick={() => update("gender", "homme")}
                label={t("onboarding.gender_man")}
                icon={ManIcon}
              />
            </div>
          </Field>
        </div>
        <Field label={t("onboarding.country")} htmlFor="country">
          <PaysSelect
            id="country"
            value={data.country}
            onChange={(pays) => {
              if (pays !== data.country) update("city", "");
              update("country", pays);
            }}
          />
        </Field>
        <Field label={t("onboarding.city")} htmlFor="city">
          <VilleSelect
            id="city"
            value={data.city}
            pays={data.country}
            onChange={(v) => update("city", v)}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label={t("onboarding.bio")} htmlFor="bio">
            <Textarea
              id="bio"
              maxLength={500}
              value={data.bio}
              onChange={(e) => update("bio", e.target.value)}
              placeholder={t("onboarding.bio_placeholder")}
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
  const { t } = useTranslation();
  const estAutre =
    data.denomination !== "" && !DENOMINATIONS_CONNUES.includes(data.denomination);

  const [autreOuvert, setAutreOuvert] = useState(estAutre);

  return (
    <div>
      <StepHeader
        eyebrow={`${t("onboarding.step")} 2`}
        title={t("onboarding.step2_header_title")}
        description={t("onboarding.step2_header_desc")}
      />
      <div className="grid gap-6 mt-8">
        <Field label={t("onboarding.denomination")}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {DENOMINATIONS_CONNUES.map((d) => (
              <ChoiceChip
                key={d}
                active={data.denomination === d}
                onClick={() => {
                  setAutreOuvert(false);
                  update("denomination", d);
                }}
                label={d}
              />
            ))}
            <ChoiceChip
              active={autreOuvert || estAutre}
              onClick={() => {
                setAutreOuvert(true);
                if (!estAutre) update("denomination", "");
              }}
              label={t("onboarding.other")}
            />
          </div>

          {(autreOuvert || estAutre) && (
            <div className="mt-3">
              <Input
                autoFocus
                maxLength={60}
                value={estAutre ? data.denomination : ""}
                onChange={(e) => update("denomination", e.target.value)}
                placeholder={t("onboarding.other_denomination_placeholder")}
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                {t("onboarding.other_denomination_hint")}
              </p>
            </div>
          )}
        </Field>

        <Field label={t("onboarding.practice_level")}>
          <div className="grid sm:grid-cols-2 gap-2">
            {[
              { v: "tres-pratiquant", l: t("onboarding.practice_very") },
              { v: "pratiquant", l: t("onboarding.practice_regular") },
              { v: "croyant", l: t("onboarding.practice_believer") },
              { v: "en-recherche", l: t("onboarding.practice_seeking") },
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
          <Field label={t("onboarding.baptized")}>
            <div className="grid grid-cols-2 gap-2">
              {[
                { v: "oui", l: t("onboarding.yes") },
                { v: "non", l: t("onboarding.no") },
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
          <Field label={t("onboarding.church_freq")}>
            <Select
              value={data.churchAttendance}
              onValueChange={(v) => update("churchAttendance", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("onboarding.church_select")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="plusieurs-semaine">{t("onboarding.church_several_week")}</SelectItem>
                <SelectItem value="hebdo">{t("onboarding.church_weekly")}</SelectItem>
                <SelectItem value="mensuel">{t("onboarding.church_monthly")}</SelectItem>
                <SelectItem value="occasionnel">{t("onboarding.church_occasional")}</SelectItem>
                <SelectItem value="rarement">{t("onboarding.church_rarely")}</SelectItem>
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
  const { t } = useTranslation();
  const maritalLabels: Record<string, string> = {
    celibataire: t("onboarding.marital_celibataire"),
    divorce: t("onboarding.marital_divorce"),
    veuf: t("onboarding.marital_veuf"),
    separe: t("onboarding.marital_separe"),
    annule: t("onboarding.marital_annule"),
  };

  return (
    <div>
      <StepHeader
        eyebrow={`${t("onboarding.step")} 3`}
        title={t("onboarding.step3_header_title")}
        description={t("onboarding.step3_header_desc")}
      />
      <div className="grid gap-6 mt-8">
        <Field label={t("onboarding.seeking_gender")}>
          <div className="grid grid-cols-2 gap-3">
            <GenderChoice
              active={data.seekingGender === "femme"}
              onClick={() => update("seekingGender", "femme")}
              label={t("onboarding.seeking_woman")}
              icon={WomanIcon}
            />
            <GenderChoice
              active={data.seekingGender === "homme"}
              onClick={() => update("seekingGender", "homme")}
              label={t("onboarding.seeking_man")}
              icon={ManIcon}
            />
          </div>
        </Field>

        <Field label={t("onboarding.marital_status")}>
          <div className="grid sm:grid-cols-3 gap-2">
            {MARITAL_STATUSES.map((s) => (
              <ChoiceChip
                key={s.key}
                active={data.maritalStatus === s.key}
                onClick={() => update("maritalStatus", s.key)}
                label={maritalLabels[s.key] || s.label}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {t("onboarding.marital_hint")}
          </p>
        </Field>

        <Field label={t("onboarding.marriage_intent")}>
          <div className="grid sm:grid-cols-3 gap-2">
            {[
              { v: "1-2ans", l: t("onboarding.marriage_1_2") },
              { v: "2-5ans", l: t("onboarding.marriage_2_5") },
              { v: "ouvert", l: t("onboarding.marriage_open") },
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

        <Field label={t("onboarding.has_children")}>
          <div className="grid grid-cols-2 sm:grid-cols-2 gap-2">
            {[
              { v: "oui", l: t("onboarding.yes") },
              { v: "non", l: t("onboarding.no") },
            ].map((o) => (
              <ChoiceChip
                key={o.v}
                active={data.hasChildren === o.v}
                onClick={() => update("hasChildren", o.v)}
                label={o.l}
              />
            ))}
          </div>
        </Field>

        <Field label={t("onboarding.wants_children")}>
          <div className="grid grid-cols-3 gap-2">
            {[
              { v: "oui", l: t("onboarding.yes") },
              { v: "peut-etre", l: t("onboarding.maybe") },
              { v: "non", l: t("onboarding.no") },
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
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const GenderAvatar =
    data.gender === "femme" ? WomanIcon : data.gender === "homme" ? ManIcon : null;

  const photo = data.photos[0] ?? null;

  const handleFile = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Ce fichier n'est pas une image.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image trop volumineuse", {
        description: "8 Mo maximum. Réduisez-la ou choisissez une autre photo.",
      });
      return;
    }

    const r = new FileReader();
    r.onload = () =>
      update("photos", [
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          url: String(r.result),
          name: file.name,
        },
      ]);
    r.onerror = () => toast.error("Cette image n'a pas pu être lue.");
    r.readAsDataURL(file);
  };

  return (
    <div>
      <StepHeader
        eyebrow={`${t("onboarding.step")} 4`}
        title={t("onboarding.step4_header_title")}
        description={t("onboarding.step4_header_desc")}
      />

      <div className="mt-8 max-w-[15rem] mx-auto">
        {photo ? (
          <div className="relative aspect-[3/4] rounded-2xl overflow-hidden border border-border/60">
            <img src={photo.url} alt="Votre photo de profil" className="w-full h-full object-cover" />
            <button
              type="button"
              aria-label={t("onboarding.remove_photo")}
              onClick={() => update("photos", [])}
              className="absolute top-2 right-2 w-8 h-8 rounded-full bg-background/90 hover:bg-background flex items-center justify-center shadow-soft transition"
            >
              <X className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="absolute inset-x-0 bottom-0 py-2.5 bg-background/90 backdrop-blur-sm text-sm font-medium hover:bg-background transition"
            >
              {t("onboarding.change_photo")}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-full aspect-[3/4] rounded-2xl border-2 border-dashed border-border hover:border-primary hover:bg-secondary/40 transition-all flex flex-col items-center justify-center gap-3 text-muted-foreground hover:text-primary"
          >
            {GenderAvatar ? (
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center ring-4 ring-primary/10">
                <GenderAvatar className="w-10 h-10 text-primary" />
              </div>
            ) : (
              <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center">
                <Upload className="w-6 h-6" />
              </div>
            )}
            <span className="text-sm font-semibold">{t("onboarding.add_photo")}</span>
            <span className="text-xs">{t("onboarding.photo_format_hint")}</span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files);
          e.target.value = "";
        }}
      />

      <p className="mt-4 text-center text-xs text-muted-foreground">
        {t("onboarding.extra_photos_hint")}
      </p>
    </div>
  );
}

// ---------- Success ----------
function SuccessScreen({ data }: { data: OnboardingData }) {
  const { t } = useTranslation();
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
          {t("onboarding.success_title")}
        </h1>
        <p className="text-muted-foreground mt-3">
          {t("onboarding.success_desc")}
        </p>
        <div className="mt-8">
          <Link to="/accueil">
            <Button
              size="lg"
              className="bg-gradient-to-r from-primary to-primary/80 shadow-elegant w-full sm:w-auto"
            >
              {t("onboarding.success_cta")}
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
    <motion.button
      type="button"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
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
    </motion.button>
  );
}

// ---------- Source (pre-step) ----------
function SourceScreen({ onSelect, onBack }: { onSelect: (s: string) => void; onBack: () => void }) {
  const { t } = useTranslation();
  const options: { id: string; label: string; icon: ReactElement; color: string }[] = [
    { id: "tiktok", label: "TikTok", icon: <Music2 className="w-6 h-6" />, color: "bg-foreground text-background" },
    { id: "instagram", label: "Instagram", icon: <Instagram className="w-6 h-6" />, color: "bg-gradient-to-tr from-fuchsia-500 via-pink-500 to-amber-400 text-white" },
    { id: "facebook", label: "Facebook", icon: <Facebook className="w-6 h-6" />, color: "bg-[#1877F2] text-white" },
    { id: "youtube", label: "YouTube", icon: <Youtube className="w-6 h-6" />, color: "bg-[#FF0000] text-white" },
    { id: "whatsapp", label: "WhatsApp", icon: <MessageCircle className="w-6 h-6" />, color: "bg-[#25D366] text-white" },
    { id: "recommandation", label: t("onboarding.source_recommendation"), icon: <Users className="w-6 h-6" />, color: "bg-primary text-primary-foreground" },
    { id: "autre", label: t("onboarding.source_other"), icon: <MoreHorizontal className="w-6 h-6" />, color: "bg-primary/10 text-primary" },
  ];
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-secondary/30">
      <header className="border-b border-border/40 backdrop-blur-md bg-background/80 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <img src={logoAsset} alt="Eden Rencontre" className="w-10 h-10 object-contain" />
            <span className="font-serif text-xl font-semibold">Eden Rencontre</span>
          </Link>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition"
          >
            <ArrowLeft className="w-4 h-4" />
            {t("onboarding.btn_back")}
          </button>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-10 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-card rounded-3xl shadow-elegant border border-border/50 p-6 sm:p-10"
        >
          <div className="text-center mb-8">
            <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-foreground">
              {t("onboarding.source_title")}
            </h1>
            <p className="text-muted-foreground mt-2 text-sm">{t("onboarding.source_sub")}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {options.map((o) => (
              <motion.button
                key={o.id}
                type="button"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => onSelect(o.id)}
                className="group flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-border hover:border-primary/50 bg-background hover:bg-primary/5 py-6 px-4 transition-all shadow-soft hover:shadow-elegant"
              >
                <span className={`w-12 h-12 rounded-xl flex items-center justify-center ${o.color}`}>
                  {o.icon}
                </span>
                <span className="text-sm font-medium text-foreground text-center">
                  {o.label}
                </span>
              </motion.button>
            ))}
          </div>
        </motion.div>
        <p className="text-center text-xs text-muted-foreground mt-6">
          {t("onboarding.source_footer")}
        </p>
      </main>
    </div>
  );
}
