export type AuctionStatus = "SCHEDULED" | "ACTIVE" | "CLOSED" | "FORCE_CLOSED";

export type TriggerType = "ANY_BID" | "ANY_RANK_CHANGE" | "L1_CHANGE_ONLY";

export interface RfqTiming {
  bidStartAt: Date;
  bidCloseAt: Date;
  forcedCloseAt: Date;
}

export function computeStatus(rfq: RfqTiming, now: Date): AuctionStatus {
  if (now < rfq.bidStartAt) return "SCHEDULED";
  if (now < rfq.bidCloseAt) return "ACTIVE";
  return rfq.bidCloseAt >= rfq.forcedCloseAt ? "FORCE_CLOSED" : "CLOSED";
}

export interface RankableBid {
  supplierId: number;
  totalAmount: number;
  submittedAt: Date;
}

export interface RankedBid extends RankableBid {
  label: string;
}

export function latestPerSupplier<T extends { supplierId: number; submittedAt: Date }>(bids: T[]): T[] {
  const latest = new Map<number, T>();
  for (const bid of bids) {
    const existing = latest.get(bid.supplierId);
    if (!existing || bid.submittedAt > existing.submittedAt) {
      latest.set(bid.supplierId, bid);
    }
  }
  return [...latest.values()];
}

export function computeRanking<T extends RankableBid>(bids: T[]): (T & { label: string })[] {
  return [...bids]
    .sort((a, b) => {
      if (a.totalAmount !== b.totalAmount) return a.totalAmount - b.totalAmount;
      return a.submittedAt.getTime() - b.submittedAt.getTime();
    })
    .map((bid, index) => ({ ...bid, label: `L${index + 1}` }));
}

export function rankChanged(before: RankableBid[], after: RankableBid[]): boolean {
  const n = Math.min(before.length, after.length);
  for (let i = 0; i < n; i++) {
    if (before[i].supplierId !== after[i].supplierId) return true;
  }
  return false;
}

export interface ExtensionConfig {
  bidCloseAt: Date;
  forcedCloseAt: Date;
  triggerWindowMin: number;
  extensionMin: number;
  triggerType: TriggerType;
}

export interface ExtensionResult {
  newCloseTime: Date;
  reason: string;
}

function buildExtensionReason(triggerType: TriggerType, newCloseTime: Date): string {
  const formatted = newCloseTime.toISOString();
  switch (triggerType) {
    case "ANY_BID":
      return `New bid received within the trigger window — extended to ${formatted}.`;
    case "ANY_RANK_CHANGE":
      return `Supplier ranking changed within the trigger window — extended to ${formatted}.`;
    case "L1_CHANGE_ONLY":
      return `New lowest bidder (L1) within the trigger window — extended to ${formatted}.`;
  }
}

export function evaluateExtension(
  rfq: ExtensionConfig,
  rankBefore: RankedBid[],
  rankAfter: RankedBid[],
  bidTimestamp: Date,
): ExtensionResult | null {
  const windowStart = new Date(rfq.bidCloseAt.getTime() - rfq.triggerWindowMin * 60_000);
  if (bidTimestamp < windowStart) return null;

  let triggered: boolean;
  switch (rfq.triggerType) {
    case "ANY_BID":
      triggered = true;
      break;
    case "ANY_RANK_CHANGE":
      triggered = rankChanged(rankBefore, rankAfter);
      break;
    case "L1_CHANGE_ONLY":
      triggered = rankBefore[0]?.supplierId !== rankAfter[0]?.supplierId;
      break;
  }

  if (!triggered) return null;

  const proposed = new Date(rfq.bidCloseAt.getTime() + rfq.extensionMin * 60_000);
  const newCloseTime = proposed < rfq.forcedCloseAt ? proposed : rfq.forcedCloseAt;
  if (newCloseTime.getTime() <= rfq.bidCloseAt.getTime()) return null;

  return { newCloseTime, reason: buildExtensionReason(rfq.triggerType, newCloseTime) };
}

export function computeTotalAmount(freightCharge: number, originCharge: number, destinationCharge: number): number {
  return freightCharge + originCharge + destinationCharge;
}
