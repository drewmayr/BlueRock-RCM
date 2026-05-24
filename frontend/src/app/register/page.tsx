"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { Button, Input, Field } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { ShieldCheck } from "lucide-react";

export default function RegisterPage() {
  const { register, user, loading } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ agencyName: "", firstName: "", lastName: "", email: "", phone: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [user, loading, router]);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await register(form);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-2 text-xl font-bold text-brand-700">
          <ShieldCheck className="h-7 w-7" /> BlueRock RCM
        </div>
        <div className="card p-8">
          <h1 className="text-2xl font-bold text-slate-900">Create your agency</h1>
          <p className="mt-1 text-sm text-slate-500">
            Set up your workspace. You&apos;ll be the agency owner and can invite your team next.
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <Field label="Agency name">
              <Input value={form.agencyName} onChange={(e) => set("agencyName", e.target.value)} required placeholder="Summit Life Partners" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="First name">
                <Input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} required />
              </Field>
              <Field label="Last name">
                <Input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} required />
              </Field>
            </div>
            <Field label="Email">
              <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required />
            </Field>
            <Field label="Phone (optional)">
              <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+15551234567" />
            </Field>
            <Field label="Password" hint="At least 8 characters.">
              <Input type="password" value={form.password} onChange={(e) => set("password", e.target.value)} required minLength={8} />
            </Field>
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
            <Button type="submit" loading={busy} className="w-full">
              Create agency
            </Button>
          </form>
        </div>
        <p className="mt-6 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-brand-600 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
