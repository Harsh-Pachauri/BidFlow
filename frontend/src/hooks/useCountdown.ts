import { useEffect, useState } from "react";

// Client and server share a clock in local dev, so this deliberately skips
// server-time-offset correction -- not a scenario that can happen here. See
// ARCHITECTURE_DECISIONS.md for the trade-off if this ever ran across hosts.
export function useCountdown(targetIso: string): number {
  const [remainingMs, setRemainingMs] = useState(() => new Date(targetIso).getTime() - Date.now());

  useEffect(() => {
    const targetMs = new Date(targetIso).getTime();
    const tick = () => setRemainingMs(targetMs - Date.now());

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [targetIso]);

  return Math.max(0, remainingMs);
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => String(n).padStart(2, "0");
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  return `${minutes}:${pad(seconds)}`;
}
