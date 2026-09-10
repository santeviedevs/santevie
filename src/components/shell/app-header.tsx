import { UserMenu } from "./user-menu";

export function AppHeader({ name, roleName }: { name: string; roleName: string }) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-border px-4 md:px-6">
      <span className="font-heading text-sm font-semibold md:hidden">ALISONS</span>
      <div className="hidden md:block" />
      <UserMenu name={name} roleName={roleName} />
    </header>
  );
}
