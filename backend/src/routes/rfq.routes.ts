import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { createRfq, listRfqs, getRfqDetail, DuplicateReferenceIdError, type CreateRfqInput } from "../services/rfq.service";

const router = Router();

const createRfqSchema = z
  .object({
    referenceId: z.string().min(1),
    pickupDate: z.coerce.date(),
    bidStartAt: z.coerce.date(),
    bidCloseAt: z.coerce.date(),
    forcedCloseAt: z.coerce.date(),
    triggerWindowMin: z.number().int().positive(),
    extensionMin: z.number().int().positive(),
    triggerType: z.enum(["ANY_BID", "ANY_RANK_CHANGE", "L1_CHANGE_ONLY"]),
  })
  .superRefine((data, ctx) => {
    if (data.bidStartAt.getTime() >= data.bidCloseAt.getTime()) {
      ctx.addIssue({ code: "custom", path: ["bidCloseAt"], message: "bidCloseAt must be after bidStartAt" });
    }
    if (data.bidCloseAt.getTime() >= data.forcedCloseAt.getTime()) {
      ctx.addIssue({ code: "custom", path: ["forcedCloseAt"], message: "forcedCloseAt must be strictly after bidCloseAt" });
    }
    const durationMin = (data.bidCloseAt.getTime() - data.bidStartAt.getTime()) / 60_000;
    if (data.triggerWindowMin > durationMin) {
      ctx.addIssue({
        code: "custom",
        path: ["triggerWindowMin"],
        message: "triggerWindowMin cannot exceed the auction's initial duration",
      });
    }
  });

router.get("/", authenticate, async (_req, res) => {
  const rfqs = await listRfqs();
  res.json(rfqs);
});

router.get("/:id", authenticate, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid RFQ id" });
    return;
  }

  const rfq = await getRfqDetail(id);
  if (!rfq) {
    res.status(404).json({ error: "RFQ not found" });
    return;
  }
  res.json(rfq);
});

router.post("/", authenticate, authorize("BUYER"), async (req, res) => {
  const parsed = createRfqSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
    return;
  }

  try {
    const rfq = await createRfq(req.user!.id, parsed.data as CreateRfqInput);
    res.status(201).json(rfq);
  } catch (err) {
    if (err instanceof DuplicateReferenceIdError) {
      res.status(409).json({ error: "An RFQ with this reference ID already exists" });
      return;
    }
    throw err;
  }
});

export default router;
