"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { useMeta } from "@/lib/meta";
import { useToast } from "@/lib/toast";
import { Button, Card, Badge, Spinner, EmptyState, PageHeader, Select, Modal, Field, Input, Textarea } from "@/components/ui";
import { fmtDate, humanize } from "@/lib/format";
import type { Referral, Contact, Paginated } from "@/lib/types";
import { Plus, ArrowRightCircle } from "lucide-react";

export default function ReferralsPage() {
  const meta = useMeta();
  const toast = useToast();
  const [status, setStatus] = useState("");
  const { data, loading, reload } = useApi<Referral[]>(`/api/referrals${status ? `?status=${status}` : ""}`);
  const [open, setOpen] = useState(false);

  const convert = async (id: string) => {
    try {
      const res = await api.post<{ contact: Contact }>(`/api/referrals/${id}/convert`);
      toast(`Converted to client lead: ${res.contact.firstName} ${res.contact.lastName}`);
      reload();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Failed", "error");
    }
  };

  const setReferralStatus = async (id: string, s: string) => {
    await api.patch(`/api/referrals/${id}`, { status: s });
    reload();
  };

  return (
    <div>
      <PageHeader title="Referrals" subtitle="Capture referrals, track them, and convert into client leads." actions={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Add referral</Button>} />

      <Card className="mb-4 flex items-center gap-3 p-3">
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="max-w-[200px]">
          <option value="">All statuses</option>
          {meta?.referralStatuses.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
        </Select>
      </Card>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner className="h-7 w-7" /></div>
      ) : !data || data.length === 0 ? (
        <EmptyState title="No referrals yet" description="Add referrals from happy clients and convert them into new business." action={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Add referral</Button>} />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3 font-semibold">Referred person</th>
                <th className="hidden px-4 py-3 font-semibold md:table-cell">Referred by</th>
                <th className="hidden px-4 py-3 font-semibold lg:table-cell">Added</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{r.referredName || "—"}</p>
                    <p className="text-xs text-slate-400">{r.referredPhone || r.referredEmail || ""}</p>
                  </td>
                  <td className="hidden px-4 py-3 text-slate-500 md:table-cell">{r.referrer ? `${r.referrer.firstName} ${r.referrer.lastName}` : "—"}</td>
                  <td className="hidden px-4 py-3 text-slate-400 lg:table-cell">{fmtDate(r.createdAt)}</td>
                  <td className="px-4 py-3">
                    <Select value={r.status} onChange={(e) => setReferralStatus(r.id, e.target.value)} className="!w-auto !py-1 text-xs">
                      {meta?.referralStatuses.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
                    </Select>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {r.referredContactId ? (
                      <Link href={`/contacts/${r.referredContactId}`} className="text-xs font-semibold text-brand-600 hover:underline">View lead →</Link>
                    ) : (
                      <Button variant="ghost" onClick={() => convert(r.id)}><ArrowRightCircle className="h-4 w-4" /> Convert</Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <ReferralForm open={open} onClose={() => setOpen(false)} onSaved={reload} />
    </div>
  );
}

function ReferralForm({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [form, setForm] = useState({ referrerId: "", referredName: "", referredPhone: "", referredEmail: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError(""); setForm({ referrerId: "", referredName: "", referredPhone: "", referredEmail: "", notes: "" });
    api.get<Paginated<Contact>>("/api/contacts?type=CLIENT&pageSize=100").then((d) => setContacts(d.items)).catch(() => {});
  }, [open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError("");
    try {
      await api.post("/api/referrals", { ...form, referrerId: form.referrerId || undefined });
      toast("Referral added"); onSaved(); onClose();
    } catch (err) { setError(err instanceof ApiError ? err.message : "Failed"); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add referral">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Referred by (client)">
          <Select value={form.referrerId} onChange={(e) => setForm((f) => ({ ...f, referrerId: e.target.value }))}>
            <option value="">Unknown / external</option>
            {contacts.map((c) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
          </Select>
        </Field>
        <Field label="Referred person name"><Input value={form.referredName} onChange={(e) => setForm((f) => ({ ...f, referredName: e.target.value }))} required /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Phone"><Input value={form.referredPhone} onChange={(e) => setForm((f) => ({ ...f, referredPhone: e.target.value }))} /></Field>
          <Field label="Email"><Input type="email" value={form.referredEmail} onChange={(e) => setForm((f) => ({ ...f, referredEmail: e.target.value }))} /></Field>
        </div>
        <Field label="Notes"><Textarea rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></Field>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" loading={busy}>Add</Button></div>
      </form>
    </Modal>
  );
}
