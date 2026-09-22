"use client";

import Link from "next/link";
import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { IconTile } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md pt-10">
      <Card className="items-center gap-0 p-8 text-center">
        <IconTile icon={TriangleAlert} tone="amber" size="lg" />
        <h1 className="mt-5 text-2xl font-medium">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We couldn&apos;t load this page. Please try again in a moment.
          {error.digest && <span className="mt-1 block text-xs">Reference: {error.digest}</span>}
        </p>
        <div className="mt-6 grid w-full gap-2">
          <Button size="xl" onClick={reset}>
            Try again
          </Button>
          <Button asChild variant="ghost" size="xl">
            <Link href="/">Back to home</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
