"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Dictionary } from "@/lib/i18n/dictionary";

// Start and end date inputs for an assignment range (native date inputs —
// the app has no date-picker library). The end can never be set before the
// start, and neither can precede `minDate` (today in Africa/Kinshasa); the
// server enforces both again regardless. With `labelled`, each input gets its
// own visible label (Start date / End date) in a two-column grid that stacks
// on small screens; otherwise they sit inline under one "Date Range" legend.
export function DateRangeFields({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  minDate,
  disabled,
  labelled = false,
  dict,
}: {
  startDate: string;
  endDate: string;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  minDate: string;
  disabled: boolean;
  labelled?: boolean;
  dict: Dictionary["routesPage"];
}) {
  if (labelled) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="range-start">{dict.startDateLabel}</Label>
          <Input
            id="range-start"
            type="date"
            value={startDate}
            min={minDate}
            disabled={disabled}
            onChange={(event) => {
              onStartDateChange(event.target.value);
              if (endDate && event.target.value > endDate) onEndDateChange(event.target.value);
            }}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="range-end">{dict.endDateLabel}</Label>
          <Input
            id="range-end"
            type="date"
            value={endDate}
            min={startDate || minDate}
            disabled={disabled}
            onChange={(event) => onEndDateChange(event.target.value)}
          />
        </div>
      </div>
    );
  }

  return (
    <fieldset className="flex min-w-0 flex-col gap-1.5">
      <legend className="mb-1.5 text-sm font-medium">{dict.dateRangeLabel}</legend>
      <div className="flex items-center gap-2">
        <Input
          type="date"
          aria-label={dict.startDateLabel}
          value={startDate}
          min={minDate}
          disabled={disabled}
          onChange={(event) => {
            onStartDateChange(event.target.value);
            if (endDate && event.target.value > endDate) onEndDateChange(event.target.value);
          }}
          className="w-full md:w-40"
        />
        <span className="text-muted-foreground" aria-hidden>
          –
        </span>
        <Input
          type="date"
          aria-label={dict.endDateLabel}
          value={endDate}
          min={startDate || minDate}
          disabled={disabled}
          onChange={(event) => onEndDateChange(event.target.value)}
          className="w-full md:w-40"
        />
      </div>
    </fieldset>
  );
}
