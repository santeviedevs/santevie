import { beforeEach, describe, expect, it, vi } from "vitest";

import { Prisma } from "../../../generated/prisma/client";

const createEmballageCollectionRow = vi.fn();
const findEmballageCollectionById = vi.fn();
const correctEmballageCollectionRow = vi.fn();
const createEmballageCorrectionRow = vi.fn();
const findCorrectionsForCollection = vi.fn();
const listEmballageCollections = vi.fn();
const countEmballageCollections = vi.fn();
const findEmballageCollectionsForPeriod = vi.fn();
const lockEmballageCollectionsForPeriod = vi.fn();
const createEmballageReportRunRow = vi.fn();
const findEmballageReportRun = vi.fn();
const runInTransaction = vi.fn();
vi.mock("@/server/repositories/emballage-repository", () => ({
  createEmballageCollectionRow,
  findEmballageCollectionById,
  correctEmballageCollectionRow,
  createEmballageCorrectionRow,
  findCorrectionsForCollection,
  listEmballageCollections,
  countEmballageCollections,
  findEmballageCollectionsForPeriod,
  lockEmballageCollectionsForPeriod,
  createEmballageReportRunRow,
  findEmballageReportRun,
  runInTransaction: (fn: (tx: unknown) => unknown) => runInTransaction(fn),
}));

const getUserScope = vi.fn();
const isWithinScope = vi.fn();
const scopeUserIds = vi.fn();
vi.mock("@/server/scope", async () => {
  const actual = await vi.importActual<typeof import("@/server/scope")>("@/server/scope");
  return { ...actual, getUserScope, isWithinScope, scopeUserIds };
});

const {
  correctEmballageCollection,
  createEmballageCollection,
  EmballageCollectionLockedError,
  EmballageCollectionNotFoundError,
  EmballageNotAuthorizedError,
  EmballageReportAlreadyFinalizedError,
  finalizeEmballageReport,
  getEmballageReport,
} = await import("./emballage-service");

function collection(overrides: Record<string, unknown> = {}) {
  return {
    id: "c-1",
    centerId: "center-1",
    productId: "product-1",
    userId: "delegate-1",
    visitDate: new Date("2026-06-10T00:00:00.000Z"),
    quantity: "10",
    remarks: null,
    correctionCount: 0,
    locked: false,
    center: { id: "center-1", name: "Centre A", code: "C1" },
    product: { id: "product-1", name: "Product A", code: "P1" },
    user: { id: "delegate-1", name: "Delegate One" },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  runInTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn({}));
});

describe("createEmballageCollection", () => {
  it("creates a new log row owned by the actor", async () => {
    createEmballageCollectionRow.mockResolvedValue(collection());

    const result = await createEmballageCollection(
      { centerId: "center-1", productId: "product-1", visitDate: "2026-06-10", quantity: 10 },
      "delegate-1",
    );

    expect(createEmballageCollectionRow).toHaveBeenCalledWith(
      expect.objectContaining({
        center: { connect: { id: "center-1" } },
        product: { connect: { id: "product-1" } },
        user: { connect: { id: "delegate-1" } },
        quantity: "10",
        createdBy: "delegate-1",
        updatedBy: "delegate-1",
      }),
    );
    expect(result.quantity).toBe("10");
  });
});

