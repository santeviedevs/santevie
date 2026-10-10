import type { Prisma } from "../../../generated/prisma/client";

// Just the names needed to print a Territory's path (see formatTerritoryPath)
// — shared by every query that shows where a Center is.
export const territoryPathSelect = {
  select: {
    province: { select: { name: true } },
    ville: { select: { name: true } },
    commune: { select: { name: true } },
    quartier: { select: { name: true } },
  },
} satisfies { select: Prisma.TerritorySelect };
