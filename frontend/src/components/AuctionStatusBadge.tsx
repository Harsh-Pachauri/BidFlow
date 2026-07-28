import type { AuctionStatus } from "../types";
import { Badge } from "./ui/Badge";

// Scheduled is a real, internal-only status (see ARCHITECTURE_DECISIONS.md #16) --
// this just renders whatever the backend computed. It never has to decide
// when Scheduled is "allowed" to show; that's already handled server-side.
const statusConfig: Record<AuctionStatus, { label: string; tone: "slate" | "green" | "amber" | "blue" }> = {
  SCHEDULED: { label: "Scheduled", tone: "blue" },
  ACTIVE: { label: "Active", tone: "green" },
  CLOSED: { label: "Closed", tone: "slate" },
  FORCE_CLOSED: { label: "Force Closed", tone: "amber" },
};

export function AuctionStatusBadge({ status }: { status: AuctionStatus }) {
  const config = statusConfig[status];
  return <Badge tone={config.tone}>{config.label}</Badge>;
}
