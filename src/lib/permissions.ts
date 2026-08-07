import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Rôles et permissions de l'équipe.
 *
 * Ce module ne décide de RIEN : il ne fait que refléter ce que la base
 * autorise, pour afficher le bon menu. Chaque fonction serveur vérifie la
 * permission de son côté — masquer une entrée de menu n'a jamais empêché
 * personne d'appeler l'API directement.
 */

export type Permission =
  | "membres" | "moderation" | "conversations" | "contenus"
  | "support" | "finances" | "reglages" | "equipe";

export type Role = "member" | "redacteur" | "support" | "moderator" | "admin";

export type MyPermissions = {
  role: Role;
  is_staff: boolean;
  permissions: Permission[];
};

export const ROLE_LABELS: Record<Role, string> = {
  member: "Membre",
  redacteur: "Rédacteur",
  support: "Support",
  moderator: "Modérateur",
  admin: "Administrateur",
};

export const ROLE_DESCRIPTIONS: Record<Exclude<Role, "member">, string> = {
  redacteur:
    "Rédige et publie les articles, valide les publications de la communauté. Aucun accès aux données personnelles des membres.",
  support:
    "Répond aux demandes d'aide, consulte les fiches membres pour instruire un cas, peut offrir des jours d'accès. Sans droit de sanction.",
  moderator:
    "Traite les signalements, lit les conversations, suspend un compte. N'accède ni aux revenus, ni aux réglages, ni à l'équipe.",
  admin:
    "Accès complet, y compris les réglages, les revenus et la composition de l'équipe.",
};

export const PERMISSION_LABELS: Record<Permission, string> = {
  membres: "Fiches membres",
  moderation: "Signalements et sanctions",
  conversations: "Lecture des conversations",
  contenus: "Blog et publications",
  support: "Demandes d'aide",
  finances: "Revenus et abonnements",
  reglages: "Réglages et marketing",
  equipe: "Composition de l'équipe",
};

export async function fetchMyPermissions(): Promise<MyPermissions> {
  const { data, error } = await supabase.rpc("my_permissions");

  if (error || !data) {
    console.error("[permissions]", error);
    // Repli le plus restrictif : en cas de doute, aucun droit. L'inverse
    // ouvrirait le back-office à la faveur d'une erreur réseau.
    return { role: "member", is_staff: false, permissions: [] };
  }
  return data as MyPermissions;
}

/**
 * `undefined` tant que la réponse n'est pas arrivée : permet de n'afficher
 * ni le contenu ni une redirection avant de savoir.
 */
export function useMyPermissions(): MyPermissions | undefined {
  const [perms, setPerms] = useState<MyPermissions | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    fetchMyPermissions().then(p => { if (!cancelled) setPerms(p); });
    return () => { cancelled = true; };
  }, []);

  return perms;
}

export function has(perms: MyPermissions | undefined, p: Permission): boolean {
  return Boolean(perms?.permissions?.includes(p));
}
