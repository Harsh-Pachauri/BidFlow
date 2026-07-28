import { prisma } from "../lib/prisma";
import { computeStatus, computeRanking, latestPerSupplier, type AuctionStatus } from "../lib/auction-rules";
import { serializeBid } from "../lib/serializers";

// "Awarded" / "Won" are deliberately not stored anywhere -- there's no
// award action, no new column. An RFQ is awarded the instant it's
// Closed/Force Closed and has at least one bid: the L1 (lowest) bidder at
// that moment *is* the award, derived the same way status and ranking
// already are everywhere else in this app. See ARCHITECTURE_DECISIONS.md #20.
const CONCLUDED: AuctionStatus[] = ["CLOSED", "FORCE_CLOSED"];

interface RfqSummary {
  id: number;
  referenceId: string;
  status: AuctionStatus;
  bidCloseAt: Date;
  forcedCloseAt: Date;
  winner: { carrierName: string; totalAmount: number } | null;
}

export async function getBuyerDashboard(buyerId: number) {
  const rfqs = await prisma.rfq.findMany({
    where: { createdById: buyerId },
    include: { bids: true },
    orderBy: { createdAt: "desc" },
  });
  const now = new Date();

  const myRfqs: RfqSummary[] = rfqs.map((rfq) => {
    const status = computeStatus(rfq, now);
    const ranking = computeRanking(latestPerSupplier(rfq.bids.map(serializeBid)));
    const winner =
      CONCLUDED.includes(status) && ranking.length > 0
        ? { carrierName: ranking[0].carrierName, totalAmount: ranking[0].totalAmount }
        : null;

    return {
      id: rfq.id,
      referenceId: rfq.referenceId,
      status,
      bidCloseAt: rfq.bidCloseAt,
      forcedCloseAt: rfq.forcedCloseAt,
      winner,
    };
  });

  const awardedRfqs = myRfqs.filter((rfq) => rfq.winner !== null);

  return {
    role: "BUYER" as const,
    stats: {
      totalRfqs: myRfqs.length,
      activeRfqs: myRfqs.filter((rfq) => rfq.status === "ACTIVE" || rfq.status === "SCHEDULED").length,
      awardedRfqs: awardedRfqs.length,
    },
    myRfqs,
    awardedRfqs,
  };
}

export async function getSupplierDashboard(supplierId: number) {
  const biddedOn = await prisma.bid.findMany({
    where: { supplierId },
    select: { rfqId: true },
    distinct: ["rfqId"],
  });
  const rfqIds = biddedOn.map((b) => b.rfqId);

  const rfqs = await prisma.rfq.findMany({
    where: { id: { in: rfqIds } },
    include: { bids: true },
    orderBy: { createdAt: "desc" },
  });
  const now = new Date();

  const myQuotes = rfqs.map((rfq) => {
    const status = computeStatus(rfq, now);
    const ranking = computeRanking(latestPerSupplier(rfq.bids.map(serializeBid)));
    const mine = ranking.find((bid) => bid.supplierId === supplierId) ?? null;
    const won = CONCLUDED.includes(status) && mine?.label === "L1";

    return {
      id: rfq.id,
      referenceId: rfq.referenceId,
      status,
      bidCloseAt: rfq.bidCloseAt,
      forcedCloseAt: rfq.forcedCloseAt,
      myRank: mine?.label ?? null,
      myBidAmount: mine?.totalAmount ?? null,
      won,
    };
  });

  const wonQuotes = myQuotes.filter((quote) => quote.won);

  return {
    role: "SUPPLIER" as const,
    stats: {
      totalQuotes: myQuotes.length,
      activeQuotes: myQuotes.filter((quote) => quote.status === "ACTIVE").length,
      wonQuotes: wonQuotes.length,
    },
    myQuotes,
    wonQuotes,
  };
}
