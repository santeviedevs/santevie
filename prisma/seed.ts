import { PrismaPg } from "@prisma/adapter-pg";
import { config as loadEnv } from "dotenv";

import { PrismaClient } from "../generated/prisma/client";
import { hashPassword } from "../src/server/auth/password";
import { PERMISSIONS, ROLE_PERMISSIONS, ROLES } from "../src/server/auth/permissions";

loadEnv({ path: ".env.local" });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const passwordHash = await hashPassword("ChangeMe123!");

  const permissions = new Map<string, string>();
  for (const key of PERMISSIONS) {
    const permission = await prisma.permission.upsert({
      where: { key },
      update: {},
      create: { key },
    });
    permissions.set(key, permission.id);
  }

  const roles = new Map<string, string>();
  for (const name of ROLES) {
    const role = await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    roles.set(name, role.id);

    for (const key of ROLE_PERMISSIONS[name]) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permissions.get(key)! } },
        update: {},
        create: { roleId: role.id, permissionId: permissions.get(key)! },
      });
    }
  }

  // Real sample values from the client's own location data (Équateur >
  // Mbandaka > Wangata > Bongondo), not a placeholder — see the DRC
  // Province/Ville/Commune/Quartier sheet the client shared.
  const province = await prisma.province.upsert({
    where: { name: "Équateur" },
    update: {},
    create: { name: "Équateur" },
  });

  const ville = await prisma.ville.upsert({
    where: { provinceId_name: { provinceId: province.id, name: "Mbandaka" } },
    update: {},
    create: { name: "Mbandaka", provinceId: province.id },
  });

  const commune = await prisma.commune.upsert({
    where: { villeId_name: { villeId: ville.id, name: "Wangata" } },
    update: {},
    create: { name: "Wangata", villeId: ville.id },
  });

  const quartier = await prisma.quartier.upsert({
    where: { communeId_name: { communeId: commune.id, name: "Bongondo" } },
    update: {},
    create: { name: "Bongondo", communeId: commune.id },
  });

  const admin = await prisma.user.upsert({
    where: { email: "admin@santevie.test" },
    update: {},
    create: {
      employeeCode: "EMP-ADMIN",
      name: "Admin User",
      email: "admin@santevie.test",
      passwordHash,
      roleId: roles.get("ADMIN")!,
      provinceId: province.id,
      villeId: ville.id,
      communeId: commune.id,
      quartierId: quartier.id,
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: "manager@santevie.test" },
    update: {},
    create: {
      employeeCode: "EMP-MANAGER",
      name: "Manager User",
      email: "manager@santevie.test",
      passwordHash,
      roleId: roles.get("MANAGER")!,
      provinceId: province.id,
      villeId: ville.id,
      communeId: commune.id,
      quartierId: quartier.id,
      managerId: admin.id,
    },
  });

  const supervisor = await prisma.user.upsert({
    where: { email: "supervisor@santevie.test" },
    update: {},
    create: {
      employeeCode: "EMP-SUPERVISOR",
      name: "Supervisor User",
      email: "supervisor@santevie.test",
      passwordHash,
      roleId: roles.get("SUPERVISOR")!,
      provinceId: province.id,
      villeId: ville.id,
      communeId: commune.id,
      quartierId: quartier.id,
      managerId: manager.id,
    },
  });

  await prisma.user.upsert({
    where: { email: "delegate@santevie.test" },
    update: {},
    create: {
      employeeCode: "EMP-DELEGATE",
      name: "Delegate User",
      email: "delegate@santevie.test",
      passwordHash,
      roleId: roles.get("DELEGATE")!,
      provinceId: province.id,
      villeId: ville.id,
      communeId: commune.id,
      quartierId: quartier.id,
      managerId: supervisor.id,
    },
  });

  const clientTypes = new Map<string, string>();
  for (const [code, name] of [
    ["DOCTOR", "Doctor"],
    ["HOSPITAL", "Hospital"],
    ["CHEMIST", "Chemist"],
    ["PHARMACY", "Pharmacy"],
  ]) {
    const clientType = await prisma.clientType.upsert({
      where: { code },
      update: {},
      create: { code, name },
    });
    clientTypes.set(code, clientType.id);
  }

  // Codes namespaced away from "CL-0001"/"CL-0002" deliberately — this seed
  // runs against a shared dev database that already has client records at
  // those codes from earlier stories, with types the original (pre-S2-02)
  // seed assigned. Reusing them here would silently attach a Hospital/
  // Doctor extension to whatever pre-existing client already holds that
  // code, regardless of its actual type — exactly the bug this comment is
  // here to prevent a repeat of.
  const hospitalClient = await prisma.client.upsert({
    where: { code: "CL-HOSP-0001" },
    update: {},
    create: {
      code: "CL-HOSP-0001",
      name: "Sample Clinic",
      typeId: clientTypes.get("HOSPITAL")!,
      quartierId: quartier.id,
      communeId: commune.id,
      villeId: ville.id,
      provinceId: province.id,
      latitude: 0.0487,
      longitude: 18.2603,
    },
  });
  if (hospitalClient.typeId !== clientTypes.get("HOSPITAL")) {
    throw new Error(
      `Seed conflict: client CL-HOSP-0001 already exists with a different typeId (${hospitalClient.typeId}); refusing to attach a Hospital extension to it.`,
    );
  }
  const hospital = await prisma.hospital.upsert({
    where: { clientId: hospitalClient.id },
    update: {},
    create: { clientId: hospitalClient.id, hospitalCategory: "Centre Médical" },
  });

  const doctorClient = await prisma.client.upsert({
    where: { code: "CL-DOC-0001" },
    update: {},
    create: {
      code: "CL-DOC-0001",
      name: "Sample Doctor",
      typeId: clientTypes.get("DOCTOR")!,
      quartierId: quartier.id,
      communeId: commune.id,
      villeId: ville.id,
      provinceId: province.id,
    },
  });
  if (doctorClient.typeId !== clientTypes.get("DOCTOR")) {
    throw new Error(
      `Seed conflict: client CL-DOC-0001 already exists with a different typeId (${doctorClient.typeId}); refusing to attach a Doctor extension to it.`,
    );
  }
  const doctor = await prisma.doctor.upsert({
    where: { clientId: doctorClient.id },
    update: {},
    create: {
      clientId: doctorClient.id,
      doctorType: "MÉDECIN",
      gender: "Homme",
      department: "GÉNÉRALISTE (G.P)",
      mobileNo: "810000000",
    },
  });

  await prisma.doctorHospital.upsert({
    where: { doctorId_hospitalId: { doctorId: doctor.id, hospitalId: hospital.id } },
    update: {},
    create: { doctorId: doctor.id, hospitalId: hospital.id },
  });

  await prisma.product.upsert({
    where: { code: "PR-0001" },
    update: {},
    create: {
      code: "PR-0001",
      name: "Sample Product",
      price: 100,
      currency: "AED",
    },
  });

  console.log("Seed complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
