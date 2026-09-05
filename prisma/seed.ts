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

  const territory = await prisma.territory.upsert({
    where: { code: "DXB-01" },
    update: {},
    create: { code: "DXB-01", name: "Dubai Central" },
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
      homeTerritoryId: territory.id,
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
      homeTerritoryId: territory.id,
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
      homeTerritoryId: territory.id,
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
      homeTerritoryId: territory.id,
      managerId: supervisor.id,
    },
  });

  const clientType = await prisma.clientType.upsert({
    where: { code: "DOCTOR" },
    update: {},
    create: { code: "DOCTOR", name: "Doctor" },
  });

  await prisma.client.upsert({
    where: { code: "CL-0001" },
    update: {},
    create: {
      code: "CL-0001",
      name: "Sample Clinic",
      typeId: clientType.id,
      territoryId: territory.id,
      latitude: 25.2048,
      longitude: 55.2708,
    },
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
