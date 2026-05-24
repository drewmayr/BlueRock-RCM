"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError, setTokens } from "@/lib/api";
import { Button, Input, Field, Spinner } from "@/components/ui";
import { humanize } from "@/lib/format";
import { ShieldCheck } from "lucide-react";

interface InviteInfo {
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  agencyName: string;
}

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [loadErr, setLoadErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get<InviteInfo>(`/api/invitations/${token}`)
      .then((d) => {
        setInvite(d);
        setForm((f) => ({ ...f, firstName: d.firstName ?? "", lastName: d.lastName ?? "" }));
      })
      .catch((e) => setLoadErr(e instanceof ApiError ? e.message : "Invitation not found"))
      .finally(() => setLoading(false));
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await api.post<{ accessToken: string; refreshToken: string }>(`/api/invitations/${token}/accept`, form);
      setTokens(res.accessToken, res.refreshToken);
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not accept invitation");
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-2 text-xl font-bold text-brand-700">
          <ShieldCheck className="h-7 w-7" /> BlueRock Financial
        </div>
        <div className="card p-8">
          {loading ? (
            <div className="flex justify-center py-8"><Spinner className="h-7 w-7" /></div>
          ) : loadErr ? (
            <div className="text-center">
              <h1 className="text-xl font-bold text-slate-900">Invitation unavailable</h1>
              <p className="mt-2 text-sm text-slate-500">{loadErr}</p>
              <Link href="/login" className="mt-4 inline-block font-semibold text-brand-600 hover:underline">Go to sign in</Link>
            </div>
          ) : invite ? (
            <>
              <h1 className="text-2xl font-bold text-slate-900">Join {invite.agencyName}</h1>
              <p className="mt-1 text-sm text-slate-500">
                You&apos;ve been invited as a <span className="font-semibold text-slate-700">{humanize(invite.role)}</span>. Set your password to get started.
              </p>
              <form onSubmit={submit} className="mt-6 space-y-4">
                <Field label="Email"><Input value={invite.email} disabled /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="First name"><Input value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} required /></Field>
                  <Field label="Last name"><Input value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} required /></Field>
                </div>
                <Field label="Phone (optional)"><Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} /></Field>
                <Field label="Password" hint="At least 8 characters."><Input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} required minLength={8} /></Field>
                {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
                <Button type="submit" loading={busy} className="w-full">Accept & join</Button>
              </form>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
