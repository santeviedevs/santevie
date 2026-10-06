import { z } from "zod";

// The GPS fix's own confidence radius (meters) a check-in must be within to
// be trusted — not a distance to anything else, just a quality gate on the
// fix itself. Shared between the client (so a bad fix is caught before
// submitting) and the server (which never trusts the client's judgment
// alone and re-checks this exact threshold).
export const MAX_ACCEPTABLE_ACCURACY_METERS = 50;

const latitude = z.number().min(-90).max(90);
const longitude = z.number().min(-180).max(180);
// The GPS fix's own confidence radius in meters, as reported by the browser
// Geolocation API's position.coords.accuracy — not a distance to anything
// else, just how much to trust this particular fix.
const accuracy = z.number().positive();
const deviceTimestamp = z.iso.datetime({ offset: true });

// Location fields are either all present (a GPS fix was captured) or all
// absent (no-location check-in) — never partial. Whether location is
// actually *required* for this particular check-in is a server-side
// decision (attendance-service.ts resolves it from the user's/role's
// requiresLocation), not something this schema enforces: a
// location-not-required user may still send one, and that's fine.
export const checkInSchema = z
  .object({
    lat: latitude.optional(),
    lng: longitude.optional(),
    accuracy: accuracy.optional(),
    deviceTimestamp: deviceTimestamp.optional(),
  })
  .superRefine((data, ctx) => {
    const present = [data.lat, data.lng, data.accuracy, data.deviceTimestamp];
    const filledCount = present.filter((value) => value !== undefined).length;
    if (filledCount !== 0 && filledCount !== present.length) {
      ctx.addIssue({
        code: "custom",
        path: ["lat"],
        message: "Send a complete location fix (lat, lng, accuracy, device time) or none at all.",
      });
    }
  });

export type CheckInInput = z.infer<typeof checkInSchema>;
