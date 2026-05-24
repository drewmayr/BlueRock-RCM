export type Role = "OWNER" | "MANAGER" | "AGENT";
export type ContactType = "RECRUIT" | "CLIENT" | "REFERRAL";

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: Role;
  agencyId: string;
  isActive?: boolean;
  lastLoginAt?: string | null;
}

export interface Agency {
  id: string;
  name: string;
  timezone: string;
  agedLeadDays: number;
  emailFromAddress: string | null;
  emailFromName: string | null;
  twilioFromNumber: string | null;
  providers?: {
    sms: { configured: boolean; from: string | null };
    email: { configured: boolean; from: string | null };
  };
  hasTwilioCreds?: boolean;
  hasResendCreds?: boolean;
}

export interface Contact {
  id: string;
  type: ContactType;
  status: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  dateOfBirth: string | null;
  anniversary: string | null;
  occupation: string | null;
  employer: string | null;
  maritalStatus: string | null;
  spouseName: string | null;
  numberOfChildren: number | null;
  familyNotes: string | null;
  retirementGoalAge: number | null;
  retirementNotes: string | null;
  incomeBand: string | null;
  source: string | null;
  recruitNotes: string | null;
  lastContactedAt: string | null;
  followUpDate: string | null;
  nextTouchpointAt: string | null;
  convertedUserId: string | null;
  isAged: boolean;
  doNotContact: boolean;
  tags: string[];
  notes: string | null;
  ownerId: string | null;
  owner?: { id: string; firstName: string; lastName: string; email?: string } | null;
  createdAt: string;
  updatedAt: string;
  _count?: { policies: number; enrollments: number };
}

export interface ContactDetail extends Contact {
  policies: Policy[];
  lifeEvents: LifeEvent[];
  crossSells: CrossSell[];
  tasks: Task[];
  enrollments: Enrollment[];
  messages: Message[];
  activities: Activity[];
}

export interface Policy {
  id: string;
  contactId: string;
  policyNumber: string | null;
  carrier: string | null;
  productType: string;
  faceAmount: string | null;
  premium: string | null;
  premiumMode: string | null;
  status: string;
  effectiveDate: string | null;
  renewalDate: string | null;
  notes: string | null;
  createdAt: string;
  contact?: { id: string; firstName: string; lastName: string };
}

export interface Referral {
  id: string;
  referrerId: string | null;
  referredContactId: string | null;
  referredName: string | null;
  referredPhone: string | null;
  referredEmail: string | null;
  status: string;
  rewardStatus: string | null;
  notes: string | null;
  createdAt: string;
  referrer?: { id: string; firstName: string; lastName: string } | null;
  referredContact?: { id: string; firstName: string; lastName: string } | null;
}

export interface CrossSell {
  id: string;
  contactId: string;
  productType: string;
  reason: string | null;
  status: string;
  estimatedValue: string | null;
  source: string | null;
  createdAt: string;
  contact?: { id: string; firstName: string; lastName: string };
}

export interface LifeEvent {
  id: string;
  contactId: string;
  type: string;
  title: string;
  date: string;
  recurring: boolean;
  notes: string | null;
  nextOccurrence?: string;
  contact?: { id: string; firstName: string; lastName: string };
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  contactId: string | null;
  assigneeId: string | null;
  dueDate: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH";
  status: "OPEN" | "DONE";
  type: string | null;
  completedAt: string | null;
  autoCreated: boolean;
  createdAt: string;
  contact?: { id: string; firstName: string; lastName: string } | null;
  assignee?: { id: string; firstName: string; lastName: string } | null;
}

export type ActionType = "SMS" | "EMAIL" | "TASK" | "NOTE" | "STATUS" | "TAG" | "NOTIFY";

export interface SequenceStep {
  id?: string;
  order: number;
  channel: ActionType;
  delayDays: number;
  delayHours: number;
  subject: string | null;
  body: string;
  taskTitle: string | null;
  actionConfig?: Record<string, unknown> | null;
}

export interface Sequence {
  id: string;
  name: string;
  description: string | null;
  audience: "RECRUIT" | "CLIENT" | "BOTH";
  triggerType: string;
  triggerConfig: Record<string, unknown> | null;
  isActive: boolean;
  createdAt: string;
  steps?: SequenceStep[];
  activeEnrollments?: number;
  _count?: { steps?: number; enrollments: number };
}

export interface Enrollment {
  id: string;
  sequenceId: string;
  contactId: string;
  status: string;
  currentStep: number;
  nextRunAt: string | null;
  enrolledAt: string;
  completedAt: string | null;
  sequence?: { id: string; name: string };
  contact?: { id: string; firstName: string; lastName: string; type?: string };
}

export interface Message {
  id: string;
  contactId: string | null;
  channel: string;
  direction: string;
  status: string;
  toAddress: string | null;
  fromAddress: string | null;
  subject: string | null;
  body: string;
  scheduledAt: string | null;
  sentAt: string | null;
  providerId: string | null;
  error: string | null;
  createdAt: string;
  contact?: { id: string; firstName: string; lastName: string } | null;
}

export interface Activity {
  id: string;
  type: string;
  description: string;
  contactId: string | null;
  userId: string | null;
  createdAt: string;
}

export interface DashboardStats {
  recruits: { total: number; byStage: Record<string, number>; aged: number };
  clients: { total: number; byStage: Record<string, number> };
  policies: { active: number; totalFaceAmount: number; annualizedPremium: number };
  referrals: { total: number; byStatus: Record<string, number> };
  crossSells: { openCount: number; pipelineValue: number; wonValue: number };
  tasks: { open: number; overdue: number; dueToday: number };
  messages: { sentLast30Days: number; pending: number };
  automations: { activeEnrollments: number };
  recentActivity: Activity[];
}

export interface Meta {
  leadTypes: string[];
  leadSegments: string[];
  recruitStages: string[];
  clientStages: string[];
  referralStages: string[];
  productTypes: string[];
  policyStatuses: string[];
  referralStatuses: string[];
  crossSellStatuses: string[];
  sequenceTriggers: string[];
  channels: string[];
  actionTypes: string[];
  agingTiers: { key: string; label: string; maxDays: number }[];
  templateTokens: string[];
  premiumModes: string[];
  roles: string[];
}

export interface Lead extends Contact {
  agingTier: string;
  daysSinceContact: number;
  hasActivePolicy: boolean;
  hasOpenCrossSell: boolean;
}

export interface AppNotification {
  id: string;
  category: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  contactId: string | null;
  createdAt: string;
}

export interface ReminderBucket<T = Record<string, unknown>> {
  count: number;
  items: T[];
}

export interface NotificationCenter {
  unreadCount: number;
  notifications: AppNotification[];
  reminders: {
    upcomingBirthdays: ReminderBucket;
    upcomingAnniversaries: ReminderBucket;
    policyRenewals: ReminderBucket;
    inactiveRecruits: ReminderBucket;
    overdueFollowUps: ReminderBucket;
    overdueTasks: ReminderBucket;
    referralOpportunities: ReminderBucket;
    crossSellOpportunities: ReminderBucket;
  };
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
}
