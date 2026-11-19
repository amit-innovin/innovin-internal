"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, type ComponentProps } from "react";

// Every screen has its own route again (Today no longer hosts other screens as panels), so these
// are plain links and replaces. Kept so the screens that use them don't need to change.
export function useWorkspaceHref() {
  return (href: string) => href;
}

export function useWorkspaceReplace() {
  const router = useRouter();
  return useCallback((path: string, options?: { scroll?: boolean }) => router.replace(path, options), [router]);
}

export function WorkspaceLink({ href, ...props }: Omit<ComponentProps<typeof Link>, "href"> & { href: string }) {
  return <Link href={href} {...props} />;
}
