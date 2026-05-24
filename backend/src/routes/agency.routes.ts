import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { notFound } from "../lib/errors";
import { requireAuth, requireRole } from "../middleware/auth";
import { providerStatus } from "../services/messaging";

const router = Router();
router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const agency = await prisma.agency.findUnique({ where: { id: req.auth!.agencyId } });
    if (!agency) throw notFound("Agency not found");
    // Never expose secret credentials; only report whether each provider is configured.
    const { twilioAccountSid, twilioAuthToken, resendApiKey, ...safe } = agency;
    res.json({
      ...safe,
      providers: providerStatus(agency),
      hasTwilioCreds: Boolean(twilioAccountSid && twilioAuthToken),
      hasResendCreds: Boolean(resendApiKey),
    });
  })
);

const updateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  timezone: z.string().max(60).optional(),
  agedLeadDays: z.number().int().min(1).max(3650).optional(),
  emailFromAddress: z.string().email().optional().or(z.literal("")).transform((v) => (v ? v : null)).optional(),
  emailFromName: z.string().max(120).optional().nullable(),
  twilioFromNumber: z.string().max(40).optional().nullable(),
});

router.patch(
  "/",
  requireRole("OWNER", "MANAGER"),
  asyncHandler(async (req, res) => {
    const data = updateSchema.parse(req.body);
    const agency = await prisma.agency.update({ where: { id: req.auth!.agencyId }, data });
    const { twilioAccountSid, twilioAuthToken, resendApiKey, ...safe } = agency;
    res.json({ ...safe, providers: providerStatus(agency) });
  })
);

// Update messaging provider credentials (owner only). Empty string clears a credential.
const providerSchema = z.object({
  twilioAccountSid: z.string().optional().nullable(),
  twilioAuthToken: z.string().optional().nullable(),
  twilioFromNumber: z.string().optional().nullable(),
  resendApiKey: z.string().optional().nullable(),
  emailFromAddress: z.string().optional().nullable(),
  emailFromName: z.string().optional().nullable(),
});

router.patch(
  "/providers",
  requireRole("OWNER"),
  asyncHandler(async (req, res) => {
    const data = providerSchema.parse(req.body);
    const normalize = (v: string | null | undefined) =>
      v === undefined ? undefined : v === "" ? null : v;
    const agency = await prisma.agency.update({
      where: { id: req.auth!.agencyId },
      data: {
        twilioAccountSid: normalize(data.twilioAccountSid),
        twilioAuthToken: normalize(data.twilioAuthToken),
        twilioFromNumber: normalize(data.twilioFromNumber),
        resendApiKey: normalize(data.resendApiKey),
        emailFromAddress: normalize(data.emailFromAddress),
        emailFromName: normalize(data.emailFromName),
      },
    });
    res.json({ providers: providerStatus(agency) });
  })
);

export default router;
