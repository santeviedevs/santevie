import { redirect } from "next/navigation";

// Temporary: there's no real home screen yet (that's S1-08's application
// shell), so send signed-in users straight to admin/users for now. Remove
// this once S1-08 lands.
export default function Home(): never {
  redirect("/admin/users");
}
