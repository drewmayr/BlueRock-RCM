"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { initials } from "@/lib/format";
import { api } from "@/lib/api";
import {
  LayoutDashboard,
  Contact2,
  FileText,
  Share2,
  TrendingUp,
  Workflow,
  MessageSquare,
  CheckSquare,
  Settings,
  ShieldCheck,
  ChevronDown,
  LogOut,
  Menu,
  X,
  Bell,
  GraduationCap,
} from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: Contact2 },
  { href: "/policies", label: "Policies", icon: FileText },
  { href: "/referrals", label: "Referrals", icon: Share2 },
  { href: "/cross-sells", label: "Cross-Sell", icon: TrendingUp },
  { href: "/automations", label: "Automations", icon: Workflow },
  { href: "/messages", label: "Messages", icon: MessageSquare },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
];

export default function TopNav() {
  const { user, agency, logout } = useAuth();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const fetchUnread = () => api.get<{ count: number }>("/api/notifications/unread-count").then((d) => setUnread(d.count)).catch(() => {});
    fetchUnread();
    const t = setInterval(fetchUnread, 60000);
    return () => clearInterval(t);
  }, []);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-4 px-4">
        <Link href="/dashboard" className="flex shrink-0 items-center gap-2 font-bold text-brand-700">
          <ShieldCheck className="h-6 w-6" />
          <span className="hidden sm:inline">BlueRock Financial</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden flex-1 items-center gap-0.5 lg:flex">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                isActive(href) ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {/* Notifications */}
          <Link href="/notifications" className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100" title="Notifications">
            <Bell className="h-5 w-5" />
            {unread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Link>

          {/* User menu */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-100"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                {initials(user?.firstName, user?.lastName)}
              </span>
              <span className="hidden text-left sm:block">
                <span className="block text-sm font-semibold leading-tight text-slate-800">
                  {user?.firstName} {user?.lastName}
                </span>
                <span className="block text-xs leading-tight text-slate-400">{agency?.name}</span>
              </span>
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 z-20 mt-2 w-52 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                  <div className="border-b border-slate-100 px-4 py-2">
                    <p className="text-xs text-slate-400">Signed in as</p>
                    <p className="truncate text-sm font-medium text-slate-700">{user?.email}</p>
                    <span className="mt-1 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                      {user?.role}
                    </span>
                  </div>
                  <Link
                    href="/training"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
                  >
                    <GraduationCap className="h-4 w-4" /> Training & Help
                  </Link>
                  <Link
                    href="/settings"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
                  >
                    <Settings className="h-4 w-4" /> Settings & Team
                  </Link>
                  <button
                    onClick={logout}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <LogOut className="h-4 w-4" /> Sign out
                  </button>
                </div>
              </>
            )}
          </div>

          <button className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden" onClick={() => setMobileOpen((o) => !o)}>
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <nav className="grid grid-cols-2 gap-1 border-t border-slate-200 bg-white p-3 lg:hidden">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                isActive(href) ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
