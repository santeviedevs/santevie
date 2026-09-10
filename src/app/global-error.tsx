"use client";

import "./globals.css";

// Last-resort error boundary: only triggers when the root layout itself
// throws, so it must render its own <html>/<body> — every other error
// (including auth/permission errors) is caught by src/app/(app)/error.tsx.
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Please try again. If the problem continues, contact support.
        </p>
        <button
          type="button"
          onClick={reset}
          className="rounded-md border border-border px-4 py-2 text-sm"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
