// In-memory fixed-window limiter. Good enough for a single-instance dev/UAT
// deployment; a multi-instance production deployment needs a shared store
// (e.g. Redis) instead, since each instance keeps its own counters.
const attempts = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export function isRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || entry.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  entry.count += 1;
  return entry.count > MAX_ATTEMPTS;
}

export function resetRateLimit(key: string): void {
  attempts.delete(key);
}
