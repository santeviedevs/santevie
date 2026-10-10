import type { Dictionary } from "@/lib/i18n/dictionary";
import type { RouteStatus } from "@/lib/schemas/route";

// Badge variant and label for a route's derived status — shared by the Add
// Routes list, the Assign Routes table and Home so the same status always
// reads the same everywhere.
export const ROUTE_STATUS_VARIANT = {
  UNASSIGNED: "outline",
  ASSIGNED: "secondary",
  IN_PROGRESS: "default",
  MISSED: "destructive",
  COMPLETED: "default",
  CANCELLED: "outline",
} as const satisfies Record<RouteStatus, string>;

export function statusLabel(status: RouteStatus, dict: Dictionary["routesPage"]): string {
  switch (status) {
    case "UNASSIGNED":
      return dict.statusUnassigned;
    case "ASSIGNED":
      return dict.statusAssigned;
    case "IN_PROGRESS":
      return dict.statusInProgress;
    case "MISSED":
      return dict.statusMissed;
    case "COMPLETED":
      return dict.statusCompleted;
    case "CANCELLED":
      return dict.statusCancelled;
  }
}
