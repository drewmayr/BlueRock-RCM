import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { requireAuth } from "../middleware/auth";
import { logActivity } from "../lib/activity";
import { isValidStatus, defaultStatusFor, agingTier, LeadType } from "../shared/pipeline";
import { triggerSequencesForContact } from "../services/automation";

const router = Router();
router.use(requireAuth);

const OPEN_CROSS = ["IDENTIFIED", "PRESENTED", "IN_PROGRESS"];

function segmentWhere(segment?: string): Prisma.ContactWhereInput {
  switch (segment) {
    case "AGED":
      return { isAged: true };
    case "SOLD_POLICY":
      return { policies: { some: { status: "ACTIVE" } } };
    case "CROSS_SELL":
      return { crossSells: { some: { status: { in: OPEN_CROSS } } } };
    default:
      return {};
  }
}

/** Unified leads list across all types, with derived segments + aging tier. */
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const agencyId = req.auth!.agencyId;
    const { type, segment, status, owner, q } = req.query as Record<string, string>;
    const page = Math.max(1, parseInt((req.query.page as string) ?? "1", 10));
    const pageSize = Math.min(200, Math.max(1, parseInt((req.query.pageSize as string) ?? "50", 10)));

    const where: Prisma.ContactWhereInput = { agencyId, ...segmentWhere(segment) };
    if (type && ["RECRUIT", "CLIENT", "REFERRAL"].includes(type)) where.type = type as LeadType;
    if (status) where.status = status;
    if (owner) where.ownerId = owner;
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
          _count: { select: { policies: true } },
          policies: { where: { status: "ACTIVE" }, select: { id: true }, take: 1 },
          crossSells: { where: { status: { in: OPEN_CROSS } }, select: { id: true }, take: 1 },
        },
      }),
    ]);

    const now = Date.now();
    const leads = items.map((c) => {
      const since = c.lastContactedAt ?? c.createdAt;
      const days = Math.floor((now - new Date(since).getTime()) / 86400000);
      const { policies, crossSells, ...rest } = c;
      return {
        ...rest,
        agingTier: agingTier(days),
        daysSinceContact: days,
        hasActivePolicy: policies.length > 0,
        hasOpenCrossSell: crossSells.length > 0,
      };
    });

    res.json({ items: leads, total, page, pageSize, pages: Math.ceil(total / pageSize) });
  })
);

