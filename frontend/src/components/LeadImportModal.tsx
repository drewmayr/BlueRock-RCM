"use client";

import { useState } from "react";
import { Modal, Button, Select, Field } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { useMeta } from "@/lib/meta";
import { useToast } from "@/lib/toast";
import { parseCsv, autoMap, LEAD_FIELDS } from "@/lib/csv";
import { Upload, FileText, CheckCircle2, AlertTriangle } from "lucide-react";

interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: { row: number; message: string }[];
  results: { row: number; action: string; name: string; reason?: string }[];
  total: number;
}

type Step = "upload" | "map" | "preview" | "done";

export default function LeadImportModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const meta = useMeta();
  const toast = useToast();
  const [step, setStep] = useState<Step>("upload");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<string[]>([]);
  const [defaultType, setDefaultType] = useState("CLIENT");
  const [mode, setMode] = useState("skip");
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const reset = () => {
    setStep("upload"); setHeaders([]); setRows([]); setMapping([]);
    setPreview(null); setResult(null); setError(""); setDefaultType("CLIENT"); setMode("skip");
  };
  const close = () => { reset(); onClose(); };

  const onFile = async (file: File) => {
    setError("");
    const text = await file.text();
    const { headers, rows } = parseCsv(text);
    if (!headers.length || !rows.length) { setError("That file has no rows."); return; }
    setHeaders(headers);
    setRows(rows);
    setMapping(headers.map((h) => autoMap(h)));
    setStep("map");
  };

  const buildRows = () => {
    return rows.map((r) => {
      const obj: Record<string, string> = {};
      mapping.forEach((field, i) => {
        if (!field) return;
        const val = (r[i] ?? "").trim();
        if (!val) return;
        if (field === "name") {
          const [first, ...rest] = val.split(" ");
          obj.firstName = obj.firstName || first;
          obj.lastName = obj.lastName || rest.join(" ");
        } else obj[field] = val;
      });
      return obj;
    });
  };

  const runPreview = async () => {
    setBusy(true); setError("");
    try {
      const res = await api.post<ImportResult>("/api/leads/import", { rows: buildRows(), mode, defaultType, preview: true });
      setPreview(res);
      setStep("preview");
    } catch (e) { setError(e instanceof ApiError ? e.message : "Preview failed"); } finally { setBusy(false); }
  };

  const commit = async () => {
    setBusy(true); setError("");
    try {
      const res = await api.post<ImportResult>("/api/leads/import", { rows: buildRows(), mode, defaultType });
      setResult(res);
      setStep("done");
      onDone();
      toast(`Imported ${res.created} lead${res.created === 1 ? "" : "s"}`);
    } catch (e) { setError(e instanceof ApiError ? e.message : "Import failed"); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={close} title="Import leads (CSV)" wide>
      {step === "upload" && (
        <div>
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center hover:border-brand-400">
            <Upload className="h-8 w-8 text-slate-400" />
            <span className="mt-2 text-sm font-medium text-slate-600">Choose a CSV file</span>
            <span className="mt-1 text-xs text-slate-400">Name, Phone, Email, State, Birthday, Anniversary, Source, Tags, Status, Notes, Follow-up…</span>
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          </label>
          {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          <p className="mt-3 text-xs text-slate-400">First row must be column headers. You&apos;ll map columns and preview before anything is saved.</p>
        </div>
      )}

      {step === "map" && (
        <div className="space-y-4">
          <p className="text-sm text-slate-600"><FileText className="mr-1 inline h-4 w-4" /> {rows.length} rows detected. Map your columns:</p>
          <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase text-slate-400">
                <tr><th className="px-3 py-2">CSV column</th><th className="px-3 py-2">Sample</th><th className="px-3 py-2">Maps to</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {headers.map((h, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2 font-medium text-slate-700">{h}</td>
                    <td className="px-3 py-2 text-slate-400">{(rows[0]?.[i] ?? "").slice(0, 24)}</td>
                    <td className="px-3 py-2">
                      <Select value={mapping[i] ?? ""} onChange={(e) => setMapping((m) => m.map((x, j) => (j === i ? e.target.value : x)))} className="!py-1 text-xs">
                        {LEAD_FIELDS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Default lead type" hint="Used when a row has no Type column">
              <Select value={defaultType} onChange={(e) => setDefaultType(e.target.value)}>
                {(meta?.leadTypes ?? ["RECRUIT", "CLIENT", "REFERRAL"]).map((t) => <option key={t} value={t}>{t[0] + t.slice(1).toLowerCase()}</option>)}
              </Select>
            </Field>
            <Field label="Duplicates (by email/phone)">
              <Select value={mode} onChange={(e) => setMode(e.target.value)}>
                <option value="skip">Skip duplicates</option>
                <option value="update">Update existing</option>
              </Select>
            </Field>
          </div>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          <div className="flex justify-between">
            <Button variant="secondary" onClick={reset}>Back</Button>
            <Button onClick={runPreview} loading={busy} disabled={!mapping.includes("firstName") && !mapping.includes("name")}>Preview import</Button>
          </div>
          {!mapping.includes("firstName") && !mapping.includes("name") && <p className="text-xs text-amber-600">Map a First Name or Full Name column to continue.</p>}
        </div>
      )}

      {step === "preview" && preview && (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-3 text-center">
            <Stat label="Will create" value={preview.created} tone="text-emerald-600" />
            <Stat label="Will update" value={preview.updated} tone="text-brand-600" />
            <Stat label="Skip (dupes)" value={preview.skipped} tone="text-amber-600" />
            <Stat label="Errors" value={preview.errors.length} tone="text-red-600" />
          </div>
          <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase text-slate-400"><tr><th className="px-3 py-2">Row</th><th className="px-3 py-2">Name</th><th className="px-3 py-2">Action</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {preview.results.slice(0, 100).map((r) => (
                  <tr key={r.row}>
                    <td className="px-3 py-1.5 text-slate-400">{r.row}</td>
                    <td className="px-3 py-1.5 text-slate-700">{r.name}</td>
                    <td className="px-3 py-1.5"><span className={`badge ${r.action === "create" ? "bg-emerald-100 text-emerald-700" : r.action === "update" ? "bg-brand-100 text-brand-700" : r.action === "skip" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>{r.action}{r.reason ? ` · ${r.reason}` : ""}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          <div className="flex justify-between">
            <Button variant="secondary" onClick={() => setStep("map")}>Back</Button>
            <Button onClick={commit} loading={busy}>Import {preview.created + preview.updated} leads</Button>
          </div>
        </div>
      )}

      {step === "done" && result && (
        <div className="py-6 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
          <p className="mt-3 text-lg font-semibold text-slate-800">Import complete</p>
          <p className="mt-1 text-sm text-slate-500">{result.created} created · {result.updated} updated · {result.skipped} skipped{result.errors.length ? ` · ${result.errors.length} errors` : ""}</p>
          <Button className="mt-5" onClick={close}>Done</Button>
        </div>
      )}
    </Modal>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg border border-slate-200 py-3">
      <p className={`text-2xl font-bold ${tone}`}>{value}</p>
      <p className="text-xs text-slate-400">{label}</p>
    </div>
  );
}
