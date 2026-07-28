import { describe, it, expect } from "vitest";
import {
  computeStatus,
  computeRanking,
  latestPerSupplier,
  rankChanged,
  evaluateExtension,
  computeTotalAmount,
  type RfqTiming,
  type ExtensionConfig,
  type RankedBid,
} from "../src/lib/auction-rules";

describe("latestPerSupplier", () => {
  it("keeps only each supplier's most recent bid", () => {
    const result = latestPerSupplier([
      { supplierId: 1, submittedAt: new Date("2026-01-01T10:00:00Z"), totalAmount: 500 },
      { supplierId: 1, submittedAt: new Date("2026-01-01T11:00:00Z"), totalAmount: 400 },
      { supplierId: 2, submittedAt: new Date("2026-01-01T10:30:00Z"), totalAmount: 450 },
    ]);
    expect(result).toHaveLength(2);
    expect(result.find((b) => b.supplierId === 1)?.totalAmount).toBe(400);
  });
});

function minutes(n: number): number {
  return n * 60_000;
}

describe("computeStatus", () => {
  const timing: RfqTiming = {
    bidStartAt: new Date("2026-01-01T10:00:00Z"),
    bidCloseAt: new Date("2026-01-01T12:00:00Z"),
    forcedCloseAt: new Date("2026-01-01T13:00:00Z"),
  };

  it("is SCHEDULED before bidStartAt", () => {
    expect(computeStatus(timing, new Date("2026-01-01T09:59:59Z"))).toBe("SCHEDULED");
  });

  it("is ACTIVE exactly at bidStartAt (boundary is inclusive of start)", () => {
    expect(computeStatus(timing, new Date("2026-01-01T10:00:00Z"))).toBe("ACTIVE");
  });

  it("is ACTIVE between start and close", () => {
    expect(computeStatus(timing, new Date("2026-01-01T11:00:00Z"))).toBe("ACTIVE");
  });

  it("is CLOSED exactly at bidCloseAt when below the forced ceiling (boundary excludes close)", () => {
    expect(computeStatus(timing, new Date("2026-01-01T12:00:00Z"))).toBe("CLOSED");
  });

  it("is FORCE_CLOSED when bidCloseAt has been pushed to equal forcedCloseAt", () => {
    const extended: RfqTiming = { ...timing, bidCloseAt: timing.forcedCloseAt };
    expect(computeStatus(extended, new Date("2026-01-01T13:00:00Z"))).toBe("FORCE_CLOSED");
  });
});

describe("computeRanking", () => {
  it("sorts ascending by totalAmount", () => {
    const ranked = computeRanking([
      { supplierId: 1, totalAmount: 500, submittedAt: new Date("2026-01-01T10:00:00Z") },
      { supplierId: 2, totalAmount: 300, submittedAt: new Date("2026-01-01T10:01:00Z") },
      { supplierId: 3, totalAmount: 400, submittedAt: new Date("2026-01-01T10:02:00Z") },
    ]);
    expect(ranked.map((b) => b.supplierId)).toEqual([2, 3, 1]);
    expect(ranked.map((b) => b.label)).toEqual(["L1", "L2", "L3"]);
  });

  it("breaks ties on totalAmount by earliest submission", () => {
    const ranked = computeRanking([
      { supplierId: 1, totalAmount: 300, submittedAt: new Date("2026-01-01T10:05:00Z") },
      { supplierId: 2, totalAmount: 300, submittedAt: new Date("2026-01-01T10:01:00Z") },
    ]);
    expect(ranked.map((b) => b.supplierId)).toEqual([2, 1]);
  });

  it("returns an empty array for no bids", () => {
    expect(computeRanking([])).toEqual([]);
  });
});

describe("rankChanged", () => {
  it("is false when a new entrant lands at the bottom, unseen positions aside", () => {
    const before: RankedBid[] = [
      { supplierId: 1, totalAmount: 300, submittedAt: new Date(), label: "L1" },
      { supplierId: 2, totalAmount: 400, submittedAt: new Date(), label: "L2" },
    ];
    const after: RankedBid[] = [
      { supplierId: 1, totalAmount: 300, submittedAt: new Date(), label: "L1" },
      { supplierId: 2, totalAmount: 400, submittedAt: new Date(), label: "L2" },
      { supplierId: 3, totalAmount: 900, submittedAt: new Date(), label: "L3" },
    ];
    expect(rankChanged(before, after)).toBe(false);
  });

  it("is true when a new entrant slots in above an existing bidder", () => {
    const before: RankedBid[] = [
      { supplierId: 1, totalAmount: 300, submittedAt: new Date(), label: "L1" },
      { supplierId: 2, totalAmount: 400, submittedAt: new Date(), label: "L2" },
    ];
    const after: RankedBid[] = [
      { supplierId: 3, totalAmount: 100, submittedAt: new Date(), label: "L1" },
      { supplierId: 1, totalAmount: 300, submittedAt: new Date(), label: "L2" },
      { supplierId: 2, totalAmount: 400, submittedAt: new Date(), label: "L3" },
    ];
    expect(rankChanged(before, after)).toBe(true);
  });

  it("is false when the same single supplier lowers their own bid and stays L1", () => {
    const before: RankedBid[] = [{ supplierId: 1, totalAmount: 500, submittedAt: new Date(), label: "L1" }];
    const after: RankedBid[] = [{ supplierId: 1, totalAmount: 400, submittedAt: new Date(), label: "L1" }];
    expect(rankChanged(before, after)).toBe(false);
  });
});

