import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import type { AuctionStatus, RfqDetail, TriggerType } from "../types";
import { Card, CardHeader, CardBody } from "../components/ui/Card";
import { Spinner } from "../components/ui/Spinner";
import { AuctionStatusBadge } from "../components/AuctionStatusBadge";
import { CountdownTimer } from "../components/CountdownTimer";
import { RankTable } from "../components/RankTable";
import { ActivityLog } from "../components/ActivityLog";
import { BidForm } from "../components/BidForm";
import { formatCurrency, formatDate, formatDateTime } from "../lib/format";
import { useToast } from "../components/ui/Toast";
import { useSocketEvent, useSocketRoom } from "../hooks/useSocket";

const triggerTypeLabels: Record<TriggerType, string> = {
  ANY_BID: "Any new bid",
  ANY_RANK_CHANGE: "Any rank change",
  L1_CHANGE_ONLY: "L1 (lowest bidder) change only",
};

interface BidPlacedPayload {
  rfqId: number;
  bid: { supplierId: number; carrierName: string; totalAmount: number };
}
interface ExtendedPayload {
  rfqId: number;
  bidCloseAt: string;
}
interface ClosedPayload {
  rfqId: number;
  status: AuctionStatus;
}

export function AuctionDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const rfqId = Number(id);
  const { user } = useAuth();
  const { showToast } = useToast();
  const [rfq, setRfq] = useState<RfqDetail | null>(null);

  const load = useCallback(() => {
    api.get<RfqDetail>(`/rfqs/${id}`).then(
      (response) => setRfq(response.data),
      () => showToast("Failed to load auction.", "error"),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useSocketRoom("auction:join", "auction:leave", { rfqId });

  useSocketEvent<BidPlacedPayload>("auction:bid_placed", (payload) => {
    if (payload.rfqId !== rfqId) return;
    if (payload.bid.supplierId !== user?.id) {
      showToast(`New bid: ${formatCurrency(payload.bid.totalAmount)} from ${payload.bid.carrierName}`, "info");
    }
    load();
  });

  useSocketEvent<ExtendedPayload>("auction:extended", (payload) => {
    if (payload.rfqId !== rfqId) return;
    showToast(`Auction extended — new close time ${formatDateTime(payload.bidCloseAt)}`, "info");
    load();
  });

  useSocketEvent<ClosedPayload>("auction:closed", (payload) => {
    if (payload.rfqId !== rfqId) return;
    showToast(`Auction is now ${payload.status === "FORCE_CLOSED" ? "Force Closed" : "Closed"}`, "info");
    load();
  });

  if (!rfq) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  const canBid = user?.role === "SUPPLIER" && rfq.status === "ACTIVE";

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="flex flex-col gap-6 lg:col-span-2">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-slate-900">{rfq.referenceId}</h1>
            <AuctionStatusBadge status={rfq.status} />
          </div>
          <p className="text-sm text-slate-500">Pickup date: {formatDate(rfq.pickupDate)}</p>
        </div>

        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-slate-900">Bids</h2>
          </CardHeader>
          <CardBody>
            <RankTable bids={rfq.bids} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-slate-900">Activity Log</h2>
          </CardHeader>
          <CardBody>
            <ActivityLog entries={rfq.activityLog} />
          </CardBody>
        </Card>
      </div>

      <div className="flex flex-col gap-6">
        <Card className="border-brand-200 bg-gradient-to-b from-brand-50/70 to-white">
          <CardBody className="flex flex-col gap-4">
            {(rfq.status === "ACTIVE" || rfq.status === "SCHEDULED") && (
              <CountdownTimer
                targetIso={rfq.status === "SCHEDULED" ? rfq.bidStartAt : rfq.bidCloseAt}
                label={rfq.status === "SCHEDULED" ? "Starts in" : "Bid close in"}
                completedLabel={rfq.status === "SCHEDULED" ? "Starting…" : "Closed"}
                onComplete={rfq.status === "SCHEDULED" ? load : undefined}
              />
            )}
            <dl className="flex flex-col gap-1.5 text-xs">
              <div className="flex justify-between">
                <dt className="text-slate-500">Bid start</dt>
                <dd className="text-slate-600">{formatDateTime(rfq.bidStartAt)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Bid close</dt>
                <dd className="text-slate-600">{formatDateTime(rfq.bidCloseAt)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Forced close</dt>
                <dd className="text-slate-600">{formatDateTime(rfq.forcedCloseAt)}</dd>
              </div>
            </dl>
          </CardBody>
        </Card>

        {canBid && (
          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-slate-900">Submit a Bid</h2>
            </CardHeader>
            <CardBody>
              <BidForm rfqId={rfq.id} onSubmitted={load} />
            </CardBody>
          </Card>
        )}

        <Card muted>
          <CardBody>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Auction Configuration
            </h2>
            <dl className="flex flex-col gap-1.5 text-xs">
              <div className="flex justify-between">
                <dt className="text-slate-500">Trigger window</dt>
                <dd className="text-slate-600">{rfq.triggerWindowMin} min</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Extension</dt>
                <dd className="text-slate-600">{rfq.extensionMin} min</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="shrink-0 text-slate-500">Trigger type</dt>
                <dd className="text-right text-slate-600">{triggerTypeLabels[rfq.triggerType]}</dd>
              </div>
            </dl>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
