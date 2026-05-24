"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useMeta } from "@/lib/meta";
import { useToast } from "@/lib/toast";
import { Button, Card, Field, Input, Select, Textarea, Spinner, Badge } from "@/components/ui";
import { humanize } from "@/lib/format";
import type { Sequence, SequenceStep } from "@/lib/types";
import { Plus, Trash2, ArrowLeft, Mail, MessageSquare, CheckSquare, GripVertical, StickyNote, GitBranch, Tag, Bell } from "lucide-react";

const CHANNEL_ICON: Record<string, React.ReactNode> = {
  SMS: <MessageSquare className="h-4 w-4" />,
  EMAIL: <Mail className="h-4 w-4" />,
  TASK: <CheckSquare className="h-4 w-4" />,
  NOTE: <StickyNote className="h-4 w-4" />,
  STATUS: <GitBranch className="h-4 w-4" />,
  TAG: <Tag className="h-4 w-4" />,
  NOTIFY: <Bell className="h-4 w-4" />,
};

const ACTION_LABEL: Record<string, string> = {
  SMS: "Send SMS",
  EMAIL: "Send Email",
  TASK: "Create Task",
  NOTE: "Add Note",
  STATUS: "Update Status",
  TAG: "Add Tags",
  NOTIFY: "Notify Assigned User",
};

function emptyStep(order: number): SequenceStep {
  return { order, channel: "SMS", delayDays: order === 0 ? 0 : 2, delayHours: 0, subject: "", body: "", taskTitle: "", actionConfig: {} };
}

