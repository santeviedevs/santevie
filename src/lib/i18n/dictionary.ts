import { DEFAULT_LANGUAGE, type Language } from "./language";

// UI copy only — labels, headings, button text, static messages. Never put
// database-sourced values here (role/territory names, user data): those
// stay exactly as stored regardless of the selected language.
export type Dictionary = {
  // Kept out of `userForm` deliberately: `userForm` as a whole gets passed
  // as a prop into the (client) UserForm component, and a function value
  // can't cross that Server → Client boundary — only the edit page itself
  // (a Server Component) ever calls this, to build the page heading.
  editUserTitle: (name: string) => string;
  editTerritoryTitle: (name: string) => string;
  nav: {
    home: string;
    users: string;
    territories: string;
    installGuide: string;
  };
  header: {
    signOut: string;
    languageToggleLabel: string;
  };
  loginPage: {
    title: string;
    email: string;
    password: string;
    signIn: string;
    signingIn: string;
  };
  usersPage: {
    title: string;
    newUser: string;
    columnEmployeeCode: string;
    columnName: string;
    columnEmail: string;
    columnRole: string;
    columnManager: string;
    columnHomeTerritory: string;
    columnStatus: string;
    edit: string;
    noResults: string;
    statusActive: string;
    statusInactive: string;
  };
  filters: {
    searchLabel: string;
    searchPlaceholder: string;
    roleLabel: string;
    anyRole: string;
    territoryLabel: string;
    anyTerritory: string;
    statusLabel: string;
    anyStatus: string;
    active: string;
    inactive: string;
    clearFilters: string;
  };
  territoriesPage: {
    title: string;
    newTerritory: string;
    columnCode: string;
    columnName: string;
    columnStatus: string;
    edit: string;
    noResults: string;
    statusActive: string;
    statusInactive: string;
  };
  territoryFilters: {
    searchLabel: string;
    searchPlaceholder: string;
    statusLabel: string;
    anyStatus: string;
    active: string;
    inactive: string;
    clearFilters: string;
  };
  territoryForm: {
    newTerritoryTitle: string;
    code: string;
    name: string;
    activate: string;
    activeDescription: string;
    inactiveDescription: string;
    createTerritory: string;
    saveChanges: string;
    saving: string;
    territoryCreated: string;
    territoryUpdated: string;
  };
  userForm: {
    newUserTitle: string;
    employeeCode: string;
    name: string;
    email: string;
    role: string;
    selectRole: string;
    manager: string;
    noManager: string;
    homeTerritory: string;
    noHomeTerritory: string;
    activate: string;
    activeDescription: string;
    inactiveDescription: string;
    createUser: string;
    saveChanges: string;
    saving: string;
    userCreated: string;
    userUpdated: string;
  };
};

const en: Dictionary = {
  editUserTitle: (name) => `Edit ${name}`,
  editTerritoryTitle: (name) => `Edit ${name}`,
  nav: {
    home: "Home",
    users: "Users",
    territories: "Territories",
    installGuide: "Install guide",
  },
  header: {
    signOut: "Sign out",
    languageToggleLabel: "Language",
  },
  loginPage: {
    title: "Sign in",
    email: "Email",
    password: "Password",
    signIn: "Sign in",
    signingIn: "Signing in...",
  },
  usersPage: {
    title: "Users",
    newUser: "New user",
    columnEmployeeCode: "Employee code",
    columnName: "Name",
    columnEmail: "Email",
    columnRole: "Role",
    columnManager: "Manager",
    columnHomeTerritory: "Home territory",
    columnStatus: "Status",
    edit: "Edit",
    noResults: "No users match these filters.",
    statusActive: "ACTIVE",
    statusInactive: "INACTIVE",
  },
  filters: {
    searchLabel: "Search",
    searchPlaceholder: "Name, email or code",
    roleLabel: "Role",
    anyRole: "Any role",
    territoryLabel: "Territory",
    anyTerritory: "Any territory",
    statusLabel: "Status",
    anyStatus: "Any status",
    active: "Active",
    inactive: "Inactive",
    clearFilters: "Clear filters",
  },
  territoriesPage: {
    title: "Territories",
    newTerritory: "New territory",
    columnCode: "Code",
    columnName: "Name",
    columnStatus: "Status",
    edit: "Edit",
    noResults: "No territories match these filters.",
    statusActive: "ACTIVE",
    statusInactive: "INACTIVE",
  },
  territoryFilters: {
    searchLabel: "Search",
    searchPlaceholder: "Name or code",
    statusLabel: "Status",
    anyStatus: "Any status",
    active: "Active",
    inactive: "Inactive",
    clearFilters: "Clear filters",
  },
  territoryForm: {
    newTerritoryTitle: "New territory",
    code: "Code",
    name: "Name",
    activate: "Activate",
    activeDescription: "Selectable for new work.",
    inactiveDescription: "Deactivated — no longer selectable for new work. Save changes to reactivate.",
    createTerritory: "Create territory",
    saveChanges: "Save changes",
    saving: "Saving...",
    territoryCreated: "Territory created",
    territoryUpdated: "Territory updated",
  },
  userForm: {
    newUserTitle: "New user",
    employeeCode: "Employee code",
    name: "Name",
    email: "Email",
    role: "Role",
    selectRole: "Select a role",
    manager: "Manager",
    noManager: "No manager",
    homeTerritory: "Home territory",
    noHomeTerritory: "No home territory",
    activate: "Activate",
    activeDescription: "Can sign in and appears in active lists.",
    inactiveDescription: "Deactivated — can't sign in. Save changes to reactivate.",
    createUser: "Create user",
    saveChanges: "Save changes",
    saving: "Saving...",
    userCreated: "User created",
    userUpdated: "User updated",
  },
};

