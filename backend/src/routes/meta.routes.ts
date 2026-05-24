import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import {
  RECRUIT_STAGES,
  CLIENT_STAGES,
  REFERRAL_STAGES,
  PRODUCT_TYPES,
  POLICY_STATUSES,
  REFERRAL_STATUSES,
  CROSSSELL_STATUSES,
  SEQUENCE_TRIGGERS,
  CHANNELS,
  ACTION_TYPES,
  LEAD_TYPES,
  LEAD_SEGMENTS,
  AGING_TIERS,
} from "../shared/pipeline";
import { AVAILABLE_TOKENS } from "../services/templating";

const router = Router();

// Reference data the frontend uses for dropdowns, pipelines, and the workflow builder.
router.get("/", requireAuth, (_req, res) => {
  res.json({
    leadTypes: LEAD_TYPES,
    leadSegments: LEAD_SEGMENTS,
    recruitStages: RECRUIT_STAGES,
    clientStages: CLIENT_STAGES,
    referralStages: REFERRAL_STAGES,
    productTypes: PRODUCT_TYPES,
    policyStatuses: POLICY_STATUSES,
    referralStatuses: REFERRAL_STATUSES,
    crossSellStatuses: CROSSSELL_STATUSES,
    sequenceTriggers: SEQUENCE_TRIGGERS,
    channels: CHANNELS,
    actionTypes: ACTION_TYPES,
    agingTiers: AGING_TIERS,
    templateTokens: AVAILABLE_TOKENS,
    premiumModes: ["MONTHLY", "QUARTERLY", "ANNUAL"],
    roles: ["OWNER", "MANAGER", "AGENT", "RECRUITER", "ASSISTANT", "SUPPORT", "TRAINER"],
  });
});

export default router;
