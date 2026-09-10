"use client";

import { Download, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

const DISMISSED_KEY = "alisons:install-prompt-dismissed";

// Chrome/Android fires `beforeinstallprompt` and lets a site show its own
// install button instead of relying on the browser's default UI. iOS
// Safari never fires this event — there is no programmatic prompt there,
// which is why the install guide (src/app/(app)/help/install) exists as
// the fallback for iPhone users.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallPrompt() {
  const [deferredEvent, setDeferredEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (localStorage.getItem(DISMISSED_KEY)) return;

    const handler = (event: Event) => {
      event.preventDefault();
      setDeferredEvent(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!deferredEvent) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "1");
    setDeferredEvent(null);
  };

  const install = async () => {
    await deferredEvent.prompt();
    await deferredEvent.userChoice;
    setDeferredEvent(null);
  };

  return (
    <div className="fixed inset-x-0 bottom-16 z-30 mx-auto flex w-full max-w-sm items-center justify-between gap-3 rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-lg md:bottom-4">
      <p className="text-sm">Install ALISONS for one-tap access.</p>
      <div className="flex shrink-0 items-center gap-1">
        <Button size="sm" onClick={install}>
          <Download className="size-4" />
          Install
        </Button>
        <Button size="icon-sm" variant="ghost" onClick={dismiss} aria-label="Dismiss">
          <X className="size-4" />
        </Button>
      </div>
    </div>
  );
}
