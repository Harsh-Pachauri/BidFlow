import type { Prisma } from "@prisma/client";

interface BidLike {
  id: number;
  supplierId: number;
  carrierName: string;
  freightCharge: Prisma.Decimal;
  originCharge: Prisma.Decimal;
  destinationCharge: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
  transitTime: string;
  quoteValidityDays: number;
  submittedAt: Date;
}

export function serializeBid(bid: BidLike) {
  return {
    id: bid.id,
    supplierId: bid.supplierId,
    carrierName: bid.carrierName,
    freightCharge: bid.freightCharge.toNumber(),
    originCharge: bid.originCharge.toNumber(),
    destinationCharge: bid.destinationCharge.toNumber(),
    totalAmount: bid.totalAmount.toNumber(),
    transitTime: bid.transitTime,
    quoteValidityDays: bid.quoteValidityDays,
    submittedAt: bid.submittedAt,
  };
}
