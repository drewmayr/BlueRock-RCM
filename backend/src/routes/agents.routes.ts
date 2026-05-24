import { Router } from "express";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { notFound, conflict, badRequest } from "../lib/errors";
import { requireAuth, requireRole } from "../middleware/auth";
import { hashPassword } from "../lib/password";
import { env } from "../config/env";
import { sendTransactionalEmail } from "../services/messaging";
import { logActivity } from "../lib/activity";

const ROLE_VALUES = ["OWNER", "MANAGER", "AGENT", "RECRUITER", "ASSISTANT", "SUPPORT", "TRAINER"] as const;

const router = Router();
router.use(requireAuth);

function publicUser(u: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: string;
  isActive: boolean;
  lastLoginAt: Date | null;
}) {
  return {
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    phone: u.phone,
    role: u.role,
    isActive: u.isActive,
    lastLoginAt: u.lastLoginAt,
  };
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const users = await prisma.user.findMany({
      where: { agencyId: req.auth!.agencyId },
      orderBy: { createdAt: "asc" },
    });
    res.json(users.map(publicUser));
  })
);

const createSchema = z.object({
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(200),
  phone: z.string().max(40).optional().nullable(),
  role: z.enum(ROLE_VALUES).optional(),
});

router.post(
  "/",
  requireRole("OWNER", "MANAGER"),
  asyncHandler(async (req, res) => {
    const data = createSchema.parse(req.body);
    const email = data.email.toLowerCase().trim();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw conflict("A user with that email already exists");

    // Managers cannot create owners.
    let role = data.role ?? "AGENT";
    if (req.auth!.role === "MANAGER" && role === "OWNER") role = "MANAGER";

    const user = await prisma.user.create({
      data: {
        agencyId: req.auth!.agencyId,
        email,
        passwordHash: await hashPassword(data.password),
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone ?? null,
        role,
      },
    });
    res.status(201).json(publicUser(user));
  })
);

const updateSchema = z.object({
  firstName: z.string().min(1).max(80).optional(),
  lastName: z.string().min(1).max(80).optional(),
  phone: z.string().max(40).optional().nullable(),
  role: z.enum(ROLE_VALUES).optional(),
  isActive: z.boolean().optional(),
});

router.patch(
  "/:id",
  requireRole("OWNER", "MANAGER"),
  asyncHandler(async (req, res) => {
    const agencyId = req.auth!.agencyId;
    const target = await prisma.user.findFirst({ where: { id: req.params.id, agencyId } });
    if (!target) throw notFound("User not found");
    const data = updateSchema.parse(req.body);

    if (req.auth!.role === "MANAGER" && (data.role === "OWNER" || target.role === "OWNER")) {
      throw badRequest("Managers cannot modify owner accounts");
    }
    // Prevent removing the last active owner.
    if ((data.role && data.role !== "OWNER") || data.isActive === false) {
      if (target.role === "OWNER") {
        const owners = await prisma.user.count({ where: { agencyId, role: "OWNER", isActive: true } });
        if (owners <= 1) throw badRequest("You cannot demote or deactivate the last active owner");
      }
    }

    const user = await prisma.user.update({ where: { id: target.id }, data });
    res.json(publicUser(user));
  })
);

const passwordSchema = z.object({ password: z.string().min(8).max(200) });
router.post(
  "/:id/reset-password",
  requireRole("OWNER", "MANAGER"),
  asyncHandler(async (req, res) => {
    const agencyId = req.auth!.agencyId;
    const target = await prisma.user.findFirst({ where: { id: req.params.id, agencyId } });
    if (!target) throw notFound("User not found");
    if (req.auth!.role === "MANAGER" && target.role === "OWNER") {
      throw badRequest("Managers cannot reset an owner's password");
    }
    const { password } = passwordSchema.parse(req.body);
    await prisma.user.update({ where: { id: target.id }, data: { passwordHash: await hashPassword(password) } });
    res.json({ ok: true });
  })
);

// ============================================================
// Team invitations (email invite + signup link)
// ============================================================

function inviteLink(token: string) {
  return `${env.frontendUrl}/invite/${token}`;
}

