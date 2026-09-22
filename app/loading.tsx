import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Shown while server-rendered pages (home, admin) fetch their data.
export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="mt-2 h-4 w-80" />
      <div className="mt-6 grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Card key={i} className="gap-3 p-5">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </Card>
        ))}
      </div>
    </div>
  );
}
