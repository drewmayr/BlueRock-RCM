import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { notFound, badRequest } from "../lib/errors";
import { requireAuth, requireRole } from "../middleware/auth";
import { CROSSSELL_STATUSES, PRODUCT_TYPES } from "../shared/pipeline";
import { detectCrossSells } from "../services/automation";

const router = Router();
router.use(requireAuth);

const optionalNum = z.preprocess((v) => (v === "" || v === null ? null : v), z.coerce.number().nonnegative().nullable().optional());

const createSchema = z.object({
  contactId: z.string().min(1),
  productType: z.enum(PRODUCT_TYPES),
  reason: z.string().max(500).optional().nullable(),
  status: z.enum(CROSSSELL_STATUSES).optional(),
  estimatedValue: optionalNum,
});

const updateSchema = createSchema.partial().omit({ contactId: true });

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const agencyId = req.auth!.agencyId;
    const where: Prisma.CrossSellWhereInput = { agencyId };
    if (req.query.status) where.status = req.query.status as string;
    if (req.query.contactId) where.contactId = req.query.contactId as string;
    const items = await prisma.crossSell.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { contact: { select: { id: true, firstName: true, lastName: true } } },
    });
    res.json(items);
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const agencyId = req.auth!.agencyId;
    const data = createSchema.parse(req.body);
    const contact = await prisma.contact.findFirst({ where: { id: data.contactId, agencyId } });
    if (!contact) throw badRequest("Contact not found in your agency");
    const item = await prisma.crossSell.create({
      data: { ...(data as Prisma.CrossSellUncheckedCreateInput), agencyId, source: "MANUAL" },
    });
    res.status(201).json(item);
  })
);

router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const agencyId = req.auth!.agencyId;
    const existing = await prisma.crossSell.findFirst({ where: { id: req.params.id, agencyId } });
    if (!existing) throw notFound("Opportunity not found");
    const data = updateSchema.parse(req.body);
    const item = await prisma.crossSell.update({
      where: { id: existing.id },
      data: data as Prisma.CrossSellUpdateInput,
    });
    res.json(item);
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const agencyId = req.auth!.agencyId;
    const existing = await prisma.crossSell.findFirst({ where: { id: req.params.id, agencyId } });
    if (!existing) throw notFound("Opportunity not found");
    await prisma.crossSell.delete({ where: { id: existing.id } });
    res.status(204).end();
  })
);

// Run the rules-based cross-sell detector on demand.
router.post(
  "/detect",
  requireRole("OWNER", "MANAGER"),
  asyncHandler(async (req, res) => {
    const created = await detectCrossSells(req.auth!.agencyId);
    res.json({ created });
  })
);

export default router;
