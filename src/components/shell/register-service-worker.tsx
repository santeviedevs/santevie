"use client";

import { useEffect } from "react";

// Registers the shell-only service worker (public/sw.js). Silently no-ops
// where unsupported (e.g. older browsers) — installability is a bonus, not
// a requirement.
export function RegisterServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Not fatal — the app works fully without an active service worker.
    });
  }, []);

  return null;
}
