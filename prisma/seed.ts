import { PrismaPg } from "@prisma/adapter-pg";
import { config as loadEnv } from "dotenv";

import { PrismaClient } from "../generated/prisma/client";
import { slugifyLookupName } from "../src/lib/lookup-slug";
import { hashPassword } from "../src/server/auth/password";
import {
  PERMISSIONS,
  ROLE_LOCATION_DEFAULTS,
  ROLE_PERMISSIONS,
  ROLES,
} from "../src/server/auth/permissions";

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
      update: { requiresLocation: ROLE_LOCATION_DEFAULTS[name] },
      create: { name, requiresLocation: ROLE_LOCATION_DEFAULTS[name] },
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
  // Province/Ville/Commune/Quartier sheet the client shared. Pure
  // geography now, no code of their own — Territory (below) is what owns
  // the code.
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

  // The Territory mapping to this exact path — matched by pathKey against
  // whatever already exists (this seed runs against a shared dev DB where
  // this combination was already backfilled into a Territory row when the
  // model was introduced), or created fresh on a brand-new database. The
  // code here is namespaced away from the "TER-00001" sequential format
  // the application generates, so it can never collide with it.
  const territoryPathKey = `${province.id}:${ville.id}:${commune.id}:${quartier.id}`;
  const territory = await prisma.territory.upsert({
    where: { pathKey: territoryPathKey },
    update: {},
    create: {
      code: "TER-SEED-EQUATEUR",
      provinceId: province.id,
      villeId: ville.id,
      communeId: commune.id,
      quartierId: quartier.id,
      pathKey: territoryPathKey,
    },
  });

  // Mon-Sat working, Sunday off — an editable placeholder (D4 in the
  // execution plan is still open with the client), seeded directly here
  // since this territory is created via upsert above, bypassing the
  // territory-service.ts create flow that auto-seeds these rows for every
  // territory created through the application from here on.
  for (let dayOfWeek = 0; dayOfWeek <= 6; dayOfWeek++) {
    await prisma.territoryWorkingDay.upsert({
      where: { territoryId_dayOfWeek: { territoryId: territory.id, dayOfWeek } },
      update: {},
      create: { territoryId: territory.id, dayOfWeek, isWorking: dayOfWeek !== 0 },
    });
  }

  // Initial leave-type catalogue requested for the application.
  for (const [code, name] of [
    ["ANNUAL", "Annual Leave"],
    ["SICK", "Sick Leave"],
    ["MATERNITY", "Maternity Leave"],
    ["PATERNITY", "Paternity / Childbirth Leave"],
    ["MARRIAGE", "Marriage Leave"],
    ["CHILD_MARRIAGE", "Child's Marriage Leave"],
    ["BEREAVEMENT_CLOSE", "Bereavement Leave – Spouse/Close Family"],
    ["BEREAVEMENT_EXTENDED", "Bereavement Leave – Extended Family"],
    ["OTHER", "Other / Exceptional Leave"],
  ]) {
    await prisma.leaveType.upsert({
      where: { code },
      update: {},
      create: { code, name },
    });
  }

  const admin = await prisma.user.upsert({
    where: { email: "admin@santevie.test" },
    update: {},
    create: {
      employeeCode: "EMP-ADMIN",
      name: "Admin User",
      email: "admin@santevie.test",
      passwordHash,
      roleId: roles.get("ADMIN")!,
      territoryId: territory.id,
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
      territoryId: territory.id,
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
      territoryId: territory.id,
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
      territoryId: territory.id,
      managerId: supervisor.id,
    },
  });

  const centerTypes = new Map<string, string>();
  for (const [code, name] of [
    ["CLINIC", "Clinic"],
    ["HOSPITAL", "Hospital"],
    ["CHEMIST", "Chemist"],
    ["PHARMACY", "Pharmacy"],
  ]) {
    const centerType = await prisma.centerType.upsert({
      where: { code },
      update: {},
      create: { code, name },
    });
    centerTypes.set(code, centerType.id);
  }

  // Codes namespaced away from "CL-0001"/"CL-0002" deliberately — this seed
  // runs against a shared dev database that already has center records at
  // those codes from earlier stories, with types the original (pre-S2-02)
  // seed assigned. Reusing them here would silently attach a Hospital/
  // Doctor extension to whatever pre-existing center already holds that
  // code, regardless of its actual type — exactly the bug this comment is
  // here to prevent a repeat of.
  const hospitalCenter = await prisma.center.upsert({
    where: { code: "CL-HOSP-0001" },
    update: {},
    create: {
      code: "CL-HOSP-0001",
      name: "Sample Clinic",
      typeId: centerTypes.get("HOSPITAL")!,
      territoryId: territory.id,
      latitude: 0.0487,
      longitude: 18.2603,
    },
  });
  if (hospitalCenter.typeId !== centerTypes.get("HOSPITAL")) {
    throw new Error(
      `Seed conflict: center CL-HOSP-0001 already exists with a different typeId (${hospitalCenter.typeId}); refusing to attach a Hospital extension to it.`,
    );
  }
  await prisma.hospital.upsert({
    where: { centerId: hospitalCenter.id },
    update: {},
    create: { centerId: hospitalCenter.id, hospitalCategory: "Centre Médical" },
  });

  await prisma.center.upsert({
    where: { code: "CL-CLINIC-0001" },
    update: {},
    create: {
      code: "CL-CLINIC-0001",
      name: "Sample Clinic Center",
      typeId: centerTypes.get("CLINIC")!,
      territoryId: territory.id,
    },
  });

  // Initial Person Types. Configurable at runtime (admins can add more from
  // the Persons form) — these are only the two the client named up front.
  for (const [code, name] of [
    ["MEDECIN", "MÉDECIN"],
    ["INFIRMIER", "INFIRMIER"],
  ]) {
    await prisma.personType.upsert({ where: { code }, update: {}, create: { code, name } });
  }

  // Initial Specializations / Departments, taken from the client's source
  // data. Configurable at runtime like Person Type — admins can add more
  // from the Persons form. Distinct from Person Type, Center Type and Role
  // at Center; per-Center roles are deliberately NOT seeded (no approved
  // values). The code comes from slugifyLookupName, the same rule the
  // Persons form uses, so a value later typed into the combobox maps onto
  // the same row instead of duplicating it.
  for (const name of [
    "GÉNÉRALISTE (G.P)",
    "PÉDIATRE (PED)",
    "INFIRMIÈRE (NURSE)",
    "INFIRMIÈRE TITULAIRE (IT) (HEAD NURSE)",
    "INFIRMIÈRE GÉNÉRALISTE (G.P NURSE)",
    "CHIRURGIEN (SURGEON)",
    "MÉDECINE INTERNE (INTERNIST)",
    "GYNÉCOLOGUE (GYN)",
    "DENTISTE",
    "NEUROLOGUE",
    "STAGIAIRE MÉDECINE (INTERN-DOCTOR)",
    "SAGE-FEMME (MID-WIFE)",
    "TECHNICIEN DE LABORATOIRE",
    "STAGIAIRE INFIRMIÈRE (INTERN-NURSE)",
    "ORTHOPEDICIEN",
    "OPHTALMOLOGIST",
    "PHARMACIEN (PHARMACIST)",
    "UROLOGUE",
    "GASTROLOGUE",
    "CARDIOLOGUE",
    "ORL (ENT)",
    "PSYCHOLOGUE",
    "PHYSIOTHÉRAPEUTE",
    "PSYCHIATRE",
  ]) {
    const code = slugifyLookupName(name);
    await prisma.specialization.upsert({
      where: { code },
      update: {},
      create: { code, name },
    });
  }

  // A small starting taxonomy, from our own reading of the price list's
  // generic names — the sheet itself has no category column, and the
  // client hasn't confirmed a real one yet (see product.ts). Left broad
  // deliberately; products are free to have no category at all.
  const productCategories = new Map<string, string>();
  for (const [code, name] of [
    ["ANTIBIOTIC", "Antibiotic"],
    ["ANALGESIC", "Analgesic / Anti-inflammatory"],
    ["ANTIPARASITIC", "Antiparasitic"],
    ["GASTRO", "Gastro-intestinal"],
    ["VITAMIN", "Vitamins & supplements"],
  ]) {
    const category = await prisma.productCategory.upsert({
      where: { code },
      update: {},
      create: { code, name },
    });
    productCategories.set(code, category.id);
  }

  // Real sample values from Alisons' August 2026 price list (distributed
  // via Santevie/Kinshasa) — gross and net exactly as given (net already
  // reflects the client's own discount, not derived from a percentage; see
  // product.ts). No `code` column exists in the source sheet, so these are
  // generated placeholders, pending real codes from the client.
  //
  // Codes namespaced as "PR-ALS-..." deliberately, not "PR-0001" onward —
  // this seed runs against a shared dev database that already has a
  // "PR-0001" Product row from the original (pre-S2-03) seed, under the old
  // single-price shape. Reusing that code here would upsert against it with
  // an empty `update: {}` and silently leave its stale name/price in place
  // — exactly the bug the identical comment on the Center seed above is
  // there to prevent a repeat of.
  for (const [code, name, categoryCode, grossPrice, netPrice] of [
    ["PR-ALS-0001", "AGGUPLAX (CLOPIDOGREL) 75 mg", "ANTIPARASITIC", 3.334, 3.0],
    ["PR-ALS-0002", "ALBENTEL (ALBENDAZOLE) 400 mg", "ANTIPARASITIC", 7.0, 6.3],
    ["PR-ALS-0003", "CIFIN 500 mg (Ciprofloxacine)", "ANTIBIOTIC", 7.223, 6.5],
    ["PR-ALS-0004", "DOLAREN Plus(Diclofénac+para+chlorzoxazone)", "ANALGESIC", 4.445, 4.0],
    ["PR-ALS-0005", "ALAIZE (ANTI ACIDE) susp", "GASTRO", 2.5, 2.25],
    ["PR-ALS-0006", "ORACEE 500 mg (Vitamine C 500 mg)", "VITAMIN", 2.5, 2.25],
  ] as const) {
    const product = await prisma.product.upsert({
      where: { code },
      update: {},
      create: {
        code,
        name,
        categoryId: productCategories.get(categoryCode)!,
        grossPrice,
        netPrice,
      },
    });
    await prisma.productPriceHistory.upsert({
      where: { id: `${product.id}-seed` },
      update: {},
      create: { id: `${product.id}-seed`, productId: product.id, grossPrice, netPrice },
    });
  }

  // Starting USD → CDF rate — Deepak's own figure from the pricing
  // discussion ("today's rate is $1 = 2350 CDF"), set manually and never
  // auto-fetched (see exchange-rate-service.ts).
  const hasRate = await prisma.exchangeRate.findFirst();
  if (!hasRate) {
    await prisma.exchangeRate.create({ data: { rate: 2350 } });
  }

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
