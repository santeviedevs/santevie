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
  editProductTitle: (name: string) => string;
  nav: {
    home: string;
    users: string;
    territoriesGroup: string;
    manageTerritories: string;
    territoryAssignment: string;
    team: string;
    clients: string;
    products: string;
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
    // "Reports to" — currently only rendered on the Team screen (S2-04),
    // kept here alongside roleLabel since it's a generic user-list filter.
    reportsToLabel: string;
    anyReportsTo: string;
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
  // The Assign Territories admin screen (S2-04): pick a delegate, see
  // and manage the set of territories (at any level) they're allowed to
  // work in — distinct from territoriesPage above, which manages the
  // territory hierarchy itself, not who's assigned to it.
  territoryAssignmentPage: {
    title: string;
    userLabel: string;
    selectUser: string;
    pickUserPrompt: string;
    addHeading: string;
    currentHeading: string;
    noAssignments: string;
    assign: string;
    saving: string;
    remove: string;
    assigned: string;
    removed: string;
  };
  // The Supervisor's read-only "current team" screen (S2-04) — their
  // downstream team (via scope.ts) and each member's territory
  // assignments. No create/edit here, unlike territoryAssignmentPage.
  teamPage: {
    title: string;
    columnEmployeeCode: string;
    columnName: string;
    columnRole: string;
    columnReportsTo: string;
    noManager: string;
    columnTerritories: string;
    noAssignments: string;
    noResults: string;
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
  // The Product catalogue admin screen (S2-03). Both grossPrice and
  // netPrice are shown — the source price list carries both, and the
  // admin team relies on comparing them, same reasoning as the schema
  // comment on the Product model.
  productsPage: {
    title: string;
    newProduct: string;
    exchangeRate: string;
    columnCode: string;
    columnName: string;
    columnCategory: string;
    columnGrossPrice: string;
    columnNetPrice: string;
    columnStatus: string;
    edit: string;
    noResults: string;
    statusActive: string;
    statusInactive: string;
  };
  productFilters: {
    searchLabel: string;
    searchPlaceholder: string;
    categoryLabel: string;
    anyCategory: string;
    sortLabel: string;
    sortDefault: string;
    sortPriceAsc: string;
    sortPriceDesc: string;
    statusLabel: string;
    anyStatus: string;
    active: string;
    inactive: string;
    clearFilters: string;
  };
  productForm: {
    newProductTitle: string;
    code: string;
    name: string;
    category: string;
    noCategory: string;
    grossPrice: string;
    netPrice: string;
    // A convenience-only calculator, not a stored field — see the
    // comment in product-form.tsx.
    discountPercentHelper: string;
    discountPercentPlaceholder: string;
    cdfPreviewLabel: string;
    activate: string;
    activeDescription: string;
    inactiveDescription: string;
    createProduct: string;
    saveChanges: string;
    saving: string;
    productCreated: string;
    productUpdated: string;
  };
  // The USD → CDF exchange-rate settings screen — a single current rate an
  // admin can update, plus the append-only history of every past rate.
  exchangeRatePage: {
    title: string;
    currentRateLabel: string;
    noRateSet: string;
    rateLabel: string;
    rateHint: string;
    historyTitle: string;
    save: string;
    saving: string;
    rateUpdated: string;
  };
};

const en: Dictionary = {
  editUserTitle: (name) => `Edit ${name}`,
  editTerritoryTitle: (name) => `Edit ${name}`,
  editClientTitle: (name) => `Edit ${name}`,
  viewClientTitle: (name) => name,
  editProductTitle: (name) => `Edit ${name}`,
  nav: {
    home: "Home",
    users: "Users",
    territoriesGroup: "Territories",
    manageTerritories: "Manage Territories",
    territoryAssignment: "Assign Territories",
    team: "Team",
    clients: "Clients",
    products: "Products",
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
    reportsToLabel: "Reports to",
    anyReportsTo: "Any",
    statusLabel: "Status",
    anyStatus: "Any status",
    active: "Active",
    inactive: "Inactive",
    clearFilters: "Clear filters",
  },
  territoriesPage: {
    title: "Manage Territories",
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
  territoryAssignmentPage: {
    title: "Assign Territories",
    userLabel: "User",
    selectUser: "Select a user",
    pickUserPrompt: "Select a user to see and manage their assigned territories.",
    addHeading: "Assign a territory",
    currentHeading: "Assigned territories",
    noAssignments: "No territories assigned yet.",
    assign: "Assign",
    saving: "Saving...",
    remove: "Remove",
    assigned: "Territory assigned",
    removed: "Assignment removed",
  },
  teamPage: {
    title: "My team",
    columnEmployeeCode: "Employee code",
    columnName: "Name",
    columnRole: "Role",
    columnReportsTo: "Reports to",
    noManager: "—",
    columnTerritories: "Territories",
    noAssignments: "No territories assigned",
    noResults: "No one reports to you yet.",
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
  productsPage: {
    title: "Products",
    newProduct: "New product",
    exchangeRate: "Exchange rate",
    columnCode: "Code",
    columnName: "Name",
    columnCategory: "Category",
    columnGrossPrice: "Gross price",
    columnNetPrice: "Net price",
    columnStatus: "Status",
    edit: "Edit",
    noResults: "No products match these filters.",
    statusActive: "ACTIVE",
    statusInactive: "INACTIVE",
  },
  productFilters: {
    searchLabel: "Search",
    searchPlaceholder: "Name or code",
    categoryLabel: "Category",
    anyCategory: "Any category",
    sortLabel: "Sort by price",
    sortDefault: "Default (name)",
    sortPriceAsc: "Price: Low to high",
    sortPriceDesc: "Price: High to low",
    statusLabel: "Status",
    anyStatus: "Any status",
    active: "Active",
    inactive: "Inactive",
    clearFilters: "Clear filters",
  },
  productForm: {
    newProductTitle: "New product",
    code: "Code",
    name: "Name",
    category: "Category",
    noCategory: "No category",
    grossPrice: "Gross price (USD)",
    netPrice: "Net price (USD)",
    discountPercentHelper: "Discount % (optional)",
    discountPercentPlaceholder: "e.g. 10",
    cdfPreviewLabel: "≈",
    activate: "Activate",
    activeDescription: "Selectable for new orders.",
    inactiveDescription: "Deactivated — hidden from new order selection.",
    createProduct: "Create product",
    saveChanges: "Save changes",
    saving: "Saving...",
    productCreated: "Product created",
    productUpdated: "Product updated",
  },
  exchangeRatePage: {
    title: "Exchange rate",
    currentRateLabel: "Current rate",
    noRateSet: "No rate set yet",
    rateLabel: "USD to CDF rate",
    rateHint: "Set manually — updates whenever the admin decides, not automatically.",
    historyTitle: "History",
    save: "Save rate",
    saving: "Saving...",
    rateUpdated: "Exchange rate updated",
  },
};

const fr: Dictionary = {
  editUserTitle: (name) => `Modifier ${name}`,
  editTerritoryTitle: (name) => `Modifier ${name}`,
  editClientTitle: (name) => `Modifier ${name}`,
  viewClientTitle: (name) => name,
  editProductTitle: (name) => `Modifier ${name}`,
  nav: {
    home: "Accueil",
    users: "Utilisateurs",
    territoriesGroup: "Territoires",
    manageTerritories: "Gérer les territoires",
    territoryAssignment: "Affecter des territoires",
    team: "Équipe",
    clients: "Clients",
    products: "Produits",
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
    reportsToLabel: "Rattaché à",
    anyReportsTo: "Tous",
    statusLabel: "Statut",
    anyStatus: "Tous les statuts",
    active: "Actif",
    inactive: "Inactif",
    clearFilters: "Effacer les filtres",
  },
  territoriesPage: {
    title: "Gérer les territoires",
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
  territoryAssignmentPage: {
    title: "Affecter des territoires",
    userLabel: "Utilisateur",
    selectUser: "Sélectionner un utilisateur",
    pickUserPrompt: "Sélectionnez un utilisateur pour voir et gérer ses territoires affectés.",
    addHeading: "Affecter un territoire",
    currentHeading: "Territoires affectés",
    noAssignments: "Aucun territoire affecté pour le moment.",
    assign: "Affecter",
    saving: "Enregistrement...",
    remove: "Retirer",
    assigned: "Territoire affecté",
    removed: "Affectation retirée",
  },
  teamPage: {
    title: "Mon équipe",
    columnEmployeeCode: "Code employé",
    columnName: "Nom",
    columnRole: "Rôle",
    columnReportsTo: "Rattaché à",
    noManager: "—",
    columnTerritories: "Territoires",
    noAssignments: "Aucun territoire affecté",
    noResults: "Personne ne vous est rattaché pour le moment.",
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
  productsPage: {
    title: "Produits",
    newProduct: "Nouveau produit",
    exchangeRate: "Taux de change",
    columnCode: "Code",
    columnName: "Nom",
    columnCategory: "Catégorie",
    columnGrossPrice: "Prix brut",
    columnNetPrice: "Prix net",
    columnStatus: "Statut",
    edit: "Modifier",
    noResults: "Aucun produit ne correspond à ces filtres.",
    statusActive: "ACTIF",
    statusInactive: "INACTIF",
  },
  productFilters: {
    searchLabel: "Recherche",
    searchPlaceholder: "Nom ou code",
    categoryLabel: "Catégorie",
    anyCategory: "Toutes les catégories",
    sortLabel: "Trier par prix",
    sortDefault: "Par défaut (nom)",
    sortPriceAsc: "Prix : croissant",
    sortPriceDesc: "Prix : décroissant",
    statusLabel: "Statut",
    anyStatus: "Tous les statuts",
    active: "Actif",
    inactive: "Inactif",
    clearFilters: "Effacer les filtres",
  },
  productForm: {
    newProductTitle: "Nouveau produit",
    code: "Code",
    name: "Nom",
    category: "Catégorie",
    noCategory: "Aucune catégorie",
    grossPrice: "Prix brut (USD)",
    netPrice: "Prix net (USD)",
    discountPercentHelper: "Remise % (facultatif)",
    discountPercentPlaceholder: "ex. 10",
    cdfPreviewLabel: "≈",
    activate: "Activer",
    activeDescription: "Sélectionnable pour de nouvelles commandes.",
    inactiveDescription: "Désactivé — masqué des nouvelles commandes.",
    createProduct: "Créer le produit",
    saveChanges: "Enregistrer",
    saving: "Enregistrement...",
    productCreated: "Produit créé",
    productUpdated: "Produit mis à jour",
  },
  exchangeRatePage: {
    title: "Taux de change",
    currentRateLabel: "Taux actuel",
    noRateSet: "Aucun taux défini",
    rateLabel: "Taux USD vers CDF",
    rateHint:
      "Défini manuellement — mis à jour quand l'administrateur le décide, jamais automatiquement.",
    historyTitle: "Historique",
    save: "Enregistrer le taux",
    saving: "Enregistrement...",
    rateUpdated: "Taux de change mis à jour",
  },
};

const dictionaries: Record<Language, Dictionary> = { en, fr };

export function getDictionary(language: Language = DEFAULT_LANGUAGE): Dictionary {
  return dictionaries[language];
}
