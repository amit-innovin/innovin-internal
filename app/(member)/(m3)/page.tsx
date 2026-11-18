import { HomePage } from "@/components/home/home-page";
import { requireUser } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function Page() {
  const actor = await requireUser();
  return <HomePage firstName={(actor.name || actor.email.split("@")[0]).split(/\s+/)[0]} />;
}
