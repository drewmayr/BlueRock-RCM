import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import {
  RECRUIT_STAGES,
  CLIENT_STAGES,
  PRODUCT_TYPES,
  POLICY_STATUSES,
  REFERRAL_STATUSES,
  CROSSSELL_STATUSES,
  SEQUENCE_TRIGGERS,
  CHANNELS,
} from "../shared/pipeline";
import { AVAILABLE_TOKENS } from "../services/templating";

const router = Router();

// Reference data the frontend uses for dropdowns, pipelines, and the sequence editor.
router.get("/", requireAuth, (_req, res) => {
  res.json({
    recruitStages: RECRUIT_STAGES,
    clientStages: CLIENT_STAGES,
    productTypes: PRODUCT_TYPES,
    policyStatuses: POLICY_STATUSES,
    referralStatuses: REFERRAL_STATUSES,
    crossSellStatuses: CROSSSELL_STATUSES,
    sequenceTriggers: SEQUENCE_TRIGGERS,
    channels: CHANNELS,
    templateTokens: AVAILABLE_TOKENS,
    premiumModes: ["MONTHLY", "QUARTERLY", "ANNUAL"],
    roles: ["OWNER", "MANAGER", "AGENT", "RECRUITER", "ASSISTANT", "SUPPORT", "TRAINER"],
  });
});

export default router;
