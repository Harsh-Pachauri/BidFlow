import type { ActivityLogEntry } from "../types";
import { formatDateTime } from "../lib/format";
import { EmptyState } from "./ui/EmptyState";

const typeLabels: Record<ActivityLogEntry["type"], string> = {
  BID_SUBMITTED: "Bid",
  EXTENDED: "Extended",
  CLOSED: "Closed",
  FORCE_CLOSED: "Force Closed",
};

export function ActivityLog({ entries }: { entries: ActivityLogEntry[] }) {
  if (entries.length === 0) {
    return <EmptyState title="No activity yet" />;
  }

  return (
    <ol className="flex flex-col gap-3">
      {[...entries].reverse().map((entry) => (
        <li key={entry.id} className="flex gap-3 text-sm">
          <span className="mt-0.5 shrink-0 text-xs font-medium uppercase tracking-wide text-slate-400">
            {typeLabels[entry.type]}
          </span>
          <div>
            <p className="text-slate-700">{entry.reason}</p>
            <p className="text-xs text-slate-400">{formatDateTime(entry.createdAt)}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
