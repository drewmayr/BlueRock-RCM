import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { notFound, badRequest } from "../lib/errors";
import { requireAuth } from "../middleware/auth";
import { logActivity } from "../lib/activity";
import { triggerSequencesForContact } from "../services/automation";
import { PRODUCT_TYPES, POLICY_STATUSES } from "../shared/pipeline";

const router = Router();
router.use(requireAuth);

const optionalDate = z.preprocess((v) => (v === "" ? null : v), z.coerce.date().nullable().optional());
const optionalNum = z.preprocess((v) => (v === "" || v === null ? null : v), z.coerce.number().nonnegative().nullable().optional());

const createSchema = z.object({
  contactId: z.string().min(1),
  policyNumber: z.string().max(80).optional().nullable(),
  carrier: z.string().max(120).optional().nullable(),
  productType: z.enum(PRODUCT_TYPES),
  faceAmount: optionalNum,
  premium: optionalNum,
  premiumMode: z.enum(["MONTHLY", "QUARTERLY", "ANNUAL"]).optional().nullable(),
  status: z.enum(POLICY_STATUSES).optional(),
  effectiveDate: optionalDate,
  renewalDate: optionalDate,
  notes: z.string().max(2000).optional().nullable(),
});

const updateSchema = createSchema.partial().omit({ contactId: true });

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const agencyId = req.auth!.agencyId;
    const where: Prisma.PolicyWhereInput = { agencyId };
    if (req.query.contactId) where.contactId = req.query.contactId as string;
    if (req.query.status) where.status = req.query.status as string;
    const policies = await prisma.policy.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { contact: { select: { id: true, firstName: true, lastName: true } } },
    });
    res.json(policies);
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const agencyId = req.auth!.agencyId;
    const data = createSchema.parse(req.body);
    const contact = await prisma.contact.findFirst({ where: { id: data.contactId, agencyId } });
    if (!contact) throw badRequest("Contact not found in your agency");

    const policy = await prisma.policy.create({
      data: { ...(data as Prisma.PolicyUncheckedCreateInput), agencyId },
    });

    await logActivity({
      agencyId,
      userId: req.auth!.userId,
      contactId: contact.id,
      type: "POLICY_ADDED",
      description: `Added ${data.productType.replace(/_/g, " ").toLowerCase()} policy${data.carrier ? ` with ${data.carrier}` : ""}`,
    });

    // A newly sold (active) policy fires onboarding / POLICY_SOLD automations.
    if ((data.status ?? "ACTIVE") === "ACTIVE") {
      await triggerSequencesForContact(contact.id, "POLICY_SOLD");
    }

    res.status(201).json(policy);
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const policy = await prisma.policy.findFirst({
      where: { id: req.params.id, agencyId: req.auth!.agencyId },
      include: { contact: true },
    });
    if (!policy) throw notFound("Policy not found");
    res.json(policy);
  })
);

router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const agencyId = req.auth!.agencyId;
    const existing = await prisma.policy.findFirst({ where: { id: req.params.id, agencyId } });
    if (!existing) throw notFound("Policy not found");
    const data = updateSchema.parse(req.body);
    const policy = await prisma.policy.update({
      where: { id: existing.id },
      data: data as Prisma.PolicyUpdateInput,
    });
    res.json(policy);
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const agencyId = req.auth!.agencyId;
    const existing = await prisma.policy.findFirst({ where: { id: req.params.id, agencyId } });
    if (!existing) throw notFound("Policy not found");
    await prisma.policy.delete({ where: { id: existing.id } });
    res.status(204).end();
  })
);

export default router;
