/**
 * Seed an initial agency + owner login so a fresh deploy is usable immediately.
 * No fake contacts/policies are created — only the owner account and the real,
 * ready-to-run automation templates. Override via env:
 *   SEED_AGENCY, SEED_EMAIL, SEED_PASSWORD, SEED_FIRST_NAME, SEED_LAST_NAME
 *
 * Idempotent: running it again will not duplicate the owner.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_SEQUENCES } from "../src/services/defaults";

const prisma = new PrismaClient();

async function main() {
  const agencyName = process.env.SEED_AGENCY ?? "BlueRock Insurance Group";
  const email = (process.env.SEED_EMAIL ?? "owner@bluerockrcm.com").toLowerCase();
  const password = process.env.SEED_PASSWORD ?? "BlueRock123!";
  const firstName = process.env.SEED_FIRST_NAME ?? "Agency";
  const lastName = process.env.SEED_LAST_NAME ?? "Owner";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`[seed] owner ${email} already exists — nothing to do`);
    return;
  }

  const agency = await prisma.agency.create({ data: { name: agencyName } });
  await prisma.user.create({
    data: {
      agencyId: agency.id,
      email,
      passwordHash: await bcrypt.hash(password, 10),
      firstName,
      lastName,
      role: "OWNER",
    },
  });

  for (const def of DEFAULT_SEQUENCES) {
    await prisma.sequence.create({
      data: {
        agencyId: agency.id,
        name: def.name,
        description: def.description,
        audience: def.audience,
        triggerType: def.triggerType,
        triggerConfig: def.triggerConfig ?? undefined,
        isActive: true,
        steps: {
          create: def.steps.map((s) => ({
            order: s.order,
            channel: s.channel,
            delayDays: s.delayDays ?? 0,
            delayHours: s.delayHours ?? 0,
            subject: s.subject ?? null,
            body: s.body,
            taskTitle: s.taskTitle ?? null,
          })),
        },
      },
    });
  }

  console.log("[seed] created agency + owner + default automations");
  console.log(`[seed]   Agency:   ${agencyName}`);
  console.log(`[seed]   Login:    ${email}`);
  console.log(`[seed]   Password: ${password}`);
  console.log("[seed]   (change the password after first login)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
