import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { notFound, badRequest } from "../lib/errors";
import { requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

const createSchema = z.object({
  contactId: z.string().min(1),
  type: z.enum([
    "BIRTHDAY",
    "ANNIVERSARY",
    "POLICY_ANNIVERSARY",
    "RENEWAL",
    "NEW_BABY",
    "RETIREMENT",
    "MILESTONE",
    "CUSTOM",
  ]),
  title: z.string().min(1).max(160),
  date: z.coerce.date(),
  recurring: z.boolean().optional(),
  notes: z.string().max(1000).optional().nullable(),
});

const updateSchema = createSchema.partial().omit({ contactId: true });

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const agencyId = req.auth!.agencyId;
    const where: Prisma.LifeEventWhereInput = { agencyId };
    if (req.query.contactId) where.contactId = req.query.contactId as string;
    const events = await prisma.lifeEvent.findMany({
      where,
      orderBy: { date: "asc" },
      include: { contact: { select: { id: true, firstName: true, lastName: true } } },
    });
    res.json(events);
  })
);

// Upcoming birthdays / anniversaries / renewals within N days (recurring-aware).
router.get(
  "/upcoming",
  asyncHandler(async (req, res) => {
    const agencyId = req.auth!.agencyId;
    const days = Math.min(365, Math.max(1, parseInt((req.query.days as string) ?? "30", 10)));

    const events = await prisma.lifeEvent.findMany({
      where: { agencyId },
      include: { contact: { select: { id: true, firstName: true, lastName: true } } },
    });

    const now = new Date();
    const horizon = new Date(now.getTime() + days * 86400000);

    const withNext = events
      .map((e) => {
        const d = new Date(e.date);
        let next = new Date(d);
        if (e.recurring) {
          next = new Date(now.getFullYear(), d.getMonth(), d.getDate());
          if (next < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
            next = new Date(now.getFullYear() + 1, d.getMonth(), d.getDate());
          }
        }
        return { ...e, nextOccurrence: next };
      })
      .filter((e) => e.nextOccurrence >= new Date(now.getFullYear(), now.getMonth(), now.getDate()) && e.nextOccurrence <= horizon)
      .sort((a, b) => a.nextOccurrence.getTime() - b.nextOccurrence.getTime());

    res.json(withNext);
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const agencyId = req.auth!.agencyId;
    const data = createSchema.parse(req.body);
    const contact = await prisma.contact.findFirst({ where: { id: data.contactId, agencyId } });
    if (!contact) throw badRequest("Contact not found in your agency");
    const event = await prisma.lifeEvent.create({
      data: { ...(data as Prisma.LifeEventUncheckedCreateInput), agencyId },
    });
    res.status(201).json(event);
  })
);

router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const agencyId = req.auth!.agencyId;
    const existing = await prisma.lifeEvent.findFirst({ where: { id: req.params.id, agencyId } });
    if (!existing) throw notFound("Event not found");
    const data = updateSchema.parse(req.body);
    const event = await prisma.lifeEvent.update({
      where: { id: existing.id },
      data: data as Prisma.LifeEventUpdateInput,
    });
    res.json(event);
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const agencyId = req.auth!.agencyId;
    const existing = await prisma.lifeEvent.findFirst({ where: { id: req.params.id, agencyId } });
    if (!existing) throw notFound("Event not found");
    await prisma.lifeEvent.delete({ where: { id: existing.id } });
    res.status(204).end();
  })
);

export default router;
