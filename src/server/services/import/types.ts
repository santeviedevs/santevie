// Called after each unit of work so the route handler can stream a live
// percentage to the client — the row-by-row resolve/write loop is the only
// place that knows how far through a (possibly slow) large file it is.
export type ImportProgress = (done: number, total: number) => void;

// One row's classification from the dry-run pass — "reject" never carries
// resolved data, since a row that failed validation has nothing safe to
// commit. `data` for create/update is already resolved: every code/name
// foreign key has been turned into the id the underlying create/update
// service call actually needs.
export type ImportRowOutcome<T> =
  | { row: number; action: "create"; data: T }
  | { row: number; action: "update"; id: string; data: T }
  | { row: number; action: "reject"; errors: string[] };

export type ImportSummary = {
  totalRows: number;
  createdCount: number;
  updatedCount: number;
  rejectedCount: number;
  errors: { row: number; errors: string[] }[];
};

export function summarize(
  totalRows: number,
  outcomes: ImportRowOutcome<unknown>[],
  committed: { created: number; updated: number },
): ImportSummary {
  const errors = outcomes
    .filter((outcome) => outcome.action === "reject")
    .map((outcome) => ({ row: outcome.row, errors: outcome.errors }));
  return {
    totalRows,
    createdCount: committed.created,
    updatedCount: committed.updated,
    rejectedCount: errors.length,
    errors,
  };
}
