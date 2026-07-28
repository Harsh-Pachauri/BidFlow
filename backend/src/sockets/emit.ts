import { getIO } from "./io";
import type { AuctionStatus } from "../lib/auction-rules";

interface EmittedBid {
  id: number;
  supplierId: number;
  carrierName: string;
  freightCharge: number;
  originCharge: number;
  destinationCharge: number;
  totalAmount: number;
  transitTime: string;
  quoteValidityDays: number;
  submittedAt: Date;
  label: string;
}

export function emitBidPlaced(rfqId: number, bid: EmittedBid, rank: EmittedBid[]) {
  getIO().to(`rfq:${rfqId}`).emit("auction:bid_placed", { rfqId, bid, rank });
}

export function emitExtended(rfqId: number, bidCloseAt: Date, reason: string) {
  getIO().to(`rfq:${rfqId}`).emit("auction:extended", { rfqId, bidCloseAt, reason });
}

export function emitClosed(rfqId: number, status: "CLOSED" | "FORCE_CLOSED", closedAt: Date) {
  const payload = { rfqId, status, closedAt };
  getIO().to(`rfq:${rfqId}`).emit("auction:closed", payload);
  getIO().to("listing").emit("listing:updated", payload);
}

export function emitListingUpdated(
  rfqId: number,
  lowestBid: { carrierName: string; totalAmount: number } | null,
  bidCloseAt: Date,
  status: AuctionStatus,
) {
  getIO().to("listing").emit("listing:updated", { rfqId, lowestBid, bidCloseAt, status });
}
