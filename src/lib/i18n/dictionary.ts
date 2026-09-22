import { DEFAULT_LANGUAGE, type Language } from "./language";

// UI copy only — labels, headings, button text, static messages. Never put
// database-sourced values here (role/territory names, user data): those
// stay exactly as stored regardless of the selected language.
export type Dictionary = {
  // Kept out of `userForm`/`territoriesPage` deliberately: those objects
  // get passed as props into client components (UserForm, TerritoryForm),
  // and a function value can't cross that Server → Client boundary — only
  // the edit page itself (a Server Component) ever calls these, to build
  // the page heading.
  editUserTitle: (name: string) => string;
  editTerritoryTitle: (name: string) => string;
  editClientTitle: (name: string) => string;
  viewClientTitle: (name: string) => string;
  nav: {
    home: string;
    users: string;
    territories: string;
    clients: string;
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
  // Shared by the Territories admin form (create/edit) and the Users
  // form's territory assignment — the four hierarchy levels (Province >
  // Ville > Commune > Quartier), plus placeholders reused by every
  // cascading select.
  territory: {
    province: string;
    ville: string;
    commune: string;
    quartier: string;
    selectProvince: string;
    selectVille: string;
    selectCommune: string;
    selectQuartier: string;
    anyProvince: string;
    anyVille: string;
    anyCommune: string;
    anyQuartier: string;
    // A plain string template rather than a `(name) => string` function —
    // this dict is passed into TerritoryForm, a Client Component, and
    // functions can't cross that Server → Client boundary (see the note on
    // editUserTitle/editTerritoryTitle above). The combobox does the
    // `"{name}"` substitution itself.
    createOption: string;
    noMatches: string;
    // "{label}" is substituted with province/ville/commune's own label above.
    typeOrSelectPlaceholder: string;
    typeOrCreatePlaceholder: string;
  };
  usersPage: {
    title: string;
    newUser: string;
    columnEmployeeCode: string;
    columnName: string;
    columnEmail: string;
    columnRole: string;
    columnManager: string;
    columnTerritory: string;
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
    statusLabel: string;
    anyStatus: string;
    active: string;
    inactive: string;
    clearFilters: string;
  };
  // The Territories admin screen: one list (one row per territory, i.e.
  // one Quartier with its full Province/Ville/Commune path) with cascading
  // filters, plus a single create/edit form — mirrors usersPage/userForm.
  territoriesPage: {
    title: string;
    newTerritory: string;
    searchLabel: string;
    searchPlaceholder: string;
    statusLabel: string;
    anyStatus: string;
    active: string;
    inactive: string;
    provinceLabel: string;
    villeLabel: string;
    communeLabel: string;
    // A Territory can now be a Province, Ville, Commune, or Quartier row on
    // its own — the list shows all four as columns, each entry's own name
    // in whichever column matches its level, the rest blank.
    quartierLabel: string;
    columnStatus: string;
    edit: string;
    noResults: string;
    statusActive: string;
    statusInactive: string;
    clearFilters: string;
    createTerritory: string;
    save: string;
    saving: string;
    created: string;
    updated: string;
    activate: string;
    // Heading over the edit form's optional "also add a new one below this"
    // fields — e.g. editing a Province can grow a new Ville under it.
    addChildHeading: string;
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
    territorySectionLabel: string;
    activate: string;
    activeDescription: string;
    inactiveDescription: string;
    createUser: string;
    saveChanges: string;
    saving: string;
    userCreated: string;
    userUpdated: string;
  };
  // The Client master admin screen (S2-02: Doctor/Hospital/Chemist/
  // Pharmacy) — mirrors usersPage/userForm/filters in shape.
  clientsPage: {
    title: string;
    newClient: string;
    columnCode: string;
    columnName: string;
    columnType: string;
    columnTerritory: string;
    columnCoordinates: string;
    columnStatus: string;
    view: string;
    edit: string;
    noResults: string;
    statusActive: string;
    statusInactive: string;
    missingCoordinates: string;
  };
  clientFilters: {
    searchLabel: string;
    searchPlaceholder: string;
    typeLabel: string;
    anyType: string;
    statusLabel: string;
    anyStatus: string;
    active: string;
    inactive: string;
    missingCoordinates: string;
    clearFilters: string;
  };
  clientForm: {
    newClientTitle: string;
    code: string;
    name: string;
    type: string;
    selectType: string;
    contact: string;
    address: string;
    territorySectionLabel: string;
    coordinatesLabel: string;
    noCoordinates: string;
    doctorSectionLabel: string;
    doctorType: string;
    gender: string;
    department: string;
    mobileNo: string;
    associatedHospitals: string;
    noHospitals: string;
    hospitalSectionLabel: string;
    hospitalCategory: string;
    activate: string;
    activeDescription: string;
    inactiveDescription: string;
    createClient: string;
    saveChanges: string;
    saving: string;
    clientCreated: string;
    clientUpdated: string;
  };
  // The read-only Client detail screen — reuses clientForm's field labels
  // (code/name/type/doctorType/...) for consistency, and only adds what's
  // specific to a view: section headings, the edit/back links, and a
  // fallback for an empty field.
  clientDetailPage: {
    backToList: string;
    editClient: string;
    detailsSectionLabel: string;
    contact: string;
    address: string;
    notProvided: string;
    hospitalCode: string;
  };
};

const en: Dictionary = {
  editUserTitle: (name) => `Edit ${name}`,
  editTerritoryTitle: (name) => `Edit ${name}`,
  editClientTitle: (name) => `Edit ${name}`,
  viewClientTitle: (name) => name,
  nav: {
    home: "Home",
    users: "Users",
    territories: "Territories",
    clients: "Clients",
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
  territory: {
    province: "Province",
    ville: "Ville",
    commune: "Commune",
    quartier: "Quartier",
    selectProvince: "Select a province",
    selectVille: "Select a ville",
    selectCommune: "Select a commune",
    selectQuartier: "Select a quartier",
    anyProvince: "Any province",
    anyVille: "Any ville",
    anyCommune: "Any commune",
    anyQuartier: "Any quartier",
    createOption: 'Create "{name}"',
    noMatches: "No matches",
    typeOrSelectPlaceholder: "Type or select {label}...",
    typeOrCreatePlaceholder: "Type or create {label}...",
  },
  usersPage: {
    title: "Users",
    newUser: "New user",
    columnEmployeeCode: "Employee code",
    columnName: "Name",
    columnEmail: "Email",
    columnRole: "Role",
    columnManager: "Manager",
    columnTerritory: "Territory",
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
    statusLabel: "Status",
    anyStatus: "Any status",
    active: "Active",
    inactive: "Inactive",
    clearFilters: "Clear filters",
  },
  territoriesPage: {
    title: "Territories",
    newTerritory: "New territory",
    searchLabel: "Search",
    searchPlaceholder: "Name",
    statusLabel: "Status",
    anyStatus: "Any status",
    active: "Active",
    inactive: "Inactive",
    provinceLabel: "Province",
    villeLabel: "Ville",
    communeLabel: "Commune",
    quartierLabel: "Quartier",
    columnStatus: "Status",
    edit: "Edit",
    noResults: "No territories match these filters.",
    statusActive: "ACTIVE",
    statusInactive: "INACTIVE",
    clearFilters: "Clear filters",
    createTerritory: "Create territory",
    save: "Save changes",
    saving: "Saving...",
    created: "Territory created",
    updated: "Territory updated",
    activate: "Activate",
    addChildHeading: "Also add a new one below",
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
    territorySectionLabel: "Territory",
    activate: "Activate",
    activeDescription: "Can sign in and appears in active lists.",
    inactiveDescription: "Deactivated — can't sign in. Save changes to reactivate.",
    createUser: "Create user",
    saveChanges: "Save changes",
    saving: "Saving...",
    userCreated: "User created",
    userUpdated: "User updated",
  },
  clientsPage: {
    title: "Clients",
    newClient: "New client",
    columnCode: "Code",
    columnName: "Name",
    columnType: "Type",
    columnTerritory: "Territory",
    columnCoordinates: "Coordinates",
    columnStatus: "Status",
    view: "View",
    edit: "Edit",
    noResults: "No clients match these filters.",
    statusActive: "ACTIVE",
    statusInactive: "INACTIVE",
    missingCoordinates: "Missing coordinates",
  },
  clientFilters: {
    searchLabel: "Search",
    searchPlaceholder: "Name or code",
    typeLabel: "Type",
    anyType: "Any type",
    statusLabel: "Status",
    anyStatus: "Any status",
    active: "Active",
    inactive: "Inactive",
    missingCoordinates: "Missing coordinates",
    clearFilters: "Clear filters",
  },
  clientForm: {
    newClientTitle: "New client",
    code: "Code",
    name: "Name",
    type: "Type",
    selectType: "Select a type",
    contact: "Contact",
    address: "Address",
    territorySectionLabel: "Territory",
    coordinatesLabel: "Coordinates",
    noCoordinates: "No coordinates set — click the map to place a pin.",
    doctorSectionLabel: "Doctor details",
    doctorType: "Doctor type",
    gender: "Gender",
    department: "Department",
    mobileNo: "Mobile number",
    associatedHospitals: "Associated hospitals",
    noHospitals: "No active hospitals to associate yet.",
    hospitalSectionLabel: "Hospital details",
    hospitalCategory: "Hospital category",
    activate: "Activate",
    activeDescription: "Selectable for new visits and orders.",
    inactiveDescription: "Deactivated — hidden from new visit/order selection, kept in history.",
    createClient: "Create client",
    saveChanges: "Save changes",
    saving: "Saving...",
    clientCreated: "Client created",
    clientUpdated: "Client updated",
  },
  clientDetailPage: {
    backToList: "Back to clients",
    editClient: "Edit client",
    detailsSectionLabel: "Details",
    contact: "Contact",
    address: "Address",
    notProvided: "Not provided",
    hospitalCode: "Code",
  },
};

const fr: Dictionary = {
  editUserTitle: (name) => `Modifier ${name}`,
  editTerritoryTitle: (name) => `Modifier ${name}`,
  editClientTitle: (name) => `Modifier ${name}`,
  viewClientTitle: (name) => name,
  nav: {
    home: "Accueil",
    users: "Utilisateurs",
    territories: "Territoires",
    clients: "Clients",
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
  territory: {
    province: "Province",
    ville: "Ville",
    commune: "Commune",
    quartier: "Quartier",
    selectProvince: "Sélectionner une province",
    selectVille: "Sélectionner une ville",
    selectCommune: "Sélectionner une commune",
    selectQuartier: "Sélectionner un quartier",
    anyProvince: "Toutes les provinces",
    anyVille: "Toutes les villes",
    anyCommune: "Toutes les communes",
    anyQuartier: "Tous les quartiers",
    createOption: 'Créer "{name}"',
    noMatches: "Aucun résultat",
    typeOrSelectPlaceholder: "Saisir ou sélectionner {label}...",
    typeOrCreatePlaceholder: "Saisir ou créer {label}...",
  },
  usersPage: {
    title: "Utilisateurs",
    newUser: "Nouvel utilisateur",
    columnEmployeeCode: "Code employé",
    columnName: "Nom",
    columnEmail: "E-mail",
    columnRole: "Rôle",
    columnManager: "Responsable",
    columnTerritory: "Territoire",
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
    statusLabel: "Statut",
    anyStatus: "Tous les statuts",
    active: "Actif",
    inactive: "Inactif",
    clearFilters: "Effacer les filtres",
  },
  territoriesPage: {
    title: "Territoires",
    newTerritory: "Nouveau territoire",
    searchLabel: "Recherche",
    searchPlaceholder: "Nom",
    statusLabel: "Statut",
    anyStatus: "Tous les statuts",
    active: "Actif",
    inactive: "Inactif",
    provinceLabel: "Province",
    villeLabel: "Ville",
    communeLabel: "Commune",
    quartierLabel: "Quartier",
    columnStatus: "Statut",
    edit: "Modifier",
    noResults: "Aucun territoire ne correspond à ces filtres.",
    statusActive: "ACTIF",
    statusInactive: "INACTIF",
    clearFilters: "Effacer les filtres",
    createTerritory: "Créer le territoire",
    save: "Enregistrer",
    saving: "Enregistrement...",
    created: "Territoire créé",
    updated: "Territoire mis à jour",
    activate: "Activer",
    addChildHeading: "Ajouter également un nouveau en dessous",
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
    territorySectionLabel: "Territoire",
    activate: "Activer",
    activeDescription: "Peut se connecter et apparaît dans les listes actives.",
    inactiveDescription: "Désactivé — ne peut pas se connecter. Enregistrez pour réactiver.",
    createUser: "Créer l'utilisateur",
    saveChanges: "Enregistrer",
    saving: "Enregistrement...",
    userCreated: "Utilisateur créé",
    userUpdated: "Utilisateur mis à jour",
  },
  clientsPage: {
    title: "Clients",
    newClient: "Nouveau client",
    columnCode: "Code",
    columnName: "Nom",
    columnType: "Type",
    columnTerritory: "Territoire",
    columnCoordinates: "Coordonnées",
    columnStatus: "Statut",
    view: "Voir",
    edit: "Modifier",
    noResults: "Aucun client ne correspond à ces filtres.",
    statusActive: "ACTIF",
    statusInactive: "INACTIF",
    missingCoordinates: "Coordonnées manquantes",
  },
  clientFilters: {
    searchLabel: "Recherche",
    searchPlaceholder: "Nom ou code",
    typeLabel: "Type",
    anyType: "Tous les types",
    statusLabel: "Statut",
    anyStatus: "Tous les statuts",
    active: "Actif",
    inactive: "Inactif",
    missingCoordinates: "Coordonnées manquantes",
    clearFilters: "Effacer les filtres",
  },
  clientForm: {
    newClientTitle: "Nouveau client",
    code: "Code",
    name: "Nom",
    type: "Type",
    selectType: "Sélectionner un type",
    contact: "Contact",
    address: "Adresse",
    territorySectionLabel: "Territoire",
    coordinatesLabel: "Coordonnées",
    noCoordinates: "Aucune coordonnée définie — cliquez sur la carte pour placer un repère.",
    doctorSectionLabel: "Détails du médecin",
    doctorType: "Type de médecin",
    gender: "Genre",
    department: "Département",
    mobileNo: "Numéro de mobile",
    associatedHospitals: "Hôpitaux associés",
    noHospitals: "Aucun hôpital actif à associer pour le moment.",
    hospitalSectionLabel: "Détails de l'hôpital",
    hospitalCategory: "Catégorie d'hôpital",
    activate: "Activer",
    activeDescription: "Sélectionnable pour de nouvelles visites et commandes.",
    inactiveDescription:
      "Désactivé — masqué des nouvelles visites/commandes, conservé dans l'historique.",
    createClient: "Créer le client",
    saveChanges: "Enregistrer",
    saving: "Enregistrement...",
    clientCreated: "Client créé",
    clientUpdated: "Client mis à jour",
  },
  clientDetailPage: {
    backToList: "Retour aux clients",
    editClient: "Modifier le client",
    detailsSectionLabel: "Détails",
    contact: "Contact",
    address: "Adresse",
    notProvided: "Non renseigné",
    hospitalCode: "Code",
  },
};

const dictionaries: Record<Language, Dictionary> = { en, fr };

export function getDictionary(language: Language = DEFAULT_LANGUAGE): Dictionary {
  return dictionaries[language];
}