export default function SequenceEditor({ id }: { id?: string }) {
  const router = useRouter();
  const meta = useMeta();
  const toast = useToast();
  const isNew = !id;
  const [loading, setLoading] = useState(!isNew);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [audience, setAudience] = useState("CLIENT");
  const [triggerType, setTriggerType] = useState("MANUAL");
  const [daysBefore, setDaysBefore] = useState("0");
  const [statusValue, setStatusValue] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [steps, setSteps] = useState<SequenceStep[]>([emptyStep(0)]);

  useEffect(() => {
    if (isNew) return;
    api.get<Sequence>(`/api/sequences/${id}`).then((s) => {
      setName(s.name);
      setDescription(s.description ?? "");
      setAudience(s.audience);
      setTriggerType(s.triggerType);
      setIsActive(s.isActive);
      const cfg = (s.triggerConfig ?? {}) as { daysBefore?: number; status?: string };
      setDaysBefore(String(cfg.daysBefore ?? 0));
      setStatusValue(cfg.status ?? "");
      setSteps((s.steps && s.steps.length ? s.steps : [emptyStep(0)]).map((st, i) => ({ ...st, order: i })));
      setLoading(false);
    }).catch(() => { setError("Failed to load"); setLoading(false); });
  }, [id, isNew]);

  const updateStep = (i: number, patch: Partial<SequenceStep>) =>
    setSteps((s) => s.map((st, idx) => (idx === i ? { ...st, ...patch } : st)));
  const addStep = () => setSteps((s) => [...s, emptyStep(s.length)]);
  const removeStep = (i: number) => setSteps((s) => s.filter((_, idx) => idx !== i).map((st, idx) => ({ ...st, order: idx })));

  const needsDaysBefore = ["BIRTHDAY", "ANNIVERSARY", "RENEWAL"].includes(triggerType);
  const needsStatus = triggerType === "STATUS_CHANGE";
  const stages = audience === "RECRUIT" ? meta?.recruitStages : meta?.clientStages;

  const save = async () => {
    setError("");
    if (!name.trim()) return setError("Name is required");
    for (const s of steps) {
      const cfg = (s.actionConfig ?? {}) as { status?: string; tags?: string };
      if (["SMS", "EMAIL", "NOTE", "NOTIFY"].includes(s.channel) && !s.body.trim())
        return setError(`A ${s.channel.toLowerCase()} step needs a message`);
      if (s.channel === "TASK" && !s.taskTitle?.trim() && !s.body.trim())
        return setError("A task step needs a title");
      if (s.channel === "STATUS" && !cfg.status) return setError("A status step needs a target stage");
      if (s.channel === "TAG" && !String(cfg.tags ?? "").trim()) return setError("A tag step needs at least one tag");
    }
    setBusy(true);
    let triggerConfig: Record<string, unknown> | undefined;
    if (needsDaysBefore) triggerConfig = { daysBefore: parseInt(daysBefore || "0", 10) };
    if (needsStatus && statusValue) triggerConfig = { status: statusValue };

    const payload = {
      name, description, audience, triggerType, triggerConfig, isActive,
      steps: steps.map((s, i) => ({
        order: i, channel: s.channel,
        delayDays: Number(s.delayDays) || 0, delayHours: Number(s.delayHours) || 0,
        subject: s.subject || null, body: s.body || "", taskTitle: s.taskTitle || null,
        actionConfig: s.actionConfig ?? {},
      })),
    };
    try {
      if (isNew) await api.post("/api/sequences", payload);
      else await api.patch(`/api/sequences/${id}`, payload);
      toast(isNew ? "Automation created" : "Automation saved");
      router.push("/automations");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>;

  return (
    <div className="mx-auto max-w-3xl">
      <button onClick={() => router.back()} className="mb-4 flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> Back to automations
      </button>
      <h1 className="text-2xl font-bold text-slate-900">{isNew ? "New automation" : "Edit automation"}</h1>

      <Card className="mt-5 space-y-4 p-5">
        <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Aged Lead Revival" /></Field>
        <Field label="Description"><Input value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Audience">
            <Select value={audience} onChange={(e) => setAudience(e.target.value)}>
              <option value="CLIENT">Clients</option>
              <option value="RECRUIT">Recruits</option>
              <option value="BOTH">Both</option>
            </Select>
          </Field>
          <Field label="Trigger">
            <Select value={triggerType} onChange={(e) => setTriggerType(e.target.value)}>
              {meta?.sequenceTriggers.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}
            </Select>
          </Field>
          {needsDaysBefore && (
            <Field label="Days before event"><Input type="number" min={0} value={daysBefore} onChange={(e) => setDaysBefore(e.target.value)} /></Field>
          )}
          {needsStatus && (
            <Field label="When status becomes">
              <Select value={statusValue} onChange={(e) => setStatusValue(e.target.value)}>
                <option value="">Any change</option>
                {stages?.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
              </Select>
            </Field>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> Active
        </label>
      </Card>

      <div className="mt-6 mb-2 flex items-center justify-between">
        <h2 className="font-semibold text-slate-800">Steps</h2>
        <p className="text-xs text-slate-400">Tokens: {meta?.templateTokens.slice(0, 6).map((t) => `{{${t}}}`).join(" ")}…</p>
      </div>

      <div className="space-y-3">
        {steps.map((s, i) => (
          <Card key={i} className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <GripVertical className="h-4 w-4 text-slate-300" />
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-xs text-brand-700">{i + 1}</span>
                {CHANNEL_ICON[s.channel]} {humanize(s.channel)}
              </div>
              {steps.length > 1 && <button onClick={() => removeStep(i)} className="text-slate-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Action">
                <Select value={s.channel} onChange={(e) => updateStep(i, { channel: e.target.value as SequenceStep["channel"] })}>
                  {(meta?.actionTypes ?? ["SMS", "EMAIL", "TASK", "NOTE", "STATUS", "TAG", "NOTIFY"]).map((c) => <option key={c} value={c}>{ACTION_LABEL[c] ?? humanize(c)}</option>)}
                </Select>
              </Field>
              <Field label="Delay (days)"><Input type="number" min={0} value={s.delayDays} onChange={(e) => updateStep(i, { delayDays: Number(e.target.value) })} /></Field>
              <Field label="Delay (hours)"><Input type="number" min={0} max={23} value={s.delayHours} onChange={(e) => updateStep(i, { delayHours: Number(e.target.value) })} /></Field>
            </div>

            {(s.channel === "EMAIL" || s.channel === "NOTIFY") && (
              <div className="mt-3"><Field label={s.channel === "NOTIFY" ? "Notification title" : "Subject"}><Input value={s.subject ?? ""} onChange={(e) => updateStep(i, { subject: e.target.value })} placeholder={s.channel === "NOTIFY" ? "Follow up with {{firstName}}" : "Hi {{firstName}}…"} /></Field></div>
            )}
            {s.channel === "TASK" && (
              <div className="mt-3"><Field label="Task title"><Input value={s.taskTitle ?? ""} onChange={(e) => updateStep(i, { taskTitle: e.target.value })} placeholder="Call {{fullName}}" /></Field></div>
            )}

            {s.channel === "STATUS" && (
              <div className="mt-3"><Field label="Set stage to">
                <Select value={(s.actionConfig as { status?: string })?.status ?? ""} onChange={(e) => updateStep(i, { actionConfig: { ...(s.actionConfig ?? {}), status: e.target.value } })}>
                  <option value="">Select stage…</option>
                  {stages?.map((st) => <option key={st} value={st}>{humanize(st)}</option>)}
                </Select>
              </Field></div>
            )}
            {s.channel === "TAG" && (
              <div className="mt-3"><Field label="Add tags" hint="Comma-separated">
                <Input value={(s.actionConfig as { tags?: string })?.tags ?? ""} onChange={(e) => updateStep(i, { actionConfig: { ...(s.actionConfig ?? {}), tags: e.target.value } })} placeholder="vip, reengaged" />
              </Field></div>
            )}

            {["SMS", "EMAIL", "TASK", "NOTE", "NOTIFY"].includes(s.channel) && (
              <div className="mt-3">
                <Field label={s.channel === "TASK" ? "Task details" : s.channel === "NOTE" ? "Note" : s.channel === "NOTIFY" ? "Message to agent" : "Message body"}>
                  <Textarea rows={3} value={s.body} onChange={(e) => updateStep(i, { body: e.target.value })} placeholder="Hi {{firstName}}, this is {{agentName}} with {{agencyName}}…" />
                </Field>
              </div>
            )}
          </Card>
        ))}
      </div>

      <Button variant="secondary" className="mt-3" onClick={addStep}><Plus className="h-4 w-4" /> Add step</Button>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={() => router.push("/automations")}>Cancel</Button>
        <Button onClick={save} loading={busy}>{isNew ? "Create automation" : "Save changes"}</Button>
      </div>
    </div>
  );
}
