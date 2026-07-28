import type { Rfq } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { computeStatus } from "../lib/auction-rules";
import { emitClosed } from "../sockets/emit";

const CLOSED_REASON = "Bid close time reached with no further qualifying activity — auction closed.";
const FORCE_CLOSED_REASON = "Auction reached its Forced Close Time — bidding closed permanently.";

// Guarded by "does a terminal event already exist," not a status flag, so a
// missed tick, an overlapping run, or a server restart mid-scan is all
// harmless -- see ARCHITECTURE_DECISIONS.md #10/#11.
async function closeRfqIfDue(rfqId: number): Promise<void> {
  const result = await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Rfq[]>`SELECT * FROM "Rfq" WHERE id = ${rfqId} FOR UPDATE`;
    const rfq = rows[0];
    if (!rfq) return null;

    const now = new Date();
    const status = computeStatus(rfq, now);
    if (status !== "CLOSED" && status !== "FORCE_CLOSED") return null;

    const alreadyClosed = await tx.auctionEvent.findFirst({
      where: { rfqId, type: { in: ["CLOSED", "FORCE_CLOSED"] } },
    });
    if (alreadyClosed) return null;

    await tx.auctionEvent.create({
      data: {
        rfqId,
        type: status,
        reason: status === "FORCE_CLOSED" ? FORCE_CLOSED_REASON : CLOSED_REASON,
        createdAt: now,
      },
    });

    return { status, closedAt: now };
  });

  if (result) {
    emitClosed(rfqId, result.status, result.closedAt);
  }
}

export function startAuctionTicker(intervalMs = 5000): NodeJS.Timeout {
  return setInterval(() => {
    void (async () => {
      const now = new Date();
      const dueRfqs = await prisma.rfq.findMany({
        where: {
          bidCloseAt: { lte: now },
          events: { none: { type: { in: ["CLOSED", "FORCE_CLOSED"] } } },
        },
        select: { id: true },
      });

      for (const { id } of dueRfqs) {
        try {
          await closeRfqIfDue(id);
        } catch (err) {
          console.error(`Ticker failed to close RFQ ${id}:`, err);
        }
      }
    })();
  }, intervalMs);
}
