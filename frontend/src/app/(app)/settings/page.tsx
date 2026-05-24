"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { Button, Card, Badge, Field, Input, Select, Spinner, PageHeader, Modal } from "@/components/ui";
import { fmtRelative, humanize } from "@/lib/format";
import type { Agency, User } from "@/lib/types";
import { Building2, Users, MessageSquare, CheckCircle2, XCircle, Plus, KeyRound } from "lucide-react";

const TABS = ["Agency", "Team", "Providers"] as const;
type Tab = (typeof TABS)[number];

export default function SettingsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("Agency");
  const isOwner = user?.role === "OWNER";
  const canManage = user?.role === "OWNER" || user?.role === "MANAGER";

  return (
    <div>
      <PageHeader title="Settings" subtitle="Manage your agency, team, and messaging providers." />
      <div className="mb-6 flex gap-1 border-b border-slate-200">
        {TABS.map((t) => {
          const Icon = t === "Agency" ? Building2 : t === "Team" ? Users : MessageSquare;
          return (
            <button key={t} onClick={() => setTab(t)} className={`relative flex items-center gap-1.5 px-3 py-2 text-sm font-medium ${tab === t ? "text-brand-700" : "text-slate-500 hover:text-slate-700"}`}>
              <Icon className="h-4 w-4" /> {t}
              {tab === t && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-brand-600" />}
            </button>
          );
        })}
      </div>

      {tab === "Agency" && <AgencyTab canManage={canManage} />}
      {tab === "Team" && <TeamTab canManage={canManage} isOwner={isOwner} />}
      {tab === "Providers" && <ProvidersTab isOwner={isOwner} />}
    </div>
  );
}

function AgencyTab({ canManage }: { canManage: boolean }) {
  const { refresh } = useAuth();
  const toast = useToast();
  const [agency, setAgency] = useState<Agency | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get<Agency>("/api/agency").then((a) => {
      setAgency(a);
      setForm({ name: a.name, timezone: a.timezone, agedLeadDays: String(a.agedLeadDays), emailFromName: a.emailFromName ?? "", emailFromAddress: a.emailFromAddress ?? "", twilioFromNumber: a.twilioFromNumber ?? "" });
    });
  }, []);

  if (!agency) return <Spinner />;

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    try {
      await api.patch("/api/agency", { ...form, agedLeadDays: Number(form.agedLeadDays) });
      toast("Agency updated"); refresh();
    } catch (err) { toast(err instanceof ApiError ? err.message : "Failed", "error"); } finally { setBusy(false); }
  };

  return (
    <Card className="max-w-2xl p-6">
      <form onSubmit={save} className="space-y-4">
        <Field label="Agency name"><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} disabled={!canManage} /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Timezone"><Input value={form.timezone} onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))} disabled={!canManage} /></Field>
          <Field label="Aged-lead threshold (days)" hint="Recruits idle this long become aged leads."><Input type="number" min={1} value={form.agedLeadDays} onChange={(e) => setForm((f) => ({ ...f, agedLeadDays: e.target.value }))} disabled={!canManage} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Email from name"><Input value={form.emailFromName} onChange={(e) => setForm((f) => ({ ...f, emailFromName: e.target.value }))} disabled={!canManage} /></Field>
          <Field label="Email from address" hint="Must be verified in Resend."><Input type="email" value={form.emailFromAddress} onChange={(e) => setForm((f) => ({ ...f, emailFromAddress: e.target.value }))} disabled={!canManage} /></Field>
        </div>
        <Field label="SMS from number" hint="Your Twilio number, E.164 format."><Input value={form.twilioFromNumber} onChange={(e) => setForm((f) => ({ ...f, twilioFromNumber: e.target.value }))} disabled={!canManage} placeholder="+15551234567" /></Field>
        {canManage && <div className="flex justify-end"><Button type="submit" loading={busy}>Save changes</Button></div>}
      </form>
    </Card>
  );
}

