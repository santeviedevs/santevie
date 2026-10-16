import { beforeEach, describe, expect, it, vi } from "vitest";

const createPrescriptionTargetRow = vi.fn();
const findPrescriptionTargetById = vi.fn();
const findPrescriptionTargetByUniqueKey = vi.fn();
const updatePrescriptionTargetRow = vi.fn();
const createPrescriptionTargetRevisionRow = vi.fn();
const findRevisionsForTarget = vi.fn();
const incrementUpdateSequence = vi.fn();
const findLatestUpdateForTarget = vi.fn();
const createPrescriptionUpdateRow = vi.fn();
const listUpdatesForTarget = vi.fn();
const listPrescriptionTargets = vi.fn();
const countPrescriptionTargets = vi.fn();
const findLatestUpdatesForTargetIds = vi.fn();
const findLatestUpdatesForUserTargets = vi.fn();
const runInTransaction = vi.fn();
vi.mock("@/server/repositories/prescription-repository", () => ({
  createPrescriptionTargetRow,
  findPrescriptionTargetById,
  findPrescriptionTargetByUniqueKey,
  updatePrescriptionTargetRow,
  createPrescriptionTargetRevisionRow,
  findRevisionsForTarget,
  incrementUpdateSequence,
  findLatestUpdateForTarget,
  createPrescriptionUpdateRow,
  listUpdatesForTarget,
  listPrescriptionTargets,
  countPrescriptionTargets,
  findLatestUpdatesForTargetIds,
  findLatestUpdatesForUserTargets,
  runInTransaction: (fn: (tx: unknown) => unknown) => runInTransaction(fn),
}));

const assertAssigneeInScope = vi.fn();
vi.mock("@/server/services/activity-service", () => ({ assertAssigneeInScope }));

const getUserScope = vi.fn();
const isWithinScope = vi.fn();
const scopeUserIds = vi.fn();
vi.mock("@/server/scope", async () => {
  const actual = await vi.importActual<typeof import("@/server/scope")>("@/server/scope");
  return { ...actual, getUserScope, isWithinScope, scopeUserIds };
});

const {
  createPrescriptionTarget,
  getMyPrescriptionFollowUps,
  PrescriptionCorrectionReasonRequiredError,
  PrescriptionDecreaseConfirmationRequiredError,
  PrescriptionNotAuthorizedError,
  PrescriptionTargetDuplicateError,
  recordPrescriptionUpdate,
  updatePrescriptionTarget,
} = await import("./prescription-service");

function target(overrides: Record<string, unknown> = {}) {
  return {
    id: "target-1",
    userId: "delegate-1",
    monthlyTarget: 15,
    periodMonth: 6,
    periodYear: 2026,
    updateSequence: 2,
    contact: { id: "contact-1", name: "Dr. One" },
    product: { id: "product-1", name: "Tamsuprost", code: "TAM" },
    user: { id: "delegate-1", name: "Delegate One" },
    ...overrides,
  };
}

function update(overrides: Record<string, unknown> = {}) {
  return {
    id: "update-1",
    targetId: "target-1",
    sequenceNo: 2,
    cumulativeAchieved: 10,
    feedback: null,
    challenges: null,
    followUpDate: null,
    acknowledgedDecrease: false,
    correctionReason: null,
    recordedAt: new Date("2026-06-10T00:00:00.000Z"),
    recordedByUser: { id: "delegate-1", name: "Delegate One" },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  runInTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn({}));
  getUserScope.mockResolvedValue({ kind: "all" });
  isWithinScope.mockReturnValue(true);
});

describe("createPrescriptionTarget", () => {
  it("rejects a duplicate (contact, product, delegate, month) combination", async () => {
    findPrescriptionTargetByUniqueKey.mockResolvedValue(target());

    await expect(
      createPrescriptionTarget(
        {
          contactId: "contact-1",
          productId: "product-1",
          userId: "delegate-1",
          monthlyTarget: 15,
          periodMonth: 6,
          periodYear: 2026,
        },
        { user: { id: "manager-1", roleName: "MANAGER" } },
      ),
    ).rejects.toThrow(PrescriptionTargetDuplicateError);

    expect(createPrescriptionTargetRow).not.toHaveBeenCalled();
  });
});

describe("updatePrescriptionTarget", () => {
  it("writes a revision row when monthlyTarget actually changes", async () => {
    findPrescriptionTargetById.mockResolvedValue(target({ monthlyTarget: 15 }));
    updatePrescriptionTargetRow.mockResolvedValue(target({ monthlyTarget: 20 }));
    listUpdatesForTarget.mockResolvedValue([]);

    await updatePrescriptionTarget(
      { id: "target-1", monthlyTarget: 20, reason: "Revised upward" },
      { user: { id: "manager-1", roleName: "MANAGER" } },
    );

    expect(createPrescriptionTargetRevisionRow).toHaveBeenCalledWith(
      expect.objectContaining({
        previousTarget: 15,
        newTarget: 20,
        reason: "Revised upward",
      }),
      {},
    );
  });

  it("writes nothing on a no-op edit (same value resubmitted)", async () => {
    findPrescriptionTargetById.mockResolvedValue(target({ monthlyTarget: 15 }));
    listUpdatesForTarget.mockResolvedValue([]);

    await updatePrescriptionTarget(
      { id: "target-1", monthlyTarget: 15 },
      { user: { id: "manager-1", roleName: "MANAGER" } },
    );

    expect(updatePrescriptionTargetRow).not.toHaveBeenCalled();
    expect(createPrescriptionTargetRevisionRow).not.toHaveBeenCalled();
  });
});

