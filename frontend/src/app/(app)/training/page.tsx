"use client";

import Link from "next/link";
import { Card, PageHeader, Badge } from "@/components/ui";
import {
  Contact2, Upload, Workflow, Bell, UserCheck, FileText, Share2, TrendingUp,
  CheckSquare, Settings, Rocket, MessageSquare, Clock, ListChecks,
} from "lucide-react";

function Section({ icon: Icon, title, badge, children }: { icon: any; title: string; badge?: string; children: React.ReactNode }) {
  return (
    <Card className="p-6">
      <div className="mb-3 flex items-center gap-3">
        <span className="rounded-lg bg-brand-50 p-2 text-brand-600"><Icon className="h-5 w-5" /></span>
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {badge && <Badge>{badge}</Badge>}
      </div>
      <div className="space-y-2 text-sm leading-relaxed text-slate-600">{children}</div>
    </Card>
  );
}

function Steps({ items }: { items: string[] }) {
  return (
    <ol className="mt-2 space-y-1.5">
      {items.map((s, i) => (
        <li key={i} className="flex gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">{i + 1}</span>
          <span dangerouslySetInnerHTML={{ __html: s }} />
        </li>
      ))}
    </ol>
  );
}

export default function TrainingPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Training & Getting Started" subtitle="A quick guide to running your agency in BlueRock RCM." />

      <Card className="mb-6 bg-brand-700 p-6 text-white">
        <div className="flex items-center gap-3">
          <Rocket className="h-6 w-6" />
          <h2 className="text-lg font-semibold">The 5-minute setup</h2>
        </div>
        <ol className="mt-3 space-y-1.5 text-sm text-brand-50">
          <li>1. <Link href="/leads" className="underline">Import your leads</Link> (recruits, clients, referrals) from a CSV — or add them manually.</li>
          <li>2. Review your <Link href="/automations" className="underline">automations</Link> — 6 are ready out of the box.</li>
          <li>3. Add Twilio/Resend keys in <Link href="/settings" className="underline">Settings → Providers</Link> to turn on real SMS/email.</li>
          <li>4. Check the <Link href="/notifications" className="underline">Notification Center</Link> each morning for what needs attention.</li>
          <li>5. <Link href="/settings" className="underline">Invite your team</Link> and assign leads.</li>
        </ol>
      </Card>

      <div className="grid gap-5">
        <Section icon={Contact2} title="Leads — your central database">
          <p>Every recruit, client, and referral lives in one place under <Link href="/leads" className="font-medium text-brand-600">Leads</Link>. Use the tabs to filter by type, and the segment chips to instantly see <b>Aged</b>, <b>Sold-Policy</b>, and <b>Cross-Sell</b> leads — these update automatically based on real activity.</p>
          <Steps items={[
            "Use the <b>type tabs</b> (All / Recruits / Clients / Referrals) and <b>segment chips</b> to filter.",
            "Click any lead to open its full profile, timeline, policies, and life events.",
            "The <b>aging badge</b> shows how long since the last touch (Fresh, 30+, 60+, 90+ days).",
          ]} />
        </Section>

        <Section icon={Upload} title="Import & Export">
          <p>Bring your existing book of business in minutes.</p>
          <Steps items={[
            "On <b>Leads</b>, click <b>Import</b> and choose a CSV file.",
            "Map your columns (Name, Phone, Email, State, Birthday, Anniversary, Source, Tags, Status, Notes, Follow-up…) — common headers are auto-detected.",
            "<b>Preview</b> shows exactly what will be created, updated, or skipped (duplicates are detected by email/phone).",
            "Confirm to import. Use <b>Export</b> anytime to download your leads as CSV.",
          ]} />
        </Section>

        <Section icon={Workflow} title="Automations — the relationship engine">
          <p>Automations nurture leads for you. Each is a sequence of timed steps. Build your own in <Link href="/automations" className="font-medium text-brand-600">Automations → New automation</Link>.</p>
          <p className="mt-2"><b>Triggers:</b> aged lead, contact created, status change, policy sold, birthday, anniversary, renewal, or manual.</p>
          <p><b>Actions:</b> send SMS, send Email, create Task, add Note, update Status, add Tags, or notify the assigned user.</p>
          <p className="mt-2 text-xs text-slate-400">Tip: messages personalize with tokens like <code>{"{{firstName}}"}</code>, <code>{"{{agentName}}"}</code>, <code>{"{{agencyName}}"}</code>, <code>{"{{renewalDate}}"}</code>.</p>
        </Section>

        <Section icon={Clock} title="Lead aging & revival" badge="Automatic">
          <p>Recruits and leads are tracked by inactivity (30 / 60 / 90+ days). When a recruiting lead goes quiet past your threshold, BlueRock automatically tags it <b>Aged</b> and enrolls it in your <b>Aged Lead Revival</b> automation to win it back. Set the threshold in <Link href="/settings" className="font-medium text-brand-600">Settings → Agency</Link>.</p>
        </Section>

        <Section icon={Bell} title="Notification Center">
          <p>The <Link href="/notifications" className="font-medium text-brand-600">bell</Link> tells you what needs attention today: upcoming birthdays, anniversaries, policy renewals, inactive recruits, overdue follow-ups, missed tasks, referral opportunities, and cross-sell opportunities. Check it daily.</p>
        </Section>

        <Section icon={UserCheck} title="Recruiting → Active Agent">
          <p>Move recruits through the pipeline: New → Contacted → Interested → Contract Sent → Licensed → Appointed → Active Agent. When they're ready, open the recruit and click <b>Convert to Agent</b> — this creates their team account and links the record (no duplicate).</p>
        </Section>

        <Section icon={FileText} title="Clients, Policies & Life events">
          <p>Store each client's policies, birthdays, anniversaries, family details, and retirement goals on their profile. This data powers automated birthday/anniversary outreach, renewal reminders, and cross-sell detection.</p>
        </Section>

        <Section icon={TrendingUp} title="Cross-Sell & Referrals">
          <p><Link href="/cross-sells" className="font-medium text-brand-600">Cross-Sell</Link> opportunities are surfaced automatically from policy gaps and life events (e.g. term-life holder → permanent coverage). Capture <Link href="/referrals" className="font-medium text-brand-600">Referrals</Link> from happy clients and convert them into client leads in one click.</p>
        </Section>

        <Section icon={CheckSquare} title="Tasks & Messages">
          <p><Link href="/tasks" className="font-medium text-brand-600">Tasks</Link> are your follow-ups and reminders — including ones automations create for you. The <Link href="/messages" className="font-medium text-brand-600">Messages</Link> outbox logs every automated and manual SMS/email with delivery status.</p>
        </Section>

        <Section icon={MessageSquare} title="Turning on real SMS & Email">
          <p>Until providers are connected, messages are composed and parked in the outbox as <b>Queued</b>. In <Link href="/settings" className="font-medium text-brand-600">Settings → Providers</Link>, add your <b>Twilio</b> (SMS) and <b>Resend</b> (email) credentials — queued messages then send automatically.</p>
        </Section>

        <Section icon={Settings} title="Team & Settings">
          <p>As the owner you control everything. In <Link href="/settings" className="font-medium text-brand-600">Settings</Link> you can edit agency info, invite team members by email (they get a signup link), set roles, and manage messaging providers.</p>
        </Section>
      </div>

      <p className="mt-8 text-center text-xs text-slate-400">BlueRock RCM — relationship automation for life insurance agencies.</p>
    </div>
  );
}
