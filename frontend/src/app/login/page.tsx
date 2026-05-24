"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { Button, Input, Field } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { ShieldCheck } from "lucide-react";

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
    <div className="flex min-h-screen">
      <div className="hidden w-1/2 flex-col justify-between bg-brand-700 p-12 text-white lg:flex">
        <div className="flex items-center gap-2 text-xl font-bold">
          <ShieldCheck className="h-7 w-7" /> BlueRock Financial
        </div>
        <div>
          <h2 className="text-3xl font-bold leading-tight">
            The relationship engine for life insurance agencies.
          </h2>
          <p className="mt-4 max-w-md text-brand-100">
            Revive aged recruiting leads, automate client follow-ups, surface cross-sell
            opportunities, and grow referrals — all on autopilot.
          </p>
        </div>
        <p className="text-sm text-brand-200">Recruiting · Retention · Referrals · Cross-sell</p>
      </div>

      <div className="flex w-full items-center justify-center px-6 lg:w-1/2">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-2 text-xl font-bold text-brand-700">
              <ShieldCheck className="h-7 w-7" /> BlueRock Financial
            </div>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Welcome back</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in to your agency workspace.</p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <Field label="Email">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus placeholder="you@agency.com" />
            </Field>
            <Field label="Password">
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" />
            </Field>
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
            <Button type="submit" loading={busy} className="w-full">
              Sign in
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            New agency?{" "}
            <Link href="/register" className="font-semibold text-brand-600 hover:underline">
              Create your account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
