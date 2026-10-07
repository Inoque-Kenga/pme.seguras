"use client";

import { useState, useTransition } from "react";
import { changePasswordAction } from "./actions";

const inputClass =
  "h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100";

export function ChangePasswordForm() {
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      const result = await changePasswordAction({
        currentPassword: String(formData.get("currentPassword") ?? ""),
        newPassword: String(formData.get("newPassword") ?? ""),
        confirmPassword: String(formData.get("confirmPassword") ?? ""),
      });
      if (!result.ok) {
        setMessage({ type: "error", text: result.error.message });
        return;
      }
      setMessage({ type: "success", text: "Palavra-passe alterada com sucesso. As outras sessões foram terminadas." });
    });
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="text-base font-semibold text-slate-900">Alterar palavra-passe</h2>
      <p className="mt-1 text-sm leading-6 text-slate-600">
        Mínimo 12 caracteres, com maiúsculas, minúsculas e dígitos. As outras sessões serão terminadas por segurança.
      </p>
      {message && (
        <p
          role="alert"
          className={`mt-4 rounded-lg px-3 py-2 text-sm font-medium ${
            message.type === "error" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"
          }`}
        >
          {message.text}
        </p>
      )}
      <form action={handleSubmit} className="mt-4 grid max-w-lg gap-3">
        <input autoComplete="current-password" className={inputClass} name="currentPassword" placeholder="Palavra-passe atual" required type="password" />
        <input autoComplete="new-password" className={inputClass} minLength={12} name="newPassword" placeholder="Nova palavra-passe" required type="password" />
        <input autoComplete="new-password" className={inputClass} minLength={12} name="confirmPassword" placeholder="Confirmar nova palavra-passe" required type="password" />
        <div>
          <button disabled={isPending} className="h-10 rounded-lg bg-blue-800 px-4 text-sm font-semibold text-white hover:bg-blue-900 disabled:opacity-60" type="submit">
            {isPending ? "A guardar..." : "Alterar palavra-passe"}
          </button>
        </div>
      </form>
    </section>
  );
}
