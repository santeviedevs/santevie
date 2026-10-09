import { z } from "zod";

// Three-tier GPS accuracy gate, shared between the client (so a bad fix is
// caught before submitting) and the server (which never trusts the
// client's judgment alone and re-checks the same thresholds):
//   - accuracy <= MAX_ACCEPTABLE_ACCURACY_METERS: clean accept, no flag.
//   - MAX_ACCEPTABLE_ACCURACY_METERS < accuracy <= MAX_REJECTABLE_ACCURACY_METERS:
//     accepted, but attendance-status-service.ts's NEEDS_REVIEW check (an
//     unconditional `accuracy > MAX_ACCEPTABLE_ACCURACY_METERS`) already
//     flags anything in this band for a supervisor to look at — no change
//     needed there, it was always written for this two-threshold shape.
//   - accuracy > MAX_REJECTABLE_ACCURACY_METERS: rejected outright, same as
//     before this tier was introduced — too unreliable to record at all.
export const MAX_ACCEPTABLE_ACCURACY_METERS = 50;
export const MAX_REJECTABLE_ACCURACY_METERS = 100;

const latitude = z.number().min(-90).max(90);
const longitude = z.number().min(-180).max(180);
// The GPS fix's own confidence radius in meters, as reported by the browser
// Geolocation API's position.coords.accuracy — not a distance to anything
// else, just how much to trust this particular fix.
const accuracy = z.number().positive();
const deviceTimestamp = z.iso.datetime({ offset: true });

// Location fields are either all present (a GPS fix was captured) or all
// absent (no-location event) — never partial. Whether location is actually
// *required* for this particular check-in or check-out is a server-side
// decision (attendance-service.ts resolves it from the user's/role's
// requiresLocation), not something this schema enforces: a
// location-not-required user may still send one, and that's fine. Check-in
// and check-out submit the identical shape, so both schemas are built from
// this one factory rather than kept as two copies that could drift.
function locationFixSchema() {
  return z
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
}

export const checkInSchema = locationFixSchema();
export type CheckInInput = z.infer<typeof checkInSchema>;

export const checkOutSchema = locationFixSchema();
export type CheckOutInput = z.infer<typeof checkOutSchema>;
