import { HomeWorkspace } from "@/components/home/workspace";
import { requireUser } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function Page() {
  const actor = await requireUser();
  const name = actor.name || actor.email.split("@")[0];
  return <HomeWorkspace name={name} firstName={name.split(/\s+/)[0]} isAdmin={actor.role === "admin"} />;
}
