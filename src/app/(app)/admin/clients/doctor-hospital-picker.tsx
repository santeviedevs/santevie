"use client";

import { useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type HospitalOption = { id: string; name: string; code: string };

type DoctorHospitalPickerProps = {
  options: HospitalOption[];
  value: string[];
  onChange: (hospitalIds: string[]) => void;
  disabled?: boolean;
  emptyLabel: string;
  searchPlaceholder: string;
  noMatchesLabel: string;
};

// Which Hospitals this Doctor is associated with (DoctorHospital) — a
// Doctor can have several, and this is the only place that association is
// edited; the server still re-validates the pair on every Visit (S2-02
// decision 13), this is UI convenience only.
//
// The list is every active Hospital in the system (not scoped by
// territory — see the conversation this came from: scoping it would need
// an unstated business rule about how "close" a doctor's hospitals must
// be), so a search box is the interim way to keep it usable as the
// hospital count grows.
export function DoctorHospitalPicker({
  options,
  value,
  onChange,
  disabled,
  emptyLabel,
  searchPlaceholder,
  noMatchesLabel,
}: DoctorHospitalPickerProps) {
  const [query, setQuery] = useState("");

  function toggle(hospitalId: string, checked: boolean) {
    onChange(checked ? [...value, hospitalId] : value.filter((id) => id !== hospitalId));
  }

  if (options.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = normalizedQuery
    ? options.filter(
        (option) =>
          option.name.toLowerCase().includes(normalizedQuery) ||
          option.code.toLowerCase().includes(normalizedQuery),
      )
    : options;

  return (
    <div className="flex flex-col gap-2">
      <Input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={searchPlaceholder}
        disabled={disabled}
      />
      <div className="flex max-h-48 flex-col gap-2 overflow-y-auto rounded-md border border-border p-3">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">{noMatchesLabel}</p>
        ) : (
          filtered.map((option) => {
            const id = `hospital-${option.id}`;
            return (
              <div key={option.id} className="flex items-center gap-2">
                <Checkbox
                  id={id}
                  disabled={disabled}
                  checked={value.includes(option.id)}
                  onCheckedChange={(checked) => toggle(option.id, checked === true)}
                />
                <Label htmlFor={id} className="font-normal">
                  {option.name}
                </Label>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
