"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { Button, Card, Badge, Spinner, EmptyState, PageHeader, Select, Modal, Field, Input, Textarea } from "@/components/ui";
import { fmtDate, humanize } from "@/lib/format";
import type { Task } from "@/lib/types";
import { Plus, CheckCircle2, Circle, CalendarClock } from "lucide-react";

export default function TasksPage() {
  const toast = useToast();
  const [filter, setFilter] = useState("OPEN");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const load = () => {
    setLoading(true);
    const q = filter === "ALL" ? "" : `?status=${filter}`;
    api.get<Task[]>(`/api/tasks${q}`).then((t) => { setTasks(t); setLoading(false); });
  };
  useEffect(load, [filter]);

  const toggle = async (t: Task) => {
    if (t.status === "DONE") await api.patch(`/api/tasks/${t.id}`, { status: "OPEN" });
    else await api.post(`/api/tasks/${t.id}/complete`);
    load();
  };

  const overdue = (t: Task) => t.status === "OPEN" && t.dueDate && new Date(t.dueDate) < new Date();

  return (
    <div>
      <PageHeader title="Tasks" subtitle="Follow-ups and reminders — including those created automatically by your sequences." actions={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Add task</Button>} />

      <Card className="mb-4 flex items-center gap-3 p-3">
        <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="max-w-[180px]">
          <option value="OPEN">Open</option>
          <option value="DONE">Completed</option>
          <option value="ALL">All</option>
        </Select>
      </Card>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner className="h-7 w-7" /></div>
      ) : tasks.length === 0 ? (
        <EmptyState title="No tasks" description="You're all caught up. Add a task or let automations create follow-ups for you." action={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Add task</Button>} />
      ) : (
        <div className="space-y-2">
          {tasks.map((t) => (
            <Card key={t.id} className="flex items-center gap-3 p-4">
              <button onClick={() => toggle(t)} className={t.status === "DONE" ? "text-emerald-600" : "text-slate-300 hover:text-brand-500"}>
                {t.status === "DONE" ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
              </button>
              <div className="min-w-0 flex-1">
                <p className={`font-medium ${t.status === "DONE" ? "text-slate-400 line-through" : "text-slate-800"}`}>{t.title}</p>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  {t.contact && <Link href={`/contacts/${t.contact.id}`} className="hover:text-brand-600">{t.contact.firstName} {t.contact.lastName}</Link>}
                  {t.type && <span>{humanize(t.type)}</span>}
                  {t.dueDate && <span className={`flex items-center gap-1 ${overdue(t) ? "font-semibold text-red-500" : ""}`}><CalendarClock className="h-3.5 w-3.5" /> {fmtDate(t.dueDate)}</span>}
                  {t.autoCreated && <span className="badge bg-violet-50 text-violet-600">Auto</span>}
                </div>
                {t.description && <p className="mt-1 text-sm text-slate-500">{t.description}</p>}
              </div>
              <Badge>{t.priority}</Badge>
            </Card>
          ))}
        </div>
      )}

      <TaskForm open={open} onClose={() => setOpen(false)} onSaved={load} />
    </div>
  );
}

function TaskForm({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({ title: "", description: "", dueDate: "", priority: "MEDIUM", type: "FOLLOW_UP" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { if (open) { setForm({ title: "", description: "", dueDate: "", priority: "MEDIUM", type: "FOLLOW_UP" }); setError(""); } }, [open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError("");
    try { await api.post("/api/tasks", form); toast("Task added"); onSaved(); onClose(); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Failed"); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add task">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Title"><Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required /></Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Due date"><Input type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} /></Field>
          <Field label="Priority"><Select value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}>{["LOW", "MEDIUM", "HIGH"].map((p) => <option key={p}>{p}</option>)}</Select></Field>
          <Field label="Type"><Select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>{["CALL", "EMAIL", "FOLLOW_UP", "MEETING", "ONBOARDING", "OTHER"].map((t) => <option key={t} value={t}>{humanize(t)}</option>)}</Select></Field>
        </div>
        <Field label="Description"><Textarea rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></Field>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" loading={busy}>Add</Button></div>
      </form>
    </Modal>
  );
}
