import { Router } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

function annualize(premium: number, mode: string | null): number {
  switch (mode) {
    case "MONTHLY":
      return premium * 12;
    case "QUARTERLY":
      return premium * 4;
    default:
      return premium;
  }
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const agencyId = req.auth!.agencyId;
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    const [
      recruitGroups,
      clientGroups,
      agedCount,
      activePolicies,
      faceAgg,
      referralGroups,
      openCrossSells,
      wonCrossSells,
      openTasks,
      overdueTasks,
      dueTodayTasks,
      sentLast30,
      pendingMessages,
      activeEnrollments,
      recentActivity,
    ] = await Promise.all([
      prisma.contact.groupBy({ by: ["status"], where: { agencyId, type: "RECRUIT" }, _count: true }),
      prisma.contact.groupBy({ by: ["status"], where: { agencyId, type: "CLIENT" }, _count: true }),
      prisma.contact.count({ where: { agencyId, type: "RECRUIT", isAged: true } }),
      prisma.policy.findMany({ where: { agencyId, status: "ACTIVE" }, select: { premium: true, premiumMode: true } }),
      prisma.policy.aggregate({ where: { agencyId, status: "ACTIVE" }, _sum: { faceAmount: true } }),
      prisma.referral.groupBy({ by: ["status"], where: { agencyId }, _count: true }),
      prisma.crossSell.findMany({
        where: { agencyId, status: { in: ["IDENTIFIED", "PRESENTED", "IN_PROGRESS"] } },
        select: { estimatedValue: true },
      }),
      prisma.crossSell.findMany({ where: { agencyId, status: "WON" }, select: { estimatedValue: true } }),
      prisma.task.count({ where: { agencyId, status: "OPEN" } }),
      prisma.task.count({ where: { agencyId, status: "OPEN", dueDate: { lt: now } } }),
      prisma.task.count({ where: { agencyId, status: "OPEN", dueDate: { gte: now, lte: todayEnd } } }),
      prisma.message.count({ where: { agencyId, status: "SENT", sentAt: { gte: thirtyDaysAgo } } }),
      prisma.message.count({ where: { agencyId, status: { in: ["SCHEDULED", "QUEUED"] } } }),
      prisma.enrollment.count({ where: { agencyId, status: "ACTIVE" } }),
      prisma.activity.findMany({ where: { agencyId }, orderBy: { createdAt: "desc" }, take: 15 }),
    ]);

    const toMap = (groups: { status: string; _count: number }[]) =>
      groups.reduce<Record<string, number>>((acc, g) => {
        acc[g.status] = g._count;
        return acc;
      }, {});

    const recruitsByStage = toMap(recruitGroups as any);
    const clientsByStage = toMap(clientGroups as any);

    const annualizedPremium = activePolicies.reduce(
      (sum, p) => sum + annualize(Number(p.premium ?? 0), p.premiumMode),
      0
    );
    const crossSellPipeline = openCrossSells.reduce((s, x) => s + Number(x.estimatedValue ?? 0), 0);
    const crossSellWon = wonCrossSells.reduce((s, x) => s + Number(x.estimatedValue ?? 0), 0);

    res.json({
      recruits: {
        total: Object.values(recruitsByStage).reduce((a, b) => a + b, 0),
        byStage: recruitsByStage,
        aged: agedCount,
      },
      clients: {
        total: Object.values(clientsByStage).reduce((a, b) => a + b, 0),
        byStage: clientsByStage,
      },
      policies: {
        active: activePolicies.length,
        totalFaceAmount: Number(faceAgg._sum.faceAmount ?? 0),
        annualizedPremium,
      },
      referrals: {
        total: (referralGroups as any[]).reduce((a, g) => a + g._count, 0),
        byStatus: toMap(referralGroups as any),
      },
      crossSells: {
        openCount: openCrossSells.length,
        pipelineValue: crossSellPipeline,
        wonValue: crossSellWon,
      },
      tasks: { open: openTasks, overdue: overdueTasks, dueToday: dueTodayTasks },
      messages: { sentLast30Days: sentLast30, pending: pendingMessages },
      automations: { activeEnrollments },
      recentActivity,
    });
  })
);

export default router;
