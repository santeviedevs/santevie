import { NextResponse } from "next/server";

import { auth } from "@/server/auth";

export default auth((req) => {
  if (req.auth) {
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
