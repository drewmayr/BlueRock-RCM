"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, API_URL, getAccessToken } from "@/lib/api";
import { useMeta } from "@/lib/meta";
import { useToast } from "@/lib/toast";
import { Button, Card, Badge, Spinner, EmptyState, PageHeader, Input, Select } from "@/components/ui";
import ContactForm from "@/components/ContactForm";
import LeadImportModal from "@/components/LeadImportModal";
import { humanize, initials, fmtRelative } from "@/lib/format";
import type { Lead, Paginated, ContactType } from "@/lib/types";
import { Plus, Search, Upload, Download, ChevronDown, AlertTriangle, FileText, TrendingUp } from "lucide-react";

const AGING_TONE: Record<string, string> = {
  FRESH: "bg-emerald-100 text-emerald-700",
  WARM: "bg-amber-100 text-amber-700",
  COOL: "bg-orange-100 text-orange-700",
  COLD: "bg-red-100 text-red-700",
};
const TYPE_TABS = [
  { key: "", label: "All Leads" },
  { key: "RECRUIT", label: "Recruits" },
  { key: "CLIENT", label: "Clients" },
  { key: "REFERRAL", label: "Referrals" },
];
const SEGMENTS = [
  { key: "", label: "All" },
  { key: "AGED", label: "Aged", icon: AlertTriangle },
  { key: "SOLD_POLICY", label: "Sold Policy", icon: FileText },
  { key: "CROSS_SELL", label: "Cross-Sell", icon: TrendingUp },
];

export default function LeadsPage() {
  const meta = useMeta();
  const toast = useToast();
  const [type, setType] = useState("");
  const [segment, setSegment] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<Lead> | null>(null);
  const [loading, setLoading] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const [addType, setAddType] = useState<ContactType | null>(null);
  const [addMenu, setAddMenu] = useState(false);

  const query = useMemo(() => {
    const p = new URLSearchParams({ page: String(page), pageSize: "50" });
    if (type) p.set("type", type);
    if (segment) p.set("segment", segment);
    if (q) p.set("q", q);
    return p.toString();
  }, [type, segment, q, page]);

  const load = () => api.get<Paginated<Lead>>(`/api/leads?${query}`).then((d) => { setData(d); setLoading(false); });
  useEffect(() => {
    setLoading(true);
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [query]);

  const exportLeads = async () => {
    try {
      const res = await fetch(`${API_URL}/api/leads/export${type ? `?type=${type}` : ""}`, { headers: { Authorization: `Bearer ${getAccessToken()}` } });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "bluerock-leads.csv"; a.click();
      URL.revokeObjectURL(url);
      toast("Export downloaded");
    } catch { toast("Export failed", "error"); }
  };

  return (
    <div>
      <PageHeader
        title="Leads"
        subtitle="One database for every lead — recruits, clients, and referrals. Import, classify, and let automations work them."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={exportLeads}><Download className="h-4 w-4" /> Export</Button>
            <Button variant="secondary" onClick={() => setImportOpen(true)}><Upload className="h-4 w-4" /> Import</Button>
            <div className="relative">
              <Button onClick={() => setAddMenu((o) => !o)}><Plus className="h-4 w-4" /> Add lead <ChevronDown className="h-3.5 w-3.5" /></Button>
              {addMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setAddMenu(false)} />
                  <div className="absolute right-0 z-20 mt-1 w-40 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                    {(["RECRUIT", "CLIENT", "REFERRAL"] as ContactType[]).map((t) => (
                      <button key={t} onClick={() => { setAddType(t); setAddMenu(false); }} className="block w-full px-4 py-2 text-left text-sm text-slate-600 hover:bg-slate-50">{humanize(t)}</button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        }
      />

      {/* Type tabs */}
      <div className="mb-4 flex flex-wrap gap-1 border-b border-slate-200">
        {TYPE_TABS.map((t) => (
          <button key={t.key} onClick={() => { setType(t.key); setPage(1); }}
            className={`relative px-4 py-2 text-sm font-medium ${type === t.key ? "text-brand-700" : "text-slate-500 hover:text-slate-700"}`}>
            {t.label}
            {type === t.key && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-brand-600" />}
          </button>
        ))}
      </div>

      {/* Controls */}
      <Card className="mb-4 flex flex-wrap items-center gap-3 p-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} placeholder="Search name, email, phone…" className="pl-9" />
        </div>
        <div className="flex gap-1">
          {SEGMENTS.map((s) => (
            <button key={s.key} onClick={() => { setSegment(s.key); setPage(1); }}
              className={`flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium ${segment === s.key ? "bg-brand-50 text-brand-700" : "text-slate-500 hover:bg-slate-100"}`}>
              {s.icon && <s.icon className="h-3.5 w-3.5" />} {s.label}
            </button>
          ))}
        </div>
      </Card>

      {loading && !data ? (
        <div className="flex justify-center py-16"><Spinner className="h-7 w-7" /></div>
      ) : !data || data.items.length === 0 ? (
        <EmptyState title="No leads found" description="Add a lead or import a CSV to get started." action={<Button onClick={() => setImportOpen(true)}><Upload className="h-4 w-4" /> Import CSV</Button>} />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Stage</th>
                <th className="hidden px-4 py-3 font-semibold md:table-cell">Aging</th>
                <th className="hidden px-4 py-3 font-semibold lg:table-cell">Segments</th>
                <th className="hidden px-4 py-3 font-semibold lg:table-cell">Last touch</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.items.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/contacts/${c.id}`} className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">{initials(c.firstName, c.lastName)}</span>
                      <span>
                        <span className="block font-medium text-slate-800 hover:text-brand-600">{c.firstName} {c.lastName}</span>
                        <span className="text-xs text-slate-400">{c.phone || c.email || ""}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3"><span className="badge bg-slate-100 text-slate-600">{humanize(c.type)}</span></td>
                  <td className="px-4 py-3"><Badge status={c.status} /></td>
                  <td className="hidden px-4 py-3 md:table-cell"><span className={`badge ${AGING_TONE[c.agingTier] ?? "bg-slate-100 text-slate-600"}`}>{c.agingTier === "FRESH" ? "Fresh" : `${c.daysSinceContact}d`}</span></td>
                  <td className="hidden px-4 py-3 lg:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {c.isAged && <span className="badge bg-orange-100 text-orange-700">Aged</span>}
                      {c.hasActivePolicy && <span className="badge bg-emerald-100 text-emerald-700">Sold</span>}
                      {c.hasOpenCrossSell && <span className="badge bg-violet-100 text-violet-700">Cross-sell</span>}
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-xs text-slate-400 lg:table-cell">{fmtRelative(c.lastContactedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {data && data.pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
          <span>{data.total} total</span>
          <div className="flex gap-2">
            <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <span className="flex items-center px-2">Page {data.page} of {data.pages}</span>
            <Button variant="secondary" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      )}

      <LeadImportModal open={importOpen} onClose={() => setImportOpen(false)} onDone={load} />
      {addType && <ContactForm open={!!addType} onClose={() => setAddType(null)} type={addType} onSaved={load} />}
    </div>
  );
}
