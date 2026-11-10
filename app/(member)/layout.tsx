import type { ReactNode } from "react";
import { requireUser } from "@/lib/admin";

// Every page in this group needs a signed-in employee (the proxy already sent cookie-less
// visitors to sign-in; this also catches expired or forged sessions).
export default async function MemberLayout({ children }: { children: ReactNode }) {
  await requireUser();
  return children;
}
