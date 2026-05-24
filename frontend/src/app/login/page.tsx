"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { Button, Input } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { ShieldCheck, Lock, UserPlus, CalendarHeart, TrendingUp, Workflow } from "lucide-react";

const FEATURES = [
  { icon: UserPlus, title: "Recruit & revive", desc: "Automatically re-engage aged recruiting leads." },
  { icon: CalendarHeart, title: "Retain clients", desc: "Birthday, anniversary & renewal outreach on autopilot." },
  { icon: TrendingUp, title: "Grow revenue", desc: "Surface cross-sell opportunities and referrals." },
  { icon: Workflow, title: "Automate everything", desc: "Smart workflows for follow-ups and reminders." },
];

export default function LoginPage() {
  const { login, user, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [user, loading, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(email, password);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Left brand panel */}
      <div className="relative hidden w-1/2 overflow-hidden bg-gradient-to-br from-brand-700 via-brand-800 to-brand-950 lg:flex xl:w-[55%]">
        {/* subtle dot pattern */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.18]"
          style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1px)", backgroundSize: "22px 22px" }}
        />
        {/* soft glow accents */}
        <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-brand-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -right-16 h-96 w-96 rounded-full bg-brand-500/20 blur-3xl" />

        <div className="relative z-10 flex w-full flex-col justify-between p-12 xl:p-16 text-white">
          <div className="flex items-center gap-2.5 text-xl font-bold tracking-tight">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
              <ShieldCheck className="h-6 w-6" />
            </span>
            BlueRock Financial
          </div>

          <div className="max-w-lg">
            <p className="mb-4 inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-brand-100 ring-1 ring-white/15">
              Relationship automation for life insurance agencies
            </p>
            <h2 className="text-4xl font-bold leading-tight xl:text-[2.75rem]">
              The relationship engine that grows your agency.
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-brand-100">
              Recruiting, retention, referrals, and cross-sell — managed and automated from one intelligent platform.
            </p>

            <div className="mt-10 grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
              {FEATURES.map((f) => (
                <div key={f.title} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15">
                    <f.icon className="h-5 w-5 text-white" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{f.title}</p>
                    <p className="text-sm text-brand-200">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm text-brand-200">
            <Lock className="h-4 w-4" />
            Bank-level encryption · Your agency data stays private &amp; secure
          </div>
        </div>
      </div>

      {/* Right login panel */}
      <div className="flex w-full items-center justify-center px-5 py-10 sm:px-8 lg:w-1/2 xl:w-[45%]">
        <div className="w-full max-w-md">
          {/* Mobile brand */}
          <div className="mb-8 flex items-center justify-center gap-2.5 text-xl font-bold text-brand-700 lg:hidden">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white">
              <ShieldCheck className="h-6 w-6" />
            </span>
            BlueRock Financial
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-200/60 sm:p-9">
            <div className="mb-7">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Welcome back</h1>
              <p className="mt-1.5 text-sm text-slate-500">Sign in to your agency workspace.</p>
            </div>

            <form onSubmit={submit} className="space-y-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Email address</label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus placeholder="you@youragency.com" className="h-11" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Password</label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" className="h-11" />
              </div>

              {error && (
                <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2.5 text-sm text-red-600">{error}</p>
              )}

              <Button type="submit" loading={busy} className="h-11 w-full text-[15px]">
                Sign in
              </Button>
            </form>

            <div className="mt-5 flex items-center justify-center gap-1.5 text-xs text-slate-400">
              <Lock className="h-3.5 w-3.5" />
              Secured with 256-bit encryption
            </div>
          </div>

          <p className="mt-6 text-center text-sm text-slate-500">
            New agency?{" "}
            <Link href="/register" className="font-semibold text-brand-600 hover:text-brand-700 hover:underline">
              Create your account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
