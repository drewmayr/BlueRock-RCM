"use client";

import { useEffect, useState } from "react";
import { Modal, Field, Input, Select, Textarea, Button } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { useMeta } from "@/lib/meta";
import { useToast } from "@/lib/toast";
import { humanize } from "@/lib/format";
import type { Contact, ContactType, User } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  type: ContactType;
  contact?: Contact | null;
  onSaved: (c: Contact) => void;
}

function dateInput(value: string | null | undefined): string {
  if (!value) return "";
  return value.slice(0, 10);
}

export default function ContactForm({ open, onClose, type, contact, onSaved }: Props) {
  const meta = useMeta();
  const toast = useToast();
  const [agents, setAgents] = useState<User[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<Record<string, string | boolean>>({});

  useEffect(() => {
    if (!open) return;
    api.get<User[]>("/api/agents").then(setAgents).catch(() => {});
    setError("");
    setForm({
      firstName: contact?.firstName ?? "",
      lastName: contact?.lastName ?? "",
      email: contact?.email ?? "",
      phone: contact?.phone ?? "",
      status: contact?.status ?? "",
      ownerId: contact?.ownerId ?? "",
      street: contact?.street ?? "",
      city: contact?.city ?? "",
      state: contact?.state ?? "",
      zip: contact?.zip ?? "",
      dateOfBirth: dateInput(contact?.dateOfBirth),
      anniversary: dateInput(contact?.anniversary),
      maritalStatus: contact?.maritalStatus ?? "",
      spouseName: contact?.spouseName ?? "",
      numberOfChildren: contact?.numberOfChildren?.toString() ?? "",
      occupation: contact?.occupation ?? "",
      employer: contact?.employer ?? "",
      incomeBand: contact?.incomeBand ?? "",
      retirementGoalAge: contact?.retirementGoalAge?.toString() ?? "",
      familyNotes: contact?.familyNotes ?? "",
      retirementNotes: contact?.retirementNotes ?? "",
      source: contact?.source ?? "",
      recruitNotes: contact?.recruitNotes ?? "",
      tags: (contact?.tags ?? []).join(", "),
      notes: contact?.notes ?? "",
      doNotContact: contact?.doNotContact ?? false,
    });
  }, [open, contact]);

  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));
  const stages = type === "RECRUIT" ? meta?.recruitStages : type === "REFERRAL" ? meta?.referralStages : meta?.clientStages;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    const payload: Record<string, unknown> = {
      type,
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email,
      phone: form.phone,
      status: form.status || undefined,
      ownerId: form.ownerId || undefined,
      street: form.street,
      city: form.city,
      state: form.state,
      zip: form.zip,
      tags: String(form.tags || "").split(",").map((t) => t.trim()).filter(Boolean),
      notes: form.notes,
      doNotContact: form.doNotContact,
    };
    if (type === "CLIENT" || type === "REFERRAL") {
      Object.assign(payload, {
        dateOfBirth: form.dateOfBirth,
        anniversary: form.anniversary,
        maritalStatus: form.maritalStatus,
        spouseName: form.spouseName,
        numberOfChildren: form.numberOfChildren,
        occupation: form.occupation,
        employer: form.employer,
        incomeBand: form.incomeBand,
        retirementGoalAge: form.retirementGoalAge,
        familyNotes: form.familyNotes,
        retirementNotes: form.retirementNotes,
      });
    } else {
      Object.assign(payload, { source: form.source, recruitNotes: form.recruitNotes });
    }

    try {
      const saved = contact
        ? await api.patch<Contact>(`/api/contacts/${contact.id}`, payload)
        : await api.post<Contact>("/api/contacts", payload);
      toast(contact ? "Contact updated" : `${type[0] + type.slice(1).toLowerCase()} added`);
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={contact ? "Edit contact" : `Add ${type.toLowerCase()}`} wide>
      <form onSubmit={submit} className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <Field label="First name">
            <Input value={form.firstName as string} onChange={(e) => set("firstName", e.target.value)} required />
          </Field>
          <Field label="Last name">
            <Input value={form.lastName as string} onChange={(e) => set("lastName", e.target.value)} required />
          </Field>
          <Field label="Email">
            <Input type="email" value={form.email as string} onChange={(e) => set("email", e.target.value)} />
          </Field>
          <Field label="Phone" hint="E.164 format for SMS, e.g. +15551234567">
            <Input value={form.phone as string} onChange={(e) => set("phone", e.target.value)} />
          </Field>
          <Field label="Stage">
            <Select value={form.status as string} onChange={(e) => set("status", e.target.value)}>
              <option value="">Default</option>
              {stages?.map((s) => (
                <option key={s} value={s}>{humanize(s)}</option>
              ))}
            </Select>
          </Field>
          <Field label="Assigned agent">
            <Select value={form.ownerId as string} onChange={(e) => set("ownerId", e.target.value)}>
              <option value="">Me</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{a.firstName} {a.lastName}</option>
              ))}
            </Select>
          </Field>
        </div>

        {type === "CLIENT" || type === "REFERRAL" ? (
          <>
            <div className="border-t border-slate-100 pt-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Life details (drive automation & cross-sell)</p>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Field label="Date of birth"><Input type="date" value={form.dateOfBirth as string} onChange={(e) => set("dateOfBirth", e.target.value)} /></Field>
                <Field label="Anniversary"><Input type="date" value={form.anniversary as string} onChange={(e) => set("anniversary", e.target.value)} /></Field>
                <Field label="Marital status">
                  <Select value={form.maritalStatus as string} onChange={(e) => set("maritalStatus", e.target.value)}>
                    <option value="">—</option>
                    {["Single", "Married", "Divorced", "Widowed"].map((m) => <option key={m}>{m}</option>)}
                  </Select>
                </Field>
                <Field label="Spouse name"><Input value={form.spouseName as string} onChange={(e) => set("spouseName", e.target.value)} /></Field>
                <Field label="# Children"><Input type="number" min={0} value={form.numberOfChildren as string} onChange={(e) => set("numberOfChildren", e.target.value)} /></Field>
                <Field label="Retirement goal age"><Input type="number" min={0} value={form.retirementGoalAge as string} onChange={(e) => set("retirementGoalAge", e.target.value)} /></Field>
                <Field label="Occupation"><Input value={form.occupation as string} onChange={(e) => set("occupation", e.target.value)} /></Field>
                <Field label="Employer"><Input value={form.employer as string} onChange={(e) => set("employer", e.target.value)} /></Field>
                <Field label="Income band"><Input value={form.incomeBand as string} onChange={(e) => set("incomeBand", e.target.value)} placeholder="$50k–$75k" /></Field>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Family notes"><Textarea rows={2} value={form.familyNotes as string} onChange={(e) => set("familyNotes", e.target.value)} /></Field>
              <Field label="Retirement notes"><Textarea rows={2} value={form.retirementNotes as string} onChange={(e) => set("retirementNotes", e.target.value)} /></Field>
            </div>
          </>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Lead source"><Input value={form.source as string} onChange={(e) => set("source", e.target.value)} placeholder="Indeed, referral, event…" /></Field>
            <Field label="Recruit notes"><Textarea rows={2} value={form.recruitNotes as string} onChange={(e) => set("recruitNotes", e.target.value)} /></Field>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-4">
          <Field label="City"><Input value={form.city as string} onChange={(e) => set("city", e.target.value)} /></Field>
          <Field label="State"><Input value={form.state as string} onChange={(e) => set("state", e.target.value)} /></Field>
          <Field label="ZIP"><Input value={form.zip as string} onChange={(e) => set("zip", e.target.value)} /></Field>
          <Field label="Tags"><Input value={form.tags as string} onChange={(e) => set("tags", e.target.value)} placeholder="vip, español" /></Field>
        </div>

        <Field label="General notes"><Textarea rows={2} value={form.notes as string} onChange={(e) => set("notes", e.target.value)} /></Field>

        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={form.doNotContact as boolean} onChange={(e) => set("doNotContact", e.target.checked)} />
          Do not contact (excludes from all automations)
        </label>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={busy}>{contact ? "Save changes" : "Add"}</Button>
        </div>
      </form>
    </Modal>
  );
}
