import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  motion, useScroll, useTransform, useSpring, useInView,
  useMotionValue, useReducedMotion, type MotionValue,
} from "motion/react";

/**
 * Boîte à outils d'animation de la page d'accueil.
 *
 * DEUX CONTRAINTES, et la seconde prime sur la première.
 *
 * 1. L'effet recherché : celui des pages produit haut de gamme —
 *    révélation au défilement, parallaxe, typographie cinétique.
 *
 * 2. Le matériel réel de vos membres. Un téléphone d'entrée de gamme
 *    sous Android, sur un réseau lent. Une page qui saccade est perçue
 *    comme cassée, jamais comme élégante.
 *
 * D'où trois règles appliquées partout :
 *   • `transform` et `opacity` uniquement — les seules propriétés que le
 *     navigateur anime sans recalculer la mise en page.
 *   • `prefers-reduced-motion` respecté : tout s'affiche, rien ne bouge.
 *   • Les effets coûteux (parallaxe, lueur suivant la souris) sont
 *     désactivés sous 1024 px, là où ils n'apportent rien et coûtent le
 *     plus cher.
 */

const DOUX = [0.16, 1, 0.3, 1] as const;

/** Vrai au-delà de la largeur donnée. Réévalué au redimensionnement. */
export function useLarge(min = 1024): boolean {
  const [large, setLarge] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${min}px)`);
    const maj = () => setLarge(mq.matches);
    maj();
    mq.addEventListener("change", maj);
    return () => mq.removeEventListener("change", maj);
  }, [min]);
  return large;
}

/* ─────────────── Révélation au défilement ─────────────── */

export function Reveal({
  children,
  delay = 0,
  y = 28,
  className = "",
  once = true,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  once?: boolean;
}) {
  const reduit = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={reduit ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      // `margin` négatif : l'animation part quand l'élément est déjà
      // engagé dans l'écran, pas au moment où il l'effleure — sinon on
      // rate le mouvement en faisant défiler vite.
      viewport={{ once, margin: "-80px" }}
      transition={{ duration: 0.7, delay, ease: DOUX }}
    >
      {children}
    </motion.div>
  );
}

/* ─────────────── Titre mot à mot ─────────────── */

/**
 * Chaque mot monte séparément, avec un léger décalage.
 *
 * Découpage par MOT et non par lettre : sur un titre en français, les
 * lettres isolées cassent le crénage et empêchent la césure — le titre
 * déborde sur mobile.
 */
export function TitreCinetique({
  texte,
  className = "",
  delay = 0,
  motsColores = [],
}: {
  texte: string;
  className?: string;
  delay?: number;
  /** Indices des mots à mettre en avant. */
  motsColores?: number[];
}) {
  const reduit = useReducedMotion();
  const mots = texte.split(" ");

  return (
    <span className={className}>
      {mots.map((mot, i) => (
        <span key={i} className="inline-block overflow-hidden align-bottom">
          <motion.span
            className={`inline-block ${
              motsColores.includes(i) ? "italic text-gradient-gold" : ""
            }`}
            initial={reduit ? false : { y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, delay: delay + i * 0.06, ease: DOUX }}
          >
            {mot}
          </motion.span>
          {i < mots.length - 1 && " "}
        </span>
      ))}
    </span>
  );
}

/* ─────────────── Parallaxe ─────────────── */

/** Déplace un élément à contre-courant du défilement. */
export function useParallaxe(distance = 60): MotionValue<number> {
  const { scrollY } = useScroll();
  const reduit = useReducedMotion();
  const large = useLarge();
  const brut = useTransform(scrollY, [0, 1200], [0, reduit || !large ? 0 : -distance]);
  // Ressort : sans lui, le déplacement suit la molette au pixel près et
  // paraît mécanique.
  return useSpring(brut, { stiffness: 80, damping: 20, mass: 0.4 });
}

/* ─────────────── Carte inclinable ─────────────── */

/**
 * Inclinaison suivant le curseur, avec relief.
 *
 * Souris uniquement : au doigt, l'inclinaison se déclencherait pendant
 * le défilement et donnerait l'impression d'un bug.
 */
export function CarteInclinable({
  children,
  className = "",
  intensite = 8,
}: {
  children: ReactNode;
  className?: string;
  intensite?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduit = useReducedMotion();
  const large = useLarge();

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rx = useSpring(useTransform(y, [-0.5, 0.5], [intensite, -intensite]), {
    stiffness: 220, damping: 22,
  });
  const ry = useSpring(useTransform(x, [-0.5, 0.5], [-intensite, intensite]), {
    stiffness: 220, damping: 22,
  });

  const actif = large && !reduit;

  return (
    <motion.div
      ref={ref}
      onPointerMove={e => {
        if (!actif || e.pointerType !== "mouse") return;
        const r = ref.current!.getBoundingClientRect();
        x.set((e.clientX - r.left) / r.width - 0.5);
        y.set((e.clientY - r.top) / r.height - 0.5);
      }}
      onPointerLeave={() => { x.set(0); y.set(0); }}
      style={actif ? { rotateX: rx, rotateY: ry, transformPerspective: 900 } : undefined}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ─────────────── Compteur ─────────────── */

/**
 * Chiffre qui monte quand il entre à l'écran.
 *
 * `useInView` plutôt qu'une animation au chargement : un compteur qui a
 * fini de tourner avant qu'on arrive dessus n'impressionne personne.
 */
export function Compteur({
  valeur,
  suffixe = "",
  duree = 1600,
  className = "",
}: {
  valeur: number;
  suffixe?: string;
  duree?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const vu = useInView(ref, { once: true, margin: "-60px" });
  const reduit = useReducedMotion();
  const [n, setN] = useState(0);

  useEffect(() => {
    if (!vu) return;
    if (reduit) { setN(valeur); return; }

    let brut: number;
    const pas = (t: number) => {
      if (brut === undefined) brut = t;
      const p = Math.min((t - brut) / duree, 1);
      // Décélération cubique : le chiffre ralentit en approchant de sa
      // valeur, au lieu de s'arrêter net.
      setN(Math.round(valeur * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(pas);
    };
    const id = requestAnimationFrame(pas);
    return () => cancelAnimationFrame(id);
  }, [vu, valeur, duree, reduit]);

  return (
    <span ref={ref} className={className}>
      {n.toLocaleString("fr-FR")}{suffixe}
    </span>
  );
}

/* ─────────────── Bandeau défilant ─────────────── */

/**
 * Défilement horizontal continu.
 *
 * Le contenu est dupliqué et l'animation parcourt exactement -50 % :
 * la boucle est alors invisible. Animer la position au lieu de la marge
 * évite tout recalcul de mise en page.
 */
export function Bandeau({
  children,
  vitesse = 40,
  inverse = false,
  className = "",
}: {
  children: ReactNode;
  vitesse?: number;
  inverse?: boolean;
  className?: string;
}) {
  const reduit = useReducedMotion();

  return (
    <div className={`overflow-hidden ${className}`}>
      <motion.div
        className="flex w-max gap-4"
        animate={reduit ? undefined : { x: inverse ? ["-50%", "0%"] : ["0%", "-50%"] }}
        transition={{ duration: vitesse, ease: "linear", repeat: Infinity }}
      >
        {children}
        {/* Copie : masquée aux lecteurs d'écran, qui liraient tout deux fois. */}
        <div className="flex gap-4" aria-hidden>{children}</div>
      </motion.div>
    </div>
  );
}

/* ─────────────── Barre de progression ─────────────── */

export function BarreProgression() {
  const { scrollYProgress } = useScroll();
  const largeur = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.3 });

  return (
    <motion.div
      style={{ scaleX: largeur }}
      className="fixed top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary via-gold to-primary origin-left z-[60]"
      aria-hidden
    />
  );
}

/* ─────────────── Lueur suivant le curseur ─────────────── */

/**
 * Halo doux qui suit la souris.
 *
 * Grand écran uniquement, et jamais au doigt : sur mobile il resterait
 * figé là où l'on a touché.
 */
export function LueurCurseur() {
  const large = useLarge();
  const reduit = useReducedMotion();
  const x = useSpring(useMotionValue(0), { stiffness: 60, damping: 20 });
  const y = useSpring(useMotionValue(0), { stiffness: 60, damping: 20 });

  useEffect(() => {
    if (!large || reduit) return;
    const bouge = (e: MouseEvent) => { x.set(e.clientX); y.set(e.clientY); };
    window.addEventListener("mousemove", bouge, { passive: true });
    return () => window.removeEventListener("mousemove", bouge);
  }, [large, reduit, x, y]);

  if (!large || reduit) return null;

  return (
    <motion.div
      aria-hidden
      style={{ x, y }}
      className="pointer-events-none fixed -top-40 -left-40 w-80 h-80 rounded-full
                 bg-gold/[0.07] blur-3xl z-0"
    />
  );
}

/* ─────────────── Grain ─────────────── */

/**
 * Voile de grain sur toute la page.
 *
 * Un SVG en data-URI plutôt qu'une image : aucune requête réseau, et le
 * bruit casse les aplats des dégradés — c'est ce qui distingue une page
 * imprimée d'un aplat numérique.
 */
export function Grain() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[1] opacity-[0.035] mix-blend-multiply"
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
      }}
    />
  );
}
