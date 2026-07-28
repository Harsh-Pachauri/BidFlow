import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { submitBid, RfqNotFoundError, AuctionNotActiveError, BidNotLowerError } from "../services/bid.service";

const router = Router({ mergeParams: true });

const submitBidSchema = z.object({
  carrierName: z.string().min(1),
  freightCharge: z.number().nonnegative(),
  originCharge: z.number().nonnegative(),
  destinationCharge: z.number().nonnegative(),
  transitTime: z.string().min(1),
  quoteValidityDays: z.number().int().positive(),
});

router.post("/", authenticate, authorize("SUPPLIER"), async (req, res) => {
  const rfqId = Number(req.params.rfqId);
  if (!Number.isInteger(rfqId)) {
    res.status(400).json({ error: "Invalid RFQ id" });
    return;
  }

  const parsed = submitBidSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
    return;
  }

  try {
    const result = await submitBid(rfqId, req.user!.id, parsed.data);
    res.status(201).json(result);
  } catch (err) {
    if (err instanceof RfqNotFoundError) {
      res.status(404).json({ error: "RFQ not found" });
      return;
    }
    if (err instanceof AuctionNotActiveError) {
      res.status(409).json({ error: "This auction is not open for bidding" });
      return;
    }
    if (err instanceof BidNotLowerError) {
      res.status(422).json({ error: "Your bid must be lower than your own previous bid on this RFQ" });
      return;
    }
    throw err;
  }
});

export default router;
