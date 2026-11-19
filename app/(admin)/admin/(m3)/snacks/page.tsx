import { redirect } from "next/navigation";

// The snack shelf moved into Office.
export default function Page() {
  redirect("/admin/office?tab=shelf");
}
