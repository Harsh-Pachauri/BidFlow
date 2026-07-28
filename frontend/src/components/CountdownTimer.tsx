import { useCountdown, formatDuration } from "../hooks/useCountdown";

interface CountdownTimerProps {
  targetIso: string;
  label: string;
}

export function CountdownTimer({ targetIso, label }: CountdownTimerProps) {
  const remainingMs = useCountdown(targetIso);
  const isUrgent = remainingMs > 0 && remainingMs < 5 * 60_000;

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-brand-700/70">{label}</p>
      <p className={`font-mono text-3xl font-bold tracking-tight ${isUrgent ? "text-red-600" : "text-slate-900"}`}>
        {remainingMs > 0 ? formatDuration(remainingMs) : "Closed"}
      </p>
    </div>
  );
}