const fr: Dictionary = {
  editUserTitle: (name) => `Modifier ${name}`,
  editTerritoryTitle: (name) => `Modifier ${name}`,
  nav: {
    home: "Accueil",
    users: "Utilisateurs",
    territories: "Territoires",
    installGuide: "Guide d'installation",
  },
  header: {
    signOut: "Se déconnecter",
    languageToggleLabel: "Langue",
  },
  loginPage: {
    title: "Se connecter",
    email: "E-mail",
    password: "Mot de passe",
    signIn: "Se connecter",
    signingIn: "Connexion...",
  },
  usersPage: {
    title: "Utilisateurs",
    newUser: "Nouvel utilisateur",
    columnEmployeeCode: "Code employé",
    columnName: "Nom",
    columnEmail: "E-mail",
    columnRole: "Rôle",
    columnManager: "Responsable",
    columnHomeTerritory: "Territoire",
    columnStatus: "Statut",
    edit: "Modifier",
    noResults: "Aucun utilisateur ne correspond à ces filtres.",
    statusActive: "ACTIF",
    statusInactive: "INACTIF",
  },
  filters: {
    searchLabel: "Recherche",
    searchPlaceholder: "Nom, e-mail ou code",
    roleLabel: "Rôle",
    anyRole: "Tous les rôles",
    territoryLabel: "Territoire",
    anyTerritory: "Tous les territoires",
    statusLabel: "Statut",
    anyStatus: "Tous les statuts",
    active: "Actif",
    inactive: "Inactif",
    clearFilters: "Effacer les filtres",
  },
  territoriesPage: {
    title: "Territoires",
    newTerritory: "Nouveau territoire",
    columnCode: "Code",
    columnName: "Nom",
    columnStatus: "Statut",
    edit: "Modifier",
    noResults: "Aucun territoire ne correspond à ces filtres.",
    statusActive: "ACTIF",
    statusInactive: "INACTIF",
  },
  territoryFilters: {
    searchLabel: "Recherche",
    searchPlaceholder: "Nom ou code",
    statusLabel: "Statut",
    anyStatus: "Tous les statuts",
    active: "Actif",
    inactive: "Inactif",
    clearFilters: "Effacer les filtres",
  },
  territoryForm: {
    newTerritoryTitle: "Nouveau territoire",
    code: "Code",
    name: "Nom",
    activate: "Activer",
    activeDescription: "Sélectionnable pour de nouveaux travaux.",
    inactiveDescription:
      "Désactivé — n'est plus sélectionnable pour de nouveaux travaux. Enregistrez pour réactiver.",
    createTerritory: "Créer le territoire",
    saveChanges: "Enregistrer",
    saving: "Enregistrement...",
    territoryCreated: "Territoire créé",
    territoryUpdated: "Territoire mis à jour",
  },
  userForm: {
    newUserTitle: "Nouvel utilisateur",
    employeeCode: "Code employé",
    name: "Nom",
    email: "E-mail",
    role: "Rôle",
    selectRole: "Sélectionner un rôle",
    manager: "Responsable",
    noManager: "Aucun responsable",
    homeTerritory: "Territoire",
    noHomeTerritory: "Aucun territoire",
    activate: "Activer",
    activeDescription: "Peut se connecter et apparaît dans les listes actives.",
    inactiveDescription: "Désactivé — ne peut pas se connecter. Enregistrez pour réactiver.",
    createUser: "Créer l'utilisateur",
    saveChanges: "Enregistrer",
    saving: "Enregistrement...",
    userCreated: "Utilisateur créé",
    userUpdated: "Utilisateur mis à jour",
  },
};

const dictionaries: Record<Language, Dictionary> = { en, fr };

export function getDictionary(language: Language = DEFAULT_LANGUAGE): Dictionary {
  return dictionaries[language];
}
