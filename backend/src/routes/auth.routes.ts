import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { hashPassword, verifyPassword } from "../lib/password";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../lib/jwt";
import { asyncHandler } from "../lib/asyncHandler";
import { badRequest, conflict, unauthorized } from "../lib/errors";
import { requireAuth } from "../middleware/auth";
import { provisionDefaultSequences } from "../services/defaults";
import { logActivity } from "../lib/activity";

const router = Router();

function publicUser(u: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: string;
  agencyId: string;
}) {
  return {
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    phone: u.phone,
    role: u.role,
    agencyId: u.agencyId,
  };
}

const registerSchema = z.object({
  agencyName: z.string().min(2).max(120),
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(200),
  phone: z.string().max(40).optional(),
  timezone: z.string().max(60).optional(),
});

// Register a new agency + owner account.
router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const data = registerSchema.parse(req.body);
    const email = data.email.toLowerCase().trim();

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw conflict("An account with that email already exists");

    const passwordHash = await hashPassword(data.password);

    const { user, agency } = await prisma.$transaction(async (tx) => {
      const agency = await tx.agency.create({
        data: { name: data.agencyName, timezone: data.timezone ?? "America/New_York" },
      });
      const user = await tx.user.create({
        data: {
          agencyId: agency.id,
          email,
          passwordHash,
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone ?? null,
          role: "OWNER",
        },
      });
      return { user, agency };
    });

    // Provision real, ready-to-run automation templates for the new agency.
    await provisionDefaultSequences(agency.id);
    await logActivity({
      agencyId: agency.id,
      userId: user.id,
      type: "AGENCY_CREATED",
      description: `${user.firstName} created agency "${agency.name}"`,
    });

    const payload = { userId: user.id, agencyId: agency.id, role: user.role };
    res.status(201).json({
      accessToken: signAccessToken(payload),
      refreshToken: signRefreshToken(payload),
      user: publicUser(user),
      agency,
    });
  })
);

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const data = loginSchema.parse(req.body);
    const email = data.email.toLowerCase().trim();

    const user = await prisma.user.findUnique({ where: { email }, include: { agency: true } });
    if (!user || !user.isActive) throw unauthorized("Invalid credentials");

    const ok = await verifyPassword(data.password, user.passwordHash);
    if (!ok) throw unauthorized("Invalid credentials");

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const payload = { userId: user.id, agencyId: user.agencyId, role: user.role };
    res.json({
      accessToken: signAccessToken(payload),
      refreshToken: signRefreshToken(payload),
      user: publicUser(user),
      agency: user.agency,
    });
  })
);

const refreshSchema = z.object({ refreshToken: z.string().min(1) });

router.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const { refreshToken } = refreshSchema.parse(req.body);
    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch {
      throw unauthorized("Invalid refresh token");
    }
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user || !user.isActive) throw unauthorized("Account is no longer active");

    const payload = { userId: user.id, agencyId: user.agencyId, role: user.role };
    res.json({
      accessToken: signAccessToken(payload),
      refreshToken: signRefreshToken(payload),
    });
  })
);

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.auth!.userId },
      include: { agency: true },
    });
    if (!user) throw unauthorized();
    res.json({ user: publicUser(user), agency: user.agency });
  })
);

export default router;
