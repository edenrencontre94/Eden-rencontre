import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Download, X, Smartphone } from "lucide-react";
import { useInstall } from "@/lib/install";
import { EtapesIOS } from "@/components/app/EtapesIOS";
import logoAsset from "@/assets/logo.png";

/**
 * Invitation à installer l'application.
 *
 * Deux emplacements sur la page d'accueil publique – une barre en haut,
 * une carte en bas – parce que le visiteur qui fait défiler ne remonte
 * jamais, et que celui qui reste en haut ne descend pas toujours.
 *
 * TROIS RÊGLES :
 *
 *  1. On attend 5 secondes. Proposer d'installer l'application très vite après
 *     l'inscription permet de capter l'utilisateur quand il est engagé.
 *  2. Un refus vaut trente jours de silence, et vaut pour LES DEUX
 *     emplacements : les fermer un par un serait une corvée.
 *  3. Rien du tout si l'application est déjà installée.
 */

const CLE_REFUS = "eden_install_refuse";

/** Délai avant la proposition, en millisecondes. 5 secondes après inscription. */
const DELAI_MS = 5_000;
const JOURS_APRES_REFUS = 30;

function refusRecent(): boolean {
  try {
    const t = Number(localStorage.getItem(CLE_REFUS) ?? 0);
    return t > 0 && Date.now() - t < JOURS_APRES_REFUS * 86400000;
  } catch {
    return false;
  }
}

/**
 * État partagé par les deux emplacements.
 *
 * Sans lui, fermer la barre du haut laisserait la carte du bas – deux
 * refus pour une seule intention.
 */
const abonnes = new Set<() => void>();
let ecarteGlobal = false;

function ecarter() {
  try { localStorage.setItem(CLE_REFUS, String(Date.now())); } catch {}
  ecarteGlobal = true;
  abonnes.forEach(f => f());
}

