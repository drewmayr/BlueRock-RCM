import { format } from "date-fns";

export interface TemplateContext {
  contact?: {
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    phone?: string | null;
    dateOfBirth?: Date | null;
    anniversary?: Date | null;
    spouseName?: string | null;
    city?: string | null;
    state?: string | null;
  } | null;
  agent?: {
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  agency?: {
    name?: string | null;
  } | null;
  policy?: {
    productType?: string | null;
    carrier?: string | null;
    renewalDate?: Date | null;
  } | null;
  extra?: Record<string, string>;
}

function fmtDate(d?: Date | null): string {
  return d ? format(new Date(d), "MMMM d") : "";
}

/**
 * Replace {{variable}} tokens in a template with values from the context.
 * Unknown tokens are left blank. Supported tokens are documented in the UI.
 */
export function renderTemplate(template: string, ctx: TemplateContext): string {
  const c = ctx.contact ?? {};
  const a = ctx.agent ?? {};
  const ag = ctx.agency ?? {};
  const p = ctx.policy ?? {};

  const vars: Record<string, string> = {
    firstName: c.firstName ?? "there",
    lastName: c.lastName ?? "",
    fullName: [c.firstName, c.lastName].filter(Boolean).join(" "),
    email: c.email ?? "",
    phone: c.phone ?? "",
    city: c.city ?? "",
    state: c.state ?? "",
    spouseName: c.spouseName ?? "",
    birthday: fmtDate(c.dateOfBirth),
    anniversary: fmtDate(c.anniversary),
    agentName: [a.firstName, a.lastName].filter(Boolean).join(" ") || (ag.name ?? "Your agent"),
    agentFirstName: a.firstName ?? "",
    agentEmail: a.email ?? "",
    agentPhone: a.phone ?? "",
    agencyName: ag.name ?? "our agency",
    productType: (p.productType ?? "").replace(/_/g, " ").toLowerCase(),
    carrier: p.carrier ?? "",
    renewalDate: fmtDate(p.renewalDate),
    ...(ctx.extra ?? {}),
  };

  return template.replace(/\{\{\s*([\w]+)\s*\}\}/g, (_match, key: string) => {
    return key in vars ? vars[key] : "";
  });
}

/** List of tokens advertised to users in the sequence editor. */
export const AVAILABLE_TOKENS = [
  "firstName",
  "lastName",
  "fullName",
  "spouseName",
  "birthday",
  "anniversary",
  "city",
  "state",
  "agentName",
  "agentFirstName",
  "agentEmail",
  "agentPhone",
  "agencyName",
  "productType",
  "carrier",
  "renewalDate",
];
