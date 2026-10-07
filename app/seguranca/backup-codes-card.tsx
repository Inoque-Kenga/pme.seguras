"use client";

import { useState, useTransition } from "react";
import { regenerateCodesAction } from "./actions";

const inputClass =
  "h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100";

export function BackupCodesCard({ remaining }: { remaining: number }) {
  const [codes, setCodes] = useState<string[] | null>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function regenerate(formData: FormData) {
    setError("");
    startTransition(async () => {
      const result = await regenerateCodesAction(String(formData.get("code") ?? ""));
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setCodes(result.data.backupCodes);
    });
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="text-base font-semibold text-slate-900">Códigos de backup</h2>
      <p className="mt-1 text-sm leading-6 text-slate-600">
        Restam <strong>{remaining}</strong> código(s). Se estiverem a acabar, gere novos — os antigos deixam de
        funcionar.
      </p>

      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}

      {codes ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">⚠️ Guarde os novos códigos agora — mostrados uma única vez.</p>
          <ul className="mt-3 grid grid-cols-2 gap-2 font-mono text-sm sm:grid-cols-4">
            {codes.map((code) => (
              <li key={code} className="rounded-lg bg-white px-3 py-2 text-center ring-1 ring-amber-200">
                {code}
              </li>
            ))}
          </ul>
          <button onClick={() => setCodes(null)} className="mt-4 rounded-lg bg-amber-800 px-4 py-2 text-sm font-semibold text-white" type="button">
            Já guardei
          </button>
        </div>
      ) : (
        <form action={regenerate} className="mt-4 flex max-w-md gap-2">
          <input autoComplete="one-time-code" className={inputClass} inputMode="numeric" name="code" placeholder="Código MFA atual" required />
          <button disabled={isPending} className="h-10 shrink-0 rounded-lg bg-slate-800 px-4 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-60" type="submit">
            Gerar novos códigos
          </button>
        </form>
      )}
    </section>
  );
}
