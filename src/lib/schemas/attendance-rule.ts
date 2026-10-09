import { z } from "zod";

// cuid — matches the id format Prisma generates for Territory/User.
const id = z.string().min(1);

// Minutes-since-midnight (0 = 00:00 .. 1439 = 23:59), the same convention
// used for expectedStartMinutes itself.
const minutesOfDay = z.number().int().min(0).max(1439);

const thresholds = z.object({
  expectedStartMinutes: minutesOfDay,
  lateGraceMinutes: z.number().int().min(0).max(240),
  minimumWorkedMinutes: z.number().int().min(0).max(1440),
});

// One screen, one form — the scope type just picks which target field is
// required, per S3-04's locked design (territory / team / individual, never
// more than one scope set per rule version).
//
// Team scope has no target field at all — unlike Individual, which lets the
// actor name anyone in their downstream chain, Team scope is always "my own
// downstream team." The owner is resolved server-side from the session
// (attendance-rule-service.ts), never accepted from the client, so there's
// nothing for this branch to validate beyond the shared thresholds.
export const createAttendanceRuleSchema = z.discriminatedUnion("scope", [
  thresholds.extend({ scope: z.literal("territory"), territoryId: id }),
  thresholds.extend({ scope: z.literal("team") }),
  thresholds.extend({ scope: z.literal("individual"), targetUserId: id }),
]);
export type CreateAttendanceRuleInput = z.infer<typeof createAttendanceRuleSchema>;
