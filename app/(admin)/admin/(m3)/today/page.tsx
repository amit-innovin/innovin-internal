import { redirect } from "next/navigation";

// The old admin "Today" screen is now the admin app's home.
export default function Page() {
  redirect("/admin");
}
