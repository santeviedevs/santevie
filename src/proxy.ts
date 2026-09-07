import { NextResponse } from "next/server";

import { auth } from "@/server/auth";

export default auth((req) => {
  if (req.auth) {
    return NextResponse.next();
  }

  // A Server Action call is a fetch(), not a page navigation — Next.js
  // marks it with this header. It expects a specific response shape back,
  // and a redirect breaks that contract client-side (visible as a crash,
  // not a graceful "please sign in"). Let it through unauthenticated and
  // leave the session check to the action itself (requirePermission),
  // which already returns a clean "session expired" signal instead of
  // crashing.
  if (req.headers.get("next-action")) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", req.nextUrl.origin);
  loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(loginUrl);
});

export const config = {
  // Everything except the login page, the Auth.js routes and static assets
  // requires a session. Business pages built in later stories fall under
  // this by default rather than needing to opt in individually.
  matcher: ["/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)"],
};
