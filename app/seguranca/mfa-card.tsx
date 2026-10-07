"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { confirmMfaAction, disableMfaAction, startMfaAction } from "./actions";

const inputClass =
  "h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100";

type Step =
  | { name: "idle" }
  | { name: "setup"; qrDataUrl: string; secret: string }
  | { name: "backup-codes"; codes: string[] }
  | { name: "disable" };

export function MfaCard({ mfaEnabled }: { mfaEnabled: boolean }) {
  const [step, setStep] = useState<Step>({ name: "idle" });
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function start() {
    setError("");
    startTransition(async () => {
      const result = await startMfaAction();
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setStep({ name: "setup", qrDataUrl: result.data.qrDataUrl, secret: result.data.secret });
    });
  }

  function confirm(formData: FormData) {
    setError("");
    startTransition(async () => {
      const result = await confirmMfaAction(String(formData.get("code") ?? ""));
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setStep({ name: "backup-codes", codes: result.data.backupCodes });
    });
  }

  function disable(formData: FormData) {
    setError("");
    startTransition(async () => {
      const result = await disableMfaAction(String(formData.get("password") ?? ""), String(formData.get("code") ?? ""));
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setStep({ name: "idle" });
    });
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Autenticação de dois fatores (MFA)</h2>
          <p className="mt-1 max-w-xl text-sm leading-6 text-slate-600">
            O MFA adiciona uma segunda prova de identidade (código da aplicação autenticadora). Mesmo que alguém
            descubra a sua palavra-passe, não consegue entrar sem o seu telemóvel.
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${
            mfaEnabled ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
          }`}
        >
          {mfaEnabled ? "✓ Ativo" : "Inativo"}
        </span>
      </div>

      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}

      {step.name === "idle" && (
        <div className="mt-5">
          {mfaEnabled ? (
            <button
              onClick={() => setStep({ name: "disable" })}
              className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
              type="button"
            >
              Desativar MFA
            </button>
          ) : (
            <button
              onClick={start}
              disabled={isPending}
              className="rounded-lg bg-blue-800 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-900 disabled:opacity-60"
              type="button"
            >
              {isPending ? "A gerar..." : "Ativar MFA"}
            </button>
          )}
        </div>
      )}

      {step.name === "setup" && (
        <div className="mt-5 grid gap-5 sm:grid-cols-[auto_1fr]">
          <div className="rounded-xl border border-slate-200 p-3">
            <Image src={step.qrDataUrl} alt="QR code para configurar a aplicação autenticadora" width={200} height={200} unoptimized />
          </div>
          <div>
            <ol className="list-decimal space-y-1 pl-5 text-sm leading-6 text-slate-600">
              <li>Abra o Google Authenticator, Authy ou similar.</li>
              <li>Leia o QR code (ou introduza o segredo manualmente).</li>
              <li>Escreva abaixo o código de 6 dígitos gerado.</li>
            </ol>
            <p className="mt-3 break-all rounded-lg bg-slate-50 px-3 py-2 font-mono text-xs text-slate-600">
              Segredo: {step.secret}
            </p>
            <form action={confirm} className="mt-4 flex gap-2">
              <input
                autoComplete="one-time-code"
                className={`${inputClass} max-w-40 text-center tracking-[0.3em]`}
                inputMode="numeric"
                name="code"
                placeholder="000000"
                required
              />
              <button
                disabled={isPending}
                className="h-10 rounded-lg bg-blue-800 px-4 text-sm font-semibold text-white hover:bg-blue-900 disabled:opacity-60"
                type="submit"
              >
                Confirmar e ativar
              </button>
            </form>
            <button onClick={() => setStep({ name: "idle" })} className="mt-2 text-xs font-semibold text-slate-500 hover:text-slate-700" type="button">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {step.name === "backup-codes" && (
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">
            ⚠️ Guarde estes códigos de backup agora — são mostrados apenas esta vez.
          </p>
          <p className="mt-1 text-xs text-amber-800">
            Se perder o telemóvel, cada código permite entrar uma única vez.
          </p>
          <ul className="mt-3 grid grid-cols-2 gap-2 font-mono text-sm sm:grid-cols-4">
            {step.codes.map((code) => (
              <li key={code} className="rounded-lg bg-white px-3 py-2 text-center ring-1 ring-amber-200">
                {code}
              </li>
            ))}
          </ul>
          <button
            onClick={() => setStep({ name: "idle" })}
            className="mt-4 rounded-lg bg-amber-800 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-900"
            type="button"
          >
            Já guardei os códigos
          </button>
        </div>
      )}

      {step.name === "disable" && (
        <form action={disable} className="mt-5 max-w-md space-y-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-900">
            Para desativar o MFA, confirme a sua palavra-passe atual e um código da aplicação.
          </p>
          <input autoComplete="current-password" className={inputClass} name="password" placeholder="Palavra-passe atual" required type="password" />
          <input autoComplete="one-time-code" className={inputClass} inputMode="numeric" name="code" placeholder="Código de 6 dígitos" required />
          <div className="flex gap-2">
            <button disabled={isPending} className="h-10 rounded-lg bg-red-700 px-4 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60" type="submit">
              Confirmar desativação
            </button>
            <button onClick={() => setStep({ name: "idle" })} className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700" type="button">
              Cancelar
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
