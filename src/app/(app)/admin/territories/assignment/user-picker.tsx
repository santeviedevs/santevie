"use client";

import { usePathname, useRouter } from "next/navigation";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type UserOption = { id: string; name: string; employeeCode: string };

// Drives the ?userId= query param — picking a different user re-runs the
// Server Component with that user's assignments, same pattern as the
// filter bars elsewhere in the admin screens.
export function UserPicker({
  users,
  selectedUserId,
  label,
  placeholder,
}: {
  users: UserOption[];
  selectedUserId: string | null;
  label: string;
  placeholder: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor="userId" className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Select
        items={users.map((user) => ({
          value: user.id,
          label: `${user.name} (${user.employeeCode})`,
        }))}
        value={selectedUserId ?? ""}
        onValueChange={(value) => router.push(value ? `${pathname}?userId=${value}` : pathname)}
      >
        <SelectTrigger id="userId" className="w-72">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {users.map((user) => (
            <SelectItem key={user.id} value={user.id}>
              {user.name} ({user.employeeCode})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
