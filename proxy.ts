import { NextResponse, type NextRequest } from "next/server";
import { USER_COOKIE } from "@/lib/auth";

// Pages need a signed-in employee, except sign-in itself and anonymous Speak Up. This is an
// optimistic cookie check only: the (member)/(admin) layouts verify the session and role, and
// every API route authenticates itself (APIs are excluded below so they answer with JSON).
const PUBLIC_PAGES = ["/sign-in", "/grievances"];
const PUBLIC_PREFIXES = ["/api/", "/_next/", "/brand/", "/icons/", "/assets/"];
const PUBLIC_FILES = ["/sw.js", "/manifest.webmanifest", "/icon.svg", "/favicon.ico"];

export function isPublicPath(pathname: string): boolean {
  return (
    PUBLIC_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ||
    PUBLIC_PREFIXES.some((p) => pathname.startsWith(p)) ||
    PUBLIC_FILES.includes(pathname)
  );
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();
  if (!request.cookies.get(USER_COOKIE)?.value) {
    const signIn = new URL("/sign-in", request.url);
    signIn.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(signIn);
  }
  // requireUser() reads this to send an expired session back to the same page after sign-in.
  const headers = new Headers(request.headers);
  headers.set("x-pathname", `${pathname}${search}`);
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: ["/((?!api/|_next/static|_next/image).*)"] };