function TeamTab({ canManage, isOwner }: { canManage: boolean; isOwner: boolean }) {
  const { user } = useAuth();
  const toast = useToast();
  const [agents, setAgents] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const load = () => api.get<User[]>("/api/agents").then((a) => { setAgents(a); setLoading(false); });
  useEffect(() => { load(); }, []);

  const setRole = async (id: string, role: string) => { try { await api.patch(`/api/agents/${id}`, { role }); load(); } catch (e) { toast(e instanceof ApiError ? e.message : "Failed", "error"); } };
  const setActive = async (id: string, isActive: boolean) => { try { await api.patch(`/api/agents/${id}`, { isActive }); load(); } catch (e) { toast(e instanceof ApiError ? e.message : "Failed", "error"); } };

  if (loading) return <Spinner />;

  return (
    <div>
      {canManage && <div className="mb-4 flex justify-end"><Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Add team member</Button></div>}
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
            <tr><th className="px-4 py-3 font-semibold">Name</th><th className="px-4 py-3 font-semibold">Email</th><th className="px-4 py-3 font-semibold">Role</th><th className="px-4 py-3 font-semibold">Last login</th><th className="px-4 py-3 font-semibold">Status</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {agents.map((a) => (
              <tr key={a.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-800">{a.firstName} {a.lastName}{a.id === user?.id && <span className="ml-1 text-xs text-slate-400">(you)</span>}</td>
                <td className="px-4 py-3 text-slate-500">{a.email}</td>
                <td className="px-4 py-3">
                  {canManage && a.id !== user?.id ? (
                    <Select value={a.role} onChange={(e) => setRole(a.id, e.target.value)} className="!w-auto !py-1 text-xs" disabled={!isOwner && a.role === "OWNER"}>
                      {["AGENT", "MANAGER", ...(isOwner ? ["OWNER"] : [])].map((r) => <option key={r} value={r}>{r}</option>)}
                    </Select>
                  ) : <Badge>{a.role}</Badge>}
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">{fmtRelative(a.lastLoginAt)}</td>
                <td className="px-4 py-3">
                  {canManage && a.id !== user?.id ? (
                    <button onClick={() => setActive(a.id, !a.isActive)} className="text-xs">
                      {a.isActive ? <span className="badge bg-emerald-100 text-emerald-700">Active</span> : <span className="badge bg-slate-200 text-slate-600">Inactive</span>}
                    </button>
                  ) : (a.isActive ? <Badge status="ACTIVE">Active</Badge> : <Badge>Inactive</Badge>)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <AddMemberModal open={open} onClose={() => setOpen(false)} onSaved={load} isOwner={isOwner} />
    </div>
  );
}

function AddMemberModal({ open, onClose, onSaved, isOwner }: { open: boolean; onClose: () => void; onSaved: () => void; isOwner: boolean }) {
  const toast = useToast();
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", password: "", role: "AGENT" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { if (open) { setForm({ firstName: "", lastName: "", email: "", phone: "", password: "", role: "AGENT" }); setError(""); } }, [open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError("");
    try { await api.post("/api/agents", form); toast("Team member added"); onSaved(); onClose(); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Failed"); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add team member">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="First name"><Input value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} required /></Field>
          <Field label="Last name"><Input value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} required /></Field>
        </div>
        <Field label="Email"><Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} /></Field>
          <Field label="Role"><Select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>{["AGENT", "MANAGER", ...(isOwner ? ["OWNER"] : [])].map((r) => <option key={r} value={r}>{r}</option>)}</Select></Field>
        </div>
        <Field label="Temporary password" hint="At least 8 characters. They can change it after signing in."><Input type="text" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} required minLength={8} /></Field>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" loading={busy}>Add</Button></div>
      </form>
    </Modal>
  );
}

function ProvidersTab({ isOwner }: { isOwner: boolean }) {
  const toast = useToast();
  const [agency, setAgency] = useState<Agency | null>(null);
  const [form, setForm] = useState({ twilioAccountSid: "", twilioAuthToken: "", twilioFromNumber: "", resendApiKey: "", emailFromAddress: "", emailFromName: "" });
  const [busy, setBusy] = useState(false);

  const load = () => api.get<Agency>("/api/agency").then((a) => { setAgency(a); setForm((f) => ({ ...f, twilioFromNumber: a.twilioFromNumber ?? "", emailFromAddress: a.emailFromAddress ?? "", emailFromName: a.emailFromName ?? "" })); });
  useEffect(() => { load(); }, []);

  if (!agency) return <Spinner />;
  const p = agency.providers;

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    // Only send non-empty secret fields so we don't wipe existing creds.
    const payload: Record<string, string> = { twilioFromNumber: form.twilioFromNumber, emailFromAddress: form.emailFromAddress, emailFromName: form.emailFromName };
    if (form.twilioAccountSid) payload.twilioAccountSid = form.twilioAccountSid;
    if (form.twilioAuthToken) payload.twilioAuthToken = form.twilioAuthToken;
    if (form.resendApiKey) payload.resendApiKey = form.resendApiKey;
    try { await api.patch("/api/agency/providers", payload); toast("Providers updated — sending is now live where configured"); load(); }
    catch (err) { toast(err instanceof ApiError ? err.message : "Failed", "error"); } finally { setBusy(false); }
  };

  return (
    <div className="max-w-2xl space-y-4">
      <Card className="p-5">
        <div className="flex items-center gap-6">
          <ProviderStatus label="SMS (Twilio)" ok={p?.sms.configured} detail={p?.sms.from} />
          <ProviderStatus label="Email (Resend)" ok={p?.email.configured} detail={p?.email.from} />
        </div>
        <p className="mt-3 text-xs text-slate-400">Until a provider is configured, automated and manual messages are composed and parked in the outbox as <span className="font-semibold">Queued</span>, then send automatically the moment credentials are added.</p>
      </Card>

      {!isOwner ? (
        <Card className="p-5 text-sm text-slate-500">Only the agency owner can edit provider credentials.</Card>
      ) : (
        <Card className="p-6">
          <form onSubmit={save} className="space-y-5">
            <div>
              <h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-800"><MessageSquare className="h-4 w-4" /> Twilio (SMS)</h3>
              <div className="space-y-3">
                <Field label="Account SID"><Input value={form.twilioAccountSid} onChange={(e) => setForm((f) => ({ ...f, twilioAccountSid: e.target.value }))} placeholder={agency.hasTwilioCreds ? "•••• saved — enter to replace" : "ACxxxx…"} /></Field>
                <Field label="Auth token"><Input type="password" value={form.twilioAuthToken} onChange={(e) => setForm((f) => ({ ...f, twilioAuthToken: e.target.value }))} placeholder={agency.hasTwilioCreds ? "•••• saved — enter to replace" : ""} /></Field>
                <Field label="From number"><Input value={form.twilioFromNumber} onChange={(e) => setForm((f) => ({ ...f, twilioFromNumber: e.target.value }))} placeholder="+15551234567" /></Field>
              </div>
            </div>
            <div className="border-t border-slate-100 pt-5">
              <h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-800"><KeyRound className="h-4 w-4" /> Resend (Email)</h3>
              <div className="space-y-3">
                <Field label="API key"><Input type="password" value={form.resendApiKey} onChange={(e) => setForm((f) => ({ ...f, resendApiKey: e.target.value }))} placeholder={agency.hasResendCreds ? "•••• saved — enter to replace" : "re_xxxx…"} /></Field>
                <Field label="From address" hint="Must be a verified Resend sender/domain."><Input type="email" value={form.emailFromAddress} onChange={(e) => setForm((f) => ({ ...f, emailFromAddress: e.target.value }))} placeholder="hello@youragency.com" /></Field>
                <Field label="From name"><Input value={form.emailFromName} onChange={(e) => setForm((f) => ({ ...f, emailFromName: e.target.value }))} /></Field>
              </div>
            </div>
            <div className="flex justify-end"><Button type="submit" loading={busy}>Save providers</Button></div>
          </form>
        </Card>
      )}
    </div>
  );
}

function ProviderStatus({ label, ok, detail }: { label: string; ok?: boolean; detail?: string | null }) {
  return (
    <div className="flex items-center gap-2">
      {ok ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <XCircle className="h-5 w-5 text-slate-300" />}
      <div>
        <p className="text-sm font-medium text-slate-700">{label}</p>
        <p className="text-xs text-slate-400">{ok ? detail || "Configured" : "Not configured"}</p>
      </div>
    </div>
  );
}
