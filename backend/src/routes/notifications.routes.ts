import { Router } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { notFound } from "../lib/errors";
import { requireAuth } from "../middleware/auth";
import { RECRUIT_TERMINAL_STAGES } from "../shared/pipeline";

const router = Router();
router.use(requireAuth);

const DAY = 86400000;
const OPEN_CROSS = ["IDENTIFIED", "PRESENTED", "IN_PROGRESS"];

/** Days until the next annual occurrence of a month/day, in UTC. */
function daysUntilAnnual(date: Date | null): number | null {
  if (!date) return null;
  const d = new Date(date);
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  let next = new Date(Date.UTC(now.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  if (next < today) next = new Date(Date.UTC(now.getUTCFullYear() + 1, d.getUTCMonth(), d.getUTCDate()));
  return Math.round((next.getTime() - today.getTime()) / DAY);
}

/** Reminder center: stored notifications + live computed reminders. */
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const agencyId = req.auth!.agencyId;
    const now = new Date();
    const horizon = 30;

    const [stored, unreadCount, clients, recruits, activePolicies, openTasks, referrals, crossSells] = await Promise.all([
      prisma.notification.findMany({ where: { agencyId }, orderBy: { createdAt: "desc" }, take: 30 }),
      prisma.notification.count({ where: { agencyId, read: false } }),
      prisma.contact.findMany({
        where: { agencyId, doNotContact: false, OR: [{ dateOfBirth: { not: null } }, { anniversary: { not: null } }, { followUpDate: { not: null } }] },
        select: { id: true, firstName: true, lastName: true, dateOfBirth: true, anniversary: true, followUpDate: true },
      }),
      prisma.contact.findMany({
        where: { agencyId, type: "RECRUIT", doNotContact: false, status: { notIn: [...RECRUIT_TERMINAL_STAGES] }, OR: [{ isAged: true }, { lastContactedAt: { lte: new Date(Date.now() - 30 * DAY) } }] },
        select: { id: true, firstName: true, lastName: true, lastContactedAt: true, status: true },
        take: 50,
      }),
      prisma.policy.findMany({
        where: { agencyId, status: "ACTIVE", renewalDate: { not: null } },
        select: { id: true, renewalDate: true, productType: true, contact: { select: { id: true, firstName: true, lastName: true } } },
      }),
      prisma.task.findMany({
        where: { agencyId, status: "OPEN", dueDate: { lt: now } },
        select: { id: true, title: true, dueDate: true, contact: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: { dueDate: "asc" }, take: 50,
      }),
      prisma.referral.findMany({
        where: { agencyId, status: { in: ["NEW", "CONTACTED", "QUALIFIED"] } },
        select: { id: true, referredName: true, status: true },
        take: 50,
      }),
      prisma.crossSell.findMany({
        where: { agencyId, status: { in: OPEN_CROSS } },
        select: { id: true, productType: true, contact: { select: { id: true, firstName: true, lastName: true } } },
        take: 50,
      }),
    ]);

    const birthdays = clients
      .map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}`, days: daysUntilAnnual(c.dateOfBirth) }))
      .filter((x) => x.days !== null && x.days <= 14)
      .sort((a, b) => (a.days! - b.days!));

    const anniversaries = clients
      .map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}`, days: daysUntilAnnual(c.anniversary) }))
      .filter((x) => x.days !== null && x.days <= 14)
      .sort((a, b) => (a.days! - b.days!));

    const renewals = activePolicies
      .map((p) => ({ id: p.contact?.id, policyId: p.id, name: p.contact ? `${p.contact.firstName} ${p.contact.lastName}` : "—", productType: p.productType, days: daysUntilAnnual(p.renewalDate) }))
      .filter((x) => x.days !== null && x.days <= horizon)
      .sort((a, b) => (a.days! - b.days!));

    const overdueFollowUps = clients
      .filter((c) => c.followUpDate && new Date(c.followUpDate) < now)
      .map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}`, date: c.followUpDate }));

    res.json({
      unreadCount,
      notifications: stored,
      reminders: {
        upcomingBirthdays: { count: birthdays.length, items: birthdays.slice(0, 20) },
        upcomingAnniversaries: { count: anniversaries.length, items: anniversaries.slice(0, 20) },
        policyRenewals: { count: renewals.length, items: renewals.slice(0, 20) },
        inactiveRecruits: { count: recruits.length, items: recruits.map((r) => ({ id: r.id, name: `${r.firstName} ${r.lastName}`, status: r.status })) },
        overdueFollowUps: { count: overdueFollowUps.length, items: overdueFollowUps },
        overdueTasks: { count: openTasks.length, items: openTasks.map((t) => ({ id: t.id, title: t.title, dueDate: t.dueDate, contact: t.contact })) },
        referralOpportunities: { count: referrals.length, items: referrals.map((r) => ({ id: r.id, name: r.referredName, status: r.status })) },
        crossSellOpportunities: { count: crossSells.length, items: crossSells.map((x) => ({ id: x.id, productType: x.productType, contact: x.contact })) },
      },
    });
  })
);

router.get(
  "/unread-count",
  asyncHandler(async (req, res) => {
    const count = await prisma.notification.count({ where: { agencyId: req.auth!.agencyId, read: false } });
    res.json({ count });
  })
);

router.post(
  "/:id/read",
  asyncHandler(async (req, res) => {
    const n = await prisma.notification.findFirst({ where: { id: req.params.id, agencyId: req.auth!.agencyId } });
    if (!n) throw notFound("Notification not found");
    await prisma.notification.update({ where: { id: n.id }, data: { read: true } });
    res.json({ ok: true });
  })
);

router.post(
  "/read-all",
  asyncHandler(async (req, res) => {
    await prisma.notification.updateMany({ where: { agencyId: req.auth!.agencyId, read: false }, data: { read: true } });
    res.json({ ok: true });
  })
);

export default router;
