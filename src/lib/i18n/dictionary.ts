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
    leavesGroup: string;
    myLeaves: string;
    teamLeaves: string;
    calendar: string;
    attendanceGroup: string;
    checkIn: string;
  };
  header: {
    signOut: string;
    languageToggleLabel: string;
  };
  // Shared by every admin/team list screen's pagination controls.
  pagination: {
    previous: string;
    next: string;
    pageInfo: (page: number, totalPages: number, total: number) => string;
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
    code: string;
    codeRequired: string;
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
    // Label/placeholder for the single-combobox TerritoryPicker used on
    // list-filter screens (clients, users, team) — distinct from `province`
    // above, which is specifically the top hierarchy level in the
    // Territories admin form.
    territoryFilterLabel: string;
    // Label for the same TerritoryPicker when used to assign/pick a
    // territory on a record (client form, user form, territory assignment)
    // rather than to filter a list.
    territoryPickerLabel: string;
    selectTerritoryFilter: string;
    anyTerritoryFilter: string;
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
    importButton: string;
    columnCode: string;
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
    columnContractStartDate: string;
    columnContractDuration: string;
    columnContractExpiry: string;
    noContract: string;
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
    contractStartDate: string;
    contractDuration: string;
    contractExpiry: string;
    durationUnitDays: string;
    durationUnitMonths: string;
    durationUnitYears: string;
    activate: string;
    activeDescription: string;
    inactiveDescription: string;
    locationRequirement: string;
    locationRequirementInheritRequired: string;
    locationRequirementInheritNotRequired: string;
    locationRequirementRequired: string;
    locationRequirementNotRequired: string;
    createUser: string;
    saveChanges: string;
    saving: string;
    userCreated: string;
    userUpdated: string;
  };
  // Shared by both My Leaves (S3-01: own requests, every role) and Team
  // Leaves (downstream requests, approve/reject) — same table shape, only
  // the Actions column and the scope differ between the two pages.
  leavesPage: {
    myTitle: string;
    teamTitle: string;
    applyLeave: string;
    columnEmployee: string;
    columnType: string;
    columnDates: string;
    columnStatus: string;
    columnReason: string;
    columnActions: string;
    statusPending: string;
    statusApproved: string;
    statusRejected: string;
    approve: string;
    reject: string;
    view: string;
    noResults: string;
    approveConfirmTitle: string;
    approveConfirmButton: string;
    rejectConfirmTitle: string;
    rejectRemarkLabel: string;
    rejectConfirmButton: string;
    cancel: string;
    leaveApplied: string;
    leaveDecided: string;
    filterLeaveType: string;
    filterAnyLeaveType: string;
    filterStatus: string;
    filterAnyStatus: string;
    filterFrom: string;
    filterTo: string;
    filterEmployee: string;
    filterAnyEmployee: string;
    clearFilters: string;
  };
  leaveForm: {
    title: string;
    leaveType: string;
    selectLeaveType: string;
    startDate: string;
    endDate: string;
    reason: string;
    submit: string;
    saving: string;
  };
  // S3-02 GPS check-in. Location UI strings only appear when the resolved
  // requiresLocation flag is true for the signed-in user — a
  // location-not-required user only ever sees title/checkInButton/success*.
  checkInPage: {
    title: string;
    permissionGuidance: string;
    checkInButton: string;
    requesting: string;
    deniedTitle: string;
    deniedBody: string;
    unavailableTitle: string;
    unavailableBody: string;
    timeoutTitle: string;
    timeoutBody: string;
    lowAccuracyTitle: string;
    lowAccuracyBody: string;
    tryAgain: string;
    successTitle: string;
    // Plain string, not a function: this whole object is passed as a prop
    // into CheckInForm, a Client Component — a function anywhere in that
    // props object breaks RSC serialization even if never called client-side
    // (see pagination-controls.tsx for the same constraint elsewhere). The
    // formatted time is appended by the client, not interpolated here.
    successBodyPrefix: string;
    backToHome: string;
    alreadyCheckedIn: string;
    notAWorkingDay: string;
  };
  // The Holidays admin screen (S3-01) — mirrors territoriesPage/
  // territoryForm in shape: one list with filters, one create/edit form.
  holidaysPage: {
    title: string;
    newHoliday: string;
    territoryLabel: string;
    anyTerritory: string;
    yearLabel: string;
    anyYear: string;
    clearFilters: string;
    columnDates: string;
    columnName: string;
    columnTerritory: string;
    allTerritories: string;
    columnStatus: string;
    edit: string;
    noResults: string;
    statusActive: string;
    statusInactive: string;
  };
  holidayForm: {
    newTitle: string;
    name: string;
    startDate: string;
    endDate: string;
    territory: string;
    allTerritories: string;
    save: string;
    saving: string;
    created: string;
    updated: string;
    activate: string;
  };
  // Per-territory working-week configuration (S3-01, D4 placeholder) —
  // reached from the Territory admin screen, not a standalone list.
  workingDaysPage: {
    title: string;
    dayLabels: [string, string, string, string, string, string, string];
    save: string;
    saving: string;
    updated: string;
  };
  // The Calendar screen: a month-grid view of the viewer's own holidays,
  // weekly-offs and leave status, plus a Holidays tab (the same
  // holidaysPage list, now reachable by every role instead of admin-only).
  calendarPage: {
    tabCalendar: string;
    tabHolidays: string;
    subtitle: string;
    today: string;
    legendPublicHoliday: string;
    legendWeeklyOff: string;
    legendApprovedLeave: string;
    legendPendingLeave: string;
    legendRejectedLeave: string;
  };
  // The Client master admin screen (S2-02: Doctor/Hospital/Chemist/
  // Pharmacy) — mirrors usersPage/userForm/filters in shape.
  clientsPage: {
    title: string;
    newClient: string;
    importButton: string;
    columnCode: string;
    columnName: string;
    columnType: string;
    columnResponsiblePerson: string;
    columnContact: string;
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
    responsiblePerson: string;
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
    searchHospitals: string;
    noHospitalsMatch: string;
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
    responsiblePerson: string;
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
    importButton: string;
    exchangeRate: string;
    columnCode: string;
    columnName: string;
    columnCategory: string;
    columnGrossPrice: string;
    columnNetPrice: string;
    columnQuantityPerCarton: string;
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
    quantityPerCarton: string;
    grossPrice: string;
    netPrice: string;
    // A convenience-only calculator, not a stored field — see the
    // comment in product-form.tsx.
    discountPercentHelper: string;
    discountPercentPlaceholder: string;
    discountPercentMaxError: string;
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
  // The bulk import screen (S2-05) — one shared wizard for territories,
  // clients and products, distinguished only by which entity's endpoint
  // and column list it's pointed at.
  importPage: {
    backToList: string;
    downloadTemplate: string;
    chooseFile: string;
    noFileChosen: string;
    preview: string;
    previewing: string;
    confirmImport: string;
    importing: string;
    // Shown once the file has fully reached the server but the row-by-row
    // validation/resolution is still running — distinct from `previewing`/
    // `importing`, which describe the upload itself.
    processingFile: string;
    startOver: string;
    totalRows: string;
    willCreate: string;
    willUpdate: string;
    willReject: string;
    errorsHeading: string;
    rowColumn: string;
    errorsColumn: string;
    downloadErrorReport: string;
    resultHeading: string;
    created: string;
    updated: string;
    rejected: string;
    linkWarningsHeading: string;
    genericError: string;
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
    leavesGroup: "Leaves",
    myLeaves: "My Leaves",
    teamLeaves: "Team Leaves",
    calendar: "Calendar",
    attendanceGroup: "Attendance",
    checkIn: "Check In",
  },
  header: {
    signOut: "Sign out",
    languageToggleLabel: "Language",
  },
  pagination: {
    previous: "Previous",
    next: "Next",
    pageInfo: (page, totalPages, total) => `Page ${page} of ${totalPages} (${total} total)`,
  },
  loginPage: {
    title: "Sign in",
    email: "Email",
    password: "Password",
    signIn: "Sign in",
    signingIn: "Signing in...",
  },
  territory: {
    code: "Code",
    codeRequired: "Code is required",
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
    territoryFilterLabel: "Territory Filter",
    territoryPickerLabel: "Territory",
    selectTerritoryFilter: "Select a territory",
    anyTerritoryFilter: "Any territory",
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
    importButton: "Import",
    columnCode: "Code",
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
    columnContractStartDate: "Contract start",
    columnContractDuration: "Duration",
    columnContractExpiry: "Contract expiry",
    noContract: "—",
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
    contractStartDate: "Contract start date",
    contractDuration: "Contract duration",
    contractExpiry: "Contract expiry (calculated)",
    durationUnitDays: "Days",
    durationUnitMonths: "Months",
    durationUnitYears: "Years",
    activate: "Activate",
    activeDescription: "Can sign in and appears in active lists.",
    inactiveDescription: "Deactivated — can't sign in. Save changes to reactivate.",
    locationRequirement: "GPS for check-in",
    locationRequirementInheritRequired: "Use role default (currently: required)",
    locationRequirementInheritNotRequired: "Use role default (currently: not required)",
    locationRequirementRequired: "Always require GPS",
    locationRequirementNotRequired: "Never require GPS",
    createUser: "Create user",
    saveChanges: "Save changes",
    saving: "Saving...",
    userCreated: "User created",
    userUpdated: "User updated",
  },
  leavesPage: {
    myTitle: "My Leaves",
    teamTitle: "Team Leaves",
    applyLeave: "Apply Leave",
    columnEmployee: "Employee",
    columnType: "Leave type",
    columnDates: "Dates",
    columnStatus: "Status",
    columnReason: "Reason",
    columnActions: "Actions",
    statusPending: "Pending",
    statusApproved: "Approved",
    statusRejected: "Rejected",
    approve: "Approve",
    reject: "Reject",
    view: "View",
    noResults: "No leave requests found.",
    approveConfirmTitle: "Approve this leave request?",
    approveConfirmButton: "Approve leave",
    rejectConfirmTitle: "Reject this leave request?",
    rejectRemarkLabel: "Reason for rejection (optional)",
    rejectConfirmButton: "Reject leave",
    cancel: "Cancel",
    leaveApplied: "Leave request submitted",
    leaveDecided: "Leave request updated",
    filterLeaveType: "Leave type",
    filterAnyLeaveType: "Any leave type",
    filterStatus: "Status",
    filterAnyStatus: "Any status",
    filterFrom: "From",
    filterTo: "To",
    filterEmployee: "Employee",
    filterAnyEmployee: "Any employee",
    clearFilters: "Clear filters",
  },
  leaveForm: {
    title: "Apply Leave",
    leaveType: "Leave type",
    selectLeaveType: "Select a leave type",
    startDate: "Start date",
    endDate: "End date",
    reason: "Reason",
    submit: "Submit leave request",
    saving: "Submitting...",
  },
  checkInPage: {
    title: "Check In",
    permissionGuidance: "We need your location to confirm your check-in.",
    checkInButton: "Check In",
    requesting: "Getting your location...",
    deniedTitle: "Location access denied",
    deniedBody: "Enable location for this site in your browser settings, then try again.",
    unavailableTitle: "Location unavailable",
    unavailableBody: "Make sure location services are turned on for this device, then try again.",
    timeoutTitle: "Couldn't get your location in time",
    timeoutBody: "Move to an area with a clearer view of the sky and try again.",
    lowAccuracyTitle: "Location isn't precise enough",
    lowAccuracyBody: "Move outdoors or away from buildings, then try again.",
    tryAgain: "Try again",
    successTitle: "You're checked in",
    successBodyPrefix: "Recorded at",
    backToHome: "Back to home",
    alreadyCheckedIn: "You've already checked in today.",
    notAWorkingDay: "Today isn't a working day, so check-in isn't available.",
  },
  holidaysPage: {
    title: "Holidays",
    newHoliday: "Add Holiday",
    territoryLabel: "Territory",
    anyTerritory: "All territories",
    yearLabel: "Year",
    anyYear: "Any year",
    clearFilters: "Clear filters",
    columnDates: "Date / Range",
    columnName: "Holiday name",
    columnTerritory: "Territory",
    allTerritories: "All territories",
    columnStatus: "Status",
    edit: "Edit",
    noResults: "No holidays found.",
    statusActive: "Active",
    statusInactive: "Inactive",
  },
  holidayForm: {
    newTitle: "Create Holiday",
    name: "Holiday name",
    startDate: "Start date",
    endDate: "End date",
    territory: "Territory",
    allTerritories: "All territories",
    save: "Save holiday",
    saving: "Saving...",
    created: "Holiday created",
    updated: "Holiday updated",
    activate: "Active",
  },
  workingDaysPage: {
    title: "Territory Working Days",
    dayLabels: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    save: "Save",
    saving: "Saving...",
    updated: "Working days updated",
  },
  calendarPage: {
    tabCalendar: "Calendar",
    tabHolidays: "Holidays",
    subtitle: "Holidays, your weekly offs and approved leaves.",
    today: "Today",
    legendPublicHoliday: "Public holiday",
    legendWeeklyOff: "Weekly off",
    legendApprovedLeave: "Approved leave",
    legendPendingLeave: "Pending leave",
    legendRejectedLeave: "Rejected leave",
  },
  clientsPage: {
    title: "Clients",
    newClient: "New client",
    importButton: "Import",
    columnCode: "Code",
    columnName: "Name",
    columnType: "Type",
    columnResponsiblePerson: "Responsible person",
    columnContact: "Contact",
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
    responsiblePerson: "Responsible person",
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
    searchHospitals: "Search hospitals by name or code...",
    noHospitalsMatch: "No hospitals match your search.",
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
    responsiblePerson: "Responsible person",
    contact: "Contact",
    address: "Address",
    notProvided: "Not provided",
    hospitalCode: "Code",
  },
  productsPage: {
    title: "Products",
    newProduct: "New product",
    importButton: "Import",
    exchangeRate: "Exchange rate",
    columnCode: "Code",
    columnName: "Name",
    columnCategory: "Category",
    columnGrossPrice: "Gross price",
    columnNetPrice: "Net price",
    columnQuantityPerCarton: "Qty/carton",
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
    quantityPerCarton: "Quantity per carton",
    grossPrice: "Gross price (USD)",
    netPrice: "Net price (USD)",
    discountPercentHelper: "Discount % (optional)",
    discountPercentPlaceholder: "e.g. 10",
    discountPercentMaxError: "Can't enter discount more than 10%.",
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
  importPage: {
    backToList: "Back to list",
    downloadTemplate: "Download template",
    chooseFile: "Choose file",
    noFileChosen: "No file chosen",
    preview: "Preview",
    previewing: "Checking file...",
    confirmImport: "Confirm import",
    importing: "Importing...",
    processingFile: "Processing rows...",
    startOver: "Start over",
    totalRows: "Total rows",
    willCreate: "Will create",
    willUpdate: "Will update",
    willReject: "Will reject",
    errorsHeading: "Rows with errors",
    rowColumn: "Row",
    errorsColumn: "Errors",
    downloadErrorReport: "Download error report",
    resultHeading: "Import complete",
    created: "Created",
    updated: "Updated",
    rejected: "Rejected",
    linkWarningsHeading: "Hospital links that couldn't be resolved",
    genericError: "Something went wrong. Check the file and try again.",
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
    leavesGroup: "Congés",
    myLeaves: "Mes congés",
    teamLeaves: "Congés de l'équipe",
    calendar: "Calendrier",
    attendanceGroup: "Présence",
    checkIn: "Pointage",
  },
  header: {
    signOut: "Se déconnecter",
    languageToggleLabel: "Langue",
  },
  pagination: {
    previous: "Précédent",
    next: "Suivant",
    pageInfo: (page, totalPages, total) => `Page ${page} sur ${totalPages} (${total} au total)`,
  },
  loginPage: {
    title: "Se connecter",
    email: "E-mail",
    password: "Mot de passe",
    signIn: "Se connecter",
    signingIn: "Connexion...",
  },
  territory: {
    code: "Code",
    codeRequired: "Le code est requis",
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
    territoryFilterLabel: "Filtre territoire",
    territoryPickerLabel: "Territoire",
    selectTerritoryFilter: "Sélectionner un territoire",
    anyTerritoryFilter: "Tout territoire",
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
    importButton: "Importer",
    columnCode: "Code",
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
    columnContractStartDate: "Début du contrat",
    columnContractDuration: "Durée",
    columnContractExpiry: "Expiration du contrat",
    noContract: "—",
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
    contractStartDate: "Date de début du contrat",
    contractDuration: "Durée du contrat",
    contractExpiry: "Expiration du contrat (calculée)",
    durationUnitDays: "Jours",
    durationUnitMonths: "Mois",
    durationUnitYears: "Années",
    activate: "Activer",
    activeDescription: "Peut se connecter et apparaît dans les listes actives.",
    inactiveDescription: "Désactivé — ne peut pas se connecter. Enregistrez pour réactiver.",
    locationRequirement: "GPS pour le pointage",
    locationRequirementInheritRequired: "Utiliser le défaut du rôle (actuellement : requis)",
    locationRequirementInheritNotRequired: "Utiliser le défaut du rôle (actuellement : non requis)",
    locationRequirementRequired: "Toujours exiger le GPS",
    locationRequirementNotRequired: "Ne jamais exiger le GPS",
    createUser: "Créer l'utilisateur",
    saveChanges: "Enregistrer",
    saving: "Enregistrement...",
    userCreated: "Utilisateur créé",
    userUpdated: "Utilisateur mis à jour",
  },
  leavesPage: {
    myTitle: "Mes congés",
    teamTitle: "Congés de l'équipe",
    applyLeave: "Demander un congé",
    columnEmployee: "Employé",
    columnType: "Type de congé",
    columnDates: "Dates",
    columnStatus: "Statut",
    columnReason: "Motif",
    columnActions: "Actions",
    statusPending: "En attente",
    statusApproved: "Approuvé",
    statusRejected: "Rejeté",
    approve: "Approuver",
    reject: "Rejeter",
    view: "Voir",
    noResults: "Aucune demande de congé trouvée.",
    approveConfirmTitle: "Approuver cette demande de congé ?",
    approveConfirmButton: "Approuver le congé",
    rejectConfirmTitle: "Rejeter cette demande de congé ?",
    rejectRemarkLabel: "Motif du rejet (facultatif)",
    rejectConfirmButton: "Rejeter le congé",
    cancel: "Annuler",
    leaveApplied: "Demande de congé envoyée",
    leaveDecided: "Demande de congé mise à jour",
    filterLeaveType: "Type de congé",
    filterAnyLeaveType: "Tous les types",
    filterStatus: "Statut",
    filterAnyStatus: "Tous les statuts",
    filterFrom: "Du",
    filterTo: "Au",
    filterEmployee: "Employé",
    filterAnyEmployee: "Tous les employés",
    clearFilters: "Effacer les filtres",
  },
  leaveForm: {
    title: "Demander un congé",
    leaveType: "Type de congé",
    selectLeaveType: "Sélectionner un type de congé",
    startDate: "Date de début",
    endDate: "Date de fin",
    reason: "Motif",
    submit: "Envoyer la demande",
    saving: "Envoi en cours...",
  },
  checkInPage: {
    title: "Pointage",
    permissionGuidance: "Nous avons besoin de votre position pour confirmer votre pointage.",
    checkInButton: "Pointer",
    requesting: "Récupération de votre position...",
    deniedTitle: "Accès à la position refusé",
    deniedBody:
      "Activez la localisation pour ce site dans les paramètres de votre navigateur, puis réessayez.",
    unavailableTitle: "Position indisponible",
    unavailableBody: "Vérifiez que la localisation est activée sur cet appareil, puis réessayez.",
    timeoutTitle: "Impossible d'obtenir votre position à temps",
    timeoutBody: "Déplacez-vous vers un endroit avec une meilleure vue du ciel, puis réessayez.",
    lowAccuracyTitle: "La position n'est pas assez précise",
    lowAccuracyBody: "Déplacez-vous à l'extérieur ou loin des bâtiments, puis réessayez.",
    tryAgain: "Réessayer",
    successTitle: "Vous êtes pointé",
    successBodyPrefix: "Enregistré à",
    backToHome: "Retour à l'accueil",
    alreadyCheckedIn: "Vous avez déjà pointé aujourd'hui.",
    notAWorkingDay: "Aujourd'hui n'est pas un jour travaillé, le pointage n'est pas disponible.",
  },
  holidaysPage: {
    title: "Jours fériés",
    newHoliday: "Ajouter un jour férié",
    territoryLabel: "Territoire",
    anyTerritory: "Tous les territoires",
    yearLabel: "Année",
    anyYear: "Toutes les années",
    clearFilters: "Effacer les filtres",
    columnDates: "Date / Période",
    columnName: "Nom du jour férié",
    columnTerritory: "Territoire",
    allTerritories: "Tous les territoires",
    columnStatus: "Statut",
    edit: "Modifier",
    noResults: "Aucun jour férié trouvé.",
    statusActive: "Actif",
    statusInactive: "Inactif",
  },
  holidayForm: {
    newTitle: "Créer un jour férié",
    name: "Nom du jour férié",
    startDate: "Date de début",
    endDate: "Date de fin",
    territory: "Territoire",
    allTerritories: "Tous les territoires",
    save: "Enregistrer",
    saving: "Enregistrement...",
    created: "Jour férié créé",
    updated: "Jour férié mis à jour",
    activate: "Actif",
  },
  workingDaysPage: {
    title: "Jours ouvrés du territoire",
    dayLabels: ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"],
    save: "Enregistrer",
    saving: "Enregistrement...",
    updated: "Jours ouvrés mis à jour",
  },
  calendarPage: {
    tabCalendar: "Calendrier",
    tabHolidays: "Jours fériés",
    subtitle: "Jours fériés, vos jours de repos et congés approuvés.",
    today: "Aujourd'hui",
    legendPublicHoliday: "Jour férié",
    legendWeeklyOff: "Repos hebdomadaire",
    legendApprovedLeave: "Congé approuvé",
    legendPendingLeave: "Congé en attente",
    legendRejectedLeave: "Congé rejeté",
  },
  clientsPage: {
    title: "Clients",
    newClient: "Nouveau client",
    importButton: "Importer",
    columnCode: "Code",
    columnName: "Nom",
    columnType: "Type",
    columnResponsiblePerson: "Responsable",
    columnContact: "Contact",
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
    responsiblePerson: "Responsable",
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
    searchHospitals: "Rechercher un hôpital par nom ou code...",
    noHospitalsMatch: "Aucun hôpital ne correspond à votre recherche.",
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
    responsiblePerson: "Responsable",
    contact: "Contact",
    address: "Adresse",
    notProvided: "Non renseigné",
    hospitalCode: "Code",
  },
  productsPage: {
    title: "Produits",
    newProduct: "Nouveau produit",
    importButton: "Importer",
    exchangeRate: "Taux de change",
    columnCode: "Code",
    columnName: "Nom",
    columnCategory: "Catégorie",
    columnGrossPrice: "Prix brut",
    columnNetPrice: "Prix net",
    columnQuantityPerCarton: "Qté/carton",
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
    quantityPerCarton: "Quantité par carton",
    grossPrice: "Prix brut (USD)",
    netPrice: "Prix net (USD)",
    discountPercentHelper: "Remise % (facultatif)",
    discountPercentPlaceholder: "ex. 10",
    discountPercentMaxError: "Impossible de saisir une remise supérieure à 10 %.",
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
  importPage: {
    backToList: "Retour à la liste",
    downloadTemplate: "Télécharger le modèle",
    chooseFile: "Choisir un fichier",
    noFileChosen: "Aucun fichier choisi",
    preview: "Aperçu",
    previewing: "Vérification du fichier...",
    confirmImport: "Confirmer l'import",
    importing: "Import en cours...",
    processingFile: "Traitement des lignes...",
    startOver: "Recommencer",
    totalRows: "Lignes totales",
    willCreate: "À créer",
    willUpdate: "À mettre à jour",
    willReject: "À rejeter",
    errorsHeading: "Lignes en erreur",
    rowColumn: "Ligne",
    errorsColumn: "Erreurs",
    downloadErrorReport: "Télécharger le rapport d'erreurs",
    resultHeading: "Import terminé",
    created: "Créés",
    updated: "Mis à jour",
    rejected: "Rejetés",
    linkWarningsHeading: "Liens hôpitaux non résolus",
    genericError: "Une erreur est survenue. Vérifiez le fichier et réessayez.",
  },
};

const dictionaries: Record<Language, Dictionary> = { en, fr };

export function getDictionary(language: Language = DEFAULT_LANGUAGE): Dictionary {
  return dictionaries[language];
}
