import { Router } from "express";
import { authenticate } from "../middleware/authenticate";
import { getBuyerDashboard, getSupplierDashboard } from "../services/dashboard.service";

const router = Router();

router.get("/", authenticate, async (req, res) => {
  const dashboard =
    req.user!.role === "BUYER" ? await getBuyerDashboard(req.user!.id) : await getSupplierDashboard(req.user!.id);
  res.json(dashboard);
});

export default router;
