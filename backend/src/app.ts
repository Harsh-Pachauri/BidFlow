import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes";
import rfqRoutes from "./routes/rfq.routes";
import bidRoutes from "./routes/bid.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import { errorHandler } from "./middleware/errorHandler";

export function createApp() {
  const app = express();

  app.use(cors({ origin: process.env.CLIENT_URL }));
  app.use(express.json());

  app.use("/api/auth", authRoutes);
  app.use("/api/rfqs", rfqRoutes);
  app.use("/api/rfqs/:rfqId/bids", bidRoutes);
  app.use("/api/dashboard", dashboardRoutes);

  app.use(errorHandler);

  return app;
}
