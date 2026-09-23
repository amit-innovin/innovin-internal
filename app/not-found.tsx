import Link from "next/link";
import { Compass } from "lucide-react";
import { IconTile } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md pt-10">
      <Card className="items-center gap-0 p-8 text-center">
        <IconTile icon={Compass} tone="blue" size="lg" />
        <p className="eyebrow mt-5">404</p>
        <h1 className="mt-2 text-2xl font-medium">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">That page doesn&apos;t exist or has moved.</p>
        <Button asChild size="xl" className="mt-6 w-full">
          <Link href="/">Back to home</Link>
        </Button>
      </Card>
    </div>
  );
}