function useInvitation() {
  const { possible, ios, installer } = useInstall();
  const [ecoule, setEcoule] = useState(false);
  const [, forcer] = useState(0);

  useEffect(() => {
    const f = () => forcer(n => n + 1);
    abonnes.add(f);
    return () => { abonnes.delete(f); };
  }, []);

  useEffect(() => {
    if (refusRecent()) { ecarteGlobal = true; return; }
    // 5 secondes après inscription/arrivée
    const t = setTimeout(() => setEcoule(true), DELAI_MS);
    return () => clearTimeout(t);
  }, []);

  return {
    visible: possible && ecoule && !ecarteGlobal,
    ios,
    ecarter,
    installer: async () => {
      const ok = await installer();
      // Refuser la boîte native vaut refus : réinsister ferait de
      // l'invitation une nuisance.
      if (!ok) ecarter();
      else { ecarteGlobal = true; abonnes.forEach(f => f()); }
    },
  };
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Barre haute â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export function InstallBarTop() {
  const { visible, ios, ecarter: fermer, installer } = useInvitation();
  const [etapes, setEtapes] = useState(false);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="sticky top-0 z-50 overflow-hidden bg-gradient-to-r from-primary to-primary/85 text-primary-foreground"
        >
          <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center gap-3">
            <img src={logoAsset} alt="" className="w-8 h-8 rounded-lg shrink-0 bg-white/10" />

            <p className="text-xs sm:text-sm font-medium min-w-0 flex-1 leading-snug">
              Installez Eden Rencontre sur votre téléphone
              <span className="hidden sm:inline opacity-80"> – sans passer par un magasin d'applications.</span>
            </p>

            <button
              onClick={() => (ios ? setEtapes(v => !v) : installer())}
              className="shrink-0 px-3.5 py-1.5 rounded-full bg-primary-foreground text-primary text-xs font-bold hover:opacity-90 active:scale-95 transition"
            >
              {ios ? "Comment ?" : "Installer"}
            </button>

            <button
              onClick={fermer}
              aria-label="Masquer"
              className="shrink-0 w-7 h-7 rounded-full hover:bg-white/15 flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Les étapes iPhone se déplient dans la barre : ouvrir une
              fenêtre modale par-dessus une page d'accueil qu'on découvre
              serait brutal. */}
          <AnimatePresence>
            {ios && etapes && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: "auto" }}
                exit={{ height: 0 }}
                className="overflow-hidden bg-background text-foreground"
              >
                <div className="max-w-7xl mx-auto px-4 py-3">
                  <EtapesIOS />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Carte basse â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export function InstallPrompt() {
  const { visible, ios, ecarter: fermer, installer } = useInvitation();

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 60 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          // Au-dessus de la barre de navigation quand elle existe, jamais
          // par-dessus : gêner l'usage pour vanter le confort serait absurde.
          className="fixed bottom-[4.5rem] sm:bottom-4 inset-x-3 z-50 rounded-2xl border border-border bg-card shadow-elegant p-4 max-w-md mx-auto"
        >
          <button
            onClick={fermer}
            aria-label="Fermer"
            className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full hover:bg-secondary flex items-center justify-center text-muted-foreground"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-start gap-3 pr-6">
            <img src={logoAsset} alt="" className="w-11 h-11 rounded-xl shrink-0" />
            <div className="min-w-0">
              <p className="font-serif font-semibold text-sm">Installez Eden Rencontre</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                {ios
                  ? "Pour recevoir les notifications et ouvrir l'application depuis votre écran d'accueil."
                  : "Un accès direct depuis votre écran d'accueil, sans passer par le navigateur."}
              </p>
            </div>
          </div>

          {ios ? (
            <div className="mt-3 pt-3 border-t border-border/60">
              <EtapesIOS />
            </div>
          ) : (
            <div className="flex gap-2 mt-3">
              <button
                onClick={fermer}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-secondary transition-colors"
              >
                Plus tard
              </button>
              <button
                onClick={installer}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground text-sm font-semibold shadow-soft inline-flex items-center justify-center gap-1.5"
              >
                <Download className="w-4 h-4" /> Installer
              </button>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Section dans le flux de la page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

/**
 * Variante non flottante, posée avant le pied de page.
 *
 * Contrairement aux deux précédentes, elle ne se ferme pas et ne dépend
 * d'aucun délai : elle fait partie du contenu. Celui qui lit la page
 * jusqu'au bout est précisément celui qui est convaincu.
 */
export function InstallSection() {
  const { possible, ios, installer } = useInstall();
  const [etapes, setEtapes] = useState(false);

  // Aucune condition d'affichage : cette section fait partie du contenu
  // de la page, au même titre que les tarifs ou la foire aux questions.
  //
  // Elle reste donc visible même pour quelqu'un qui a déjà installé
  // l'application – d'autant que sur iPhone, Safari est de toute façon
  // incapable de le savoir : l'application installée et l'onglet ont des
  // espaces de stockage distincts.
  //
  // Ce qui s'adapte, c'est le BOUTON, jamais le texte.
  const installationDirecte = possible && !ios;

  return (
    <section className="border-t border-border/60 bg-secondary/40">
      <div className="max-w-3xl mx-auto px-6 py-14 text-center">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary mx-auto flex items-center justify-center">
          <Smartphone className="w-7 h-7" />
        </div>

        <h2 className="font-serif text-2xl sm:text-3xl font-semibold mt-5">
          Eden Rencontre sur votre téléphone
        </h2>
        <p className="text-sm sm:text-base text-muted-foreground mt-3 leading-relaxed max-w-xl mx-auto">
          Installez l'application en un geste, sans magasin d'applications et
          sans encombrer votre mémoire. Vous serez prévenu de vos messages et
          de vos nouveaux matchs, même application fermée.
        </p>

        {installationDirecte ? (
          /* Le navigateur a signalé que l'installation est possible :
             un clic ouvre la boîte de dialogue native. */
          <button
            onClick={installer}
            className="mt-6 inline-flex items-center gap-2 px-7 py-3 rounded-full bg-gradient-to-br from-primary to-primary/80 text-primary-foreground font-semibold shadow-elegant hover:brightness-110 active:scale-[0.98] transition"
          >
            <Download className="w-4 h-4" /> Installer l'application
          </button>
        ) : (
          /* Sinon on explique le geste, au lieu d'un bouton qui ne ferait
             rien. Ce cas couvre l'iPhone – où Safari n'expose aucune API –
             mais aussi l'application déjà installée et les navigateurs qui
             ne prennent pas l'installation en charge. */
          <>
            <button
              onClick={() => setEtapes(v => !v)}
              aria-expanded={etapes}
              className="mt-6 inline-flex items-center gap-2 px-7 py-3 rounded-full bg-gradient-to-br from-primary to-primary/80 text-primary-foreground font-semibold shadow-elegant hover:brightness-110 active:scale-[0.98] transition"
            >
              <Smartphone className="w-4 h-4" /> Comment installer ?
            </button>

            {etapes && (
              <div className="mt-5 max-w-sm mx-auto text-left rounded-2xl border border-border bg-card p-4">
                {ios ? (
                  <EtapesIOS />
                ) : (
                  <div className="space-y-2.5 text-xs text-muted-foreground leading-relaxed">
                    <p>
                      <strong className="text-foreground">Sur Android</strong> –
                      ouvrez le menu <span className="font-mono">â‹®</span> de votre
                      navigateur, puis <strong>Installer l'application</strong>.
                    </p>
                    <p>
                      <strong className="text-foreground">Sur ordinateur</strong> –
                      cliquez sur l'icône d'installation, à droite de la barre
                      d'adresse.
                    </p>
                    <p className="pt-1 border-t border-border/60">
                      Si l'option n'apparaît pas, c'est que l'application est
                      déjà installée sur cet appareil.
                    </p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
