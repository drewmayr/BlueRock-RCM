import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { logActivity } from "../lib/activity";
import { renderTemplate, TemplateContext } from "./templating";
import { dispatchMessage } from "./messaging";
import { RECRUIT_TERMINAL_STAGES } from "../shared/pipeline";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

type SequenceWithSteps = Prisma.SequenceGetPayload<{ include: { steps: true } }>;

function stepDelayMs(step: { delayDays: number; delayHours: number }): number {
  return step.delayDays * DAY_MS + step.delayHours * HOUR_MS;
}

function sortedSteps(seq: SequenceWithSteps) {
  return [...seq.steps].sort((a, b) => a.order - b.order);
}

/**
 * Enroll a contact into a sequence. Idempotent. For recurring triggers (birthday,
 * anniversary, renewal) pass reArm=true to re-activate a completed enrollment when
 * the occasion comes around again.
 */
export async function enrollContact(
  sequenceId: string,
  contactId: string,
  opts: { reArm?: boolean } = {}
): Promise<{ enrolled: boolean; reason?: string }> {
  const seq = await prisma.sequence.findUnique({
    where: { id: sequenceId },
    include: { steps: true },
  });
  if (!seq) return { enrolled: false, reason: "Sequence not found" };
  if (!seq.isActive) return { enrolled: false, reason: "Sequence inactive" };
  const steps = sortedSteps(seq);
  if (steps.length === 0) return { enrolled: false, reason: "Sequence has no steps" };

  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact) return { enrolled: false, reason: "Contact not found" };
  if (contact.doNotContact) return { enrolled: false, reason: "Contact is marked do-not-contact" };

  const nextRunAt = new Date(Date.now() + stepDelayMs(steps[0]));
  const existing = await prisma.enrollment.findUnique({
    where: { sequenceId_contactId: { sequenceId, contactId } },
  });

  if (existing) {
    if (existing.status === "ACTIVE") return { enrolled: false, reason: "Already enrolled" };
    if (!opts.reArm) return { enrolled: false, reason: "Previously enrolled" };
    await prisma.enrollment.update({
      where: { id: existing.id },
      data: { status: "ACTIVE", currentStep: 0, nextRunAt, enrolledAt: new Date(), completedAt: null },
    });
  } else {
    await prisma.enrollment.create({
      data: { agencyId: seq.agencyId, sequenceId, contactId, status: "ACTIVE", currentStep: 0, nextRunAt },
    });
  }

  await logActivity({
    agencyId: seq.agencyId,
    contactId,
    type: "ENROLLED",
    description: `Enrolled in automation "${seq.name}"`,
    metadata: { sequenceId },
  });
  return { enrolled: true };
}

