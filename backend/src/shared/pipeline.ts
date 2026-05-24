// Pipeline stages and reference data shared across the backend.
// The frontend mirrors these for display.

export const RECRUIT_STAGES = [
  "NEW",
  "CONTACTED",
  "INTERVIEW_SCHEDULED",
  "INTERVIEWED",
  "ONBOARDING",
  "HIRED",
  "AGED",
  "INACTIVE",
] as const;

export const CLIENT_STAGES = [
  "LEAD",
  "PROSPECT",
  "ACTIVE",
  "RENEWAL_DUE",
  "LAPSED",
  "INACTIVE",
] as const;

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

export const CHANNELS = ["SMS", "EMAIL", "TASK"] as const;

export function isValidStatus(type: "RECRUIT" | "CLIENT", status: string): boolean {
  return type === "RECRUIT"
    ? (RECRUIT_STAGES as readonly string[]).includes(status)
    : (CLIENT_STAGES as readonly string[]).includes(status);
}

export function defaultStatusFor(type: "RECRUIT" | "CLIENT"): string {
  return type === "RECRUIT" ? "NEW" : "LEAD";
}