async function sendInviteEmail(agencyId: string, agencyName: string, inviterName: string, to: string, role: string, link: string) {
  const subject = `You're invited to join ${agencyName} on BlueRock RCM`;
  const body = `Hi,

${inviterName} has invited you to join ${agencyName} on BlueRock RCM as a ${role.toLowerCase()}.

Accept your invitation and set your password here:
${link}

This link expires in 7 days.

— BlueRock RCM`;
  return sendTransactionalEmail(agencyId, to, subject, body);
}

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(ROLE_VALUES),
  firstName: z.string().max(80).optional(),
  lastName: z.string().max(80).optional(),
});

// Create + send an invitation.
router.post(
  "/invite",
  requireRole("OWNER", "MANAGER"),
  asyncHandler(async (req, res) => {
    const agencyId = req.auth!.agencyId;
    const data = inviteSchema.parse(req.body);
    const email = data.email.toLowerCase().trim();

    if (req.auth!.role === "MANAGER" && data.role === "OWNER") {
      throw badRequest("Managers cannot invite owners");
    }
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) throw conflict("Someone with that email is already on your team");

    // Replace any prior pending invite for this email in this agency.
    await prisma.invitation.deleteMany({ where: { agencyId, email, status: "PENDING" } });

    const token = crypto.randomBytes(24).toString("hex");
    const invite = await prisma.invitation.create({
      data: {
        agencyId,
        email,
        firstName: data.firstName ?? null,
        lastName: data.lastName ?? null,
        role: data.role,
        token,
        invitedById: req.auth!.userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const link = inviteLink(token);
    const inviter = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
    const delivery = await sendInviteEmail(
      agencyId,
      (await prisma.agency.findUnique({ where: { id: agencyId } }))!.name,
      inviter ? `${inviter.firstName} ${inviter.lastName}` : "Your agency",
      email,
      data.role,
      link
    );

    await logActivity({ agencyId, userId: req.auth!.userId, type: "MEMBER_INVITED", description: `Invited ${email} as ${data.role}` });

    // Always return the link so the owner can share it manually if email isn't configured.
    res.status(201).json({
      invitation: { id: invite.id, email: invite.email, role: invite.role, status: invite.status, expiresAt: invite.expiresAt },
      inviteLink: link,
      emailSent: delivery.ok,
      emailError: delivery.ok ? null : delivery.error,
    });
  })
);

// List pending invitations.
router.get(
  "/invites",
  requireRole("OWNER", "MANAGER"),
  asyncHandler(async (req, res) => {
    const invites = await prisma.invitation.findMany({
      where: { agencyId: req.auth!.agencyId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
    });
    res.json(
      invites.map((i) => ({
        id: i.id,
        email: i.email,
        role: i.role,
        status: i.status,
        expiresAt: i.expiresAt,
        createdAt: i.createdAt,
        inviteLink: inviteLink(i.token),
      }))
    );
  })
);

// Resend an invitation email.
router.post(
  "/invites/:id/resend",
  requireRole("OWNER", "MANAGER"),
  asyncHandler(async (req, res) => {
    const agencyId = req.auth!.agencyId;
    const invite = await prisma.invitation.findFirst({ where: { id: req.params.id, agencyId, status: "PENDING" } });
    if (!invite) throw notFound("Invitation not found");
    const agency = await prisma.agency.findUnique({ where: { id: agencyId } });
    const inviter = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
    const link = inviteLink(invite.token);
    const delivery = await sendInviteEmail(agencyId, agency!.name, inviter ? `${inviter.firstName} ${inviter.lastName}` : "Your agency", invite.email, invite.role, link);
    res.json({ inviteLink: link, emailSent: delivery.ok, emailError: delivery.ok ? null : delivery.error });
  })
);

// Revoke an invitation.
router.post(
  "/invites/:id/revoke",
  requireRole("OWNER", "MANAGER"),
  asyncHandler(async (req, res) => {
    const agencyId = req.auth!.agencyId;
    const invite = await prisma.invitation.findFirst({ where: { id: req.params.id, agencyId } });
    if (!invite) throw notFound("Invitation not found");
    await prisma.invitation.update({ where: { id: invite.id }, data: { status: "REVOKED" } });
    res.json({ ok: true });
  })
);

export default router;
