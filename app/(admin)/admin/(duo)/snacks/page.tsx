import type { Metadata } from "next";
import { Suspense } from "react";
import { ShelfPage } from "@/components/admin/shelf-page";

export const metadata: Metadata = { title: "Snack shelf · Admin · Innovin" };

export default function Page() {
  return <Suspense><ShelfPage /></Suspense>;
}
