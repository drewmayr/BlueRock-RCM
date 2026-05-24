import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { notFound } from "../lib/errors";
import { requireAuth, requireRole } from "../middleware/auth";
import { SEQUENCE_TRIGGERS, CHANNELS } from "../shared/pipeline";
import { runAutomationCycle } from "../services/automation";

const router = Router();
router.use(requireAuth);

const stepSchema = z.object({
  order: z.number().int().min(0),
  channel: z.enum(CHANNELS),
  delayDays: z.number().int().min(0).max(3650).optional().default(0),
  delayHours: z.number().int().min(0).max(23).optional().default(0),
  subject: z.string().max(200).optional().nullable(),
  body: z.string().min(1).max(4000),
  taskTitle: z.string().max(200).optional().nullable(),
});

const createSchema = z.object({
  name: z.string().min(1).max(160),
  description: z.string().max(500).optional().nullable(),
  audience: z.enum(["RECRUIT", "CLIENT", "BOTH"]),
  triggerType: z.enum(SEQUENCE_TRIGGERS),
  triggerConfig: z.record(z.any()).optional().nullable(),
  isActive: z.boolean().optional(),
  steps: z.array(stepSchema).min(1),
});

const updateSchema = createSchema.partial();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const agencyId = req.auth!.agencyId;
    const sequences = await prisma.sequence.findMany({
      where: { agencyId },
      orderBy: { createdAt: "asc" },
      include: {
        _count: { select: { steps: true, enrollments: true } },
      },
    });
    res.json(sequences);
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const agencyId = req.auth!.agencyId;
    const sequence = await prisma.sequence.findFirst({
      where: { id: req.params.id, agencyId },
      include: {
        steps: { orderBy: { order: "asc" } },
        _count: { select: { enrollments: true } },
      },
    });
    if (!sequence) throw notFound("Sequence not found");

    const activeEnrollments = await prisma.enrollment.count({
      where: { sequenceId: sequence.id, status: "ACTIVE" },
    });
    res.json({ ...sequence, activeEnrollments });
  })
);

router.post(
  "/",
  requireRole("OWNER", "MANAGER"),
  asyncHandler(async (req, res) => {
    const agencyId = req.auth!.agencyId;
    const data = createSchema.parse(req.body);
    const sequence = await prisma.sequence.create({
      data: {
        agencyId,
        name: data.name,
        description: data.description ?? null,
        audience: data.audience,
        triggerType: data.triggerType,
        triggerConfig: data.triggerConfig ?? undefined,
        isActive: data.isActive ?? true,
        steps: { create: data.steps },
      },
      include: { steps: { orderBy: { order: "asc" } } },
    });
    res.status(201).json(sequence);
  })
);

router.patch(
  "/:id",
  requireRole("OWNER", "MANAGER"),
  asyncHandler(async (req, res) => {
    const agencyId = req.auth!.agencyId;
    const existing = await prisma.sequence.findFirst({ where: { id: req.params.id, agencyId } });
    if (!existing) throw notFound("Sequence not found");
    const data = updateSchema.parse(req.body);

    const sequence = await prisma.$transaction(async (tx) => {
      const updated = await tx.sequence.update({
        where: { id: existing.id },
        data: {
          name: data.name ?? undefined,
          description: data.description === undefined ? undefined : data.description,
          audience: data.audience ?? undefined,
          triggerType: data.triggerType ?? undefined,
          triggerConfig: data.triggerConfig === undefined ? undefined : data.triggerConfig ?? undefined,
          isActive: data.isActive ?? undefined,
        },
      });
      if (data.steps) {
        await tx.sequenceStep.deleteMany({ where: { sequenceId: existing.id } });
        await tx.sequenceStep.createMany({
          data: data.steps.map((s) => ({ ...s, sequenceId: existing.id })),
        });
      }
      return updated;
    });

    const full = await prisma.sequence.findUnique({
      where: { id: sequence.id },
      include: { steps: { orderBy: { order: "asc" } } },
    });
    res.json(full);
  })
);

router.post(
  "/:id/toggle",
  requireRole("OWNER", "MANAGER"),
  asyncHandler(async (req, res) => {
    const agencyId = req.auth!.agencyId;
    const existing = await prisma.sequence.findFirst({ where: { id: req.params.id, agencyId } });
    if (!existing) throw notFound("Sequence not found");
    const updated = await prisma.sequence.update({
      where: { id: existing.id },
      data: { isActive: !existing.isActive },
    });
    res.json(updated);
  })
);

router.delete(
  "/:id",
  requireRole("OWNER", "MANAGER"),
  asyncHandler(async (req, res) => {
    const agencyId = req.auth!.agencyId;
    const existing = await prisma.sequence.findFirst({ where: { id: req.params.id, agencyId } });
    if (!existing) throw notFound("Sequence not found");
    await prisma.sequence.delete({ where: { id: existing.id } });
    res.status(204).end();
  })
);

router.get(
  "/:id/enrollments",
  asyncHandler(async (req, res) => {
    const agencyId = req.auth!.agencyId;
    const sequence = await prisma.sequence.findFirst({ where: { id: req.params.id, agencyId } });
    if (!sequence) throw notFound("Sequence not found");
    const enrollments = await prisma.enrollment.findMany({
      where: { sequenceId: sequence.id },
      orderBy: { enrolledAt: "desc" },
      include: { contact: { select: { id: true, firstName: true, lastName: true, type: true } } },
    });
    res.json(enrollments);
  })
);

// Stop an active enrollment.
router.post(
  "/enrollments/:enrollmentId/stop",
  asyncHandler(async (req, res) => {
    const agencyId = req.auth!.agencyId;
    const enrollment = await prisma.enrollment.findFirst({
      where: { id: req.params.enrollmentId, agencyId },
    });
    if (!enrollment) throw notFound("Enrollment not found");
    const updated = await prisma.enrollment.update({
      where: { id: enrollment.id },
      data: { status: "STOPPED", nextRunAt: null },
    });
    res.json(updated);
  })
);

// Run the automation engine now, scoped to this agency (manual trigger / demo).
router.post(
  "/run-cycle",
  requireRole("OWNER", "MANAGER"),
  asyncHandler(async (req, res) => {
    const summary = await runAutomationCycle(req.auth!.agencyId);
    res.json({ ok: true, summary });
  })
);

export default router;
