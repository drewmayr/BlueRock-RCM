import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { notFound } from "../lib/errors";
import { requireAuth } from "../middleware/auth";
import { logActivity } from "../lib/activity";
import { REFERRAL_STATUSES } from "../shared/pipeline";

const router = Router();
router.use(requireAuth);

const createSchema = z.object({
  referrerId: z.string().optional().nullable(),
  referredName: z.string().max(160).optional().nullable(),
  referredPhone: z.string().max(40).optional().nullable(),
  referredEmail: z.string().email().optional().or(z.literal("")).transform((v) => (v ? v : null)),
  status: z.enum(REFERRAL_STATUSES).optional(),
  rewardStatus: z.enum(["PENDING", "SENT", "NA"]).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

const updateSchema = createSchema.partial();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const agencyId = req.auth!.agencyId;
    const where: Prisma.ReferralWhereInput = { agencyId };
    if (req.query.status) where.status = req.query.status as string;
    const referrals = await prisma.referral.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        referrer: { select: { id: true, firstName: true, lastName: true } },
        referredContact: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    res.json(referrals);
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const agencyId = req.auth!.agencyId;
    const data = createSchema.parse(req.body);
    const referral = await prisma.referral.create({
      data: { ...(data as Prisma.ReferralUncheckedCreateInput), agencyId },
    });
    await logActivity({
      agencyId,
      userId: req.auth!.userId,
      contactId: data.referrerId ?? null,
      type: "REFERRAL_ADDED",
      description: `New referral: ${data.referredName ?? "unnamed"}`,
    });
    res.status(201).json(referral);
  })
);

router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const agencyId = req.auth!.agencyId;
    const existing = await prisma.referral.findFirst({ where: { id: req.params.id, agencyId } });
    if (!existing) throw notFound("Referral not found");
    const data = updateSchema.parse(req.body);
    const referral = await prisma.referral.update({
      where: { id: existing.id },
      data: data as Prisma.ReferralUpdateInput,
    });
    res.json(referral);
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const agencyId = req.auth!.agencyId;
    const existing = await prisma.referral.findFirst({ where: { id: req.params.id, agencyId } });
    if (!existing) throw notFound("Referral not found");
    await prisma.referral.delete({ where: { id: existing.id } });
    res.status(204).end();
  })
);

// Convert a referral into a client lead contact.
router.post(
  "/:id/convert",
  asyncHandler(async (req, res) => {
    const agencyId = req.auth!.agencyId;
    const referral = await prisma.referral.findFirst({ where: { id: req.params.id, agencyId } });
    if (!referral) throw notFound("Referral not found");

    const [firstName, ...rest] = (referral.referredName ?? "New Referral").trim().split(" ");
    const contact = await prisma.contact.create({
      data: {
        agencyId,
        type: "CLIENT",
        status: "LEAD",
        ownerId: req.auth!.userId,
        firstName: firstName || "New",
        lastName: rest.join(" ") || "Referral",
        phone: referral.referredPhone,
        email: referral.referredEmail,
        source: "Referral",
      },
    });

    const updated = await prisma.referral.update({
      where: { id: referral.id },
      data: { status: "CONVERTED", referredContactId: contact.id },
    });

    await logActivity({
      agencyId,
      userId: req.auth!.userId,
      contactId: contact.id,
      type: "REFERRAL_CONVERTED",
      description: `Converted referral into client lead ${contact.firstName} ${contact.lastName}`,
    });

    res.status(201).json({ referral: updated, contact });
  })
);

export default router;
