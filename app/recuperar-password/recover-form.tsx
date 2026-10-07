"use client";

import { useState, useTransition } from "react";
import { requestResetAction } from "./actions";

export function RecoverForm() {
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [error, setError] = useState("");

  function handleSubmit(formData: FormData) {
    setError("");
    startTransition(async () => {
      const result = await requestResetAction({ email: String(formData.get("email") ?? "") });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setDevLink(result.data.devResetLink ?? null);
      setDone(true);
    });
  }

  if (done) {
    return (
      <div className="mt-7 space-y-4">
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900">
          Se o e-mail existir na plataforma, receberá uma ligação de recuperação válida por 1 hora.
          Verifique também a pasta de spam.
        </p>
        {devLink && (
          <p className="break-all rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
            <strong>Apenas em desenvolvimento:</strong>{" "}
            <a href={devLink} className="font-semibold underline">
              {devLink}
            </a>
          </p>
        )}
      </div>
    );
  }

  return (
    <form action={handleSubmit} className="mt-7 space-y-5">
      <div>
        <label htmlFor="email" className="mb-2 block text-sm font-semibold text-slate-700">
          E-mail da conta
        </label>
        <input
          autoComplete="username"
          className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
          id="email"
          name="email"
          required
          type="email"
        />
      </div>
      {error && <p role="alert" className="text-sm font-medium text-red-700">{error}</p>}
      <button
        className="h-11 w-full rounded-lg bg-blue-800 px-4 text-sm font-semibold text-white transition hover:bg-blue-900 disabled:opacity-60"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "A enviar..." : "Enviar ligação de recuperação"}
      </button>
    </form>
  );
}
