"use client";

import { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import { statusTone, humanize } from "@/lib/format";

export function Button({
  children,
  variant = "primary",
  loading,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger"; loading?: boolean }) {
  const cls = { primary: "btn-primary", secondary: "btn-secondary", ghost: "btn-ghost", danger: "btn-danger" }[variant];
  return (
    <button className={`${cls} ${className}`} disabled={loading || props.disabled} {...props}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`card ${className}`}>{children}</div>;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`input ${props.className ?? ""}`} {...props} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`input ${props.className ?? ""}`} {...props} />;
}

export function Select({ children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`input ${props.className ?? ""}`} {...props}>
      {children}
    </select>
  );
}

export function Badge({ status, children }: { status?: string; children?: ReactNode }) {
  const label = children ?? humanize(status);
  return <span className={`badge ${status ? statusTone(status) : "bg-slate-100 text-slate-600"}`}>{label}</span>;
}

export function Spinner({ className = "" }: { className?: string }) {
  return <Loader2 className={`h-5 w-5 animate-spin text-brand-500 ${className}`} />;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
      <p className="text-base font-semibold text-slate-700">{title}</p>
      {description && <p className="mt-1 max-w-md text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:p-8" onMouseDown={onClose}>
      <div
        className={`mt-4 w-full ${wide ? "max-w-3xl" : "max-w-lg"} rounded-2xl bg-white shadow-xl`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

export function StatCard({ label, value, sub, icon, tone = "brand" }: { label: string; value: ReactNode; sub?: string; icon?: ReactNode; tone?: string }) {
  const tones: Record<string, string> = {
    brand: "bg-brand-50 text-brand-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    violet: "bg-violet-50 text-violet-600",
    red: "bg-red-50 text-red-600",
    sky: "bg-sky-50 text-sky-600",
  };
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
          {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
        </div>
        {icon && <div className={`rounded-lg p-2 ${tones[tone] ?? tones.brand}`}>{icon}</div>}
      </div>
    </Card>
  );
}

export function Toast({ message, tone = "success" }: { message: string; tone?: "success" | "error" }) {
  return (
    <div
      className={`fixed bottom-6 right-6 z-[60] rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg ${
        tone === "success" ? "bg-emerald-600" : "bg-red-600"
      }`}
    >
      {message}
    </div>
  );
}
