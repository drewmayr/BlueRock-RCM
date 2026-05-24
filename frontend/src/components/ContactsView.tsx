"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useMeta } from "@/lib/meta";
import { Button, Input, Select, Badge, Card, Spinner, EmptyState, PageHeader } from "@/components/ui";
import ContactForm from "@/components/ContactForm";
import { fmtRelative, humanize, initials } from "@/lib/format";
import type { Contact, ContactType, Paginated } from "@/lib/types";
import { Plus, Search, AlertTriangle } from "lucide-react";

export default function ContactsView({ type }: { type: ContactType }) {
  const meta = useMeta();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [aged, setAged] = useState(false);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<Contact> | null>(null);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);

  const stages = type === "RECRUIT" ? meta?.recruitStages : meta?.clientStages;
  const isRecruit = type === "RECRUIT";

  const query = useMemo(() => {
    const p = new URLSearchParams({ type, page: String(page), pageSize: "25" });
    if (q) p.set("q", q);
    if (status) p.set("status", status);
    if (aged) p.set("aged", "true");
    return p.toString();
  }, [type, page, q, status, aged]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const t = setTimeout(() => {
      api.get<Paginated<Contact>>(`/api/contacts?${query}`).then((d) => {
        if (active) {
          setData(d);
          setLoading(false);
        }
      });
    }, 250);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [query]);

  const reload = () => api.get<Paginated<Contact>>(`/api/contacts?${query}`).then(setData);

  return (
    <div>
      <PageHeader
        title={isRecruit ? "Recruiting" : "Clients"}
        subtitle={isRecruit ? "Manage recruiting leads and revive aged ones automatically." : "Manage client relationships, policies, and life events."}
        actions={
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" /> Add {isRecruit ? "recruit" : "client"}
          </Button>
        }
      />

      <Card className="mb-4 flex flex-wrap items-center gap-3 p-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} placeholder="Search name, email, phone…" className="pl-9" />
        </div>
        <Select value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }} className="max-w-[200px]">
          <option value="">All stages</option>
          {stages?.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
        </Select>
        {isRecruit && (
          <label className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600">
            <input type="checkbox" checked={aged} onChange={(e) => { setPage(1); setAged(e.target.checked); }} />
            <AlertTriangle className="h-4 w-4 text-orange-500" /> Aged only
          </label>
        )}
      </Card>

      {loading && !data ? (
        <div className="flex justify-center py-16"><Spinner className="h-7 w-7" /></div>
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          title={`No ${isRecruit ? "recruits" : "clients"} found`}
          description={q || status || aged ? "Try adjusting your filters." : `Add your first ${isRecruit ? "recruit" : "client"} to get started.`}
          action={<Button onClick={() => setFormOpen(true)}><Plus className="h-4 w-4" /> Add {isRecruit ? "recruit" : "client"}</Button>}
        />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Stage</th>
                <th className="hidden px-4 py-3 font-semibold md:table-cell">Contact</th>
                <th className="hidden px-4 py-3 font-semibold lg:table-cell">Owner</th>
                <th className="hidden px-4 py-3 font-semibold lg:table-cell">Last touch</th>
                <th className="px-4 py-3 font-semibold">{isRecruit ? "" : "Policies"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.items.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/contacts/${c.id}`} className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                        {initials(c.firstName, c.lastName)}
                      </span>
                      <span>
                        <span className="block font-medium text-slate-800 hover:text-brand-600">{c.firstName} {c.lastName}</span>
                        {c.isAged && <span className="text-xs font-medium text-orange-500">Aged lead</span>}
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3"><Badge status={c.status} /></td>
                  <td className="hidden px-4 py-3 text-slate-500 md:table-cell">
                    <div>{c.phone || "—"}</div>
                    <div className="text-xs text-slate-400">{c.email || ""}</div>
                  </td>
                  <td className="hidden px-4 py-3 text-slate-500 lg:table-cell">
                    {c.owner ? `${c.owner.firstName} ${c.owner.lastName}` : "—"}
                  </td>
                  <td className="hidden px-4 py-3 text-xs text-slate-400 lg:table-cell">{fmtRelative(c.lastContactedAt)}</td>
                  <td className="px-4 py-3 text-slate-500">{isRecruit ? "" : c._count?.policies ?? 0}</td>
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

      <ContactForm open={formOpen} onClose={() => setFormOpen(false)} type={type} onSaved={reload} />
    </div>
  );
}
