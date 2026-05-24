"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { useMeta } from "@/lib/meta";
import { useToast } from "@/lib/toast";
import { Button, Card, Badge, Spinner, Modal, Field, Input, Select, Textarea } from "@/components/ui";
import ContactForm from "@/components/ContactForm";
import PolicyForm from "@/components/PolicyForm";
import { fmtDate, fmtDateTime, fmtRelative, fmtMoney, humanize, initials } from "@/lib/format";
import type { ContactDetail, Sequence, Policy } from "@/lib/types";
import {
  ArrowLeft, Pencil, Phone, Mail, MapPin, Cake, Heart, Users as UsersIcon, Briefcase,
  Trash2, Send, Workflow, Plus, CheckCircle2, MessageSquarePlus, CalendarPlus, StickyNote,
} from "lucide-react";

const TABS = ["Timeline", "Policies", "Life Events", "Cross-Sell", "Tasks", "Messages"] as const;
type Tab = (typeof TABS)[number];

export default function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const meta = useMeta();
  const toast = useToast();
  const { data: c, loading, reload } = useApi<ContactDetail>(`/api/contacts/${id}`);
  const [tab, setTab] = useState<Tab>("Timeline");
  const [editOpen, setEditOpen] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false);
  const [editPolicy, setEditPolicy] = useState<Policy | null>(null);
  const [msgOpen, setMsgOpen] = useState(false);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [eventOpen, setEventOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);

  if (loading || !c) {
    return <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>;
  }

  const logTouch = async () => {
    await api.post(`/api/contacts/${id}/contacted`);
    toast("Logged a touchpoint");
    reload();
  };
  const remove = async () => {
    if (!confirm(`Delete ${c.firstName} ${c.lastName}? This cannot be undone.`)) return;
    await api.del(`/api/contacts/${id}`);
    toast("Contact deleted");
    router.push(c.type === "RECRUIT" ? "/recruiting" : "/clients");
  };

  return (
    <div>
      <button onClick={() => router.back()} className="mb-4 flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* Profile */}
        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-lg font-bold text-white">
                {initials(c.firstName, c.lastName)}
              </span>
              <div>
                <h1 className="text-lg font-bold text-slate-900">{c.firstName} {c.lastName}</h1>
                <div className="mt-1 flex items-center gap-2">
                  <Badge>{c.type === "RECRUIT" ? "Recruit" : "Client"}</Badge>
                  <Badge status={c.status} />
                </div>
              </div>
            </div>
            {c.isAged && <p className="mt-3 rounded-lg bg-orange-50 px-3 py-2 text-xs font-medium text-orange-600">⚠ Aged lead — enrolled in revival automation.</p>}
            {c.doNotContact && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">Do not contact</p>}

            <div className="mt-4 space-y-2 text-sm text-slate-600">
              {c.phone && <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-slate-400" /> {c.phone}</p>}
              {c.email && <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-slate-400" /> {c.email}</p>}
              {(c.city || c.state) && <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-slate-400" /> {[c.city, c.state].filter(Boolean).join(", ")}</p>}
              {c.owner && <p className="text-xs text-slate-400">Owner: {c.owner.firstName} {c.owner.lastName}</p>}
              <p className="text-xs text-slate-400">Last touch: {fmtRelative(c.lastContactedAt)}</p>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => setEditOpen(true)}><Pencil className="h-4 w-4" /> Edit</Button>
              <Button variant="secondary" onClick={logTouch}><CheckCircle2 className="h-4 w-4" /> Log touch</Button>
              <Button variant="secondary" onClick={() => setMsgOpen(true)}><Send className="h-4 w-4" /> Message</Button>
              <Button variant="secondary" onClick={() => setEnrollOpen(true)}><Workflow className="h-4 w-4" /> Enroll</Button>
            </div>
            <button onClick={remove} className="mt-3 flex w-full items-center justify-center gap-1 text-xs text-red-500 hover:text-red-700">
              <Trash2 className="h-3.5 w-3.5" /> Delete contact
            </button>
          </Card>

          {c.type === "CLIENT" && (
            <Card className="p-5">
              <h3 className="mb-3 text-sm font-semibold text-slate-800">Life details</h3>
              <dl className="space-y-2 text-sm">
                {c.dateOfBirth && <Detail icon={<Cake className="h-4 w-4" />} label="Birthday" value={fmtDate(c.dateOfBirth)} />}
                {c.anniversary && <Detail icon={<Heart className="h-4 w-4" />} label="Anniversary" value={fmtDate(c.anniversary)} />}
                {c.maritalStatus && <Detail label="Marital" value={c.maritalStatus} />}
                {c.spouseName && <Detail label="Spouse" value={c.spouseName} />}
                {c.numberOfChildren != null && <Detail icon={<UsersIcon className="h-4 w-4" />} label="Children" value={String(c.numberOfChildren)} />}
                {c.occupation && <Detail icon={<Briefcase className="h-4 w-4" />} label="Occupation" value={c.occupation} />}
                {c.retirementGoalAge && <Detail label="Retire at" value={`Age ${c.retirementGoalAge}`} />}
                {c.incomeBand && <Detail label="Income" value={c.incomeBand} />}
              </dl>
              {(c.familyNotes || c.retirementNotes) && (
                <div className="mt-3 space-y-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
                  {c.familyNotes && <p><span className="font-semibold">Family:</span> {c.familyNotes}</p>}
                  {c.retirementNotes && <p><span className="font-semibold">Retirement:</span> {c.retirementNotes}</p>}
                </div>
              )}
            </Card>
          )}

          {c.type === "RECRUIT" && (c.source || c.recruitNotes) && (
            <Card className="p-5 text-sm">
              <h3 className="mb-2 text-sm font-semibold text-slate-800">Recruiting</h3>
              {c.source && <Detail label="Source" value={c.source} />}
              {c.recruitNotes && <p className="mt-2 text-xs text-slate-500">{c.recruitNotes}</p>}
            </Card>
          )}

          {c.tags.length > 0 && (
            <Card className="p-5">
              <div className="flex flex-wrap gap-2">
                {c.tags.map((t) => <span key={t} className="badge bg-brand-50 text-brand-700">{t}</span>)}
              </div>
            </Card>
          )}
        </div>

        {/* Tabs */}
        <div>
          <div className="mb-4 flex flex-wrap gap-1 border-b border-slate-200">
            {TABS.map((t) => {
              const counts: Record<string, number> = {
                Policies: c.policies.length, "Life Events": c.lifeEvents.length,
                "Cross-Sell": c.crossSells.length, Tasks: c.tasks.length, Messages: c.messages.length,
              };
              return (
                <button key={t} onClick={() => setTab(t)}
                  className={`relative px-3 py-2 text-sm font-medium ${tab === t ? "text-brand-700" : "text-slate-500 hover:text-slate-700"}`}>
                  {t}{counts[t] ? <span className="ml-1 text-xs text-slate-400">({counts[t]})</span> : ""}
                  {tab === t && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-brand-600" />}
                </button>
              );
            })}
          </div>

          {tab === "Timeline" && (
            <Card className="p-5">
              <div className="mb-3 flex justify-end"><Button variant="secondary" onClick={() => setNoteOpen(true)}><StickyNote className="h-4 w-4" /> Add note</Button></div>
              {c.activities.length === 0 ? <p className="text-sm text-slate-400">No activity yet.</p> : (
                <ol className="relative space-y-4 border-l border-slate-200 pl-5">
                  {c.activities.map((a) => (
                    <li key={a.id} className="relative">
                      <span className="absolute -left-[23px] top-1 h-2.5 w-2.5 rounded-full bg-brand-400" />
                      <div className="flex items-center gap-2">
                        <Badge>{humanize(a.type)}</Badge>
                        <span className="text-xs text-slate-400">{fmtRelative(a.createdAt)}</span>
                      </div>
                      <p className="mt-1 text-sm text-slate-600">{a.description}</p>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          )}

          {tab === "Policies" && (
            <Section title="Policies" onAdd={() => { setEditPolicy(null); setPolicyOpen(true); }}>
              {c.policies.length === 0 ? <Empty text="No policies yet." /> : c.policies.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-4 py-3">
                  <div>
                    <p className="font-medium text-slate-800">{humanize(p.productType)} <Badge status={p.status} /></p>
                    <p className="text-xs text-slate-500">{p.carrier || "—"} · {fmtMoney(p.faceAmount)} face · {fmtMoney(p.premium)}/{(p.premiumMode || "").toLowerCase()}</p>
                    {p.renewalDate && <p className="text-xs text-slate-400">Renews {fmtDate(p.renewalDate)}</p>}
                  </div>
                  <Button variant="ghost" onClick={() => { setEditPolicy(p); setPolicyOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                </div>
              ))}
            </Section>
          )}

          {tab === "Life Events" && (
            <Section title="Life events" onAdd={() => setEventOpen(true)}>
              {c.lifeEvents.length === 0 ? <Empty text="No life events. Add birthdays, anniversaries, or milestones to power automated outreach." /> : c.lifeEvents.map((e) => (
                <div key={e.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-4 py-3">
                  <div><p className="font-medium text-slate-800">{e.title}</p><p className="text-xs text-slate-500">{humanize(e.type)} · {fmtDate(e.date)} {e.recurring ? "· recurring" : ""}</p></div>
                </div>
              ))}
            </Section>
          )}

          {tab === "Cross-Sell" && (
            <Section title="Cross-sell opportunities">
              {c.crossSells.length === 0 ? <Empty text="No opportunities yet. The engine surfaces these automatically based on policy gaps and life events." /> : c.crossSells.map((x) => (
                <div key={x.id} className="rounded-lg border border-slate-100 px-4 py-3">
                  <p className="font-medium text-slate-800">{humanize(x.productType)} <Badge status={x.status} /> {x.source === "AUTO" && <span className="badge bg-violet-50 text-violet-600">Auto</span>}</p>
                  {x.reason && <p className="mt-1 text-xs text-slate-500">{x.reason}</p>}
                </div>
              ))}
            </Section>
          )}

          {tab === "Tasks" && (
            <Section title="Tasks">
              {c.tasks.length === 0 ? <Empty text="No tasks." /> : c.tasks.map((t) => (
                <div key={t.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-4 py-3">
                  <div><p className="font-medium text-slate-800">{t.title} <Badge status={t.status} /></p>{t.dueDate && <p className="text-xs text-slate-500">Due {fmtDate(t.dueDate)}</p>}</div>
                  {t.autoCreated && <span className="badge bg-violet-50 text-violet-600">Auto</span>}
                </div>
              ))}
            </Section>
          )}

          {tab === "Messages" && (
            <Section title="Messages" onAdd={() => setMsgOpen(true)} addLabel="Send">
              {c.messages.length === 0 ? <Empty text="No messages yet." /> : c.messages.map((m) => (
                <div key={m.id} className="rounded-lg border border-slate-100 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-500">{m.channel} <Badge status={m.status} /></p>
                    <span className="text-xs text-slate-400">{fmtDateTime(m.sentAt ?? m.createdAt)}</span>
                  </div>
                  {m.subject && <p className="mt-1 text-sm font-medium text-slate-700">{m.subject}</p>}
                  <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-600">{m.body}</p>
                  {m.error && <p className="mt-1 text-xs text-amber-600">{m.error}</p>}
                </div>
              ))}
            </Section>
          )}
        </div>
      </div>

      <ContactForm open={editOpen} onClose={() => setEditOpen(false)} type={c.type} contact={c} onSaved={reload} />
      <PolicyForm open={policyOpen} onClose={() => setPolicyOpen(false)} fixedContactId={c.id} policy={editPolicy} onSaved={reload} />
      <SendMessageModal open={msgOpen} onClose={() => setMsgOpen(false)} contactId={c.id} onSent={reload} />
      <EnrollModal open={enrollOpen} onClose={() => setEnrollOpen(false)} contactId={c.id} onDone={reload} />
      <EventModal open={eventOpen} onClose={() => setEventOpen(false)} contactId={c.id} onSaved={reload} />
      <NoteModal open={noteOpen} onClose={() => setNoteOpen(false)} contactId={c.id} onSaved={reload} />
    </div>
  );
}

function Detail({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="flex items-center gap-1.5 text-slate-400">{icon}{label}</dt>
      <dd className="font-medium text-slate-700">{value}</dd>
    </div>
  );
}
function Section({ title, children, onAdd, addLabel = "Add" }: { title: string; children: React.ReactNode; onAdd?: () => void; addLabel?: string }) {
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold text-slate-800">{title}</h3>
        {onAdd && <Button variant="secondary" onClick={onAdd}><Plus className="h-4 w-4" /> {addLabel}</Button>}
      </div>
      <div className="space-y-2">{children}</div>
    </Card>
  );
}
function Empty({ text }: { text: string }) {
  return <p className="py-6 text-center text-sm text-slate-400">{text}</p>;
}

function SendMessageModal({ open, onClose, contactId, onSent }: { open: boolean; onClose: () => void; contactId: string; onSent: () => void }) {
  const toast = useToast();
  const [channel, setChannel] = useState("SMS");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const res = await api.post<{ delivery: { ok: boolean; notConfigured?: boolean } }>("/api/messages", { contactId, channel, subject: channel === "EMAIL" ? subject : undefined, body });
      toast(res.delivery.ok ? "Message sent" : res.delivery.notConfigured ? "Queued — configure a provider in Settings to send" : "Queued");
      setBody(""); setSubject(""); onSent(); onClose();
    } catch (err) { setError(err instanceof ApiError ? err.message : "Failed"); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Send message">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Channel"><Select value={channel} onChange={(e) => setChannel(e.target.value)}><option value="SMS">SMS</option><option value="EMAIL">Email</option></Select></Field>
        {channel === "EMAIL" && <Field label="Subject"><Input value={subject} onChange={(e) => setSubject(e.target.value)} required /></Field>}
        <Field label="Message"><Textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} required /></Field>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" loading={busy}><Send className="h-4 w-4" /> Send</Button></div>
      </form>
    </Modal>
  );
}

function EnrollModal({ open, onClose, contactId, onDone }: { open: boolean; onClose: () => void; contactId: string; onDone: () => void }) {
  const toast = useToast();
  const { data: sequences } = useApi<Sequence[]>(open ? "/api/sequences" : null);
  const [sequenceId, setSequenceId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError("");
    try { await api.post(`/api/contacts/${contactId}/enroll`, { sequenceId }); toast("Enrolled in automation"); onDone(); onClose(); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Failed"); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Enroll in automation">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Automation sequence">
          <Select value={sequenceId} onChange={(e) => setSequenceId(e.target.value)} required>
            <option value="">Select…</option>
            {sequences?.filter((s) => s.isActive).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </Field>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" loading={busy}>Enroll</Button></div>
      </form>
    </Modal>
  );
}

function EventModal({ open, onClose, contactId, onSaved }: { open: boolean; onClose: () => void; contactId: string; onSaved: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({ type: "BIRTHDAY", title: "", date: "", recurring: true, notes: "" });
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    try { await api.post("/api/events", { ...form, contactId }); toast("Life event added"); onSaved(); onClose(); }
    finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Add life event">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Type">
            <Select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
              {["BIRTHDAY", "ANNIVERSARY", "POLICY_ANNIVERSARY", "RENEWAL", "NEW_BABY", "RETIREMENT", "MILESTONE", "CUSTOM"].map((t) => <option key={t} value={t}>{humanize(t)}</option>)}
            </Select>
          </Field>
          <Field label="Date"><Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} required /></Field>
        </div>
        <Field label="Title"><Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required placeholder="Wedding anniversary" /></Field>
        <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={form.recurring} onChange={(e) => setForm((f) => ({ ...f, recurring: e.target.checked }))} /> Recurs annually</label>
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" loading={busy}>Add</Button></div>
      </form>
    </Modal>
  );
}

function NoteModal({ open, onClose, contactId, onSaved }: { open: boolean; onClose: () => void; contactId: string; onSaved: () => void }) {
  const toast = useToast();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    try { await api.post(`/api/contacts/${contactId}/note`, { note }); toast("Note added"); setNote(""); onSaved(); onClose(); }
    finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Add note">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Note"><Textarea rows={4} value={note} onChange={(e) => setNote(e.target.value)} required /></Field>
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" loading={busy}>Save note</Button></div>
      </form>
    </Modal>
  );
}
