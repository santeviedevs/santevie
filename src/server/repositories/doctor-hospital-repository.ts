import { prisma } from "@/server/db";

// Hospitals available for a delegate visiting this Doctor — only ever the
// Hospitals actually linked to them (decision: hospital selection should use
// DoctorHospital, not an arbitrary list). Active hospitals only, since an
// inactive one shouldn't be offered for a new visit either.
export function listHospitalsForDoctor(doctorId: string) {
  return prisma.doctorHospital.findMany({
    where: { doctorId, hospital: { client: { status: "ACTIVE" } } },
    include: {
      hospital: { include: { client: { select: { id: true, name: true, code: true } } } },
    },
  });
}

export function doctorHospitalExists(doctorId: string, hospitalId: string): Promise<boolean> {
  return prisma.doctorHospital
    .findUnique({ where: { doctorId_hospitalId: { doctorId, hospitalId } } })
    .then((row) => row !== null);
}

// Replaces the full set of Hospital links for a Doctor with `hospitalIds` —
// used by the Client form's save, which submits the whole desired set each
// time rather than incremental add/remove calls.
export async function setDoctorHospitals(
  doctorId: string,
  hospitalIds: string[],
  actorId: string,
): Promise<void> {
  await prisma.doctorHospital.deleteMany({
    where: { doctorId, hospitalId: { notIn: hospitalIds } },
  });
  for (const hospitalId of hospitalIds) {
    await prisma.doctorHospital.upsert({
      where: { doctorId_hospitalId: { doctorId, hospitalId } },
      update: {},
      create: { doctorId, hospitalId, createdBy: actorId, updatedBy: actorId },
    });
  }
}

// Active hospitals to offer in the Doctor form's hospital picker.
export function listActiveHospitalOptions() {
  return prisma.hospital.findMany({
    where: { client: { status: "ACTIVE" } },
    select: { id: true, client: { select: { id: true, name: true, code: true } } },
    orderBy: { client: { name: "asc" } },
  });
}
