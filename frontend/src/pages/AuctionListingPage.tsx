import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import type { AuctionStatus, RfqListItem } from "../types";
import { AuctionStatusBadge } from "../components/AuctionStatusBadge";
import { Card } from "../components/ui/Card";
import { Table, THead, TBody, Tr, Th, Td } from "../components/ui/Table";
import { Spinner } from "../components/ui/Spinner";
import { EmptyState } from "../components/ui/EmptyState";
import { Button } from "../components/ui/Button";
import { formatDateTime, formatCurrency } from "../lib/format";
import { useToast } from "../components/ui/Toast";
import { useSocketEvent, useSocketRoom } from "../hooks/useSocket";

interface ListingUpdatedPayload {
  rfqId: number;
  lowestBid: RfqListItem["lowestBid"];
  bidCloseAt: string;
  status: AuctionStatus;
}

type StatusFilter = AuctionStatus | "ALL";

const STATUS_ORDER: AuctionStatus[] = ["ACTIVE", "SCHEDULED", "CLOSED", "FORCE_CLOSED"];
const STATUS_LABELS: Record<AuctionStatus, string> = {
  ACTIVE: "Active",
  SCHEDULED: "Scheduled",
  CLOSED: "Closed",
  FORCE_CLOSED: "Force Closed",
};

function StatCard({
  label,
  count,
  isActive,
  isHero,
  onClick,
}: {
  label: string;
  count: number;
  isActive: boolean;
  isHero?: boolean;
  onClick: () => void;
}) {
  const toneClasses = isHero
    ? isActive
      ? "border-brand-700 bg-brand-700"
      : "border-brand-600 bg-brand-600 hover:bg-brand-700"
    : isActive
      ? "border-brand-300 bg-brand-50"
      : "border-slate-200 bg-white hover:border-slate-300";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-4 py-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${toneClasses}`}
    >
      <p className={`text-2xl font-semibold ${isHero ? "text-white" : "text-slate-900"}`}>{count}</p>
      <p className={`text-xs font-medium ${isHero ? "text-brand-100" : "text-slate-500"}`}>{label}</p>
    </button>
  );
}

export function AuctionListingPage() {
  const navigate = useNavigate();
  const [rfqs, setRfqs] = useState<RfqListItem[] | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const { showToast } = useToast();

  useEffect(() => {
    let cancelled = false;
    api.get<RfqListItem[]>("/rfqs").then(
      (response) => {
        if (!cancelled) setRfqs(response.data);
      },
      () => {
        if (!cancelled) showToast("Failed to load auctions.", "error");
      },
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useSocketRoom("listing:join", "listing:leave");

  useSocketEvent<ListingUpdatedPayload>("listing:updated", (payload) => {
    setRfqs(
      (prev) =>
        prev?.map((rfq) =>
          rfq.id === payload.rfqId
            ? { ...rfq, lowestBid: payload.lowestBid, bidCloseAt: payload.bidCloseAt, status: payload.status }
            : rfq,
        ) ?? null,
    );
  });

  const counts = useMemo(() => {
    const result: Record<StatusFilter, number> = {
      ALL: rfqs?.length ?? 0,
      ACTIVE: 0,
      SCHEDULED: 0,
      CLOSED: 0,
      FORCE_CLOSED: 0,
    };
    for (const rfq of rfqs ?? []) result[rfq.status] += 1;
    return result;
  }, [rfqs]);

  const filteredRfqs = rfqs?.filter((rfq) => statusFilter === "ALL" || rfq.status === statusFilter) ?? null;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-slate-900">Auctions</h1>
        <p className="text-sm text-slate-500">Track every RFQ and its live bidding status.</p>
      </div>

      {rfqs === null ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
            <StatCard label="Total" count={counts.ALL} isActive={statusFilter === "ALL"} onClick={() => setStatusFilter("ALL")} />
            {STATUS_ORDER.map((status) => (
              <StatCard
                key={status}
                label={STATUS_LABELS[status]}
                count={counts[status]}
                isActive={statusFilter === status}
                isHero={status === "ACTIVE"}
                onClick={() => setStatusFilter(status)}
              />
            ))}
          </div>

          <Card>
            {rfqs.length === 0 ? (
              <EmptyState title="No RFQs yet" description="Create one to get started." />
            ) : filteredRfqs && filteredRfqs.length === 0 ? (
              <EmptyState
                title="No auctions match this filter"
                description="Try a different status, or clear the filter to see everything."
                action={
                  <Button variant="secondary" size="sm" onClick={() => setStatusFilter("ALL")}>
                    Clear filter
                  </Button>
                }
              />
            ) : (
              <Table>
                <THead>
                  <Tr>
                    <Th>Reference</Th>
                    <Th>Status</Th>
                    <Th>Current Lowest Bid</Th>
                    <Th>Bid Close</Th>
                    <Th>Forced Close</Th>
                  </Tr>
                </THead>
                <TBody>
                  {filteredRfqs?.map((rfq) => (
                    <Tr key={rfq.id} onClick={() => navigate(`/rfqs/${rfq.id}`)}>
                      <Td>
                        <Link to={`/rfqs/${rfq.id}`} className="font-semibold text-brand-700 hover:underline">
                          {rfq.referenceId}
                        </Link>
                      </Td>
                      <Td>
                        <AuctionStatusBadge status={rfq.status} />
                      </Td>
                      <Td>
                        {rfq.lowestBid ? (
                          <>
                            <span className="font-semibold text-slate-900">
                              {formatCurrency(rfq.lowestBid.totalAmount)}
                            </span>{" "}
                            <span className="text-slate-400">({rfq.lowestBid.carrierName})</span>
                          </>
                        ) : (
                          <span className="text-slate-400">No bids yet</span>
                        )}
                      </Td>
                      <Td muted>{formatDateTime(rfq.bidCloseAt)}</Td>
                      <Td muted>{formatDateTime(rfq.forcedCloseAt)}</Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
