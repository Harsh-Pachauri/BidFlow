import type { RankedBid } from "../types";
import { Table, THead, TBody, Tr, Th, Td } from "./ui/Table";
import { Badge } from "./ui/Badge";
import { EmptyState } from "./ui/EmptyState";
import { formatCurrency, formatDateTime } from "../lib/format";

export function RankTable({ bids }: { bids: RankedBid[] }) {
  if (bids.length === 0) {
    return <EmptyState title="No bids yet" description="Bids will appear here as suppliers submit them." />;
  }

  return (
    <Table>
      <THead>
        <Tr>
          <Th>Rank</Th>
          <Th>Carrier</Th>
          <Th>Total</Th>
          <Th>Transit Time</Th>
          <Th>Quote Validity</Th>
          <Th>Submitted</Th>
        </Tr>
      </THead>
      <TBody>
        {bids.map((bid) => (
          <Tr key={bid.id} className={bid.label === "L1" ? "bg-green-50/60" : ""}>
            <Td>
              <Badge tone={bid.label === "L1" ? "green" : "slate"}>{bid.label}</Badge>
            </Td>
            <Td className="font-medium text-slate-900">{bid.carrierName}</Td>
            <Td>{formatCurrency(bid.totalAmount)}</Td>
            <Td>{bid.transitTime}</Td>
            <Td>{bid.quoteValidityDays} days</Td>
            <Td className="text-slate-500">{formatDateTime(bid.submittedAt)}</Td>
          </Tr>
        ))}
      </TBody>
    </Table>
  );
}
