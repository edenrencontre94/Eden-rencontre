export type Language = "fr" | "en";

export const translations = {
  fr: {
    // Navigation & Common
    "nav.home": "Accueil",
    "nav.discover": "Découvrir",
    "nav.messages": "Messages",
    "nav.requests": "Demandes",
    "nav.community": "Communauté",
    "common.loading": "Chargement...",
    "common.cancel": "Annuler",
    "common.save": "Enregistrer",
    "common.back": "Retour",
    "common.next": "Suivant",
    "common.edit": "Modifier",
    "common.delete": "Supprimer",
    "common.confirm": "Confirmer",
    "common.close": "Fermer",
    "common.search": "Rechercher",
    "common.filter": "Filtrer",
    "common.unread": "non lu(s)",

    // Header & Menu
    "menu.account_section": "Mon Compte",
    "menu.settings_section": "Paramètres",
    "menu.my_profile": "Mon profil",
    "menu.my_subscription": "Abonnement & Facturation",
    "menu.security": "Sécurité",
    "menu.notifications": "Notifications",
    "menu.language": "Langue",
    "menu.blocked_profiles": "Profils bloqués",
    "menu.help_support": "Aide et support",
    "menu.admin": "Administration",
    "menu.delete_account": "Supprimer le compte",
    "menu.logout": "Se déconnecter",
    "menu.referral": "Parrainage",

    // Language Page
    "lang.title": "Langue",
    "lang.subtitle": "Choisissez la langue d'affichage d'Eden Rencontre.",
    "lang.french": "Français",
    "lang.english": "English",
    "lang.spanish": "Español",
    "lang.soon": "Bientôt",
    "lang.help_translate": "Vous souhaitez aider à traduire Eden Rencontre ?",
    "lang.contact_us": "Contactez-nous à",
    "lang.saved": "Langue mise à jour !",

    // Onboarding
    "onboarding.welcome": "Bienvenue sur Eden Rencontre",
    "onboarding.step": "Étape",
    "onboarding.step4.add_photo_later": "Ajouter la photo plus tard",
    "onboarding.step4.skip": "Passer cette étape",

    // Discover Page
    "discover.title": "Découvrir",
    "discover.filters": "Filtres",
    "discover.no_profiles": "Aucun profil ne correspond à vos critères.",
    "discover.refresh": "Actualiser",
    "discover.profiles_count": "{count} personnes correspondent à vos critères",

    // General
    "app.title": "Eden Rencontre",
    "app.slogan": "Rencontres chrétiennes authentiques",
  },
  en: {
    // Navigation & Common
    "nav.home": "Home",
    "nav.discover": "Discover",
    "nav.messages": "Messages",
    "nav.requests": "Requests",
    "nav.community": "Community",
    "common.loading": "Loading...",
    "common.cancel": "Cancel",
    "common.save": "Save",
    "common.back": "Back",
    "common.next": "Next",
    "common.edit": "Edit",
    "common.delete": "Delete",
    "common.confirm": "Confirm",
    "common.close": "Close",
    "common.search": "Search",
    "common.filter": "Filter",
    "common.unread": "unread",

    // Header & Menu
    "menu.account_section": "My Account",
    "menu.settings_section": "Settings",
    "menu.my_profile": "My Profile",
    "menu.my_subscription": "Subscription & Billing",
    "menu.security": "Security",
    "menu.notifications": "Notifications",
    "menu.language": "Language",
    "menu.blocked_profiles": "Blocked Profiles",
    "menu.help_support": "Help & Support",
    "menu.admin": "Administration",
    "menu.delete_account": "Delete account",
    "menu.logout": "Log out",
    "menu.referral": "Referral program",

    // Language Page
    "lang.title": "Language",
    "lang.subtitle": "Choose your preferred language for Eden Rencontre.",
    "lang.french": "Français",
    "lang.english": "English",
    "lang.spanish": "Español",
    "lang.soon": "Soon",
    "lang.help_translate": "Want to help translate Eden Rencontre?",
    "lang.contact_us": "Contact us at",
    "lang.saved": "Language updated!",

    // Onboarding
    "onboarding.welcome": "Welcome to Eden Rencontre",
    "onboarding.step": "Step",
    "onboarding.step4.add_photo_later": "Add photo later",
    "onboarding.step4.skip": "Skip for now",

    // Discover Page
    "discover.title": "Discover",
    "discover.filters": "Filters",
    "discover.no_profiles": "No profiles match your criteria.",
    "discover.refresh": "Refresh",
    "discover.profiles_count": "{count} people match your criteria",

    // General
    "app.title": "Eden Rencontre",
    "app.slogan": "Authentic Christian Dating",
  },
} as const;

export type TranslationKey = keyof typeof translations.fr;
