import { format, formatDistanceToNow, parseISO } from "date-fns";

/** Format a calendar date (stored as UTC midnight) without timezone drift. */
export function fmtDate(value: string | null | undefined, pattern = "MMM d, yyyy"): string {
  if (!value) return "—";
  try {
    const d = parseISO(value);
    // Use UTC components so a date-only value shows the day that was entered.
    const utc = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    return format(utc, pattern);
  } catch {
    return "—";
  }
}

/** Format a timestamp (real instant) in local time. */
export function fmtDateTime(value: string | null | undefined, pattern = "MMM d, yyyy h:mm a"): string {
  if (!value) return "—";
  try {
    return format(parseISO(value), pattern);
  } catch {
    return "—";
  }
}

export function fmtRelative(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    return formatDistanceToNow(parseISO(value), { addSuffix: true });
  } catch {
    return "—";
  }
}

export function fmtMoney(value: string | number | null | undefined): string {
  const n = typeof value === "string" ? parseFloat(value) : value;
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function fmtNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return "0";
  return new Intl.NumberFormat("en-US").format(value);
}

/** Turn an UPPER_SNAKE enum into Title Case. */
export function humanize(value: string | null | undefined): string {
  if (!value) return "—";
  return value
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function initials(first?: string | null, last?: string | null): string {
  return `${(first?.[0] ?? "").toUpperCase()}${(last?.[0] ?? "").toUpperCase()}` || "?";
}

const STATUS_TONES: Record<string, string> = {
  // pipeline / generic
  NEW: "bg-sky-100 text-sky-700",
  CONTACTED: "bg-indigo-100 text-indigo-700",
  INTERVIEW_SCHEDULED: "bg-violet-100 text-violet-700",
  INTERVIEWED: "bg-violet-100 text-violet-700",
  ONBOARDING: "bg-amber-100 text-amber-700",
  HIRED: "bg-emerald-100 text-emerald-700",
  AGED: "bg-orange-100 text-orange-700",
  INACTIVE: "bg-slate-200 text-slate-600",
  LEAD: "bg-sky-100 text-sky-700",
  PROSPECT: "bg-indigo-100 text-indigo-700",
  ACTIVE: "bg-emerald-100 text-emerald-700",
  RENEWAL_DUE: "bg-amber-100 text-amber-700",
  LAPSED: "bg-red-100 text-red-700",
  // policy
  PENDING: "bg-amber-100 text-amber-700",
  CANCELLED: "bg-red-100 text-red-700",
  CLAIMED: "bg-slate-200 text-slate-600",
  // referral / crosssell
  QUALIFIED: "bg-indigo-100 text-indigo-700",
  CONVERTED: "bg-emerald-100 text-emerald-700",
  LOST: "bg-red-100 text-red-700",
  IDENTIFIED: "bg-sky-100 text-sky-700",
  PRESENTED: "bg-indigo-100 text-indigo-700",
  IN_PROGRESS: "bg-amber-100 text-amber-700",
  WON: "bg-emerald-100 text-emerald-700",
  // messages
  SCHEDULED: "bg-sky-100 text-sky-700",
  QUEUED: "bg-amber-100 text-amber-700",
  SENDING: "bg-indigo-100 text-indigo-700",
  SENT: "bg-emerald-100 text-emerald-700",
  FAILED: "bg-red-100 text-red-700",
  DELIVERED: "bg-emerald-100 text-emerald-700",
  COMPLETED: "bg-emerald-100 text-emerald-700",
  STOPPED: "bg-slate-200 text-slate-600",
};

export function statusTone(status: string): string {
  return STATUS_TONES[status] ?? "bg-slate-100 text-slate-600";
}
