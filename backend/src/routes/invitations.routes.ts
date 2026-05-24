import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { badRequest, notFound, conflict } from "../lib/errors";
import { hashPassword } from "../lib/password";
import { signAccessToken, signRefreshToken } from "../lib/jwt";
import { logActivity } from "../lib/activity";

// PUBLIC routes (no auth) for accepting a team invitation.
const router = Router();

async function loadValidInvite(token: string) {
  const invite = await prisma.invitation.findUnique({
    where: { token },
    include: { agency: { select: { name: true } } },
  });
  if (!invite || invite.status !== "PENDING") return null;
  if (invite.expiresAt < new Date()) return null;
  return invite;
}

// View an invitation (used by the signup-link page).
router.get(
  "/:token",
  asyncHandler(async (req, res) => {
    const invite = await loadValidInvite(req.params.token);
    if (!invite) throw notFound("This invitation is invalid, expired, or already used");
    res.json({
      email: invite.email,
      firstName: invite.firstName,
      lastName: invite.lastName,
      role: invite.role,
      agencyName: invite.agency.name,
    });
  })
);

// Accept an invitation: create the user account and auto-login.
const acceptSchema = z.object({
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  phone: z.string().max(40).optional(),
  password: z.string().min(8).max(200),
});

router.post(
  "/:token/accept",
  asyncHandler(async (req, res) => {
    const data = acceptSchema.parse(req.body);
    const invite = await loadValidInvite(req.params.token);
    if (!invite) throw notFound("This invitation is invalid, expired, or already used");

    const email = invite.email.toLowerCase().trim();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw conflict("An account with this email already exists — please sign in");

    const user = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          agencyId: invite.agencyId,
          email,
          passwordHash: await hashPassword(data.password),
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone ?? null,
          role: invite.role,
        },
      });
      await tx.invitation.update({
        where: { id: invite.id },
        data: { status: "ACCEPTED", acceptedAt: new Date() },
      });
      return u;
    });

    await logActivity({
      agencyId: invite.agencyId,
      userId: user.id,
      type: "MEMBER_JOINED",
      description: `${user.firstName} ${user.lastName} joined as ${user.role}`,
    });

    const agency = await prisma.agency.findUnique({ where: { id: invite.agencyId } });
    const payload = { userId: user.id, agencyId: user.agencyId, role: user.role };
    res.status(201).json({
      accessToken: signAccessToken(payload),
      refreshToken: signRefreshToken(payload),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        role: user.role,
        agencyId: user.agencyId,
      },
      agency,
    });
  })
);

export default router;
