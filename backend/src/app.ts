import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { env } from "./config/env";
import { notFoundHandler, errorHandler } from "./middleware/error";

import authRoutes from "./routes/auth.routes";
import agencyRoutes from "./routes/agency.routes";
import agentRoutes from "./routes/agents.routes";
import contactRoutes from "./routes/contacts.routes";
import policyRoutes from "./routes/policies.routes";
import referralRoutes from "./routes/referrals.routes";
import crossSellRoutes from "./routes/crosssell.routes";
import eventRoutes from "./routes/events.routes";
import taskRoutes from "./routes/tasks.routes";
import sequenceRoutes from "./routes/sequences.routes";
import messageRoutes from "./routes/messages.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import metaRoutes from "./routes/meta.routes";
import invitationRoutes from "./routes/invitations.routes";
import leadRoutes from "./routes/leads.routes";
import notificationRoutes from "./routes/notifications.routes";

export function createApp() {
  const app = express();

  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        // Allow non-browser clients (no origin) and any explicitly allowed origin.
        if (!origin || env.corsOrigins.includes(origin) || env.corsOrigins.includes("*")) {
          return callback(null, true);
        }
        return callback(new Error(`Origin ${origin} not allowed by CORS`));
      },
      credentials: false,
    })
  );
  app.use(express.json({ limit: "1mb" }));
  if (!env.isProd) app.use(morgan("dev"));

  app.get("/", (_req, res) => res.json({ name: "BlueRock RCM API", status: "ok" }));
  app.get("/health", (_req, res) => res.json({ status: "ok", time: new Date().toISOString() }));

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many attempts, please try again later" },
  });

  app.use("/api/auth", authLimiter, authRoutes);
  app.use("/api/agency", agencyRoutes);
  app.use("/api/agents", agentRoutes);
  app.use("/api/contacts", contactRoutes);
  app.use("/api/policies", policyRoutes);
  app.use("/api/referrals", referralRoutes);
  app.use("/api/cross-sells", crossSellRoutes);
  app.use("/api/events", eventRoutes);
  app.use("/api/tasks", taskRoutes);
  app.use("/api/sequences", sequenceRoutes);
  app.use("/api/messages", messageRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/meta", metaRoutes);
  app.use("/api/invitations", invitationRoutes);
  app.use("/api/leads", leadRoutes);
  app.use("/api/notifications", notificationRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
