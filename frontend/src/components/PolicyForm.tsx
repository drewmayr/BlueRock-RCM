"use client";

import { useEffect, useState } from "react";
import { Modal, Field, Input, Select, Textarea, Button } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { useMeta } from "@/lib/meta";
import { useToast } from "@/lib/toast";
import { humanize } from "@/lib/format";
import type { Policy, Contact, Paginated } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  fixedContactId?: string;
  policy?: Policy | null;
  onSaved: () => void;
}

export default function PolicyForm({ open, onClose, fixedContactId, policy, onSaved }: Props) {
  const meta = useMeta();
  const toast = useToast();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setError("");
    if (!fixedContactId) {
      api.get<Paginated<Contact>>("/api/contacts?pageSize=100").then((d) => setContacts(d.items)).catch(() => {});
    }
    setForm({
      contactId: policy?.contactId ?? fixedContactId ?? "",
      productType: policy?.productType ?? "TERM_LIFE",
      carrier: policy?.carrier ?? "",
      policyNumber: policy?.policyNumber ?? "",
      faceAmount: policy?.faceAmount ?? "",
      premium: policy?.premium ?? "",
      premiumMode: policy?.premiumMode ?? "MONTHLY",
      status: policy?.status ?? "ACTIVE",
      effectiveDate: policy?.effectiveDate?.slice(0, 10) ?? "",
      renewalDate: policy?.renewalDate?.slice(0, 10) ?? "",
      notes: policy?.notes ?? "",
    });
  }, [open, policy, fixedContactId]);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (policy) {
        const { contactId, ...rest } = form;
        await api.patch(`/api/policies/${policy.id}`, rest);
      } else {
        await api.post("/api/policies", form);
      }
      toast(policy ? "Policy updated" : "Policy added");
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={policy ? "Edit policy" : "Add policy"}>
      <form onSubmit={submit} className="space-y-4">
        {!fixedContactId && !policy && (
          <Field label="Client">
            <Select value={form.contactId} onChange={(e) => set("contactId", e.target.value)} required>
              <option value="">Select a contact…</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>{c.firstName} {c.lastName} {c.type === "RECRUIT" ? "(recruit)" : ""}</option>
              ))}
            </Select>
          </Field>
        )}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Product type">
            <Select value={form.productType} onChange={(e) => set("productType", e.target.value)}>
              {meta?.productTypes.map((p) => <option key={p} value={p}>{humanize(p)}</option>)}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={(e) => set("status", e.target.value)}>
              {meta?.policyStatuses.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
            </Select>
          </Field>
          <Field label="Carrier"><Input value={form.carrier} onChange={(e) => set("carrier", e.target.value)} /></Field>
          <Field label="Policy number"><Input value={form.policyNumber} onChange={(e) => set("policyNumber", e.target.value)} /></Field>
          <Field label="Face amount"><Input type="number" min={0} value={form.faceAmount} onChange={(e) => set("faceAmount", e.target.value)} placeholder="500000" /></Field>
          <Field label="Premium"><Input type="number" min={0} step="0.01" value={form.premium} onChange={(e) => set("premium", e.target.value)} placeholder="85" /></Field>
          <Field label="Premium mode">
            <Select value={form.premiumMode} onChange={(e) => set("premiumMode", e.target.value)}>
              {meta?.premiumModes.map((m) => <option key={m} value={m}>{humanize(m)}</option>)}
            </Select>
          </Field>
          <div />
          <Field label="Effective date"><Input type="date" value={form.effectiveDate} onChange={(e) => set("effectiveDate", e.target.value)} /></Field>
          <Field label="Renewal date"><Input type="date" value={form.renewalDate} onChange={(e) => set("renewalDate", e.target.value)} /></Field>
        </div>
        <Field label="Notes"><Textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={busy}>{policy ? "Save" : "Add policy"}</Button>
        </div>
      </form>
    </Modal>
  );
}
