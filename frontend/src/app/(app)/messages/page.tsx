"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { Button, Card, Badge, Spinner, EmptyState, PageHeader, Select } from "@/components/ui";
import { fmtDateTime, humanize } from "@/lib/format";
import type { Message, Paginated } from "@/lib/types";
import { Mail, MessageSquare, RefreshCw } from "lucide-react";

export default function MessagesPage() {
  const toast = useToast();
  const [status, setStatus] = useState("");
  const [channel, setChannel] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<Message> | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    const p = new URLSearchParams({ page: String(page), pageSize: "30" });
    if (status) p.set("status", status);
    if (channel) p.set("channel", channel);
    setLoading(true);
    api.get<Paginated<Message>>(`/api/messages?${p.toString()}`).then((d) => { setData(d); setLoading(false); });
  };
  useEffect(load, [status, channel, page]);

  const retry = async (id: string) => {
    await api.post(`/api/messages/${id}/retry`);
    toast("Retry attempted");
    load();
  };

  return (
    <div>
      <PageHeader title="Messages" subtitle="Outbox & delivery log for every automated and manual message." />

      <Card className="mb-4 flex flex-wrap items-center gap-3 p-3">
        <Select value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }} className="max-w-[180px]">
          <option value="">All statuses</option>
          {["SCHEDULED", "QUEUED", "SENT", "FAILED"].map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
        </Select>
        <Select value={channel} onChange={(e) => { setPage(1); setChannel(e.target.value); }} className="max-w-[150px]">
          <option value="">All channels</option>
          <option value="SMS">SMS</option>
          <option value="EMAIL">Email</option>
        </Select>
      </Card>

      {loading && !data ? (
        <div className="flex justify-center py-16"><Spinner className="h-7 w-7" /></div>
      ) : !data || data.items.length === 0 ? (
        <EmptyState title="No messages yet" description="Messages appear here as automations run or you send manually. Queued messages send automatically once a provider is configured in Settings." />
      ) : (
        <div className="space-y-2">
          {data.items.map((m) => (
            <Card key={m.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="flex items-center gap-1 font-semibold text-slate-500">
                      {m.channel === "SMS" ? <MessageSquare className="h-3.5 w-3.5" /> : <Mail className="h-3.5 w-3.5" />} {m.channel}
                    </span>
                    <Badge status={m.status} />
                    {m.contact && <Link href={`/contacts/${m.contact.id}`} className="text-slate-600 hover:text-brand-600">{m.contact.firstName} {m.contact.lastName}</Link>}
                    <span className="text-slate-400">{m.toAddress}</span>
                  </div>
                  {m.subject && <p className="mt-1 text-sm font-medium text-slate-700">{m.subject}</p>}
                  <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap text-sm text-slate-600">{m.body}</p>
                  {m.error && <p className="mt-1 text-xs text-amber-600">{m.error}</p>}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs text-slate-400">{fmtDateTime(m.sentAt ?? m.scheduledAt ?? m.createdAt)}</p>
                  {(m.status === "FAILED" || m.status === "QUEUED") && (
                    <Button variant="ghost" className="mt-1" onClick={() => retry(m.id)}><RefreshCw className="h-3.5 w-3.5" /> Retry</Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
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
    </div>
  );
}
