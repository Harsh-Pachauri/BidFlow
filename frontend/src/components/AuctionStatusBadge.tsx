import type { AuctionStatus } from "../types";
import { Badge } from "./ui/Badge";

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
