"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

type HospitalOption = { id: string; name: string; code: string };

type DoctorHospitalPickerProps = {
  options: HospitalOption[];
  value: string[];
  onChange: (hospitalIds: string[]) => void;
  disabled?: boolean;
  emptyLabel: string;
};

// Which Hospitals this Doctor is associated with (DoctorHospital) — a
// Doctor can have several, and this is the only place that association is
// edited; the server still re-validates the pair on every Visit (S2-02
// decision 13), this is UI convenience only.
export function DoctorHospitalPicker({
  options,
  value,
  onChange,
  disabled,
  emptyLabel,
}: DoctorHospitalPickerProps) {
  function toggle(hospitalId: string, checked: boolean) {
    onChange(checked ? [...value, hospitalId] : value.filter((id) => id !== hospitalId));
  }

  if (options.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <div className="flex max-h-48 flex-col gap-2 overflow-y-auto rounded-md border border-border p-3">
      {options.map((option) => {
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
      })}
    </div>
  );
}
