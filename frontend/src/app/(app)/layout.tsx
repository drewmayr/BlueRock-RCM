"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { MetaProvider } from "@/lib/meta";
import TopNav from "@/components/TopNav";
import { Spinner } from "@/components/ui";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <MetaProvider>
      <div className="min-h-screen bg-slate-50">
        <TopNav />
        <main className="mx-auto max-w-[1400px] px-4 py-8">{children}</main>
      </div>
    </MetaProvider>
  );
}