describe("correctEmballageCollection", () => {
  it("lets the owning delegate correct their own unlocked record", async () => {
    findEmballageCollectionById.mockResolvedValue(collection());
    correctEmballageCollectionRow.mockResolvedValue(collection({ quantity: "12" }));

    const result = await correctEmballageCollection(
      { id: "c-1", quantity: 12, reason: "Miscounted" },
      { user: { id: "delegate-1", roleName: "DELEGATE" } },
      false,
    );

    expect(correctEmballageCollectionRow).toHaveBeenCalledWith("c-1", "12", "delegate-1", {});
    expect(createEmballageCorrectionRow).toHaveBeenCalledWith(
      expect.objectContaining({
        previousQuantity: "10",
        newQuantity: "12",
        reason: "Miscounted",
      }),
      {},
    );
    expect(result.quantity).toBe("12");
  });

  it("rejects correcting someone else's unlocked record", async () => {
    findEmballageCollectionById.mockResolvedValue(collection({ userId: "other-delegate" }));

    await expect(
      correctEmballageCollection(
        { id: "c-1", quantity: 12 },
        { user: { id: "delegate-1", roleName: "DELEGATE" } },
        false,
      ),
    ).rejects.toThrow(EmballageNotAuthorizedError);
  });

  it("rejects correcting a locked record without emballage:correct-locked", async () => {
    findEmballageCollectionById.mockResolvedValue(collection({ locked: true }));

    await expect(
      correctEmballageCollection(
        { id: "c-1", quantity: 12 },
        { user: { id: "delegate-1", roleName: "DELEGATE" } },
        false,
      ),
    ).rejects.toThrow(EmballageCollectionLockedError);
  });

  it("allows a manager with emballage:correct-locked to correct a locked record", async () => {
    findEmballageCollectionById.mockResolvedValue(collection({ locked: true }));
    correctEmballageCollectionRow.mockResolvedValue(collection({ locked: true }));

    await expect(
      correctEmballageCollection(
        { id: "c-1", quantity: 12 },
        { user: { id: "manager-1", roleName: "MANAGER" } },
        true,
      ),
    ).resolves.toBeDefined();
  });

  it("throws if the record doesn't exist", async () => {
    findEmballageCollectionById.mockResolvedValue(null);

    await expect(
      correctEmballageCollection(
        { id: "missing", quantity: 1 },
        { user: { id: "delegate-1", roleName: "DELEGATE" } },
        false,
      ),
    ).rejects.toThrow(EmballageCollectionNotFoundError);
  });
});

describe("getEmballageReport", () => {
  it("sums the current (corrected) quantity per centre x product", async () => {
    findEmballageCollectionsForPeriod.mockResolvedValue([
      collection({ quantity: new Prisma.Decimal("10") }),
      collection({ id: "c-2", quantity: new Prisma.Decimal("32") }),
      collection({
        id: "c-3",
        centerId: "center-2",
        center: { id: "center-2", name: "Centre B", code: "C2" },
        quantity: new Prisma.Decimal("5"),
      }),
    ]);

    const report = await getEmballageReport(6, 2026);

    expect(findEmballageCollectionsForPeriod).toHaveBeenCalledWith(6, 2026, undefined, undefined);
    expect(report).toEqual([
      {
        centerId: "center-1",
        centerName: "Centre A",
        productId: "product-1",
        productName: "Product A",
        totalQuantity: "42",
        collectionCount: 2,
      },
      {
        centerId: "center-2",
        centerName: "Centre B",
        productId: "product-1",
        productName: "Product A",
        totalQuantity: "5",
        collectionCount: 1,
      },
    ]);
  });
});

describe("finalizeEmballageReport", () => {
  it("locks every row in the period and records the report run", async () => {
    findEmballageReportRun.mockResolvedValue(null);

    await finalizeEmballageReport({ periodMonth: 6, periodYear: 2026 }, "manager-1");

    expect(lockEmballageCollectionsForPeriod).toHaveBeenCalledWith(6, 2026, {});
    expect(createEmballageReportRunRow).toHaveBeenCalledWith(
      expect.objectContaining({
        periodMonth: 6,
        periodYear: 2026,
        finalizedByUser: { connect: { id: "manager-1" } },
      }),
      {},
    );
  });

  it("rejects finalizing an already-finalized month", async () => {
    findEmballageReportRun.mockResolvedValue({ id: "run-1" });

    await expect(
      finalizeEmballageReport({ periodMonth: 6, periodYear: 2026 }, "manager-1"),
    ).rejects.toThrow(EmballageReportAlreadyFinalizedError);
    expect(lockEmballageCollectionsForPeriod).not.toHaveBeenCalled();
  });
});
