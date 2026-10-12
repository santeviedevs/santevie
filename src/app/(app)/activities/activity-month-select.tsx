"use client";

import { useRouter } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Same pattern as calendar/calendar-month-select.tsx, pointed at an
// activities calendar instead of /calendar — kept as its own small
// component rather than generalizing the original with a basePath prop,
// since the two screens' query params already happen to match (year/month)
// but have no other reason to stay coupled. `basePath` distinguishes the
// team-wide calendar (/activities/calendar) from the personal one nested
// under My Activities (/activities/my/calendar).
export function ActivityMonthSelect({
  year,
  month,
  language,
  basePath,
}: {
  year: number;
  month: number;
  language: string;
  basePath: string;
}) {
  const router = useRouter();

  const monthFormatter = new Intl.DateTimeFormat(language, { month: "long", timeZone: "UTC" });
  const months = Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1),
    label: monthFormatter.format(new Date(Date.UTC(2000, i, 1))),
  }));

  const currentYear = new Date().getUTCFullYear();
  const years = Array.from({ length: 6 }, (_, i) => currentYear - 2 + i);

  function go(nextYear: number, nextMonth: number) {
    router.push(`${basePath}?year=${nextYear}&month=${nextMonth}`);
  }

  return (
    <div className="flex items-center gap-2">
      <Select
        items={months}
        value={String(month)}
        onValueChange={(value) => value && go(year, Number(value))}
      >
        <SelectTrigger className="w-36 capitalize">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {months.map((m) => (
            <SelectItem key={m.value} value={m.value} className="capitalize">
              {m.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        items={years.map((y) => ({ value: String(y), label: String(y) }))}
        value={String(year)}
        onValueChange={(value) => value && go(Number(value), month)}
      >
        <SelectTrigger className="w-24">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {years.map((y) => (
            <SelectItem key={y} value={String(y)}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
