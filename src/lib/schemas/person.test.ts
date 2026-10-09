import { describe, expect, it } from "vitest";

import {
  createLookupSchema,
  createPersonSchema,
  personFiltersSchema,
  updatePersonSchema,
} from "./person";

const valid = {
  name: "Dr Test",
  personTypeId: "pt-1",
  specializationId: "sp-1",
  territoryId: "ter-1",
  centers: [{ centerId: "c-1", roleAtCenterId: "r-1" }],
};

describe("createPersonSchema", () => {
  it("accepts a minimal valid person", () => {
    expect(createPersonSchema.safeParse(valid).success).toBe(true);
  });

  it.each(["name", "personTypeId", "specializationId", "territoryId"] as const)(
    "requires %s",
    (field) => {
      expect(createPersonSchema.safeParse({ ...valid, [field]: "" }).success).toBe(false);
      const missing: Record<string, unknown> = { ...valid };
      delete missing[field];
      expect(createPersonSchema.safeParse(missing).success).toBe(false);
    },
  );

  it("discards a client-supplied code — codes are backend-generated", () => {
    const parsed = createPersonSchema.parse({ ...valid, code: "PER-99999" });
    expect(parsed).not.toHaveProperty("code");
  });

  it("rejects the same Center twice, accepts different Centers", () => {
    const twice = createPersonSchema.safeParse({
      ...valid,
      centers: [
        { centerId: "c-1", roleAtCenterId: "r-1" },
        { centerId: "c-1", roleAtCenterId: "r-2" },
      ],
    });
    expect(twice.success).toBe(false);

    const distinct = createPersonSchema.safeParse({
      ...valid,
      centers: [
        { centerId: "c-1", roleAtCenterId: "r-1" },
        { centerId: "c-2", roleAtCenterId: "r-2" },
      ],
    });
    expect(distinct.success).toBe(true);
  });

  it("requires a role for every association", () => {
    expect(
      createPersonSchema.safeParse({ ...valid, centers: [{ centerId: "c-1", roleAtCenterId: "" }] })
        .success,
    ).toBe(false);
  });

  it("validates gender and mobile loosely", () => {
    expect(createPersonSchema.safeParse({ ...valid, gender: "MALE" }).success).toBe(true);
    expect(createPersonSchema.safeParse({ ...valid, gender: "X" }).success).toBe(false);
    expect(createPersonSchema.safeParse({ ...valid, mobile: "+243 81 234-5678" }).success).toBe(
      true,
    );
    expect(createPersonSchema.safeParse({ ...valid, mobile: "abc123" }).success).toBe(false);
    expect(createPersonSchema.safeParse({ ...valid, mobile: "123" }).success).toBe(false);
    expect(createPersonSchema.safeParse({ ...valid, mobile: null }).success).toBe(true);
  });
});

describe("updatePersonSchema", () => {
  it("requires an id, allows an optional status, and still strips code", () => {
    expect(updatePersonSchema.safeParse(valid).success).toBe(false);
    const parsed = updatePersonSchema.parse({
      ...valid,
      id: "person-1",
      status: "INACTIVE",
      code: "PER-1",
    });
    expect(parsed.status).toBe("INACTIVE");
    expect(parsed).not.toHaveProperty("code");
  });
});

describe("createLookupSchema", () => {
  it("accepts the three lookup kinds and rejects others", () => {
    for (const kind of ["personType", "specialization", "centerRole"]) {
      expect(createLookupSchema.safeParse({ kind, name: "X" }).success).toBe(true);
    }
    expect(createLookupSchema.safeParse({ kind: "hospital", name: "X" }).success).toBe(false);
    expect(createLookupSchema.safeParse({ kind: "personType", name: "  " }).success).toBe(false);
  });
});

describe("personFiltersSchema", () => {
  it("clamps pageSize to the hard ceiling and degrades bad pages", () => {
    const parsed = personFiltersSchema.parse({ pageSize: "9999", page: "-3" });
    expect(parsed.pageSize).toBe(100);
    expect(parsed.page).toBe(1);
  });
});
