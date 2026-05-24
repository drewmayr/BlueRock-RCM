"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { useMeta } from "@/lib/meta";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { Button, Card, Badge, Spinner, EmptyState, PageHeader, Select } from "@/components/ui";
import { fmtMoney, humanize } from "@/lib/format";
import type { CrossSell } from "@/lib/types";
import { Sparkles } from "lucide-react";

export default function CrossSellsPage() {
  const meta = useMeta();
  const { user } = useAuth();
  const toast = useToast();
  const [status, setStatus] = useState("");
  const { data, loading, reload } = useApi<CrossSell[]>(`/api/cross-sells${status ? `?status=${status}` : ""}`);
  const [detecting, setDetecting] = useState(false);

  const canDetect = user?.role === "OWNER" || user?.role === "MANAGER";
  const pipeline = (data ?? []).filter((x) => ["IDENTIFIED", "PRESENTED", "IN_PROGRESS"].includes(x.status)).reduce((s, x) => s + Number(x.estimatedValue ?? 0), 0);

  const detect = async () => {
    setDetecting(true);
    try {
      const res = await api.post<{ created: number }>("/api/cross-sells/detect");
      toast(`Detected ${res.created} new opportunit${res.created === 1 ? "y" : "ies"}`);
      reload();
    } finally {
      setDetecting(false);
    }
  };

  const setCsStatus = async (id: string, s: string) => {
    await api.patch(`/api/cross-sells/${id}`, { status: s });
    reload();
  };

  return (
    <div>
      <PageHeader
        title="Cross-Sell Opportunities"
        subtitle={`${fmtMoney(pipeline)} open pipeline · auto-detected from policy gaps & life events`}
        actions={canDetect && <Button variant="secondary" onClick={detect} loading={detecting}><Sparkles className="h-4 w-4" /> Detect opportunities</Button>}
      />

      <Card className="mb-4 flex items-center gap-3 p-3">
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="max-w-[200px]">
          <option value="">All statuses</option>
          {meta?.crossSellStatuses.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
        </Select>
      </Card>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner className="h-7 w-7" /></div>
      ) : !data || data.length === 0 ? (
        <EmptyState title="No opportunities yet" description="Add clients with policies and life details, then run the detector to surface cross-sell opportunities." action={canDetect && <Button onClick={detect} loading={detecting}><Sparkles className="h-4 w-4" /> Detect opportunities</Button>} />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3 font-semibold">Client</th>
                <th className="px-4 py-3 font-semibold">Product</th>
                <th className="hidden px-4 py-3 font-semibold md:table-cell">Why</th>
                <th className="hidden px-4 py-3 font-semibold lg:table-cell">Value</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((x) => (
                <tr key={x.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    {x.contact ? <Link href={`/contacts/${x.contact.id}`} className="font-medium text-slate-800 hover:text-brand-600">{x.contact.firstName} {x.contact.lastName}</Link> : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {humanize(x.productType)} {x.source === "AUTO" && <span className="badge ml-1 bg-violet-50 text-violet-600">Auto</span>}
                  </td>
                  <td className="hidden max-w-xs px-4 py-3 text-xs text-slate-500 md:table-cell">{x.reason || "—"}</td>
                  <td className="hidden px-4 py-3 text-slate-600 lg:table-cell">{fmtMoney(x.estimatedValue)}</td>
                  <td className="px-4 py-3">
                    <Select value={x.status} onChange={(e) => setCsStatus(x.id, e.target.value)} className="!w-auto !py-1 text-xs">
                      {meta?.crossSellStatuses.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
