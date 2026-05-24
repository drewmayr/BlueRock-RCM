import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { badRequest, notFound } from "../lib/errors";
import { requireAuth } from "../middleware/auth";
import { logActivity } from "../lib/activity";
import { isValidStatus, defaultStatusFor } from "../shared/pipeline";
import { triggerSequencesForContact, enrollContact } from "../services/automation";

const router = Router();
router.use(requireAuth);

const optionalDate = z.preprocess(
  (v) => (v === "" ? null : v),
  z.coerce.date().nullable().optional()
);
const optionalInt = z.preprocess(
  (v) => (v === "" || v === null ? null : v),
  z.coerce.number().int().nullable().optional()
);

const baseContact = {
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  email: z.string().email().optional().or(z.literal("")).transform((v) => (v ? v : null)),
  phone: z.string().max(40).optional().nullable(),
  street: z.string().max(160).optional().nullable(),
  city: z.string().max(80).optional().nullable(),
  state: z.string().max(40).optional().nullable(),
  zip: z.string().max(20).optional().nullable(),
  dateOfBirth: optionalDate,
  anniversary: optionalDate,
  occupation: z.string().max(120).optional().nullable(),
  employer: z.string().max(120).optional().nullable(),
  maritalStatus: z.string().max(40).optional().nullable(),
  spouseName: z.string().max(120).optional().nullable(),
  numberOfChildren: optionalInt,
  familyNotes: z.string().max(2000).optional().nullable(),
  retirementGoalAge: optionalInt,
  retirementNotes: z.string().max(2000).optional().nullable(),
  incomeBand: z.string().max(60).optional().nullable(),
  source: z.string().max(120).optional().nullable(),
  recruitNotes: z.string().max(2000).optional().nullable(),
  ownerId: z.string().optional().nullable(),
  tags: z.array(z.string().max(40)).optional(),
  notes: z.string().max(4000).optional().nullable(),
  doNotContact: z.boolean().optional(),
};

const createSchema = z.object({
  type: z.enum(["RECRUIT", "CLIENT"]),
  status: z.string().optional(),
  ...baseContact,
});

const updateSchema = z.object({
  type: z.enum(["RECRUIT", "CLIENT"]).optional(),
  status: z.string().optional(),
  ...Object.fromEntries(Object.entries(baseContact).map(([k, v]) => [k, (v as z.ZodTypeAny).optional()])),
}) as z.ZodType<Record<string, unknown>>;

// List with filtering, search, pagination.
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const agencyId = req.auth!.agencyId;
    const { type, status, owner, aged, q } = req.query as Record<string, string>;
    const page = Math.max(1, parseInt((req.query.page as string) ?? "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt((req.query.pageSize as string) ?? "25", 10)));

    const where: Prisma.ContactWhereInput = { agencyId };
    if (type === "RECRUIT" || type === "CLIENT") where.type = type;
    if (status) where.status = status;
    if (owner) where.ownerId = owner;
    if (aged === "true") where.isAged = true;
    if (q) {
      where.OR = [
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.contact.count({ where }),
      prisma.contact.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          owner: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { policies: true, enrollments: true } },
        },
      }),
    ]);

    res.json({ items, total, page, pageSize, pages: Math.ceil(total / pageSize) });
  })
);

// Detail view with related records.
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const agencyId = req.auth!.agencyId;
    const contact = await prisma.contact.findFirst({
      where: { id: req.params.id, agencyId },
      include: {
        owner: { select: { id: true, firstName: true, lastName: true, email: true } },
        policies: { orderBy: { createdAt: "desc" } },
        lifeEvents: { orderBy: { date: "asc" } },
        crossSells: { orderBy: { createdAt: "desc" } },
        tasks: { orderBy: { createdAt: "desc" }, take: 25 },
        enrollments: { include: { sequence: { select: { id: true, name: true } } }, orderBy: { enrolledAt: "desc" } },
        messages: { orderBy: { createdAt: "desc" }, take: 25 },
        referralsGiven: true,
      },
    });
    if (!contact) throw notFound("Contact not found");

    const activities = await prisma.activity.findMany({
      where: { agencyId, contactId: contact.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    res.json({ ...contact, activities });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const agencyId = req.auth!.agencyId;
    const data = createSchema.parse(req.body);

    let status = data.status ?? defaultStatusFor(data.type);
    if (!isValidStatus(data.type, status)) {
      throw badRequest(`Invalid status "${status}" for ${data.type}`);
    }

    const { type, status: _ignore, ownerId, ...rest } = data;
    const contact = await prisma.contact.create({
      data: {
        ...(rest as Prisma.ContactUncheckedCreateInput),
        agencyId,
        type,
        status,
        ownerId: ownerId ?? req.auth!.userId,
      },
    });

    await logActivity({
      agencyId,
      userId: req.auth!.userId,
      contactId: contact.id,
      type: "CONTACT_CREATED",
      description: `Added ${type === "RECRUIT" ? "recruit" : "client"} ${contact.firstName} ${contact.lastName}`,
    });

    // Fire any CONTACT_CREATED automations (welcome sequences, etc.)
    await triggerSequencesForContact(contact.id, "CONTACT_CREATED");

    res.status(201).json(contact);
  })
);

