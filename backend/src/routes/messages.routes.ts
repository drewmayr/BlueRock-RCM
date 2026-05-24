import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { notFound, badRequest } from "../lib/errors";
import { requireAuth } from "../middleware/auth";
import { dispatchMessage } from "../services/messaging";
import { logActivity } from "../lib/activity";

const router = Router();
router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const agencyId = req.auth!.agencyId;
    const page = Math.max(1, parseInt((req.query.page as string) ?? "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt((req.query.pageSize as string) ?? "30", 10)));
    const where: Prisma.MessageWhereInput = { agencyId };
    if (req.query.status) where.status = req.query.status as string;
    if (req.query.channel) where.channel = req.query.channel as string;
    if (req.query.contactId) where.contactId = req.query.contactId as string;

    const [total, items] = await Promise.all([
      prisma.message.count({ where }),
      prisma.message.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { contact: { select: { id: true, firstName: true, lastName: true } } },
      }),
    ]);
    res.json({ items, total, page, pageSize, pages: Math.ceil(total / pageSize) });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const message = await prisma.message.findFirst({
      where: { id: req.params.id, agencyId: req.auth!.agencyId },
      include: { contact: { select: { id: true, firstName: true, lastName: true } } },
    });
    if (!message) throw notFound("Message not found");
    res.json(message);
  })
);

// Manually compose & send a message to a contact (sends immediately if a provider is configured).
const sendSchema = z.object({
  contactId: z.string().min(1),
  channel: z.enum(["SMS", "EMAIL"]),
  subject: z.string().max(200).optional().nullable(),
  body: z.string().min(1).max(4000),
});

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const agencyId = req.auth!.agencyId;
    const data = sendSchema.parse(req.body);
    const contact = await prisma.contact.findFirst({ where: { id: data.contactId, agencyId } });
    if (!contact) throw badRequest("Contact not found in your agency");

    const toAddress = data.channel === "SMS" ? contact.phone : contact.email;
    if (!toAddress) throw badRequest(`Contact has no ${data.channel === "SMS" ? "phone number" : "email address"}`);

    const message = await prisma.message.create({
      data: {
        agencyId,
        contactId: contact.id,
        channel: data.channel,
        status: "SCHEDULED",
        toAddress,
        subject: data.channel === "EMAIL" ? data.subject ?? null : null,
        body: data.body,
        scheduledAt: new Date(),
      },
    });
    const result = await dispatchMessage(message.id);

    await logActivity({
      agencyId,
      userId: req.auth!.userId,
      contactId: contact.id,
      type: "MESSAGE_SENT",
      description: `Sent ${data.channel} to ${contact.firstName} ${contact.lastName}`,
    });
    await prisma.contact.update({ where: { id: contact.id }, data: { lastContactedAt: new Date() } });

    const updated = await prisma.message.findUnique({ where: { id: message.id } });
    res.status(201).json({ message: updated, delivery: result });
  })
);

// Retry a failed or queued message.
router.post(
  "/:id/retry",
  asyncHandler(async (req, res) => {
    const agencyId = req.auth!.agencyId;
    const message = await prisma.message.findFirst({ where: { id: req.params.id, agencyId } });
    if (!message) throw notFound("Message not found");
    if (message.status === "SENT") throw badRequest("Message already sent");
    await prisma.message.update({ where: { id: message.id }, data: { status: "SCHEDULED", error: null } });
    const result = await dispatchMessage(message.id);
    const updated = await prisma.message.findUnique({ where: { id: message.id } });
    res.json({ message: updated, delivery: result });
  })
);

export default router;
