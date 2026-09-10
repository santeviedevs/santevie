"use client";

import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

// App Router error boundary for every screen behind the shell. A thrown
// SessionExpiredError/ForbiddenError (see src/server/auth/require-permission.ts)
// lands here too, since pages call requirePermission without their own
// try/catch — route it to sign-in rather than showing a generic crash.
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const sessionExpired = error.name === "SessionExpiredError";
  const forbidden = error.name === "ForbiddenError";

  useEffect(() => {
    if (!sessionExpired && !forbidden) {
      console.error(error);
    }
  }, [error, sessionExpired, forbidden]);

  if (sessionExpired) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-lg font-semibold">Your session has expired</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Sign in again to continue where you left off.
        </p>
        <Button render={<Link href="/login" />}>Sign in</Button>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-lg font-semibold">You don&apos;t have access to this</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          If you think this is wrong, contact your administrator.
        </p>
        <Button variant="outline" render={<Link href="/" />}>
          Go home
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        The error has been reported. You can try again, or go back to the home screen.
      </p>
      <div className="flex gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" render={<Link href="/" />}>
          Go home
        </Button>
      </div>
    </div>
  );
}
