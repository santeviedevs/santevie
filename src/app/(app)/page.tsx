import { redirect } from "next/navigation";

// Temporary: there's no dashboard yet (that's Sprint 5's management
// dashboard), so send signed-in users straight to admin/users for now.
export default function Home(): never {
  redirect("/admin/users");
}