describe("evaluateExtension", () => {
  const baseConfig: ExtensionConfig = {
    bidCloseAt: new Date("2026-01-01T18:00:00Z"),
    forcedCloseAt: new Date("2026-01-01T19:00:00Z"),
    triggerWindowMin: 10,
    extensionMin: 5,
    triggerType: "ANY_BID",
  };

  const rankUnchanged: RankedBid[] = [{ supplierId: 1, totalAmount: 300, submittedAt: new Date(), label: "L1" }];

  it("does not extend when the bid is outside the trigger window", () => {
    const result = evaluateExtension(
      baseConfig,
      rankUnchanged,
      rankUnchanged,
      new Date("2026-01-01T17:49:00Z"),
    );
    expect(result).toBeNull();
  });

  it("ANY_BID extends on any bid inside the window, even with no rank change", () => {
    const result = evaluateExtension(
      baseConfig,
      rankUnchanged,
      rankUnchanged,
      new Date("2026-01-01T17:55:00Z"),
    );
    expect(result).not.toBeNull();
    expect(result?.newCloseTime.toISOString()).toBe("2026-01-01T18:05:00.000Z");
  });

  it("ANY_RANK_CHANGE does not extend when ranking is unchanged", () => {
    const config: ExtensionConfig = { ...baseConfig, triggerType: "ANY_RANK_CHANGE" };
    const result = evaluateExtension(config, rankUnchanged, rankUnchanged, new Date("2026-01-01T17:55:00Z"));
    expect(result).toBeNull();
  });

  it("ANY_RANK_CHANGE extends when ranking order differs", () => {
    const config: ExtensionConfig = { ...baseConfig, triggerType: "ANY_RANK_CHANGE" };
    const before: RankedBid[] = [
      { supplierId: 1, totalAmount: 300, submittedAt: new Date(), label: "L1" },
      { supplierId: 2, totalAmount: 400, submittedAt: new Date(), label: "L2" },
    ];
    const after: RankedBid[] = [
      { supplierId: 2, totalAmount: 200, submittedAt: new Date(), label: "L1" },
      { supplierId: 1, totalAmount: 300, submittedAt: new Date(), label: "L2" },
    ];
    const result = evaluateExtension(config, before, after, new Date("2026-01-01T17:55:00Z"));
    expect(result).not.toBeNull();
  });

  it("L1_CHANGE_ONLY ignores a lower-rank reshuffle that doesn't touch L1", () => {
    const config: ExtensionConfig = { ...baseConfig, triggerType: "L1_CHANGE_ONLY" };
    const before: RankedBid[] = [
      { supplierId: 1, totalAmount: 100, submittedAt: new Date(), label: "L1" },
      { supplierId: 2, totalAmount: 400, submittedAt: new Date(), label: "L2" },
      { supplierId: 3, totalAmount: 500, submittedAt: new Date(), label: "L3" },
    ];
    const after: RankedBid[] = [
      { supplierId: 1, totalAmount: 100, submittedAt: new Date(), label: "L1" },
      { supplierId: 3, totalAmount: 350, submittedAt: new Date(), label: "L2" },
      { supplierId: 2, totalAmount: 400, submittedAt: new Date(), label: "L3" },
    ];
    const result = evaluateExtension(config, before, after, new Date("2026-01-01T17:55:00Z"));
    expect(result).toBeNull();
  });

  it("clamps the extension to forcedCloseAt instead of exceeding it", () => {
    const config: ExtensionConfig = {
      ...baseConfig,
      bidCloseAt: new Date("2026-01-01T18:58:00Z"),
      extensionMin: 5,
    };
    const result = evaluateExtension(config, rankUnchanged, rankUnchanged, new Date("2026-01-01T18:55:00Z"));
    expect(result?.newCloseTime.toISOString()).toBe(config.forcedCloseAt.toISOString());
  });

  it("returns null once already sitting at the forced-close ceiling", () => {
    const config: ExtensionConfig = { ...baseConfig, bidCloseAt: baseConfig.forcedCloseAt };
    const result = evaluateExtension(config, rankUnchanged, rankUnchanged, new Date("2026-01-01T18:58:00Z"));
    expect(result).toBeNull();
  });
});

describe("computeTotalAmount", () => {
  it("sums the three charge components", () => {
    expect(computeTotalAmount(100.5, 20, 15.25)).toBeCloseTo(135.75);
  });
});
