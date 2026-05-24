"use client";

import { useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/useApi";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { Card, StatCard, Button, Spinner, PageHeader, Badge } from "@/components/ui";
import { fmtMoney, fmtNumber, fmtRelative, humanize, fmtDate } from "@/lib/format";
import type { DashboardStats, LifeEvent } from "@/lib/types";
import {
  Users,
  UserPlus,
  FileText,
  TrendingUp,
  Share2,
  MessageSquare,
  CheckSquare,
  Workflow,
  Play,
  Cake,
} from "lucide-react";

function PipelineBar({ data, total }: { data: Record<string, number>; total: number }) {
  const entries = Object.entries(data);
  if (total === 0) return <p className="text-sm text-slate-400">No records yet.</p>;
  return (
    <div className="space-y-2">
      {entries.map(([stage, count]) => (
        <div key={stage}>
          <div className="mb-1 flex justify-between text-xs">
            <span className="font-medium text-slate-600">{humanize(stage)}</span>
            <span className="text-slate-400">{count}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-brand-500" style={{ width: `${(count / total) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const toast = useToast();
  const { data, loading, reload } = useApi<DashboardStats>("/api/dashboard");
  const { data: upcoming } = useApi<LifeEvent[]>("/api/events/upcoming?days=30");
  const [running, setRunning] = useState(false);

  const runAutomations = async () => {
    setRunning(true);
    try {
      const res = await api.post<{ summary: Record<string, number> }>("/api/sequences/run-cycle");
      const s = res.summary;
      toast(`Engine ran: ${s.stepped} step(s), ${s.messages} sent, ${s.crossSells} cross-sells, ${s.aged} aged leads`);
      reload();
    } catch {
      toast("Failed to run automations", "error");
    } finally {
      setRunning(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  const canRun = user?.role === "OWNER" || user?.role === "MANAGER";

  return (
    <div>
      <PageHeader
        title={`Welcome, ${user?.firstName}`}
        subtitle="Your agency's relationship engine at a glance."
        actions={
          canRun && (
            <Button variant="secondary" onClick={runAutomations} loading={running}>
              <Play className="h-4 w-4" /> Run automations now
            </Button>
          )
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Recruits" value={fmtNumber(data.recruits.total)} sub={`${data.recruits.aged} aged leads`} icon={<UserPlus className="h-5 w-5" />} tone="brand" />
        <StatCard label="Clients" value={fmtNumber(data.clients.total)} icon={<Users className="h-5 w-5" />} tone="sky" />
        <StatCard label="Active policies" value={fmtNumber(data.policies.active)} sub={`${fmtMoney(data.policies.annualizedPremium)} annual premium`} icon={<FileText className="h-5 w-5" />} tone="emerald" />
        <StatCard label="Cross-sell pipeline" value={fmtMoney(data.crossSells.pipelineValue)} sub={`${data.crossSells.openCount} open`} icon={<TrendingUp className="h-5 w-5" />} tone="violet" />
        <StatCard label="Referrals" value={fmtNumber(data.referrals.total)} sub={`${data.referrals.byStatus.CONVERTED ?? 0} converted`} icon={<Share2 className="h-5 w-5" />} tone="amber" />
        <StatCard label="Active automations" value={fmtNumber(data.automations.activeEnrollments)} sub="contacts enrolled" icon={<Workflow className="h-5 w-5" />} tone="brand" />
        <StatCard label="Messages (30d)" value={fmtNumber(data.messages.sentLast30Days)} sub={`${data.messages.pending} pending`} icon={<MessageSquare className="h-5 w-5" />} tone="sky" />
        <StatCard label="Open tasks" value={fmtNumber(data.tasks.open)} sub={`${data.tasks.overdue} overdue · ${data.tasks.dueToday} due today`} icon={<CheckSquare className="h-5 w-5" />} tone={data.tasks.overdue > 0 ? "red" : "emerald"} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">Recruiting pipeline</h3>
            <Link href="/recruiting" className="text-xs font-semibold text-brand-600 hover:underline">View →</Link>
          </div>
          <PipelineBar data={data.recruits.byStage} total={data.recruits.total} />
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">Client pipeline</h3>
            <Link href="/clients" className="text-xs font-semibold text-brand-600 hover:underline">View →</Link>
          </div>
          <PipelineBar data={data.clients.byStage} total={data.clients.total} />
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-semibold text-slate-800">
              <Cake className="h-4 w-4 text-brand-500" /> Upcoming (30 days)
            </h3>
          </div>
          {!upcoming || upcoming.length === 0 ? (
            <p className="text-sm text-slate-400">No upcoming birthdays, anniversaries, or renewals.</p>
          ) : (
            <ul className="space-y-2">
              {upcoming.slice(0, 8).map((e) => (
                <li key={e.id} className="flex items-center justify-between text-sm">
                  <div>
                    <Link href={`/contacts/${e.contactId}`} className="font-medium text-slate-700 hover:text-brand-600">
                      {e.contact?.firstName} {e.contact?.lastName}
                    </Link>
                    <span className="ml-2 text-xs text-slate-400">{humanize(e.type)}</span>
                  </div>
                  <span className="text-xs text-slate-500">{fmtDate(e.nextOccurrence ?? e.date, "MMM d")}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-6 p-5">
        <h3 className="mb-4 font-semibold text-slate-800">Recent activity</h3>
        {data.recentActivity.length === 0 ? (
          <p className="text-sm text-slate-400">No activity yet. Add a recruit or client to get started.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.recentActivity.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-2.5 text-sm">
                <div className="flex items-center gap-3">
                  <Badge>{humanize(a.type)}</Badge>
                  <span className="text-slate-600">{a.description}</span>
                </div>
                <span className="shrink-0 text-xs text-slate-400">{fmtRelative(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
