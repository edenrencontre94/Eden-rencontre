import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Identité de l'utilisateur courant, sans aller-retour réseau.
 *
 * `supabase.auth.getUser()` valide le JWT côté serveur : ~380 ms mesurés sur
 * ce projet, payés à chaque appel. `getSession()` lit le localStorage et
 * contient déjà `user.id`, qui est tout ce dont l'app a besoin.
 * On mémorise en plus le résultat pour que les appels suivants soient gratuits.
 */

let cachedUserId: string | null | undefined;
let inFlight: Promise<string | null> | null = null;
let listenerAttached = false;

function attachListener() {
  if (listenerAttached) return;
  listenerAttached = true;
  supabase.auth.onAuthStateChange((_event: any, session: any) => {
    cachedUserId = session?.user?.id ?? null;
    inFlight = null;
  });
}

/** Identifiant de l'utilisateur connecté, ou null. Instantané une fois résolu. */
export async function getCurrentUserId(): Promise<string | null> {
  if (cachedUserId !== undefined) return cachedUserId;
  if (inFlight) return inFlight;

  attachListener();
  inFlight = supabase.auth.getSession().then(({ data }: any) => {
    cachedUserId = data.session?.user?.id ?? null;
    inFlight = null;
    return cachedUserId;
  });

  return inFlight;
}

/**
 * Remplaçant direct de `supabase.auth.getUser()` pour les appelants qui
 * utilisent `user.id`, mais sans l'aller-retour réseau.
 */
export async function getCurrentUser(): Promise<{ id: string } | null> {
  const id = await getCurrentUserId();
  return id ? { id } : null;
}

/**
 * Utilisateur complet (avec `user_metadata`) issu de la session locale.
 * À réserver aux cas qui ont réellement besoin des métadonnées ; partout
 * ailleurs `getCurrentUser()` suffit.
 */
export async function getSessionUser(): Promise<any | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user ?? null;
}

/** Version synchrone : renvoie undefined tant que la session n'a pas été lue. */
export function peekCurrentUserId(): string | null | undefined {
  return cachedUserId;
}

/**
 * Statut d'administrateur, décidé en base par `is_admin()`.
 *
 * Renvoie `undefined` tant que la réponse n'est pas arrivée — à distinguer
 * de `false`. Sans cette nuance, l'interface afficherait brièvement le
 * contenu réservé aux membres ordinaires avant de se corriger, ou
 * l'inverse.
 *
 * Ce hook ne PROTÈGE rien : il pilote l'affichage. La protection réelle
 * vient des policies RLS, qui refusent les données quoi qu'affiche l'écran.
 */
export function useIsAdmin(): boolean | undefined {
  const [isAdmin, setIsAdmin] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const userId = await getCurrentUserId();
      if (!userId) {
        if (!cancelled) setIsAdmin(false);
        return;
      }

      // `is_staff` et non `is_admin` : un modérateur ou un agent de support
      // doit lui aussi trouver le bouton qui mène au back-office. Ce qu'il
      // y verra dépend ensuite de ses permissions.
      const { data, error } = await supabase.rpc("is_staff");
      if (cancelled) return;

      if (error) {
        console.error("[auth] is_admin:", error);
        setIsAdmin(false);
        return;
      }
      setIsAdmin(Boolean(data));
    })();

    return () => { cancelled = true; };
  }, []);

  return isAdmin;
}

export function useCurrentUserId(): string | null | undefined {
  const [userId, setUserId] = useState<string | null | undefined>(peekCurrentUserId);

  useEffect(() => {
    let cancelled = false;
    if (userId === undefined) {
      getCurrentUserId().then(id => { if (!cancelled) setUserId(id); });
    }

    attachListener();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event: any, session: any) => {
        if (!cancelled) setUserId(session?.user?.id ?? null);
      },
    );

    return () => { cancelled = true; subscription.unsubscribe(); };
  }, []);

  return userId;
}
