"use client";

import { useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/useApi";
import { useMeta } from "@/lib/meta";
import { Button, Card, Badge, Spinner, EmptyState, PageHeader, Select } from "@/components/ui";
import PolicyForm from "@/components/PolicyForm";
import { fmtMoney, fmtDate, humanize } from "@/lib/format";
import type { Policy } from "@/lib/types";
import { Plus, Pencil } from "lucide-react";

export default function PoliciesPage() {
  const meta = useMeta();
  const [status, setStatus] = useState("");
  const { data, loading, reload } = useApi<Policy[]>(`/api/policies${status ? `?status=${status}` : ""}`);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Policy | null>(null);

  const totalFace = (data ?? []).filter((p) => p.status === "ACTIVE").reduce((s, p) => s + Number(p.faceAmount ?? 0), 0);

  return (
    <div>
      <PageHeader
        title="Policies"
        subtitle={`${data?.length ?? 0} policies · ${fmtMoney(totalFace)} active face value`}
        actions={<Button onClick={() => { setEdit(null); setOpen(true); }}><Plus className="h-4 w-4" /> Add policy</Button>}
      />

      <Card className="mb-4 flex items-center gap-3 p-3">
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="max-w-[200px]">
          <option value="">All statuses</option>
          {meta?.policyStatuses.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
        </Select>
      </Card>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner className="h-7 w-7" /></div>
      ) : !data || data.length === 0 ? (
        <EmptyState title="No policies" description="Add a policy to track coverage, premiums, and renewals." action={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Add policy</Button>} />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3 font-semibold">Client</th>
                <th className="px-4 py-3 font-semibold">Product</th>
                <th className="hidden px-4 py-3 font-semibold md:table-cell">Carrier</th>
                <th className="px-4 py-3 font-semibold">Face</th>
                <th className="hidden px-4 py-3 font-semibold md:table-cell">Premium</th>
                <th className="hidden px-4 py-3 font-semibold lg:table-cell">Renewal</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    {p.contact ? <Link href={`/contacts/${p.contact.id}`} className="font-medium text-slate-800 hover:text-brand-600">{p.contact.firstName} {p.contact.lastName}</Link> : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{humanize(p.productType)}</td>
                  <td className="hidden px-4 py-3 text-slate-500 md:table-cell">{p.carrier || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{fmtMoney(p.faceAmount)}</td>
                  <td className="hidden px-4 py-3 text-slate-500 md:table-cell">{fmtMoney(p.premium)}{p.premiumMode ? `/${p.premiumMode.toLowerCase()}` : ""}</td>
                  <td className="hidden px-4 py-3 text-slate-500 lg:table-cell">{fmtDate(p.renewalDate)}</td>
                  <td className="px-4 py-3"><Badge status={p.status} /></td>
                  <td className="px-4 py-3 text-right"><Button variant="ghost" onClick={() => { setEdit(p); setOpen(true); }}><Pencil className="h-4 w-4" /></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <PolicyForm open={open} onClose={() => setOpen(false)} policy={edit} onSaved={reload} />
    </div>
  );
}
