import { describe, expect, it } from "vitest";

import {
  contactFiltersSchema,
  createContactSchema,
  createLookupSchema,
  updateContactSchema,
} from "./contact";

const valid = {
  name: "Dr Test",
  contactTypeId: "pt-1",
  specializationId: "sp-1",
  territoryId: "ter-1",
  centers: [{ centerId: "c-1", roleAtCenterId: "r-1" }],
};

describe("createContactSchema", () => {
  it("accepts a minimal valid contact", () => {
    expect(createContactSchema.safeParse(valid).success).toBe(true);
  });

  it.each(["name", "contactTypeId", "specializationId", "territoryId"] as const)(
    "requires %s",
    (field) => {
      expect(createContactSchema.safeParse({ ...valid, [field]: "" }).success).toBe(false);
      const missing: Record<string, unknown> = { ...valid };
      delete missing[field];
      expect(createContactSchema.safeParse(missing).success).toBe(false);
    },
  );

  it("discards a client-supplied code — codes are backend-generated", () => {
    const parsed = createContactSchema.parse({ ...valid, code: "CON-99999" });
    expect(parsed).not.toHaveProperty("code");
  });

  it("rejects the same Center twice, accepts different Centers", () => {
    const twice = createContactSchema.safeParse({
      ...valid,
      centers: [
        { centerId: "c-1", roleAtCenterId: "r-1" },
        { centerId: "c-1", roleAtCenterId: "r-2" },
      ],
    });
    expect(twice.success).toBe(false);

    const distinct = createContactSchema.safeParse({
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
      createContactSchema.safeParse({
        ...valid,
        centers: [{ centerId: "c-1", roleAtCenterId: "" }],
      }).success,
    ).toBe(false);
  });

  it("validates gender and mobile loosely", () => {
    expect(createContactSchema.safeParse({ ...valid, gender: "MALE" }).success).toBe(true);
    expect(createContactSchema.safeParse({ ...valid, gender: "X" }).success).toBe(false);
    expect(createContactSchema.safeParse({ ...valid, mobile: "+243 81 234-5678" }).success).toBe(
      true,
    );
    expect(createContactSchema.safeParse({ ...valid, mobile: "abc123" }).success).toBe(false);
    expect(createContactSchema.safeParse({ ...valid, mobile: "123" }).success).toBe(false);
    expect(createContactSchema.safeParse({ ...valid, mobile: null }).success).toBe(true);
  });
});

describe("updateContactSchema", () => {
  it("requires an id, allows an optional status, and still strips code", () => {
    expect(updateContactSchema.safeParse(valid).success).toBe(false);
    const parsed = updateContactSchema.parse({
      ...valid,
      id: "contact-1",
      status: "INACTIVE",
      code: "CON-1",
    });
    expect(parsed.status).toBe("INACTIVE");
    expect(parsed).not.toHaveProperty("code");
  });
});

describe("createLookupSchema", () => {
  it("accepts the three lookup kinds and rejects others", () => {
    for (const kind of ["contactType", "specialization", "centerRole"]) {
      expect(createLookupSchema.safeParse({ kind, name: "X" }).success).toBe(true);
    }
    expect(createLookupSchema.safeParse({ kind: "hospital", name: "X" }).success).toBe(false);
    expect(createLookupSchema.safeParse({ kind: "contactType", name: "  " }).success).toBe(false);
  });
});

describe("contactFiltersSchema", () => {
  it("clamps pageSize to the hard ceiling and degrades bad pages", () => {
    const parsed = contactFiltersSchema.parse({ pageSize: "9999", page: "-3" });
    expect(parsed.pageSize).toBe(100);
    expect(parsed.page).toBe(1);
  });
});
