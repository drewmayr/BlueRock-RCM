import { prisma } from "./prisma";

interface LogActivityInput {
  agencyId: string;
  userId?: string | null;
  contactId?: string | null;
  type: string;
  description: string;
  metadata?: Record<string, unknown>;
}

/** Write an entry to the activity timeline. Failures are swallowed (logging must never break a request). */
export async function logActivity(input: LogActivityInput): Promise<void> {
  try {
    await prisma.activity.create({
      data: {
        agencyId: input.agencyId,
        userId: input.userId ?? null,
        contactId: input.contactId ?? null,
        type: input.type,
        description: input.description,
        metadata: (input.metadata as object) ?? undefined,
      },
    });
  } catch (err) {
    console.error("[activity] failed to log", err);
  }
}
