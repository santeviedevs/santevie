"use client";

import { useState } from "react";

import { CreatableCombobox, type CreatableOption } from "@/components/creatable-combobox";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Dictionary } from "@/lib/i18n/dictionary";
import type { CenterOption, PersonCenterInput } from "@/lib/schemas/person";

import { createLookupOption } from "./create-lookup-option";

// The Person <-> Center association editor: pick a Center, pick the role the
// Person holds at *that* Center, add the row. A Center can only appear once
// (mirrors the database's unique(personId, clientId)); the server re-checks.
export function CenterAssociationEditor({
  centers,
  roles: initialRoles,
  value,
  onChange,
  dict,
  disabled,
}: {
  centers: CenterOption[];
  roles: CreatableOption[];
  value: PersonCenterInput[];
  onChange: (next: PersonCenterInput[]) => void;
  dict: Dictionary["persons"];
  disabled?: boolean;
}) {
  const [roles, setRoles] = useState(initialRoles);
  const [centerId, setCenterId] = useState<string | null>(null);
  const [roleId, setRoleId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const centerById = new Map(centers.map((c) => [c.id, c]));
  const roleName = (id: string) => roles.find((r) => r.id === id)?.label ?? "";
  const centerOptions: CreatableOption[] = centers.map((c) => ({
    id: c.id,
    label: `${c.name} (${c.code})`,
  }));

  function handleAdd() {
    if (!centerId || !roleId) {
      setError(dict.centerAndRoleRequired);
      return;
    }
    if (value.some((row) => row.clientId === centerId)) {
      setError(dict.centerAlreadyAdded);
      return;
    }
    setError(null);
    onChange([...value, { clientId: centerId, roleAtCenterId: roleId }]);
    setCenterId(null);
    setRoleId(null);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 rounded-md border border-border p-3 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <CreatableCombobox
            id="center-picker"
            placeholder={dict.selectCenter}
            options={centerOptions}
            value={centerId}
            onChange={(next) => {
              setCenterId(next);
              setError(null);
            }}
            noMatchesLabel={dict.noMatches}
            disabled={disabled}
          />
        </div>
        <div className="min-w-0 flex-1">
          <CreatableCombobox
            id="center-role-picker"
            placeholder={dict.selectOrAddRole}
            options={roles}
            value={roleId}
            onChange={(next) => {
              setRoleId(next);
              setError(null);
            }}
            onCreate={async (name) => {
              const created = await createLookupOption("centerRole", name);
              if (!created) return null;
              setRoles((prev) =>
                prev.some((r) => r.id === created.id)
                  ? prev
                  : [...prev, { id: created.id, label: created.label }],
              );
              return created;
            }}
            addLabel={dict.addNew}
            noMatchesLabel={dict.noMatches}
            disabled={disabled}
          />
        </div>
        <Button type="button" variant="outline" onClick={handleAdd} disabled={disabled}>
          {dict.add}
        </Button>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="rounded-md border border-border p-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{dict.center}</TableHead>
              <TableHead>{dict.centerType}</TableHead>
              <TableHead>{dict.roleAtCenter}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {value.map((row) => {
              const center = centerById.get(row.clientId);
              return (
                <TableRow key={row.clientId}>
                  <TableCell>{center ? `${center.name} (${center.code})` : row.clientId}</TableCell>
                  <TableCell>{center?.typeName ?? "—"}</TableCell>
                  <TableCell>{roleName(row.roleAtCenterId)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={disabled}
                      onClick={() => onChange(value.filter((r) => r.clientId !== row.clientId))}
                    >
                      {dict.remove}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {value.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  {dict.noCenters}
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
