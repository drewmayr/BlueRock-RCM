// Pipeline stages and reference data shared across the backend.
// The frontend mirrors these for display.

// Recruit -> Agent conversion pipeline.
export const RECRUIT_STAGES = [
  "NEW",
  "CONTACTED",
  "INTERESTED",
  "CONTRACT_SENT",
  "LICENSED",
  "APPOINTED",
  "ACTIVE_AGENT",
  "AGED",
  "INACTIVE",
] as const;

// Stages a recruit is considered "done" (no longer actively recruited).
export const RECRUIT_TERMINAL_STAGES = ["ACTIVE_AGENT", "AGED", "INACTIVE"] as const;

export const CLIENT_STAGES = [
  "LEAD",
  "PROSPECT",
  "ACTIVE",
  "RENEWAL_DUE",
  "LAPSED",
  "INACTIVE",
] as const;

export const REFERRAL_STAGES = ["NEW", "CONTACTED", "QUALIFIED", "CONVERTED", "LOST"] as const;

export const PRODUCT_TYPES = [
  "TERM_LIFE",
  "WHOLE_LIFE",
  "IUL",
  "FINAL_EXPENSE",
  "ANNUITY",
  "MORTGAGE_PROTECTION",
  "DISABILITY",
  "LONG_TERM_CARE",
  "HEALTH",
  "OTHER",
] as const;

export const POLICY_STATUSES = ["ACTIVE", "PENDING", "LAPSED", "CANCELLED", "CLAIMED"] as const;

export const REFERRAL_STATUSES = ["NEW", "CONTACTED", "QUALIFIED", "CONVERTED", "LOST"] as const;

export const CROSSSELL_STATUSES = [
  "IDENTIFIED",
  "PRESENTED",
  "IN_PROGRESS",
  "WON",
  "LOST",
] as const;

export const SEQUENCE_TRIGGERS = [
  "MANUAL",
  "AGED_LEAD",
  "CONTACT_CREATED",
  "STATUS_CHANGE",
  "BIRTHDAY",
  "ANNIVERSARY",
  "POLICY_SOLD",
  "RENEWAL",
  "REFERRAL_REQUEST",
] as const;

// Automation action types a workflow step can perform.
export const ACTION_TYPES = ["SMS", "EMAIL", "TASK", "NOTE", "STATUS", "TAG", "NOTIFY"] as const;

// Channels that actually send a message (subset of ACTION_TYPES).
export const CHANNELS = ["SMS", "EMAIL", "TASK"] as const;

export const LEAD_TYPES = ["RECRUIT", "CLIENT", "REFERRAL"] as const;
export type LeadType = (typeof LEAD_TYPES)[number];

// Auto-derived segments surfaced as filters/badges on the Leads page.
export const LEAD_SEGMENTS = ["AGED", "SOLD_POLICY", "CROSS_SELL"] as const;

// Lead-aging tiers (days since last contact / creation).
export const AGING_TIERS = [
  { key: "FRESH", label: "Fresh", maxDays: 30 },
  { key: "WARM", label: "30+ days", maxDays: 60 },
  { key: "COOL", label: "60+ days", maxDays: 90 },
  { key: "COLD", label: "90+ days", maxDays: Infinity },
] as const;

const STAGES_BY_TYPE: Record<LeadType, readonly string[]> = {
  RECRUIT: RECRUIT_STAGES,
  CLIENT: CLIENT_STAGES,
  REFERRAL: REFERRAL_STAGES,
};

export function isValidStatus(type: LeadType, status: string): boolean {
  return (STAGES_BY_TYPE[type] ?? []).includes(status);
}

export function defaultStatusFor(type: LeadType): string {
  if (type === "RECRUIT") return "NEW";
  if (type === "REFERRAL") return "NEW";
  return "LEAD";
}

export function agingTier(days: number): string {
  if (days < 30) return "FRESH";
  if (days < 60) return "WARM";
  if (days < 90) return "COOL";
  return "COLD";
}
