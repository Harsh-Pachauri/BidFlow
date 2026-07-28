import type { Rfq } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { computeStatus, computeRanking, latestPerSupplier, evaluateExtension, computeTotalAmount } from "../lib/auction-rules";
import { serializeBid } from "../lib/serializers";
import { emitBidPlaced, emitExtended, emitListingUpdated } from "../sockets/emit";

export class RfqNotFoundError extends Error {}
export class AuctionNotActiveError extends Error {}
export class BidNotLowerError extends Error {}

export interface SubmitBidInput {
  carrierName: string;
  freightCharge: number;
  originCharge: number;
  destinationCharge: number;
  transitTime: string;
  quoteValidityDays: number;
}

// The one deliberate exception to "Prisma everywhere": SELECT ... FOR UPDATE
// has no first-class Prisma equivalent, so this transaction drops to a raw
// query for the lock, then plain Prisma calls for everything else inside
// the same transaction.
export async function submitBid(rfqId: number, supplierId: number, input: SubmitBidInput) {
  const result = await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Rfq[]>`SELECT * FROM "Rfq" WHERE id = ${rfqId} FOR UPDATE`;
    const rfq = rows[0];
    if (!rfq) throw new RfqNotFoundError();

    const now = new Date();
    if (computeStatus(rfq, now) !== "ACTIVE") {
      throw new AuctionNotActiveError();
    }

    const totalAmount = computeTotalAmount(input.freightCharge, input.originCharge, input.destinationCharge);

    const previousBid = await tx.bid.findFirst({
      where: { rfqId, supplierId },
      orderBy: { submittedAt: "desc" },
    });
    if (previousBid && totalAmount >= previousBid.totalAmount.toNumber()) {
      throw new BidNotLowerError();
    }

    const existingBids = await tx.bid.findMany({ where: { rfqId } });
    const rankBefore = computeRanking(latestPerSupplier(existingBids.map(serializeBid)));

    const newBid = await tx.bid.create({
      data: {
        rfqId,
        supplierId,
        carrierName: input.carrierName,
        freightCharge: input.freightCharge,
        originCharge: input.originCharge,
        destinationCharge: input.destinationCharge,
        totalAmount,
        transitTime: input.transitTime,
        quoteValidityDays: input.quoteValidityDays,
        submittedAt: now,
      },
    });

    await tx.auctionEvent.create({
      data: {
        rfqId,
        type: "BID_SUBMITTED",
        bidId: newBid.id,
        reason: `${input.carrierName} submitted a bid of ${totalAmount}.`,
        createdAt: now,
      },
    });

    const rankAfter = computeRanking(
      latestPerSupplier([...existingBids.map(serializeBid), serializeBid(newBid)]),
    );

    const extension = evaluateExtension(rfq, rankBefore, rankAfter, now);

    let finalBidCloseAt = rfq.bidCloseAt;
    if (extension) {
      await tx.rfq.update({ where: { id: rfqId }, data: { bidCloseAt: extension.newCloseTime } });
      await tx.auctionEvent.create({
        data: { rfqId, type: "EXTENDED", bidId: newBid.id, reason: extension.reason, createdAt: now },
      });
      finalBidCloseAt = extension.newCloseTime;
    }

    return {
      bid: serializeBid(newBid),
      rank: rankAfter,
      bidCloseAt: finalBidCloseAt,
      extended: Boolean(extension),
      extensionReason: extension?.reason ?? null,
      bidStartAt: rfq.bidStartAt,
      forcedCloseAt: rfq.forcedCloseAt,
    };
  });

  // Emitted after commit, not inside the transaction -- broadcasting before
  // the write is durable would tell clients about a bid that could still
  // roll back.
  emitBidPlaced(
    rfqId,
    { ...result.bid, label: result.rank.find((r) => r.id === result.bid.id)?.label ?? "" },
    result.rank,
  );
  if (result.extended && result.extensionReason) {
    emitExtended(rfqId, result.bidCloseAt, result.extensionReason);
  }
  const status = computeStatus(
    { bidStartAt: result.bidStartAt, bidCloseAt: result.bidCloseAt, forcedCloseAt: result.forcedCloseAt },
    new Date(),
  );
  const lowestBid = result.rank[0] ?? null;
  emitListingUpdated(
    rfqId,
    lowestBid ? { carrierName: lowestBid.carrierName, totalAmount: lowestBid.totalAmount } : null,
    result.bidCloseAt,
    status,
  );

  return result;
}
