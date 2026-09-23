import {
  doctorHospitalExists,
  listActiveHospitalOptions,
  listHospitalsForDoctor as listHospitalsForDoctorRow,
} from "@/server/repositories/doctor-hospital-repository";

// A Visit naming both a Doctor client and a Hospital is only valid if that
// pair already exists in DoctorHospital — the server is the enforcement
// boundary here (decision 13), never the hospital dropdown's own filtering,
// since a hand-crafted request could submit any hospitalId regardless of
// what the UI offered.
export class DoctorHospitalMismatchError extends Error {
  constructor() {
    super("This doctor is not associated with the selected hospital.");
    this.name = "DoctorHospitalMismatchError";
  }
}

export async function assertDoctorBelongsToHospital(
  doctorId: string,
  hospitalId: string,
): Promise<void> {
  const exists = await doctorHospitalExists(doctorId, hospitalId);
  if (!exists) throw new DoctorHospitalMismatchError();
}

export async function listHospitalsForDoctor(doctorId: string) {
  const links = await listHospitalsForDoctorRow(doctorId);
  return links.map((link) => ({
    id: link.hospital.id,
    name: link.hospital.client.name,
    code: link.hospital.client.code,
  }));
}

export async function getHospitalOptions() {
  const hospitals = await listActiveHospitalOptions();
  return hospitals.map((hospital) => ({
    id: hospital.id,
    name: hospital.client.name,
    code: hospital.client.code,
  }));
}