router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const agencyId = req.auth!.agencyId;
    const existing = await prisma.contact.findFirst({ where: { id: req.params.id, agencyId } });
    if (!existing) throw notFound("Contact not found");

    const data = updateSchema.parse(req.body);
    const type = (data.type as "RECRUIT" | "CLIENT") ?? existing.type;
    if (data.status && !isValidStatus(type, data.status as string)) {
      throw badRequest(`Invalid status "${data.status}" for ${type}`);
    }

    const statusChanged = data.status && data.status !== existing.status;

    const updated = await prisma.contact.update({
      where: { id: existing.id },
      data: data as Prisma.ContactUpdateInput,
    });

    if (statusChanged) {
      await logActivity({
        agencyId,
        userId: req.auth!.userId,
        contactId: updated.id,
        type: "STATUS_CHANGED",
        description: `Status changed from ${existing.status} to ${updated.status}`,
      });
      await triggerSequencesForContact(updated.id, "STATUS_CHANGE");
    }

    res.json(updated);
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const agencyId = req.auth!.agencyId;
    const existing = await prisma.contact.findFirst({ where: { id: req.params.id, agencyId } });
    if (!existing) throw notFound("Contact not found");
    await prisma.contact.delete({ where: { id: existing.id } });
    res.status(204).end();
  })
);

// Append a timestamped note + activity.
const noteSchema = z.object({ note: z.string().min(1).max(4000) });
router.post(
  "/:id/note",
  asyncHandler(async (req, res) => {
    const agencyId = req.auth!.agencyId;
    const { note } = noteSchema.parse(req.body);
    const contact = await prisma.contact.findFirst({ where: { id: req.params.id, agencyId } });
    if (!contact) throw notFound("Contact not found");

    await logActivity({
      agencyId,
      userId: req.auth!.userId,
      contactId: contact.id,
      type: "NOTE_ADDED",
      description: note,
    });
    res.status(201).json({ ok: true });
  })
);

// Mark as contacted (clears aged status, resets engagement clock).
router.post(
  "/:id/contacted",
  asyncHandler(async (req, res) => {
    const agencyId = req.auth!.agencyId;
    const contact = await prisma.contact.findFirst({ where: { id: req.params.id, agencyId } });
    if (!contact) throw notFound("Contact not found");
    const updated = await prisma.contact.update({
      where: { id: contact.id },
      data: { lastContactedAt: new Date(), isAged: false },
    });
    await logActivity({
      agencyId,
      userId: req.auth!.userId,
      contactId: contact.id,
      type: "CONTACTED",
      description: "Logged a contact touchpoint",
    });
    res.json(updated);
  })
);

// Manually enroll into an automation sequence.
const enrollSchema = z.object({ sequenceId: z.string().min(1) });
router.post(
  "/:id/enroll",
  asyncHandler(async (req, res) => {
    const agencyId = req.auth!.agencyId;
    const { sequenceId } = enrollSchema.parse(req.body);
    const contact = await prisma.contact.findFirst({ where: { id: req.params.id, agencyId } });
    if (!contact) throw notFound("Contact not found");
    const sequence = await prisma.sequence.findFirst({ where: { id: sequenceId, agencyId } });
    if (!sequence) throw notFound("Sequence not found");

    const result = await enrollContact(sequenceId, contact.id, { reArm: true });
    if (!result.enrolled) throw badRequest(result.reason ?? "Could not enroll");
    res.status(201).json({ ok: true });
  })
);

export default router;
