import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";

interface StepDef {
  order: number;
  channel: "SMS" | "EMAIL" | "TASK";
  delayDays?: number;
  delayHours?: number;
  subject?: string;
  body: string;
  taskTitle?: string;
}

interface SeqDef {
  name: string;
  description: string;
  audience: "RECRUIT" | "CLIENT" | "BOTH";
  triggerType: string;
  triggerConfig?: Record<string, unknown>;
  steps: StepDef[];
}

/** Real, ready-to-run automation templates provisioned for every new agency. */
export const DEFAULT_SEQUENCES: SeqDef[] = [
  {
    name: "Aged Lead Revival",
    description: "Re-engages recruiting leads that have gone quiet and pulls them back into the hiring pipeline.",
    audience: "RECRUIT",
    triggerType: "AGED_LEAD",
    steps: [
      {
        order: 0,
        channel: "SMS",
        delayDays: 0,
        body: "Hi {{firstName}}, it's {{agentName}} with {{agencyName}}. We're growing our team and I immediately thought of you. Are you still open to exploring an opportunity with us?",
      },
      {
        order: 1,
        channel: "EMAIL",
        delayDays: 2,
        subject: "Still interested in joining {{agencyName}}?",
        body: "Hi {{firstName}},\n\nI wanted to reconnect. We have new openings on our team and I'd love to share what's changed since we last spoke.\n\nWould you be open to a quick 10-minute call this week?\n\nBest,\n{{agentName}}\n{{agencyName}}\n{{agentPhone}}",
      },
      {
        order: 2,
        channel: "TASK",
        delayDays: 5,
        taskTitle: "Call {{fullName}} — aged lead revival",
        body: "No response to revival sequence yet. Give {{firstName}} a personal call to re-engage.",
      },
    ],
  },
  {
    name: "New Recruit Welcome",
    description: "Warm welcome and next steps the moment a new recruiting lead is added.",
    audience: "RECRUIT",
    triggerType: "CONTACT_CREATED",
    steps: [
      {
        order: 0,
        channel: "SMS",
        delayDays: 0,
        body: "Hi {{firstName}}! Thanks for your interest in joining {{agencyName}}. This is {{agentName}} — I'll be reaching out shortly with next steps. Welcome aboard!",
      },
      {
        order: 1,
        channel: "EMAIL",
        delayDays: 1,
        subject: "Welcome to the {{agencyName}} recruiting process",
        body: "Hi {{firstName}},\n\nGreat connecting with you! Here's what happens next in our process. I'll schedule a short intro call so you can learn about the role, our training, and the income opportunity.\n\nTalk soon,\n{{agentName}}",
      },
    ],
  },
  {
    name: "New Client Onboarding",
    description: "Builds the relationship right after a policy is sold — sets expectations and invites referrals.",
    audience: "CLIENT",
    triggerType: "POLICY_SOLD",
    steps: [
      {
        order: 0,
        channel: "EMAIL",
        delayDays: 0,
        subject: "Welcome to {{agencyName}} — your coverage is in place",
        body: "Hi {{firstName}},\n\nCongratulations and thank you for trusting {{agencyName}} with your {{productType}} coverage. I'm here for you any time something changes in your life.\n\nKeep my number handy: {{agentPhone}}.\n\nWarmly,\n{{agentName}}",
      },
      {
        order: 1,
        channel: "SMS",
        delayDays: 3,
        body: "Hi {{firstName}}, just checking in to make sure you received your policy documents and have no questions. — {{agentName}}",
      },
      {
        order: 2,
        channel: "TASK",
        delayDays: 30,
        taskTitle: "30-day check-in call with {{fullName}}",
        body: "Call {{firstName}} for a relationship check-in and to confirm everything is going well with their new policy.",
      },
    ],
  },
  {
    name: "Birthday Outreach",
    description: "Automatically wishes clients a happy birthday to keep the relationship warm.",
    audience: "CLIENT",
    triggerType: "BIRTHDAY",
    triggerConfig: { daysBefore: 0 },
    steps: [
      {
        order: 0,
        channel: "SMS",
        delayDays: 0,
        body: "Happy birthday, {{firstName}}! 🎉 Wishing you a wonderful year ahead. — {{agentName}}, {{agencyName}}",
      },
    ],
  },
  {
    name: "Policy Renewal Reminder",
    description: "Reaches out ahead of a policy renewal date to retain the client and review coverage.",
    audience: "CLIENT",
    triggerType: "RENEWAL",
    triggerConfig: { daysBefore: 14 },
    steps: [
      {
        order: 0,
        channel: "EMAIL",
        delayDays: 0,
        subject: "Your {{productType}} policy renewal is coming up",
        body: "Hi {{firstName}},\n\nYour policy renews on {{renewalDate}}. Let's do a quick review to make sure your coverage still fits your life. Any changes — new home, new baby, income change — are worth a conversation.\n\nReply any time,\n{{agentName}}",
      },
      {
        order: 1,
        channel: "TASK",
        delayDays: 0,
        taskTitle: "Schedule renewal review with {{fullName}}",
        body: "Reach out to {{firstName}} to schedule a coverage review before {{renewalDate}}.",
      },
    ],
  },
  {
    name: "Referral Request",
    description: "Asks happy clients for referrals — launch this manually after a positive interaction.",
    audience: "CLIENT",
    triggerType: "MANUAL",
    steps: [
      {
        order: 0,
        channel: "SMS",
        delayDays: 0,
        body: "Hi {{firstName}}, it's been great working with you! If you know anyone — family, friends, coworkers — who could use help protecting their family, I'd be grateful for an introduction. — {{agentName}}",
      },
      {
        order: 1,
        channel: "EMAIL",
        delayDays: 2,
        subject: "A quick favor, {{firstName}}",
        body: "Hi {{firstName}},\n\nMy business grows through referrals from clients like you. If anyone comes to mind who'd benefit from a coverage review, just reply with their name and I'll take great care of them.\n\nThank you!\n{{agentName}}\n{{agencyName}}",
      },
    ],
  },
];

export async function provisionDefaultSequences(agencyId: string): Promise<void> {
  for (const def of DEFAULT_SEQUENCES) {
    await prisma.sequence.create({
      data: {
        agencyId,
        name: def.name,
        description: def.description,
        audience: def.audience,
        triggerType: def.triggerType,
        triggerConfig: (def.triggerConfig ?? undefined) as Prisma.InputJsonValue | undefined,
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
}
