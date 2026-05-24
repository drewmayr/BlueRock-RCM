import twilio from "twilio";
import { Resend } from "resend";
import type { Agency } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { env } from "../config/env";

/**
 * Resolve effective messaging credentials for an agency: per-agency overrides
 * fall back to server-wide environment defaults.
 */
export function resolveProviderConfig(agency: Pick<
  Agency,
  | "twilioAccountSid"
  | "twilioAuthToken"
  | "twilioFromNumber"
  | "resendApiKey"
  | "emailFromAddress"
  | "emailFromName"
>) {
  return {
    twilio: {
      accountSid: agency.twilioAccountSid || env.twilio.accountSid,
      authToken: agency.twilioAuthToken || env.twilio.authToken,
      fromNumber: agency.twilioFromNumber || env.twilio.fromNumber,
    },
    resend: {
      apiKey: agency.resendApiKey || env.resend.apiKey,
      fromAddress: agency.emailFromAddress || env.resend.fromAddress,
      fromName: agency.emailFromName || env.resend.fromName,
    },
  };
}

export interface ProviderStatus {
  sms: { configured: boolean; from: string | null };
  email: { configured: boolean; from: string | null };
}

export function providerStatus(agency: Parameters<typeof resolveProviderConfig>[0]): ProviderStatus {
  const cfg = resolveProviderConfig(agency);
  return {
    sms: {
      configured: Boolean(cfg.twilio.accountSid && cfg.twilio.authToken && cfg.twilio.fromNumber),
      from: cfg.twilio.fromNumber || null,
    },
    email: {
      configured: Boolean(cfg.resend.apiKey && cfg.resend.fromAddress),
      from: cfg.resend.fromAddress || null,
    },
  };
}

export interface SendResult {
  ok: boolean;
  providerId?: string;
  error?: string;
  /** true when the message could not be sent because no provider is configured (not a hard failure). */
  notConfigured?: boolean;
}

async function sendSms(
  cfg: ReturnType<typeof resolveProviderConfig>["twilio"],
  to: string,
  body: string
): Promise<SendResult> {
  if (!cfg.accountSid || !cfg.authToken || !cfg.fromNumber) {
    return { ok: false, notConfigured: true, error: "SMS provider (Twilio) is not configured" };
  }
  try {
    const client = twilio(cfg.accountSid, cfg.authToken);
    const msg = await client.messages.create({ to, from: cfg.fromNumber, body });
    return { ok: true, providerId: msg.sid };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function sendEmail(
  cfg: ReturnType<typeof resolveProviderConfig>["resend"],
  to: string,
  subject: string,
  body: string
): Promise<SendResult> {
  if (!cfg.apiKey || !cfg.fromAddress) {
    return { ok: false, notConfigured: true, error: "Email provider (Resend) is not configured" };
  }
  try {
    const resend = new Resend(cfg.apiKey);
    const from = cfg.fromName ? `${cfg.fromName} <${cfg.fromAddress}>` : cfg.fromAddress;
    const html = body
      .split("\n")
      .map((line) => (line.trim() === "" ? "<br/>" : `<p>${escapeHtml(line)}</p>`))
      .join("\n");
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject: subject || "(no subject)",
      text: body,
      html,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, providerId: data?.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Attempt to deliver a single outbox message and persist the outcome.
 * - Sends via the appropriate provider when configured.
 * - When no provider is configured, the message is parked as QUEUED (ready to send
 *   the instant credentials are added) — never silently faked.
 */
export async function dispatchMessage(messageId: string): Promise<SendResult> {
  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message) return { ok: false, error: "Message not found" };
  if (message.status === "SENT" || message.status === "SENDING") {
    return { ok: true, providerId: message.providerId ?? undefined };
  }

  const agency = await prisma.agency.findUnique({ where: { id: message.agencyId } });
  if (!agency) return { ok: false, error: "Agency not found" };
  const cfg = resolveProviderConfig(agency);

  if (!message.toAddress) {
    await prisma.message.update({
      where: { id: message.id },
      data: { status: "FAILED", error: "No recipient address on contact" },
    });
    return { ok: false, error: "No recipient address" };
  }

  await prisma.message.update({ where: { id: message.id }, data: { status: "SENDING" } });

  let result: SendResult;
  let fromAddress: string;
  if (message.channel === "SMS") {
    fromAddress = cfg.twilio.fromNumber;
    result = await sendSms(cfg.twilio, message.toAddress, message.body);
  } else {
    fromAddress = cfg.resend.fromAddress;
    result = await sendEmail(cfg.resend, message.toAddress, message.subject ?? "", message.body);
  }

  if (result.ok) {
    await prisma.message.update({
      where: { id: message.id },
      data: {
        status: "SENT",
        sentAt: new Date(),
        providerId: result.providerId,
        fromAddress,
        error: null,
      },
    });
  } else if (result.notConfigured) {
    await prisma.message.update({
      where: { id: message.id },
      data: { status: "QUEUED", error: result.error },
    });
  } else {
    await prisma.message.update({
      where: { id: message.id },
      data: { status: "FAILED", error: result.error },
    });
  }

  return result;
}