/** Build the templating context for a contact (loads owner + agency). */
async function buildContext(contactId: string): Promise<TemplateContext & { contact: { email: string | null; phone: string | null } }> {
  const contact = await prisma.contact.findUniqueOrThrow({
    where: { id: contactId },
    include: { owner: true, agency: true, policies: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  return {
    contact,
    agent: contact.owner ?? undefined,
    agency: contact.agency,
    policy: contact.policies[0] ?? undefined,
  };
}

/** Execute a single sequence step for an enrollment (create message or task). */
interface StepLike {
  channel: string;
  subject: string | null;
  body: string;
  taskTitle: string | null;
  actionConfig?: unknown;
}

async function runStep(
  enrollment: { id: string; agencyId: string; contactId: string },
  step: StepLike
): Promise<void> {
  const ctx = await buildContext(enrollment.contactId);
  const contact = ctx.contact!;
  const ownerId = (await prisma.contact.findUnique({
    where: { id: enrollment.contactId },
    select: { ownerId: true },
  }))?.ownerId ?? null;
  const cfg = (step.actionConfig as Record<string, unknown> | null) ?? {};

  switch (step.channel) {
    case "TASK": {
      await prisma.task.create({
        data: {
          agencyId: enrollment.agencyId,
          contactId: enrollment.contactId,
          assigneeId: ownerId,
          title: renderTemplate(step.taskTitle || step.subject || "Automated follow-up", ctx),
          description: renderTemplate(step.body, ctx),
          type: "FOLLOW_UP",
          dueDate: new Date(),
          autoCreated: true,
        },
      });
      return;
    }
    case "NOTE": {
      await logActivity({
        agencyId: enrollment.agencyId,
        contactId: enrollment.contactId,
        type: "NOTE_ADDED",
        description: renderTemplate(step.body || step.subject || "Automated note", ctx),
        metadata: { auto: true },
      });
      return;
    }
    case "STATUS": {
      const status = (cfg.status as string) || "";
      if (status) {
        await prisma.contact.update({ where: { id: enrollment.contactId }, data: { status } });
        await logActivity({
          agencyId: enrollment.agencyId,
          contactId: enrollment.contactId,
          type: "STATUS_CHANGED",
          description: `Automation set status to ${status}`,
        });
      }
      return;
    }
    case "TAG": {
      const tags = Array.isArray(cfg.tags) ? (cfg.tags as string[]) : String(cfg.tags ?? "").split(",").map((t) => t.trim()).filter(Boolean);
      if (tags.length) {
        const existing = (await prisma.contact.findUnique({ where: { id: enrollment.contactId }, select: { tags: true } }))?.tags ?? [];
        const merged = Array.from(new Set([...existing, ...tags]));
        await prisma.contact.update({ where: { id: enrollment.contactId }, data: { tags: merged } });
      }
      return;
    }
    case "NOTIFY": {
      await prisma.notification.create({
        data: {
          agencyId: enrollment.agencyId,
          userId: ownerId,
          contactId: enrollment.contactId,
          category: "AUTOMATION",
          type: "WORKFLOW",
          title: renderTemplate(step.subject || "Automation update", ctx),
          body: renderTemplate(step.body || "", ctx),
          link: `/contacts/${enrollment.contactId}`,
        },
      });
      return;
    }
    default: {
      // SMS or EMAIL — create an outbox message and attempt delivery.
      const toAddress = step.channel === "SMS" ? contact.phone : contact.email;
      const message = await prisma.message.create({
        data: {
          agencyId: enrollment.agencyId,
          contactId: enrollment.contactId,
          enrollmentId: enrollment.id,
          channel: step.channel,
          status: "SCHEDULED",
          toAddress: toAddress ?? null,
          subject: step.channel === "EMAIL" ? renderTemplate(step.subject ?? "", ctx) : null,
          body: renderTemplate(step.body, ctx),
          scheduledAt: new Date(),
        },
      });
      await dispatchMessage(message.id);
    }
  }
}

/**
 * Advance all enrollments whose next step is due. Runs exactly one step per
 * enrollment per tick, then schedules the following step by its delay.
 */
export async function processDueEnrollments(limit = 200): Promise<number> {
  const due = await prisma.enrollment.findMany({
    where: { status: "ACTIVE", nextRunAt: { lte: new Date() } },
    take: limit,
    include: { sequence: { include: { steps: true } } },
  });

  let processed = 0;
  for (const enr of due) {
    const steps = sortedSteps(enr.sequence);
    const step = steps[enr.currentStep];
    if (!step) {
      await prisma.enrollment.update({
        where: { id: enr.id },
        data: { status: "COMPLETED", completedAt: new Date(), nextRunAt: null },
      });
      continue;
    }
    try {
      await runStep(enr, step);
    } catch (err) {
      console.error(`[automation] step failed for enrollment ${enr.id}`, err);
    }
    const nextIndex = enr.currentStep + 1;
    if (nextIndex < steps.length) {
      await prisma.enrollment.update({
        where: { id: enr.id },
        data: {
          currentStep: nextIndex,
          nextRunAt: new Date(Date.now() + stepDelayMs(steps[nextIndex])),
        },
      });
    } else {
      await prisma.enrollment.update({
        where: { id: enr.id },
        data: { status: "COMPLETED", completedAt: new Date(), nextRunAt: null },
      });
    }
    processed++;
  }
  return processed;
}

/** Deliver any messages that are due (SCHEDULED past their time, or QUEUED awaiting a provider). */
export async function processScheduledMessages(limit = 200): Promise<number> {
  const due = await prisma.message.findMany({
    where: {
      status: { in: ["SCHEDULED", "QUEUED"] },
      OR: [{ scheduledAt: { lte: new Date() } }, { scheduledAt: null }],
    },
    take: limit,
    select: { id: true },
  });
  let sent = 0;
  for (const m of due) {
    const res = await dispatchMessage(m.id);
    if (res.ok) sent++;
  }
  return sent;
}

/**
 * Detect and enroll aged recruiting leads: recruits with no contact in
 * `agedLeadDays` whose status is still in the active pipeline. Flags them and
 * enrolls them into any active AGED_LEAD sequences (the "lead revival" feature).
 */
export async function processAgedLeads(agencyId?: string): Promise<number> {
  const agencies = await prisma.agency.findMany({ where: agencyId ? { id: agencyId } : {} });
  let count = 0;
  for (const agency of agencies) {
    const cutoff = new Date(Date.now() - agency.agedLeadDays * DAY_MS);
    const aged = await prisma.contact.findMany({
      where: {
        agencyId: agency.id,
        type: "RECRUIT",
        doNotContact: false,
        status: { notIn: [...RECRUIT_TERMINAL_STAGES] },
        OR: [{ lastContactedAt: { lte: cutoff } }, { lastContactedAt: null, createdAt: { lte: cutoff } }],
      },
    });
    if (aged.length === 0) continue;

    await prisma.contact.updateMany({
      where: { id: { in: aged.map((c) => c.id) } },
      data: { isAged: true, status: "AGED" },
    });

    const sequences = await prisma.sequence.findMany({
      where: { agencyId: agency.id, isActive: true, triggerType: "AGED_LEAD" },
    });
    for (const c of aged) {
      for (const seq of sequences) {
        await enrollContact(seq.id, c.id);
      }
      await prisma.notification.create({
        data: {
          agencyId: agency.id,
          userId: c.ownerId,
          contactId: c.id,
          category: "REMINDER",
          type: "AGED_LEAD",
          title: `Aged recruiting lead: ${c.firstName} ${c.lastName}`,
          body: "No contact in a while — placed into the revival workflow.",
          link: `/contacts/${c.id}`,
        },
      });
      count++;
    }
  }
  return count;
}

/**
 * Tag leads by inactivity tier (30/60/90+ days) so the UI and segments stay current.
 * Returns the number of leads whose tier tag changed.
 */
export async function applyAgingTiers(agencyId?: string): Promise<number> {
  const TIER_TAGS = ["aging-30", "aging-60", "aging-90"];
  const contacts = await prisma.contact.findMany({
    where: { doNotContact: false, ...(agencyId ? { agencyId } : {}) },
    select: { id: true, tags: true, lastContactedAt: true, createdAt: true },
  });
  let changed = 0;
  for (const c of contacts) {
    const since = c.lastContactedAt ?? c.createdAt;
    const days = Math.floor((Date.now() - new Date(since).getTime()) / DAY_MS);
    const tier = days >= 90 ? "aging-90" : days >= 60 ? "aging-60" : days >= 30 ? "aging-30" : null;
    const kept = c.tags.filter((t) => !TIER_TAGS.includes(t));
    const next = tier ? [...kept, tier] : kept;
    if (next.length !== c.tags.length || (tier && !c.tags.includes(tier))) {
      await prisma.contact.update({ where: { id: c.id }, data: { tags: next } });
      changed++;
    }
  }
  return changed;
}

function monthDayMatches(date: Date | null, target: Date): boolean {
  if (!date) return false;
  // Calendar dates (birthday/anniversary/renewal) are stored as UTC midnight of the
  // entered day, so compare on UTC components to stay timezone-stable.
  const d = new Date(date);
  return d.getUTCMonth() === target.getUTCMonth() && d.getUTCDate() === target.getUTCDate();
}

/** Enroll contacts into recurring date-based sequences (birthday / anniversary). */
async function processDateTriggers(triggerType: "BIRTHDAY" | "ANNIVERSARY", agencyId?: string): Promise<number> {
  const sequences = await prisma.sequence.findMany({
    where: { isActive: true, triggerType, ...(agencyId ? { agencyId } : {}) },
    include: { steps: true },
  });
  let count = 0;
  for (const seq of sequences) {
    const cfg = (seq.triggerConfig as { daysBefore?: number } | null) ?? {};
    const daysBefore = cfg.daysBefore ?? 0;
    const target = new Date(Date.now() + daysBefore * DAY_MS);
    const contacts = await prisma.contact.findMany({
      where: { agencyId: seq.agencyId, doNotContact: false },
      select: { id: true, dateOfBirth: true, anniversary: true },
    });
    for (const c of contacts) {
      const field = triggerType === "BIRTHDAY" ? c.dateOfBirth : c.anniversary;
      if (monthDayMatches(field, target)) {
        const r = await enrollContact(seq.id, c.id, { reArm: true });
        if (r.enrolled) count++;
      }
    }
  }
  return count;
}

/** Enroll policy-holders into RENEWAL sequences ahead of their renewal date. */
async function processRenewalTriggers(agencyId?: string): Promise<number> {
  const sequences = await prisma.sequence.findMany({
    where: { isActive: true, triggerType: "RENEWAL", ...(agencyId ? { agencyId } : {}) },
  });
  let count = 0;
  for (const seq of sequences) {
    const cfg = (seq.triggerConfig as { daysBefore?: number } | null) ?? {};
    const daysBefore = cfg.daysBefore ?? 14;
    const target = new Date(Date.now() + daysBefore * DAY_MS);
    const policies = await prisma.policy.findMany({
      where: { agencyId: seq.agencyId, renewalDate: { not: null }, status: "ACTIVE" },
      select: { contactId: true, renewalDate: true },
    });
    for (const p of policies) {
      if (monthDayMatches(p.renewalDate, target)) {
        const r = await enrollContact(seq.id, p.contactId, { reArm: true });
        if (r.enrolled) count++;
      }
    }
  }
  return count;
}

/**
 * Trigger sequences in response to a contact lifecycle event (called by the API
 * layer on create / status change / policy sold).
 */
export async function triggerSequencesForContact(
  contactId: string,
  triggerType: "CONTACT_CREATED" | "STATUS_CHANGE" | "POLICY_SOLD"
): Promise<void> {
  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact) return;
  const audienceMatch =
    contact.type === "RECRUIT" ? ["RECRUIT", "BOTH"] : ["CLIENT", "BOTH"];

  const sequences = await prisma.sequence.findMany({
    where: { agencyId: contact.agencyId, isActive: true, triggerType, audience: { in: audienceMatch } },
  });
  for (const seq of sequences) {
    if (triggerType === "STATUS_CHANGE") {
      const cfg = (seq.triggerConfig as { status?: string } | null) ?? {};
      if (cfg.status && cfg.status !== contact.status) continue;
    }
    await enrollContact(seq.id, contactId);
  }
}

/**
 * Rules-based cross-sell detection. Creates AUTO opportunities (deduped per
 * contact + product) so agencies surface revenue without manual analysis.
 */
export async function detectCrossSells(agencyId?: string): Promise<number> {
  const clients = await prisma.contact.findMany({
    where: { type: "CLIENT", ...(agencyId ? { agencyId } : {}) },
    include: { policies: true, crossSells: true },
  });
  let created = 0;

  for (const c of clients) {
    const owned = new Set(c.policies.filter((p) => p.status === "ACTIVE").map((p) => p.productType));
    const existing = new Set(
      c.crossSells
        .filter((x) => x.source === "AUTO" && ["IDENTIFIED", "PRESENTED", "IN_PROGRESS"].includes(x.status))
        .map((x) => x.productType)
    );
    const suggestions: { productType: string; reason: string }[] = [];

    if (owned.has("TERM_LIFE") && !owned.has("WHOLE_LIFE") && !owned.has("IUL")) {
      suggestions.push({ productType: "IUL", reason: "Holds term life — candidate for permanent coverage with cash value." });
    }
    if ((c.numberOfChildren ?? 0) > 0 && !owned.has("WHOLE_LIFE")) {
      suggestions.push({ productType: "WHOLE_LIFE", reason: "Has children — long-term family protection opportunity." });
    }
    if (c.retirementGoalAge && !owned.has("ANNUITY")) {
      suggestions.push({ productType: "ANNUITY", reason: `Retirement goal set (age ${c.retirementGoalAge}) — retirement income gap.` });
    }
    if (c.numberOfChildren && c.numberOfChildren > 0 && !owned.has("MORTGAGE_PROTECTION") && c.state) {
      suggestions.push({ productType: "MORTGAGE_PROTECTION", reason: "Family with dependents — mortgage protection gap." });
    }

    for (const s of suggestions) {
      if (existing.has(s.productType)) continue;
      await prisma.crossSell.create({
        data: {
          agencyId: c.agencyId,
          contactId: c.id,
          productType: s.productType,
          reason: s.reason,
          status: "IDENTIFIED",
          source: "AUTO",
        },
      });
      created++;
    }
  }
  return created;
}

/** One full pass of the automation engine. Pass an agencyId to scope detection to a single tenant. */
export async function runAutomationCycle(agencyId?: string): Promise<Record<string, number>> {
  const aged = await processAgedLeads(agencyId);
  const birthdays = await processDateTriggers("BIRTHDAY", agencyId);
  const anniversaries = await processDateTriggers("ANNIVERSARY", agencyId);
  const renewals = await processRenewalTriggers(agencyId);
  const crossSells = await detectCrossSells(agencyId);
  const stepped = await processDueEnrollments();
  const messages = await processScheduledMessages();
  const aging = await applyAgingTiers(agencyId);
  return { aged, birthdays, anniversaries, renewals, crossSells, stepped, messages, aging };
}
