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
  editCenterTitle: (name: string) => string;
  viewCenterTitle: (name: string) => string;
  editProductTitle: (name: string) => string;
  nav: {
    home: string;
    users: string;
    territoriesGroup: string;
    manageTerritories: string;
    territoryAssignment: string;
    team: string;
    centers: string;
    persons: string;
    products: string;
    installGuide: string;
    leavesGroup: string;
    myLeaves: string;
    teamLeaves: string;
    calendar: string;
    attendanceGroup: string;
    checkInOut: string;
    attendanceRules: string;
    attendanceAdmin: string;
    plans: string;
    activitiesGroup: string;
    activities: string;
    followUps: string;
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
    // list-filter screens (centers, users, team) — distinct from `province`
    // above, which is specifically the top hierarchy level in the
    // Territories admin form.
    territoryFilterLabel: string;
    // Label for the same TerritoryPicker when used to assign/pick a
    // territory on a record (center form, user form, territory assignment)
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
  // S3-02/S3-03 combined GPS check-in/check-out screen — a repeatable
  // check-in/check-out card (multiple cycles allowed per working day) plus
  // a paginated history table of every session. Location UI strings only
  // appear when the resolved requiresLocation flag is true for the
  // signed-in user — a location-not-required user only ever sees the
  // title/button/status strings.
  checkInOutPage: {
    title: string;
    // Status line shown on the card — which one depends on today's state:
    // never checked in today (readyStatus), currently checked in
    // (checkedInStatusPrefix + time), or checked out and free to start
    // another session (lastCheckedOutStatusPrefix + time).
    readyStatus: string;
    checkedInStatusPrefix: string;
    lastCheckedOutStatusPrefix: string;
    permissionGuidance: string;
    checkInButton: string;
    checkOutPermissionGuidance: string;
    checkOutButton: string;
    requesting: string;
    checkingIn: string;
    checkingOut: string;
    deniedTitle: string;
    deniedBody: string;
    unavailableTitle: string;
    unavailableBody: string;
    timeoutTitle: string;
    timeoutBody: string;
    lowAccuracyTitle: string;
    lowAccuracyBody: string;
    borderlineAccuracyTitle: string;
    borderlineAccuracyBody: string;
    continueAnyway: string;
    tryAgain: string;
    // Plain strings, not functions: this whole object is passed as a prop
    // into CheckInOutCard, a Client Component — a function anywhere in
    // that props object breaks RSC serialization even if never called
    // client-side (see pagination-controls.tsx for the same constraint
    // elsewhere).
    checkedInToast: string;
    checkedOutToast: string;
    alreadyCheckedIn: string;
    notAWorkingDay: string;
    historyTitle: string;
    historyColumnDate: string;
    historyColumnCheckIn: string;
    historyColumnCheckOut: string;
    historyColumnDuration: string;
    historyColumnStatus: string;
    historyStatusActive: string;
    historyStatusCompleted: string;
    historyNoResults: string;
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
  // S3-04's single Attendance Rules screen — one list (every version,
  // scoped to the viewer) plus one form with a scope-type selector
  // (territory / team / individual).
  attendanceRulesPage: {
    title: string;
    columnScope: string;
    columnTarget: string;
    columnExpectedStart: string;
    columnLateGrace: string;
    columnMinimumWorked: string;
    columnCreatedAt: string;
    scopeTerritory: string;
    scopeTeam: string;
    scopeIndividual: string;
    noResults: string;
  };
  attendanceRuleForm: {
    scopeLabel: string;
    scopeTerritory: string;
    scopeTeam: string;
    scopeIndividual: string;
    territoryLabel: string;
    teamOwnerLabel: string;
    individualLabel: string;
    expectedStartLabel: string;
    lateGraceLabel: string;
    minimumWorkedLabel: string;
    save: string;
    saving: string;
    created: string;
  };
  // S3-05's attendance administration screen — scoped list + map + Excel
  // export + daily team view, reused across the list, detail and
  // daily-team-view pages, and the filter bar component.
  attendanceAdminPage: {
    title: string;
    employeeLabel: string;
    anyEmployee: string;
    territoryLabel: string;
    anyTerritory: string;
    dateFromLabel: string;
    dateToLabel: string;
    statusLabel: string;
    anyStatus: string;
    clearFilters: string;
    columnDate: string;
    columnEmployee: string;
    columnTerritory: string;
    columnStatus: string;
    columnSessions: string;
    checkInLabel: string;
    checkOutLabel: string;
    accuracyColumn: string;
    needsReviewHint: string;
    dailyTeamView: string;
    export: string;
    noResults: string;
  };
  // S3-06's single-screen daily visit planner — one plan per delegate per
  // date, reordered in place rather than through a separate edit screen.
  plansPage: {
    title: string;
    tabPlanVisits: string;
    tabAssignment: string;
    tabMyVisits: string;
    planVisitsTitle: string;
    assignmentTitle: string;
    myVisitsTitle: string;
    myselfOption: string;
    newPlan: string;
    noPlansYet: string;
    noDateYet: string;
    unassignedLabel: string;
    noCentersYet: string;
    searchPlaceholder: string;
    noMatches: string;
    anyTerritory: string;
    remove: string;
    locked: string;
    centerAdded: string;
    centerRemoved: string;
    assignedByPrefix: string;
    markComplete: string;
    markCancelled: string;
    visitCompleted: string;
    visitCancelled: string;
    assignToLabel: string;
    dateLabel: string;
    assignAction: string;
    reassignAction: string;
    planAssigned: string;
    planReassigned: string;
    cancelAssignment: string;
    assignmentCancelled: string;
    hasCompletedHint: string;
    itemsCountSuffix: string;
    backToPlanVisits: string;
    editAction: string;
    save: string;
    saving: string;
    planSaved: string;
    newPlanPageTitle: string;
    manageAssignmentAction: string;
    viewAction: string;
    backToAssignment: string;
  };
  // S3-07's marketing activity planning and follow-ups — one screen
  // combining the pending/overdue widget, the create form, and the month
  // calendar; plus a flat my-follow-ups list and a supervisor team view.
  activitiesPage: {
    title: string;
    myFollowUps: string;
    followUpsHeading: string;
    newActivity: string;
    typeLabel: string;
    typeCampaign: string;
    typeEvent: string;
    typeOther: string;
    dateLabel: string;
    targetLabel: string;
    targetCenter: string;
    targetTerritory: string;
    notesLabel: string;
    save: string;
    saving: string;
    activityCreated: string;
    noFollowUps: string;
    overdue: string;
    markDone: string;
    followUpCompleted: string;
    teamOverdue: string;
    dueDateColumn: string;
    targetColumn: string;
    today: string;
    activitiesThisMonth: string;
    noActivitiesThisMonth: string;
    addFollowUp: string;
    followUpCreated: string;
    cancel: string;
    tabActivityList: string;
    tabAssignment: string;
    tabCalendar: string;
    tabMyActivities: string;
    tabMyFollowUps: string;
    tabTeamFollowUps: string;
    activityListTitle: string;
    myActivitiesTitle: string;
    newActivityPageTitle: string;
    newActivityButton: string;
    noActivities: string;
    unassignedLabel: string;
    assignedToPrefix: string;
    assignToLabel: string;
    assignAction: string;
    reassignAction: string;
    viewAction: string;
    activityAssigned: string;
    noActivitiesToAssign: string;
    statusPlanned: string;
    statusDone: string;
    statusCancelled: string;
    markActivityDone: string;
    markActivityCancelled: string;
    activityUpdated: string;
    filterAll: string;
    filterUnassigned: string;
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
  // The Center master admin screen (S2-02: Doctor/Hospital/Chemist/
  // Pharmacy) — mirrors usersPage/userForm/filters in shape.
  centersPage: {
    title: string;
    newCenter: string;
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
  centerFilters: {
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
  centerForm: {
    newCenterTitle: string;
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
    createCenter: string;
    saveChanges: string;
    saving: string;
    centerCreated: string;
    centerUpdated: string;
  };
  // The read-only Center detail screen — reuses centerForm's field labels
  // (code/name/type/doctorType/...) for consistency, and only adds what's
  // specific to a view: section headings, the edit/back links, and a
  // fallback for an empty field.
  centerDetailPage: {
    backToList: string;
    editCenter: string;
    detailsSectionLabel: string;
    responsiblePerson: string;
    contact: string;
    address: string;
    notProvided: string;
    hospitalCode: string;
  };
  // The Persons admin module (doctors, nurses and other professionals).
  // Plain strings only, so the whole object can be passed into client
  // components. "Centers" here is the existing Center model.
  persons: {
    title: string;
    description: string;
    addPerson: string;
    columnCode: string;
    columnPerson: string;
    columnType: string;
    columnSpecialization: string;
    columnMobile: string;
    columnTerritory: string;
    columnCenters: string;
    columnStatus: string;
    centersLabel: string;
    view: string;
    edit: string;
    activate: string;
    deactivate: string;
    noResults: string;
    statusActive: string;
    statusInactive: string;
    statusChanged: string;
    searchLabel: string;
    searchPlaceholder: string;
    typeFilterLabel: string;
    anyType: string;
    specializationFilterLabel: string;
    anySpecialization: string;
    centerTypeFilterLabel: string;
    anyCenterType: string;
    statusFilterLabel: string;
    anyStatus: string;
    filterActive: string;
    filterInactive: string;
    clearFilters: string;
    newTitle: string;
    editTitle: string;
    basicSection: string;
    professionalSection: string;
    territorySection: string;
    centersSection: string;
    codeNote: string;
    name: string;
    personType: string;
    selectOrAddType: string;
    gender: string;
    genderNone: string;
    genderMale: string;
    genderFemale: string;
    genderOther: string;
    mobile: string;
    specialization: string;
    selectOrAddSpecialization: string;
    territory: string;
    addCenter: string;
    center: string;
    centerType: string;
    roleAtCenter: string;
    selectCenter: string;
    selectOrAddRole: string;
    addNew: string;
    add: string;
    remove: string;
    noCenters: string;
    centerAlreadyAdded: string;
    centerAndRoleRequired: string;
    noMatches: string;
    statusSwitchLabel: string;
    activeDescription: string;
    inactiveDescription: string;
    cancel: string;
    createPerson: string;
    saveChanges: string;
    saving: string;
    personCreated: string;
    personUpdated: string;
    backToList: string;
    editPerson: string;
    notProvided: string;
    codeLabel: string;
    centerRelationNote: string;
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
  // centers and products, distinguished only by which entity's endpoint
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
  editCenterTitle: (name) => `Edit ${name}`,
  viewCenterTitle: (name) => name,
  editProductTitle: (name) => `Edit ${name}`,
  nav: {
    home: "Home",
    users: "Users",
    territoriesGroup: "Territories",
    manageTerritories: "Manage Territories",
    territoryAssignment: "Assign Territories",
    team: "Team",
    centers: "Centers",
    persons: "Persons",
    products: "Products",
    installGuide: "Install guide",
    leavesGroup: "Leaves",
    myLeaves: "My Leaves",
    teamLeaves: "Team Leaves",
    calendar: "Calendar",
    attendanceGroup: "Attendance",
    checkInOut: "Check-In/Out",
    attendanceRules: "Attendance Rules",
    attendanceAdmin: "Attendance Reports",
    plans: "Visit Plan",
    activitiesGroup: "Marketing",
    activities: "Activities",
    followUps: "Follow-Ups",
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
  checkInOutPage: {
    title: "Check-In / Check-Out",
    readyStatus: "Ready to start your attendance",
    checkedInStatusPrefix: "Checked in at",
    lastCheckedOutStatusPrefix: "Last checked out at",
    permissionGuidance: "We need your location to confirm your check-in.",
    checkInButton: "Check In",
    checkOutPermissionGuidance: "We need your location to confirm your check-out.",
    checkOutButton: "Check Out",
    requesting: "Getting your location...",
    checkingIn: "Checking in...",
    checkingOut: "Checking out...",
    deniedTitle: "Location access denied",
    deniedBody: "Enable location for this site in your browser settings, then try again.",
    unavailableTitle: "Location unavailable",
    unavailableBody: "Make sure location services are turned on for this device, then try again.",
    timeoutTitle: "Couldn't get your location in time",
    timeoutBody: "Move to an area with a clearer view of the sky and try again.",
    lowAccuracyTitle: "Location isn't precise enough",
    lowAccuracyBody: "Move outdoors or away from buildings, then try again.",
    borderlineAccuracyTitle: "Location accuracy is borderline",
    borderlineAccuracyBody:
      "You can continue, but this will be flagged for your supervisor to review. Move outdoors for a better fix if possible.",
    continueAnyway: "Continue anyway",
    tryAgain: "Try again",
    checkedInToast: "Checked in successfully.",
    checkedOutToast: "Checked out successfully.",
    alreadyCheckedIn: "You're already checked in — check out before starting a new session.",
    notAWorkingDay: "Today isn't a working day, so check-in isn't available.",
    historyTitle: "Check-In/Out History",
    historyColumnDate: "Date",
    historyColumnCheckIn: "Check-In",
    historyColumnCheckOut: "Check-Out",
    historyColumnDuration: "Duration",
    historyColumnStatus: "Status",
    historyStatusActive: "Active",
    historyStatusCompleted: "Completed",
    historyNoResults: "No sessions recorded yet.",
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
  attendanceRulesPage: {
    title: "Attendance Rules",
    columnScope: "Scope",
    columnTarget: "Target",
    columnExpectedStart: "Expected start",
    columnLateGrace: "Late grace (min)",
    columnMinimumWorked: "Minimum worked (min)",
    columnCreatedAt: "Created",
    scopeTerritory: "Territory",
    scopeTeam: "Team",
    scopeIndividual: "Individual",
    noResults: "No attendance rules found.",
  },
  attendanceRuleForm: {
    scopeLabel: "Scope",
    scopeTerritory: "Territory",
    scopeTeam: "Team",
    scopeIndividual: "Individual",
    territoryLabel: "Territory",
    teamOwnerLabel: "Applies to your entire downstream team",
    individualLabel: "Delegate",
    expectedStartLabel: "Expected start time",
    lateGraceLabel: "Late grace period (minutes)",
    minimumWorkedLabel: "Minimum worked minutes",
    save: "Save rule",
    saving: "Saving...",
    created: "Attendance rule created",
  },
  attendanceAdminPage: {
    title: "Attendance",
    employeeLabel: "Employee",
    anyEmployee: "All employees",
    territoryLabel: "Territory",
    anyTerritory: "All territories",
    dateFromLabel: "From date",
    dateToLabel: "To date",
    statusLabel: "Status",
    anyStatus: "Any status",
    clearFilters: "Clear filters",
    columnDate: "Date",
    columnEmployee: "Employee",
    columnTerritory: "Territory",
    columnStatus: "Status",
    columnSessions: "Sessions",
    checkInLabel: "Check-In",
    checkOutLabel: "Check-Out",
    accuracyColumn: "GPS Accuracy",
    needsReviewHint:
      "This record has a GPS fix between 50m and 100m accuracy — borderline enough to flag for review, not reliable enough to accept without a second look.",
    dailyTeamView: "Daily Team View",
    export: "Export to Excel",
    noResults: "No attendance records found.",
  },
  plansPage: {
    title: "Visit Plan",
    tabPlanVisits: "Plan Visits",
    tabAssignment: "Assignment",
    tabMyVisits: "My Visits",
    planVisitsTitle: "Plan Visits",
    assignmentTitle: "Assignment",
    myVisitsTitle: "My Visits",
    myselfOption: "Myself",
    newPlan: "New plan",
    noPlansYet: "No plans yet.",
    noDateYet: "No date yet",
    unassignedLabel: "Not assigned to anyone",
    noCentersYet: "No centers added yet.",
    searchPlaceholder: "Search by name or code...",
    noMatches: "No matching centers.",
    anyTerritory: "Any territory",
    remove: "Remove",
    locked: "This plan's date has started, so it's locked and can no longer be edited.",
    centerAdded: "Center added to plan",
    centerRemoved: "Center removed from plan",
    assignedByPrefix: "Assigned by",
    markComplete: "Mark completed",
    markCancelled: "Cancel",
    visitCompleted: "Visit marked completed",
    visitCancelled: "Visit cancelled",
    assignToLabel: "Assign to",
    dateLabel: "Date",
    assignAction: "Assign",
    reassignAction: "Reassign",
    planAssigned: "Plan assigned",
    planReassigned: "Plan reassigned",
    cancelAssignment: "Cancel assignment",
    assignmentCancelled: "Assignment cancelled",
    hasCompletedHint: "This plan already has completed visits, so it can no longer be reassigned.",
    itemsCountSuffix: "centers",
    backToPlanVisits: "Back to Plan Visits",
    editAction: "Edit",
    save: "Save",
    saving: "Saving...",
    planSaved: "Plan saved",
    newPlanPageTitle: "New plan",
    manageAssignmentAction: "Manage assignment",
    viewAction: "View",
    backToAssignment: "Back to Assignment",
  },
  activitiesPage: {
    title: "Marketing Activities",
    myFollowUps: "My Follow-Ups",
    followUpsHeading: "Pending follow-ups",
    newActivity: "New activity",
    typeLabel: "Type",
    typeCampaign: "Campaign",
    typeEvent: "Event",
    typeOther: "Other",
    dateLabel: "Date",
    targetLabel: "Applies to",
    targetCenter: "A center",
    targetTerritory: "A territory",
    notesLabel: "Notes",
    save: "Save",
    saving: "Saving...",
    activityCreated: "Activity created",
    noFollowUps: "No follow-ups.",
    overdue: "Overdue",
    markDone: "Mark done",
    followUpCompleted: "Follow-up completed",
    teamOverdue: "Team Overdue Follow-Ups",
    dueDateColumn: "Due date",
    targetColumn: "Center / Territory",
    today: "Today",
    activitiesThisMonth: "Activities this month",
    noActivitiesThisMonth: "No activities this month.",
    addFollowUp: "Add follow-up",
    followUpCreated: "Follow-up created",
    cancel: "Cancel",
    tabActivityList: "Activity list",
    tabAssignment: "Assignment",
    tabCalendar: "Calendar",
    tabMyActivities: "My activities",
    tabMyFollowUps: "My follow-ups",
    tabTeamFollowUps: "Team follow-ups",
    activityListTitle: "Marketing Activities",
    myActivitiesTitle: "My Activities",
    newActivityPageTitle: "New activity",
    newActivityButton: "New activity",
    noActivities: "No activities yet.",
    unassignedLabel: "Unassigned",
    assignedToPrefix: "Assigned to",
    assignToLabel: "Assign to",
    assignAction: "Assign",
    reassignAction: "Reassign",
    viewAction: "View",
    activityAssigned: "Activity assigned",
    noActivitiesToAssign: "No activities to assign.",
    statusPlanned: "Planned",
    statusDone: "Done",
    statusCancelled: "Cancelled",
    markActivityDone: "Mark done",
    markActivityCancelled: "Cancel",
    activityUpdated: "Activity updated",
    filterAll: "All",
    filterUnassigned: "Unassigned only",
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
  centersPage: {
    title: "Centers",
    newCenter: "New center",
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
    noResults: "No centers match these filters.",
    statusActive: "ACTIVE",
    statusInactive: "INACTIVE",
    missingCoordinates: "Missing coordinates",
  },
  centerFilters: {
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
  centerForm: {
    newCenterTitle: "New center",
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
    createCenter: "Create center",
    saveChanges: "Save changes",
    saving: "Saving...",
    centerCreated: "Center created",
    centerUpdated: "Center updated",
  },
  centerDetailPage: {
    backToList: "Back to centers",
    editCenter: "Edit center",
    detailsSectionLabel: "Details",
    responsiblePerson: "Responsible person",
    contact: "Contact",
    address: "Address",
    notProvided: "Not provided",
    hospitalCode: "Code",
  },
  persons: {
    title: "Persons",
    description: "Manage doctors, nurses and other professional persons.",
    addPerson: "Add Person",
    columnCode: "Code",
    columnPerson: "Person",
    columnType: "Person type",
    columnSpecialization: "Specialization",
    columnMobile: "Mobile",
    columnTerritory: "Territory",
    columnCenters: "Centers",
    columnStatus: "Status",
    centersLabel: "Centers",
    view: "View",
    edit: "Edit",
    activate: "Activate",
    deactivate: "Deactivate",
    noResults: "No persons match these filters.",
    statusActive: "ACTIVE",
    statusInactive: "INACTIVE",
    statusChanged: "Status updated",
    searchLabel: "Search",
    searchPlaceholder: "Code, name or mobile",
    typeFilterLabel: "Person type",
    anyType: "Any type",
    specializationFilterLabel: "Specialization",
    anySpecialization: "Any specialization",
    centerTypeFilterLabel: "Center type",
    anyCenterType: "Any center type",
    statusFilterLabel: "Status",
    anyStatus: "Any status",
    filterActive: "Active",
    filterInactive: "Inactive",
    clearFilters: "Clear filters",
    newTitle: "Add Person",
    editTitle: "Edit person",
    basicSection: "Basic information",
    professionalSection: "Professional information",
    territorySection: "Territory",
    centersSection: "Associated centers",
    codeNote: "The person code is generated automatically.",
    name: "Full name",
    personType: "Person type",
    selectOrAddType: "Select or add new type",
    gender: "Gender",
    genderNone: "Not specified",
    genderMale: "Male",
    genderFemale: "Female",
    genderOther: "Other",
    mobile: "Mobile",
    specialization: "Specialization / Department",
    selectOrAddSpecialization: "Select or add specialization",
    territory: "Territory",
    addCenter: "Add center",
    center: "Center",
    centerType: "Center type",
    roleAtCenter: "Role at center",
    selectCenter: "Select a center",
    selectOrAddRole: "Select or add role",
    addNew: "Add",
    add: "Add",
    remove: "Remove",
    noCenters: "No centers associated yet.",
    centerAlreadyAdded: "This center is already associated with the person.",
    centerAndRoleRequired: "Select a center and a role at that center.",
    noMatches: "No matches",
    statusSwitchLabel: "Active",
    activeDescription: "Person is active.",
    inactiveDescription: "Deactivated — kept in history, relationships preserved.",
    cancel: "Cancel",
    createPerson: "Create Person",
    saveChanges: "Save changes",
    saving: "Saving...",
    personCreated: "Person created",
    personUpdated: "Person updated",
    backToList: "Back to persons",
    editPerson: "Edit person",
    notProvided: "Not provided",
    codeLabel: "Code",
    centerRelationNote:
      "A person can belong to several centers, with a different role at each one.",
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
  editCenterTitle: (name) => `Modifier ${name}`,
  viewCenterTitle: (name) => name,
  editProductTitle: (name) => `Modifier ${name}`,
  nav: {
    home: "Accueil",
    users: "Utilisateurs",
    territoriesGroup: "Territoires",
    manageTerritories: "Gérer les territoires",
    territoryAssignment: "Affecter des territoires",
    team: "Équipe",
    centers: "Centres",
    persons: "Personnes",
    products: "Produits",
    installGuide: "Guide d'installation",
    leavesGroup: "Congés",
    myLeaves: "Mes congés",
    teamLeaves: "Congés de l'équipe",
    calendar: "Calendrier",
    attendanceGroup: "Présence",
    checkInOut: "Pointage",
    attendanceRules: "Règles de présence",
    attendanceAdmin: "Rapports de présence",
    plans: "Plan de visite",
    activitiesGroup: "Marketing",
    activities: "Activités",
    followUps: "Suivis",
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
  checkInOutPage: {
    title: "Pointage",
    readyStatus: "Prêt à commencer votre présence",
    checkedInStatusPrefix: "Arrivée pointée à",
    lastCheckedOutStatusPrefix: "Dernier départ pointé à",
    permissionGuidance: "Nous avons besoin de votre position pour confirmer votre arrivée.",
    checkInButton: "Pointer l'arrivée",
    checkOutPermissionGuidance: "Nous avons besoin de votre position pour confirmer votre départ.",
    checkOutButton: "Pointer le départ",
    requesting: "Récupération de votre position...",
    checkingIn: "Pointage de l'arrivée...",
    checkingOut: "Pointage du départ...",
    deniedTitle: "Accès à la position refusé",
    deniedBody:
      "Activez la localisation pour ce site dans les paramètres de votre navigateur, puis réessayez.",
    unavailableTitle: "Position indisponible",
    unavailableBody: "Vérifiez que la localisation est activée sur cet appareil, puis réessayez.",
    timeoutTitle: "Impossible d'obtenir votre position à temps",
    timeoutBody: "Déplacez-vous vers un endroit avec une meilleure vue du ciel, puis réessayez.",
    lowAccuracyTitle: "La position n'est pas assez précise",
    lowAccuracyBody: "Déplacez-vous à l'extérieur ou loin des bâtiments, puis réessayez.",
    borderlineAccuracyTitle: "La précision de la position est limite",
    borderlineAccuracyBody:
      "Vous pouvez continuer, mais cela sera signalé à votre superviseur pour examen. Déplacez-vous à l'extérieur pour une meilleure précision si possible.",
    continueAnyway: "Continuer quand même",
    tryAgain: "Réessayer",
    checkedInToast: "Arrivée pointée avec succès.",
    checkedOutToast: "Départ pointé avec succès.",
    alreadyCheckedIn: "Vous êtes déjà pointé — pointez votre départ avant d'en recommencer un.",
    notAWorkingDay: "Aujourd'hui n'est pas un jour travaillé, le pointage n'est pas disponible.",
    historyTitle: "Historique des pointages",
    historyColumnDate: "Date",
    historyColumnCheckIn: "Arrivée",
    historyColumnCheckOut: "Départ",
    historyColumnDuration: "Durée",
    historyColumnStatus: "Statut",
    historyStatusActive: "En cours",
    historyStatusCompleted: "Terminé",
    historyNoResults: "Aucune session enregistrée pour le moment.",
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
  attendanceRulesPage: {
    title: "Règles de présence",
    columnScope: "Portée",
    columnTarget: "Cible",
    columnExpectedStart: "Heure d'arrivée attendue",
    columnLateGrace: "Tolérance retard (min)",
    columnMinimumWorked: "Minimum travaillé (min)",
    columnCreatedAt: "Créée le",
    scopeTerritory: "Territoire",
    scopeTeam: "Équipe",
    scopeIndividual: "Individuel",
    noResults: "Aucune règle de présence trouvée.",
  },
  attendanceRuleForm: {
    scopeLabel: "Portée",
    scopeTerritory: "Territoire",
    scopeTeam: "Équipe",
    scopeIndividual: "Individuel",
    territoryLabel: "Territoire",
    teamOwnerLabel: "S'applique à toute votre équipe (vos subordonnés)",
    individualLabel: "Délégué",
    expectedStartLabel: "Heure d'arrivée attendue",
    lateGraceLabel: "Tolérance retard (minutes)",
    minimumWorkedLabel: "Minutes travaillées minimum",
    save: "Enregistrer la règle",
    saving: "Enregistrement...",
    created: "Règle de présence créée",
  },
  attendanceAdminPage: {
    title: "Présence",
    employeeLabel: "Employé",
    anyEmployee: "Tous les employés",
    territoryLabel: "Territoire",
    anyTerritory: "Tous les territoires",
    dateFromLabel: "Du",
    dateToLabel: "Au",
    statusLabel: "Statut",
    anyStatus: "Tout statut",
    clearFilters: "Effacer les filtres",
    columnDate: "Date",
    columnEmployee: "Employé",
    columnTerritory: "Territoire",
    columnStatus: "Statut",
    columnSessions: "Sessions",
    checkInLabel: "Arrivée",
    checkOutLabel: "Départ",
    accuracyColumn: "Précision GPS",
    needsReviewHint:
      "Cet enregistrement a une précision GPS entre 50m et 100m — assez limite pour être signalé, pas assez fiable pour être accepté sans vérification.",
    dailyTeamView: "Vue quotidienne de l'équipe",
    export: "Exporter vers Excel",
    noResults: "Aucun enregistrement de présence trouvé.",
  },
  plansPage: {
    title: "Plan de visite",
    tabPlanVisits: "Planifier des visites",
    tabAssignment: "Affectation",
    tabMyVisits: "Mes visites",
    planVisitsTitle: "Planifier des visites",
    assignmentTitle: "Affectation",
    myVisitsTitle: "Mes visites",
    myselfOption: "Moi-même",
    newPlan: "Nouveau plan",
    noPlansYet: "Aucun plan pour le moment.",
    noDateYet: "Pas encore de date",
    unassignedLabel: "Non affecté",
    noCentersYet: "Aucun centre ajouté pour le moment.",
    searchPlaceholder: "Rechercher par nom ou code...",
    noMatches: "Aucun centre correspondant.",
    anyTerritory: "Tous les territoires",
    remove: "Retirer",
    locked: "La date de ce plan a commencé, il est donc verrouillé et ne peut plus être modifié.",
    centerAdded: "Centre ajouté au plan",
    centerRemoved: "Centre retiré du plan",
    assignedByPrefix: "Assigné par",
    markComplete: "Marquer comme terminé",
    markCancelled: "Annuler",
    visitCompleted: "Visite marquée comme terminée",
    visitCancelled: "Visite annulée",
    assignToLabel: "Affecter à",
    dateLabel: "Date",
    assignAction: "Affecter",
    reassignAction: "Réaffecter",
    planAssigned: "Plan affecté",
    planReassigned: "Plan réaffecté",
    cancelAssignment: "Annuler l'affectation",
    assignmentCancelled: "Affectation annulée",
    hasCompletedHint: "Ce plan a déjà des visites terminées, il ne peut donc plus être réaffecté.",
    itemsCountSuffix: "centres",
    backToPlanVisits: "Retour à Planifier des visites",
    editAction: "Modifier",
    save: "Enregistrer",
    saving: "Enregistrement...",
    planSaved: "Plan enregistré",
    newPlanPageTitle: "Nouveau plan",
    manageAssignmentAction: "Gérer l'affectation",
    viewAction: "Voir",
    backToAssignment: "Retour à l'affectation",
  },
  activitiesPage: {
    title: "Activités marketing",
    myFollowUps: "Mes suivis",
    followUpsHeading: "Suivis en attente",
    newActivity: "Nouvelle activité",
    typeLabel: "Type",
    typeCampaign: "Campagne",
    typeEvent: "Événement",
    typeOther: "Autre",
    dateLabel: "Date",
    targetLabel: "S'applique à",
    targetCenter: "Un centre",
    targetTerritory: "Un territoire",
    notesLabel: "Notes",
    save: "Enregistrer",
    saving: "Enregistrement...",
    activityCreated: "Activité créée",
    noFollowUps: "Aucun suivi.",
    overdue: "En retard",
    markDone: "Marquer comme fait",
    followUpCompleted: "Suivi terminé",
    teamOverdue: "Suivis en retard de l'équipe",
    dueDateColumn: "Échéance",
    targetColumn: "Centre / Territoire",
    today: "Aujourd'hui",
    activitiesThisMonth: "Activités ce mois-ci",
    noActivitiesThisMonth: "Aucune activité ce mois-ci.",
    addFollowUp: "Ajouter un suivi",
    followUpCreated: "Suivi créé",
    cancel: "Annuler",
    tabActivityList: "Liste des activités",
    tabAssignment: "Affectation",
    tabCalendar: "Calendrier",
    tabMyActivities: "Mes activités",
    tabMyFollowUps: "Mes suivis",
    tabTeamFollowUps: "Suivis de l'équipe",
    activityListTitle: "Activités marketing",
    myActivitiesTitle: "Mes activités",
    newActivityPageTitle: "Nouvelle activité",
    newActivityButton: "Nouvelle activité",
    noActivities: "Aucune activité pour le moment.",
    unassignedLabel: "Non affectée",
    assignedToPrefix: "Affectée à",
    assignToLabel: "Affecter à",
    assignAction: "Affecter",
    reassignAction: "Réaffecter",
    viewAction: "Voir",
    activityAssigned: "Activité affectée",
    noActivitiesToAssign: "Aucune activité à affecter.",
    statusPlanned: "Planifiée",
    statusDone: "Terminée",
    statusCancelled: "Annulée",
    markActivityDone: "Marquer comme faite",
    markActivityCancelled: "Annuler",
    activityUpdated: "Activité mise à jour",
    filterAll: "Toutes",
    filterUnassigned: "Non affectées seulement",
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
  centersPage: {
    title: "Centres",
    newCenter: "Nouveau centre",
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
    noResults: "Aucun centre ne correspond à ces filtres.",
    statusActive: "ACTIF",
    statusInactive: "INACTIF",
    missingCoordinates: "Coordonnées manquantes",
  },
  centerFilters: {
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
  centerForm: {
    newCenterTitle: "Nouveau centre",
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
    createCenter: "Créer le centre",
    saveChanges: "Enregistrer",
    saving: "Enregistrement...",
    centerCreated: "Centre créé",
    centerUpdated: "Centre mis à jour",
  },
  centerDetailPage: {
    backToList: "Retour aux centres",
    editCenter: "Modifier le centre",
    detailsSectionLabel: "Détails",
    responsiblePerson: "Responsable",
    contact: "Contact",
    address: "Adresse",
    notProvided: "Non renseigné",
    hospitalCode: "Code",
  },
  persons: {
    title: "Personnes",
    description: "Gérer les médecins, infirmiers et autres professionnels.",
    addPerson: "Ajouter une personne",
    columnCode: "Code",
    columnPerson: "Personne",
    columnType: "Type de personne",
    columnSpecialization: "Spécialisation",
    columnMobile: "Mobile",
    columnTerritory: "Territoire",
    columnCenters: "Centres",
    columnStatus: "Statut",
    centersLabel: "Centres",
    view: "Voir",
    edit: "Modifier",
    activate: "Activer",
    deactivate: "Désactiver",
    noResults: "Aucune personne ne correspond à ces filtres.",
    statusActive: "ACTIF",
    statusInactive: "INACTIF",
    statusChanged: "Statut mis à jour",
    searchLabel: "Rechercher",
    searchPlaceholder: "Code, nom ou mobile",
    typeFilterLabel: "Type de personne",
    anyType: "Tous les types",
    specializationFilterLabel: "Spécialisation",
    anySpecialization: "Toutes les spécialisations",
    centerTypeFilterLabel: "Type de centre",
    anyCenterType: "Tous les types de centre",
    statusFilterLabel: "Statut",
    anyStatus: "Tous les statuts",
    filterActive: "Actif",
    filterInactive: "Inactif",
    clearFilters: "Effacer les filtres",
    newTitle: "Ajouter une personne",
    editTitle: "Modifier la personne",
    basicSection: "Informations de base",
    professionalSection: "Informations professionnelles",
    territorySection: "Territoire",
    centersSection: "Centres associés",
    codeNote: "Le code de la personne est généré automatiquement.",
    name: "Nom complet",
    personType: "Type de personne",
    selectOrAddType: "Sélectionner ou ajouter un type",
    gender: "Genre",
    genderNone: "Non précisé",
    genderMale: "Homme",
    genderFemale: "Femme",
    genderOther: "Autre",
    mobile: "Mobile",
    specialization: "Spécialisation / Département",
    selectOrAddSpecialization: "Sélectionner ou ajouter une spécialisation",
    territory: "Territoire",
    addCenter: "Ajouter un centre",
    center: "Centre",
    centerType: "Type de centre",
    roleAtCenter: "Rôle au centre",
    selectCenter: "Sélectionner un centre",
    selectOrAddRole: "Sélectionner ou ajouter un rôle",
    addNew: "Ajouter",
    add: "Ajouter",
    remove: "Retirer",
    noCenters: "Aucun centre associé pour l'instant.",
    centerAlreadyAdded: "Ce centre est déjà associé à la personne.",
    centerAndRoleRequired: "Sélectionnez un centre et un rôle dans ce centre.",
    noMatches: "Aucun résultat",
    statusSwitchLabel: "Actif",
    activeDescription: "La personne est active.",
    inactiveDescription: "Désactivée — conservée dans l'historique, relations préservées.",
    cancel: "Annuler",
    createPerson: "Créer la personne",
    saveChanges: "Enregistrer",
    saving: "Enregistrement...",
    personCreated: "Personne créée",
    personUpdated: "Personne mise à jour",
    backToList: "Retour aux personnes",
    editPerson: "Modifier la personne",
    notProvided: "Non renseigné",
    codeLabel: "Code",
    centerRelationNote:
      "Une personne peut appartenir à plusieurs centres, avec un rôle différent dans chacun.",
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
