import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import logoAsset from "@/assets/logo.png";
import { Heart } from "lucide-react";

/** Domaine canonique — toute URL de référencement en découle. */
export const SITE_URL = "https://edenrencontre.com";

/**
 * Gabarit des pages publiques indexables.
 *
 * L'en-tête pointe vers de VRAIES pages et non vers des ancres : c'est ce
 * qui permet à Google de les découvrir. Une ancre `#tarifs` ne crée pas
 * d'URL — le moteur voit la même page, et rien n'est indexé de plus.
 */
export function PublicLayout({
  children,
  title,
  intro,
  breadcrumb,
}: {
  children: ReactNode;
  title: string;
  intro?: string;
  breadcrumb?: { label: string; to: string }[];
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/85 border-b border-border/40">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <img src={logoAsset} alt="Eden Rencontre" className="w-8 h-8 object-contain" />
            <span className="font-serif text-lg font-semibold">Eden Rencontre</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground" aria-label="Navigation principale">
            <Link to="/tarifs" className="hover:text-foreground transition">Tarifs</Link>
            <Link to="/blog" className="hover:text-foreground transition">Blog</Link>
            <Link to="/faq" className="hover:text-foreground transition">FAQ</Link>
          </nav>

          <Link
            to="/inscription"
            className="rounded-full bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold shadow-elegant"
          >
            Rejoindre
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10">
        {breadcrumb && breadcrumb.length > 0 && (
          <nav aria-label="Fil d'Ariane" className="text-xs text-muted-foreground mb-4 flex flex-wrap gap-1.5">
            <Link to="/" className="hover:text-foreground">Accueil</Link>
            {breadcrumb.map(b => (
              <span key={b.to} className="flex gap-1.5">
                <span aria-hidden>›</span>
                <Link to={b.to as any} className="hover:text-foreground">{b.label}</Link>
              </span>
            ))}
          </nav>
        )}

        <h1 className="font-serif text-3xl sm:text-4xl font-semibold leading-tight">{title}</h1>
        {intro && <p className="text-muted-foreground mt-3 leading-relaxed">{intro}</p>}

        <div className="mt-8">{children}</div>
      </main>

      <footer className="border-t border-border bg-secondary/30 mt-16">
        <div className="max-w-5xl mx-auto px-4 py-10 grid gap-8 sm:grid-cols-3 text-sm">
          <div>
            <div className="flex items-center gap-2">
              <img src={logoAsset} alt="" className="w-7 h-7 object-contain" />
              <span className="font-serif font-semibold">Eden Rencontre</span>
            </div>
            <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
              La rencontre chrétienne sérieuse, orientée vers le mariage.
            </p>
          </div>

          <div>
            <div className="font-semibold mb-2">Découvrir</div>
            <ul className="space-y-1.5 text-muted-foreground">
              <li><Link to="/tarifs" className="hover:text-foreground transition">Tarifs</Link></li>
              <li><Link to="/blog" className="hover:text-foreground transition">Blog</Link></li>
              <li><Link to="/faq" className="hover:text-foreground transition">Questions fréquentes</Link></li>
              <li><Link to="/inscription" className="hover:text-foreground transition">Créer un compte</Link></li>
            </ul>
          </div>

          <div>
            <div className="font-semibold mb-2">Informations</div>
            <ul className="space-y-1.5 text-muted-foreground">
              <li><Link to="/conditions" className="hover:text-foreground transition">Conditions d'utilisation</Link></li>
              <li><Link to="/confidentialite" className="hover:text-foreground transition">Confidentialité</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border/60 py-4 text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5">
          <Heart className="w-3 h-3 text-primary" fill="currentColor" />
          Eden Rencontre — {new Date().getFullYear()}
        </div>
      </footer>
    </div>
  );
}
