"use client";

import Link from "next/link";
import { api } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { useToast } from "@/lib/toast";
import { Card, Button, Spinner, PageHeader, Badge } from "@/components/ui";
import { fmtRelative, fmtDate } from "@/lib/format";
import type { NotificationCenter } from "@/lib/types";
import { Cake, Heart, FileText, UserPlus, CalendarClock, CheckSquare, Share2, TrendingUp, BellRing, CheckCheck } from "lucide-react";

export default function NotificationsPage() {
  const toast = useToast();
  const { data, loading, reload } = useApi<NotificationCenter>("/api/notifications");

  const markAll = async () => { await api.post("/api/notifications/read-all"); toast("All marked read"); reload(); };
  const markOne = async (id: string) => { await api.post(`/api/notifications/${id}/read`); reload(); };

  if (loading || !data) return <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>;
  const r = data.reminders;

  const buckets = [
    { key: "upcomingBirthdays", title: "Upcoming birthdays", icon: Cake, tone: "text-pink-500", render: (i: any) => ({ label: i.name, meta: i.days === 0 ? "Today" : `in ${i.days}d`, link: `/contacts/${i.id}` }) },
    { key: "upcomingAnniversaries", title: "Upcoming anniversaries", icon: Heart, tone: "text-rose-500", render: (i: any) => ({ label: i.name, meta: i.days === 0 ? "Today" : `in ${i.days}d`, link: `/contacts/${i.id}` }) },
    { key: "policyRenewals", title: "Policy renewals", icon: FileText, tone: "text-emerald-500", render: (i: any) => ({ label: i.name, meta: `in ${i.days}d`, link: i.id ? `/contacts/${i.id}` : undefined }) },
    { key: "inactiveRecruits", title: "Inactive recruits", icon: UserPlus, tone: "text-orange-500", render: (i: any) => ({ label: i.name, meta: i.status, link: `/contacts/${i.id}` }) },
    { key: "overdueFollowUps", title: "Overdue follow-ups", icon: CalendarClock, tone: "text-amber-500", render: (i: any) => ({ label: i.name, meta: fmtDate(i.date), link: `/contacts/${i.id}` }) },
    { key: "overdueTasks", title: "Missed tasks", icon: CheckSquare, tone: "text-red-500", render: (i: any) => ({ label: i.title, meta: i.contact ? `${i.contact.firstName} ${i.contact.lastName}` : "", link: "/tasks" }) },
    { key: "referralOpportunities", title: "Referral opportunities", icon: Share2, tone: "text-violet-500", render: (i: any) => ({ label: i.name || "Referral", meta: i.status, link: "/referrals" }) },
    { key: "crossSellOpportunities", title: "Cross-sell opportunities", icon: TrendingUp, tone: "text-brand-500", render: (i: any) => ({ label: i.contact ? `${i.contact.firstName} ${i.contact.lastName}` : "—", meta: (i.productType || "").replace(/_/g, " ").toLowerCase(), link: "/cross-sells" }) },
  ] as const;

  return (
    <div>
      <PageHeader title="Notification Center" subtitle="Everything that needs your attention, in one place." />

      {/* Stored notifications */}
      <Card className="mb-6 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-semibold text-slate-800"><BellRing className="h-4 w-4 text-brand-500" /> Activity {data.unreadCount > 0 && <span className="badge bg-red-100 text-red-700">{data.unreadCount} new</span>}</h3>
          {data.unreadCount > 0 && <Button variant="secondary" onClick={markAll}><CheckCheck className="h-4 w-4" /> Mark all read</Button>}
        </div>
        {data.notifications.length === 0 ? (
          <p className="text-sm text-slate-400">No notifications yet. Automations and aged-lead detection will post here.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.notifications.map((n) => (
              <li key={n.id} className={`flex items-center justify-between py-2.5 ${n.read ? "opacity-60" : ""}`}>
                <div className="flex items-center gap-3">
                  {!n.read && <span className="h-2 w-2 rounded-full bg-brand-500" />}
                  <div>
                    <p className="text-sm font-medium text-slate-700">{n.link ? <Link href={n.link} className="hover:text-brand-600">{n.title}</Link> : n.title}</p>
                    {n.body && <p className="text-xs text-slate-500">{n.body}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">{fmtRelative(n.createdAt)}</span>
                  {!n.read && <button onClick={() => markOne(n.id)} className="text-xs text-brand-600 hover:underline">Mark read</button>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Reminder buckets */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {buckets.map((b) => {
          const bucket = (r as any)[b.key] as { count: number; items: any[] };
          const Icon = b.icon;
          return (
            <Card key={b.key} className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800"><Icon className={`h-4 w-4 ${b.tone}`} /> {b.title}</h3>
                <Badge>{bucket.count}</Badge>
              </div>
              {bucket.items.length === 0 ? (
                <p className="text-sm text-slate-400">Nothing right now.</p>
              ) : (
                <ul className="space-y-1.5">
                  {bucket.items.slice(0, 6).map((i, idx) => {
                    const v = b.render(i);
                    return (
                      <li key={idx} className="flex items-center justify-between text-sm">
                        {v.link ? <Link href={v.link} className="font-medium text-slate-700 hover:text-brand-600">{v.label}</Link> : <span className="font-medium text-slate-700">{v.label}</span>}
                        <span className="text-xs text-slate-400">{v.meta}</span>
                      </li>
                    );
                  })}
                  {bucket.count > 6 && <li className="text-xs text-slate-400">+{bucket.count - 6} more</li>}
                </ul>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
