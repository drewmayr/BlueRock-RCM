import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { notFound } from "../lib/errors";
import { requireAuth } from "../middleware/auth";
import { logActivity } from "../lib/activity";

const router = Router();
router.use(requireAuth);

const optionalDate = z.preprocess((v) => (v === "" ? null : v), z.coerce.date().nullable().optional());

const createSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  contactId: z.string().optional().nullable(),
  assigneeId: z.string().optional().nullable(),
  dueDate: optionalDate,
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  type: z.enum(["CALL", "EMAIL", "FOLLOW_UP", "MEETING", "ONBOARDING", "OTHER"]).optional().nullable(),
});

const updateSchema = createSchema.partial().extend({
  status: z.enum(["OPEN", "DONE"]).optional(),
});

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const agencyId = req.auth!.agencyId;
    const where: Prisma.TaskWhereInput = { agencyId };
    if (req.query.status) where.status = req.query.status as string;
    if (req.query.assignee) where.assigneeId = req.query.assignee as string;
    if (req.query.contactId) where.contactId = req.query.contactId as string;
    if (req.query.mine === "true") where.assigneeId = req.auth!.userId;
    const tasks = await prisma.task.findMany({
      where,
      orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
      include: {
        contact: { select: { id: true, firstName: true, lastName: true } },
        assignee: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    res.json(tasks);
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const agencyId = req.auth!.agencyId;
    const data = createSchema.parse(req.body);
    const task = await prisma.task.create({
      data: {
        ...(data as Prisma.TaskUncheckedCreateInput),
        agencyId,
        assigneeId: data.assigneeId ?? req.auth!.userId,
      },
    });
    res.status(201).json(task);
  })
);

router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const agencyId = req.auth!.agencyId;
    const existing = await prisma.task.findFirst({ where: { id: req.params.id, agencyId } });
    if (!existing) throw notFound("Task not found");
    const data = updateSchema.parse(req.body);
    const patch: Prisma.TaskUpdateInput = { ...(data as Prisma.TaskUpdateInput) };
    if (data.status === "DONE" && existing.status !== "DONE") patch.completedAt = new Date();
    if (data.status === "OPEN") patch.completedAt = null;
    const task = await prisma.task.update({ where: { id: existing.id }, data: patch });
    res.json(task);
  })
);

router.post(
  "/:id/complete",
  asyncHandler(async (req, res) => {
    const agencyId = req.auth!.agencyId;
    const existing = await prisma.task.findFirst({ where: { id: req.params.id, agencyId } });
    if (!existing) throw notFound("Task not found");
    const task = await prisma.task.update({
      where: { id: existing.id },
      data: { status: "DONE", completedAt: new Date() },
    });
    await logActivity({
      agencyId,
      userId: req.auth!.userId,
      contactId: existing.contactId,
      type: "TASK_DONE",
      description: `Completed task: ${existing.title}`,
    });
    res.json(task);
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const agencyId = req.auth!.agencyId;
    const existing = await prisma.task.findFirst({ where: { id: req.params.id, agencyId } });
    if (!existing) throw notFound("Task not found");
    await prisma.task.delete({ where: { id: existing.id } });
    res.status(204).end();
  })
);

export default router;
