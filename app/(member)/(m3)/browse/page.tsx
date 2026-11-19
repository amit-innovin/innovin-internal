import { BrowsePage } from "@/components/browse/browse-page";
import { requireUser } from "@/lib/admin";
import { openReports } from "@/lib/admin-queue";

export const dynamic = "force-dynamic";

export default async function Page() {
  const actor = await requireUser();
  const isAdmin = actor.role === "admin";
  return <BrowsePage isAdmin={isAdmin} openReports={isAdmin ? await openReports() : 0} />;
}
