"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, type ComponentProps } from "react";
import { workspaceHref } from "@/lib/workspace-navigation";

const unchanged = (href: string) => href;

export function useWorkspaceHref() {
  return usePathname() === "/" ? workspaceHref : unchanged;
}

export function useWorkspaceReplace() {
  const router = useRouter();
  const href = useWorkspaceHref();
  return useCallback((path: string, options?: { scroll?: boolean }) => router.replace(href(path), options), [router, href]);
}

export function WorkspaceLink({ href, ...props }: Omit<ComponentProps<typeof Link>, "href"> & { href: string }) {
  return <Link href={useWorkspaceHref()(href)} {...props} />;
}
