import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { notFound, conflict, badRequest } from "../lib/errors";
import { requireAuth, requireRole } from "../middleware/auth";
import { hashPassword } from "../lib/password";

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
  role: z.enum(["OWNER", "MANAGER", "AGENT"]).optional(),
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
  role: z.enum(["OWNER", "MANAGER", "AGENT"]).optional(),
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

export default router;
