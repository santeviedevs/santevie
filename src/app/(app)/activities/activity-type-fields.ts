// Which optional fields apply to which ActivityTypeDef.code — checked
// against the original 11-type activity brief and the client's own
// "Activity creation form" field table, not left as "show everything for
// every type." Two separate tables: SHARED_FIELDS gates the Activity-level
// shared-plan form (set once at creation — speaker/products/invited-
// participant picker/where the activity happens/expected counts/requirement
// category), EXECUTION_FIELDS gates the per-assignment execution form each
// delegate fills in after their visit. Legacy CAMPAIGN/EVENT/OTHER and any
// unrecognized code fall back to the all-false default — generic types, no
// special structure.

export type SharedFieldSet = {
  speaker: boolean;
  products: boolean;
  participants: boolean;
  // Where the activity happens, at creation time. requiresCenter and
  // usesLocation are mutually exclusive across the 9 standard-event types —
  // never both true for the same type. usesDepartment pairs with
  // requiresCenter (Matinee Scientifique's "centre/department", La Garde's
  // "hospital/Urgence department"); it never pairs with usesLocation.
  // Necessity-Driven has neither.
  requiresCenter: boolean;
  usesLocation: boolean;
  usesDepartment: boolean;
  // Expected counts, set at creation — the planning figure, distinct from
  // ActivityAssignment.actualParticipants (the delegate's own execution-time
  // count). Client's own wording: CPN/CPS/Bonjour say "prescribers",
  // Matinee Scientifique/La Garde say "participants" — two separate flags,
  // not one generic count.
  prescriberCount: boolean;
  expectedParticipants: boolean;
  // Necessity-Driven: the client's creation-form spec lists this as the
  // *only* required field — the manager decides the kind of need upfront.
  requirementCategory: boolean;
};

const SHARED_DEFAULT: SharedFieldSet = {
  speaker: false,
  products: false,
  participants: false,
  requiresCenter: false,
  usesLocation: false,
  usesDepartment: false,
  prescriberCount: false,
  expectedParticipants: false,
  requirementCategory: false,
};

const SHARED_FIELDS: Record<string, SharedFieldSet> = {
  RTM: { ...SHARED_DEFAULT, products: true, participants: true, usesLocation: true },
  CPN: {
    ...SHARED_DEFAULT,
    requiresCenter: true,
    prescriberCount: true,
    participants: true,
    products: true,
  },
  CPS: {
    ...SHARED_DEFAULT,
    requiresCenter: true,
    prescriberCount: true,
    participants: true,
    products: true,
  },
  CME: {
    ...SHARED_DEFAULT,
    speaker: true,
    products: true,
    participants: true,
    usesLocation: true,
  },
  NURSE_CONFERENCE: {
    ...SHARED_DEFAULT,
    speaker: true,
    products: true,
    participants: true,
    usesLocation: true,
  },
  BONJOUR: {
    ...SHARED_DEFAULT,
    requiresCenter: true,
    products: true,
    prescriberCount: true,
    participants: true,
  },
  NECESSITY_DRIVEN: { ...SHARED_DEFAULT, requirementCategory: true },
  MATINEE_SCIENTIFIQUE: {
    ...SHARED_DEFAULT,
    requiresCenter: true,
    usesDepartment: true,
    products: true,
    expectedParticipants: true,
    participants: true,
  },
  LA_GARDE: {
    ...SHARED_DEFAULT,
    requiresCenter: true,
    usesDepartment: true,
    products: true,
    participants: true,
    expectedParticipants: true,
  },
};

export function sharedFieldsFor(code: string | undefined): SharedFieldSet {
  return (code && SHARED_FIELDS[code]) || SHARED_DEFAULT;
}

export type ExecutionFieldSet = {
  participants: boolean;
  products: boolean;
  // La Garde only: whether each product was actually available on this
  // specific visit — distinct from `products` (which only controls whether
  // the per-product prescriptions/business/samples results render at all).
  // La Garde is typically a different delegate each night, so this can
  // genuinely differ visit to visit; no other type lists this as an
  // execution-time field in the client's own brief.
  productAvailability: boolean;
  pregnantWomenReached: boolean;
  childrenConsulted: boolean;
  actualParticipants: boolean;
  nightShiftTiming: boolean;
  necessity: boolean; // requirementValue / supportProvidedDescription / recipientContactId
  expenses: boolean;
  hcpBeneficiaryFeedback: boolean;
  commitments: boolean;
};

const EXECUTION_DEFAULT: ExecutionFieldSet = {
  participants: false,
  products: false,
  productAvailability: false,
  pregnantWomenReached: false,
  childrenConsulted: false,
  actualParticipants: false,
  nightShiftTiming: false,
  necessity: false,
  expenses: false,
  hcpBeneficiaryFeedback: false,
  commitments: false,
};

const EXECUTION_FIELDS: Record<string, ExecutionFieldSet> = {
  RTM: { ...EXECUTION_DEFAULT, participants: true, products: true },
  CPN: {
    ...EXECUTION_DEFAULT,
    products: true,
    pregnantWomenReached: true,
    hcpBeneficiaryFeedback: true,
  },
  CPS: {
    ...EXECUTION_DEFAULT,
    products: true,
    childrenConsulted: true,
    hcpBeneficiaryFeedback: true,
  },
  CME: {
    ...EXECUTION_DEFAULT,
    participants: true,
    products: true,
    actualParticipants: true,
    expenses: true,
  },
  NURSE_CONFERENCE: {
    ...EXECUTION_DEFAULT,
    participants: true,
    products: true,
    actualParticipants: true,
    expenses: true,
  },
  BONJOUR: {
    ...EXECUTION_DEFAULT,
    products: true,
    actualParticipants: true,
    expenses: true,
    commitments: true,
  },
  NECESSITY_DRIVEN: { ...EXECUTION_DEFAULT, necessity: true },
  MATINEE_SCIENTIFIQUE: {
    ...EXECUTION_DEFAULT,
    products: true,
    actualParticipants: true,
    expenses: true,
  },
  LA_GARDE: {
    ...EXECUTION_DEFAULT,
    participants: true,
    products: true,
    productAvailability: true,
    nightShiftTiming: true,
    expenses: true,
  },
};

export function executionFieldsFor(code: string | undefined): ExecutionFieldSet {
  return (code && EXECUTION_FIELDS[code]) || EXECUTION_DEFAULT;
}
