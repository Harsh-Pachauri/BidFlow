import { prisma } from "../lib/prisma";
import { computeStatus, computeRanking, latestPerSupplier, type TriggerType } from "../lib/auction-rules";
import { serializeBid } from "../lib/serializers";

export class DuplicateReferenceIdError extends Error {}

export interface CreateRfqInput {
  referenceId: string;
  pickupDate: Date;
  bidStartAt: Date;
  bidCloseAt: Date;
  forcedCloseAt: Date;
  triggerWindowMin: number;
  extensionMin: number;
  triggerType: TriggerType;
}

export async function createRfq(buyerId: number, input: CreateRfqInput) {
  try {
    return await prisma.rfq.create({
      data: { ...input, createdById: buyerId },
    });
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
      throw new DuplicateReferenceIdError();
    }
    throw err;
  }
}

export async function listRfqs() {
  const rfqs = await prisma.rfq.findMany({
    include: { bids: true },
    orderBy: { createdAt: "desc" },
  });
  const now = new Date();

  return rfqs.map((rfq) => {
    const ranking = computeRanking(latestPerSupplier(rfq.bids.map(serializeBid)));
    const lowestBid = ranking[0] ?? null;
    return {
      id: rfq.id,
      referenceId: rfq.referenceId,
      status: computeStatus(rfq, now),
      bidCloseAt: rfq.bidCloseAt,
      forcedCloseAt: rfq.forcedCloseAt,
      lowestBid: lowestBid ? { carrierName: lowestBid.carrierName, totalAmount: lowestBid.totalAmount } : null,
    };
  });
}

// "All supplier bids (sorted by price)" and "Supplier ranking" (§8) are read
// as one table -- each supplier's active bid, ranked -- not a separate full
// bid history alongside it. Full history (including superseded bids) is
// what the activity log is for; duplicating it here would show most of the
// same information twice. See INTERVIEW_NOTES.md #17.
export async function getRfqDetail(rfqId: number) {
  const rfq = await prisma.rfq.findUnique({
    where: { id: rfqId },
    include: {
      bids: true,
      events: { orderBy: { createdAt: "asc" }, include: { bid: true } },
    },
  });
  if (!rfq) return null;

  const now = new Date();
  const ranking = computeRanking(latestPerSupplier(rfq.bids.map(serializeBid)));

  return {
    id: rfq.id,
    referenceId: rfq.referenceId,
    status: computeStatus(rfq, now),
    pickupDate: rfq.pickupDate,
    bidStartAt: rfq.bidStartAt,
    bidCloseAt: rfq.bidCloseAt,
    forcedCloseAt: rfq.forcedCloseAt,
    triggerWindowMin: rfq.triggerWindowMin,
    extensionMin: rfq.extensionMin,
    triggerType: rfq.triggerType,
    bids: ranking,
    activityLog: rfq.events.map((event) => ({
      id: event.id,
      type: event.type,
      reason: event.reason,
      createdAt: event.createdAt,
      bid: event.bid
        ? { carrierName: event.bid.carrierName, totalAmount: event.bid.totalAmount.toNumber() }
        : null,
    })),
  };
}