describe("recordPrescriptionUpdate", () => {
  it("prescription_update_reads_latest_by_sequence_not_timestamp: inserts using the sequence returned by the lock, not a timestamp", async () => {
    findPrescriptionTargetById.mockResolvedValue(target());
    incrementUpdateSequence.mockResolvedValue(3);
    findLatestUpdateForTarget.mockResolvedValue(update({ cumulativeAchieved: 10 }));
    createPrescriptionUpdateRow.mockResolvedValue(
      update({ sequenceNo: 3, cumulativeAchieved: 12 }),
    );

    await recordPrescriptionUpdate(
      { targetId: "target-1", cumulativeAchieved: 12, confirmDecrease: false },
      "delegate-1",
    );

    expect(createPrescriptionUpdateRow).toHaveBeenCalledWith(
      expect.objectContaining({ sequenceNo: 3, cumulativeAchieved: 12 }),
      {},
    );
  });

  it("concurrent_submission_reads_latest_only_after_the_lock_is_taken: locks before reading the prior latest value", async () => {
    findPrescriptionTargetById.mockResolvedValue(target());
    incrementUpdateSequence.mockResolvedValue(3);
    findLatestUpdateForTarget.mockResolvedValue(update({ cumulativeAchieved: 10 }));
    createPrescriptionUpdateRow.mockResolvedValue(update({ sequenceNo: 3 }));

    await recordPrescriptionUpdate(
      { targetId: "target-1", cumulativeAchieved: 12, confirmDecrease: false },
      "delegate-1",
    );

    const incrementOrder = incrementUpdateSequence.mock.invocationCallOrder[0];
    const readOrder = findLatestUpdateForTarget.mock.invocationCallOrder[0];
    expect(incrementOrder).toBeLessThan(readOrder);
  });

  it("decrease_requires_confirmation: rejects a lower value without confirmDecrease, carrying the server-read current value", async () => {
    findPrescriptionTargetById.mockResolvedValue(target());
    incrementUpdateSequence.mockResolvedValue(3);
    findLatestUpdateForTarget.mockResolvedValue(update({ cumulativeAchieved: 10 }));

    await expect(
      recordPrescriptionUpdate(
        { targetId: "target-1", cumulativeAchieved: 5, confirmDecrease: false },
        "delegate-1",
      ),
    ).rejects.toThrow(PrescriptionDecreaseConfirmationRequiredError);

    expect(createPrescriptionUpdateRow).not.toHaveBeenCalled();
  });

  it("decrease_requires_correction_reason: rejects a confirmed decrease with no reason", async () => {
    findPrescriptionTargetById.mockResolvedValue(target());
    incrementUpdateSequence.mockResolvedValue(3);
    findLatestUpdateForTarget.mockResolvedValue(update({ cumulativeAchieved: 10 }));

    await expect(
      recordPrescriptionUpdate(
        { targetId: "target-1", cumulativeAchieved: 5, confirmDecrease: true },
        "delegate-1",
      ),
    ).rejects.toThrow(PrescriptionCorrectionReasonRequiredError);

    expect(createPrescriptionUpdateRow).not.toHaveBeenCalled();
  });

  it("confirmed_decrease_with_reason_is_saved_and_flagged", async () => {
    findPrescriptionTargetById.mockResolvedValue(target());
    incrementUpdateSequence.mockResolvedValue(3);
    findLatestUpdateForTarget.mockResolvedValue(update({ cumulativeAchieved: 10 }));
    createPrescriptionUpdateRow.mockResolvedValue(
      update({ sequenceNo: 3, cumulativeAchieved: 5, acknowledgedDecrease: true }),
    );

    await recordPrescriptionUpdate(
      {
        targetId: "target-1",
        cumulativeAchieved: 5,
        confirmDecrease: true,
        correctionReason: "Typo in last visit",
      },
      "delegate-1",
    );

    expect(createPrescriptionUpdateRow).toHaveBeenCalledWith(
      expect.objectContaining({
        acknowledgedDecrease: true,
        correctionReason: "Typo in last visit",
      }),
      {},
    );
  });

  it("ownership_only_no_role_bypass: rejects recording on someone else's target", async () => {
    findPrescriptionTargetById.mockResolvedValue(target({ userId: "other-delegate" }));

    await expect(
      recordPrescriptionUpdate(
        { targetId: "target-1", cumulativeAchieved: 12, confirmDecrease: false },
        "delegate-1",
      ),
    ).rejects.toThrow(PrescriptionNotAuthorizedError);

    expect(incrementUpdateSequence).not.toHaveBeenCalled();
  });
});

describe("getMyPrescriptionFollowUps", () => {
  it("shows only targets whose latest update set a follow-up date", async () => {
    findLatestUpdatesForUserTargets.mockResolvedValue([
      {
        ...update({ targetId: "target-1", followUpDate: new Date("2026-06-20T00:00:00.000Z") }),
        target: { contact: { name: "Dr. One" }, product: { name: "Tamsuprost" } },
      },
      {
        ...update({ targetId: "target-2", followUpDate: null }),
        target: { contact: { name: "Dr. Two" }, product: { name: "Dimuprost TD" } },
      },
    ]);

    const result = await getMyPrescriptionFollowUps("delegate-1");

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ targetId: "target-1", contactName: "Dr. One" });
  });
});