const CSV_COLUMNS = [
  "type", "firstName", "lastName", "email", "phone", "state", "city",
  "dateOfBirth", "anniversary", "source", "status", "tags", "notes",
  "lastContactedAt", "followUpDate", "owner",
] as const;

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s = v instanceof Date ? v.toISOString().slice(0, 10) : String(v);
  if (Array.isArray(v)) s = v.join("|");
  if (/[",\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Export all leads (optionally filtered by type) as CSV. */
router.get(
  "/export",
  asyncHandler(async (req, res) => {
    const agencyId = req.auth!.agencyId;
    const where: Prisma.ContactWhereInput = { agencyId };
    const { type } = req.query as Record<string, string>;
    if (type && ["RECRUIT", "CLIENT", "REFERRAL"].includes(type)) where.type = type as LeadType;

    const contacts = await prisma.contact.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { owner: { select: { firstName: true, lastName: true } } },
    });

    const header = CSV_COLUMNS.join(",");
    const rows = contacts.map((c) =>
      CSV_COLUMNS.map((col) => {
        if (col === "tags") return csvCell(c.tags);
        if (col === "owner") return csvCell(c.owner ? `${c.owner.firstName} ${c.owner.lastName}` : "");
        return csvCell((c as Record<string, unknown>)[col]);
      }).join(",")
    );
    const csv = [header, ...rows].join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="bluerock-leads-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  })
);

// ---- Import ----

const importRow = z.object({
  type: z.enum(["RECRUIT", "CLIENT", "REFERRAL"]).optional(),
  firstName: z.string().max(80).optional(),
  lastName: z.string().max(80).optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  state: z.string().optional(),
  city: z.string().optional(),
  dateOfBirth: z.string().optional(),
  anniversary: z.string().optional(),
  source: z.string().optional(),
  status: z.string().optional(),
  tags: z.union([z.string(), z.array(z.string())]).optional(),
  notes: z.string().optional(),
  lastContactedAt: z.string().optional(),
  followUpDate: z.string().optional(),
  assignedTo: z.string().optional(), // owner email or name
});

const importSchema = z.object({
  rows: z.array(importRow).max(5000),
  mode: z.enum(["skip", "update"]).default("skip"),
  defaultType: z.enum(["RECRUIT", "CLIENT", "REFERRAL"]).default("CLIENT"),
  preview: z.boolean().optional(),
});

function parseDate(s?: string): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}
function parseTags(t?: string | string[]): string[] {
  if (!t) return [];
  if (Array.isArray(t)) return t.filter(Boolean);
  return t.split(/[|,;]/).map((x) => x.trim()).filter(Boolean);
}

router.post(
  "/import",
  asyncHandler(async (req, res) => {
    const agencyId = req.auth!.agencyId;
    const { rows, mode, defaultType, preview } = importSchema.parse(req.body);

    // Resolve owner names/emails to user ids once.
    const users = await prisma.user.findMany({ where: { agencyId }, select: { id: true, email: true, firstName: true, lastName: true } });
    const resolveOwner = (val?: string): string | null => {
      if (!val) return null;
      const v = val.toLowerCase().trim();
      const u = users.find(
        (u) => u.email.toLowerCase() === v || `${u.firstName} ${u.lastName}`.toLowerCase() === v
      );
      return u?.id ?? null;
    };

    let created = 0, updated = 0, skipped = 0;
    const errors: { row: number; message: string }[] = [];
    const results: { row: number; action: string; name: string; reason?: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const name = [r.firstName, r.lastName].filter(Boolean).join(" ").trim();
      if (!r.firstName && !r.lastName) {
        errors.push({ row: i + 1, message: "Missing name" });
        results.push({ row: i + 1, action: "error", name: name || "(blank)", reason: "Missing name" });
        continue;
      }
      const type = (r.type ?? defaultType) as LeadType;
      const email = r.email?.toLowerCase().trim() || null;
      const phone = r.phone?.trim() || null;

      // Duplicate detection by email or phone within the agency.
      const dupe = email || phone
        ? await prisma.contact.findFirst({
            where: { agencyId, OR: [...(email ? [{ email }] : []), ...(phone ? [{ phone }] : [])] },
            select: { id: true },
          })
        : null;

      const status = r.status && isValidStatus(type, r.status) ? r.status : defaultStatusFor(type);
      const data = {
        type,
        status,
        firstName: r.firstName || "(unknown)",
        lastName: r.lastName || "",
        email,
        phone,
        state: r.state || null,
        city: r.city || null,
        dateOfBirth: parseDate(r.dateOfBirth),
        anniversary: parseDate(r.anniversary),
        source: r.source || null,
        tags: parseTags(r.tags),
        notes: r.notes || null,
        lastContactedAt: parseDate(r.lastContactedAt),
        followUpDate: parseDate(r.followUpDate),
        ownerId: resolveOwner(r.assignedTo) ?? req.auth!.userId,
      };

      if (dupe) {
        if (mode === "update") {
          if (!preview) await prisma.contact.update({ where: { id: dupe.id }, data });
          updated++;
          results.push({ row: i + 1, action: "update", name });
        } else {
          skipped++;
          results.push({ row: i + 1, action: "skip", name, reason: "Duplicate" });
        }
        continue;
      }

      if (!preview) {
        const c = await prisma.contact.create({ data: { agencyId, ...data } });
        await triggerSequencesForContact(c.id, "CONTACT_CREATED").catch(() => {});
      }
      created++;
      results.push({ row: i + 1, action: "create", name });
    }

    if (!preview) {
      await logActivity({
        agencyId,
        userId: req.auth!.userId,
        type: "LEADS_IMPORTED",
        description: `Imported leads: ${created} created, ${updated} updated, ${skipped} skipped`,
      });
    }

    res.json({ created, updated, skipped, errors, results, preview: !!preview, total: rows.length });
  })
);

export default router;
