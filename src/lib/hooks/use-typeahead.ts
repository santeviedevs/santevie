"use client";

import { useEffect, useState } from "react";

type TypeaheadState<T> = { data: T | null; status: "idle" | "loading" | "error" };

// Debounced GET type-ahead, same timer-in-an-effect shape as the filter bars
// (e.g. admin/centers/center-filters.tsx) rather than a data-fetching
// library. Every URL change aborts the previous request and discards its
// response, so a slow older answer can never overwrite a newer one. Pass
// `url: null` to stay idle (nothing to search yet).
export function useTypeahead<T>(url: string | null, delayMs: number): TypeaheadState<T> {
  const [state, setState] = useState<TypeaheadState<T>>({ data: null, status: "idle" });

  useEffect(() => {
    if (url === null) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setState((current) => ({ ...current, status: "loading" }));
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error(`Search failed (${response.status})`);
        const json = (await response.json()) as T;
        if (!controller.signal.aborted) setState({ data: json, status: "idle" });
      } catch {
        if (!controller.signal.aborted) setState((current) => ({ ...current, status: "error" }));
      }
    }, delayMs);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [url, delayMs]);

  return state;
}
