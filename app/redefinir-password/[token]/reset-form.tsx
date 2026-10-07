"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resetPasswordAction } from "./actions";

const inputClass =
  "h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100";

export function ResetForm({ token }: { token: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function handleSubmit(formData: FormData) {
    setError("");
    startTransition(async () => {
      const result = await resetPasswordAction({
        token,
        password: String(formData.get("password") ?? ""),
        confirmPassword: String(formData.get("confirmPassword") ?? ""),
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      router.push("/login?success=Palavra-passe+alterada.+Inicie+sess%C3%A3o+com+a+nova+palavra-passe.");
    });
  }

  return (
    <form action={handleSubmit} className="mt-7 space-y-5">
      <div>
        <label htmlFor="password" className="mb-2 block text-sm font-semibold text-slate-700">
          Nova palavra-passe
        </label>
        <input autoComplete="new-password" className={inputClass} id="password" minLength={12} name="password" required type="password" />
      </div>
      <div>
        <label htmlFor="confirmPassword" className="mb-2 block text-sm font-semibold text-slate-700">
          Confirmar palavra-passe
        </label>
        <input autoComplete="new-password" className={inputClass} id="confirmPassword" minLength={12} name="confirmPassword" required type="password" />
      </div>
      {error && <p role="alert" className="text-sm font-medium text-red-700">{error}</p>}
      <button
        className="h-11 w-full rounded-lg bg-blue-800 px-4 text-sm font-semibold text-white transition hover:bg-blue-900 disabled:opacity-60"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "A guardar..." : "Guardar nova palavra-passe"}
      </button>
    </form>
  );
}
