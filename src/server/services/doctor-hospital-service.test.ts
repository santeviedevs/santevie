import { beforeEach, describe, expect, it, vi } from "vitest";

const doctorHospitalExists = vi.fn();
const listActiveHospitalOptions = vi.fn();
const listHospitalsForDoctorRow = vi.fn();

vi.mock("@/server/repositories/doctor-hospital-repository", () => ({
  doctorHospitalExists,
  listActiveHospitalOptions,
  listHospitalsForDoctor: listHospitalsForDoctorRow,
}));

const { assertDoctorBelongsToHospital, listHospitalsForDoctor, DoctorHospitalMismatchError } =
  await import("./doctor-hospital-service");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("assertDoctorBelongsToHospital", () => {
  it("passes when the pair exists", async () => {
    doctorHospitalExists.mockResolvedValue(true);
    await expect(assertDoctorBelongsToHospital("doctor-1", "hospital-1")).resolves.toBeUndefined();
  });

  it("throws when the doctor is not linked to the hospital", async () => {
    doctorHospitalExists.mockResolvedValue(false);
    await expect(assertDoctorBelongsToHospital("doctor-1", "hospital-2")).rejects.toThrow(
      DoctorHospitalMismatchError,
    );
  });
});

describe("listHospitalsForDoctor", () => {
  it("maps repository rows to id/name/code", async () => {
    listHospitalsForDoctorRow.mockResolvedValue([
      {
        hospital: {
          id: "hospital-1",
          client: { id: "client-1", name: "PRINCE PHARMA", code: "CL-1" },
        },
      },
    ]);
    const result = await listHospitalsForDoctor("doctor-1");
    expect(result).toEqual([{ id: "hospital-1", name: "PRINCE PHARMA", code: "CL-1" }]);
  });
});
