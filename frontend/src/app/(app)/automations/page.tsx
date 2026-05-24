"use client";

import { useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/useApi";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { Button, Card, Badge, Spinner, EmptyState, PageHeader } from "@/components/ui";
import { humanize } from "@/lib/format";
import type { Sequence } from "@/lib/types";
import { Plus, Workflow, Power, Mail, MessageSquare, CheckSquare, Users } from "lucide-react";

const TRIGGER_DESC: Record<string, string> = {
  AGED_LEAD: "Auto-revives recruiting leads gone quiet",
  CONTACT_CREATED: "Fires when a contact is added",
  STATUS_CHANGE: "Fires on a pipeline stage change",
  POLICY_SOLD: "Fires when an active policy is added",
  BIRTHDAY: "Fires on a client's birthday",
  ANNIVERSARY: "Fires on a client's anniversary",
  RENEWAL: "Fires ahead of a policy renewal",
  MANUAL: "Enroll contacts manually",
  REFERRAL_REQUEST: "Referral ask",
};

export default function AutomationsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const { data, loading, reload } = useApi<Sequence[]>("/api/sequences");
  const [running, setRunning] = useState(false);
  const canManage = user?.role === "OWNER" || user?.role === "MANAGER";

  const toggle = async (id: string) => {
    await api.post(`/api/sequences/${id}/toggle`);
    reload();
  };
  const runNow = async () => {
    setRunning(true);
    try {
      await api.post("/api/sequences/run-cycle");
      toast("Automation engine ran");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Automations"
        subtitle="Multi-step SMS, email, and task workflows that nurture recruits and clients automatically."
        actions={
          <div className="flex gap-2">
            {canManage && <Button variant="secondary" onClick={runNow} loading={running}><Workflow className="h-4 w-4" /> Run now</Button>}
            {canManage && <Link href="/automations/new" className="btn-primary"><Plus className="h-4 w-4" /> New automation</Link>}
          </div>
        }
      />

      {loading ? (
        <div className="flex justify-center py-16"><Spinner className="h-7 w-7" /></div>
      ) : !data || data.length === 0 ? (
        <EmptyState title="No automations" description="Create your first sequence to start nurturing contacts automatically." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data.map((s) => (
            <Card key={s.id} className="flex flex-col p-5">
              <div className="flex items-start justify-between">
                <div>
                  <Link href={`/automations/${s.id}`} className="font-semibold text-slate-900 hover:text-brand-600">{s.name}</Link>
                  <p className="mt-0.5 text-xs text-slate-400">{TRIGGER_DESC[s.triggerType] ?? humanize(s.triggerType)}</p>
                </div>
                {canManage && (
                  <button onClick={() => toggle(s.id)} title={s.isActive ? "Active — click to pause" : "Paused — click to activate"}
                    className={`rounded-lg p-1.5 ${s.isActive ? "text-emerald-600 hover:bg-emerald-50" : "text-slate-300 hover:bg-slate-100"}`}>
                    <Power className="h-4 w-4" />
                  </button>
                )}
              </div>
              {s.description && <p className="mt-2 line-clamp-2 text-sm text-slate-500">{s.description}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <Badge>{humanize(s.triggerType)}</Badge>
                <span className="badge bg-slate-100 text-slate-500">{s.audience === "BOTH" ? "All" : humanize(s.audience)}</span>
                <Badge status={s.isActive ? "ACTIVE" : "STOPPED"}>{s.isActive ? "Active" : "Paused"}</Badge>
              </div>
              <div className="mt-auto flex items-center gap-4 border-t border-slate-100 pt-3 text-xs text-slate-400">
                <span className="flex items-center gap-1"><Workflow className="h-3.5 w-3.5" /> {s._count?.steps ?? s.steps?.length ?? 0} steps</span>
                <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {s._count?.enrollments ?? 0} enrolled</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
