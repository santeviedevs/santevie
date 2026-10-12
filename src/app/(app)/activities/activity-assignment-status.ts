import type { Dictionary } from "@/lib/i18n/dictionary";

// Badge variant and label for an assignment's status — shared by the
// Activity List, the Assignment table and the two detail pages, so the same
// status always reads the same everywhere.
const ASSIGNMENT_STATUS_VARIANT = {
  PLANNED: "outline",
  DONE: "default",
  CANCELLED: "destructive",
} as const;

export function assignmentStatusVariant(status: string): "outline" | "default" | "destructive" {
  return status in ASSIGNMENT_STATUS_VARIANT
    ? ASSIGNMENT_STATUS_VARIANT[status as keyof typeof ASSIGNMENT_STATUS_VARIANT]
    : "outline";
}

export function assignmentStatusLabel(status: string, dict: Dictionary["activitiesPage"]): string {
  switch (status) {
    case "PLANNED":
      return dict.statusPlanned;
    case "DONE":
      return dict.statusDone;
    default:
      return dict.statusCancelled;
  }
}
