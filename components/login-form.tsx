"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

const inputClass =
  "h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  const [mfaRequired, setMfaRequired] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [credentials, setCredentials] = useState({ email: "", password: "" });

  async function submit(email: string, password: string, totp?: string) {
    setError("");
    setIsSubmitting(true);
    const result = await signIn("credentials", {
      email,
      password,
      ...(totp ? { totp } : {}),
      redirect: false,
    });
    setIsSubmitting(false);

    if (result?.error === "MFA_REQUIRED") {
      setCredentials({ email, password });
      setMfaRequired(true);
      return;
    }
    if (result?.error === "RATE_LIMITED") {
      setError("Muitas tentativas de login. Tente novamente dentro de alguns minutos.");
      return;
    }
    if (result?.error) {
      setError(mfaRequired ? "Código incorreto. Verifique a aplicação autenticadora." : "E-mail ou palavra-passe inválidos.");
      return;
    }
    router.push(searchParams.get("callbackUrl") ?? "/dashboard");
    router.refresh();
  }

  if (mfaRequired) {
    return (
      <form
        action={async (formData: FormData) => {
          await submit(credentials.email, credentials.password, String(formData.get("totp") ?? ""));
        }}
        className="mt-7 space-y-5"
      >
        <div className="rounded-lg bg-blue-50 p-3 text-sm leading-6 text-blue-950">
          <p className="font-semibold">Verificação em dois passos</p>
          <p className="mt-1 text-xs">
            Abra a sua aplicação autenticadora e introduza o código de 6 dígitos. Também pode usar um código de backup.
          </p>
        </div>
        <div>
          <label htmlFor="totp" className="mb-2 block text-sm font-semibold text-slate-700">
            Código de verificação
          </label>
          <input
            autoComplete="one-time-code"
            autoFocus
            className={`${inputClass} text-center text-lg tracking-[0.4em]`}
            id="totp"
            inputMode="numeric"
            name="totp"
            placeholder="000000"
            required
            type="text"
          />
        </div>
        {error && <p role="alert" className="text-sm font-medium text-red-700">{error}</p>}
        <button
          className="h-11 w-full rounded-lg bg-blue-800 px-4 text-sm font-semibold text-white transition hover:bg-blue-900 disabled:opacity-60"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "A verificar..." : "Verificar e entrar"}
        </button>
        <button
          className="w-full text-center text-xs font-semibold text-blue-700 hover:text-blue-900"
          onClick={() => {
            setMfaRequired(false);
            setError("");
          }}
          type="button"
        >
          ← Voltar ao início de sessão
        </button>
      </form>
    );
  }

  async function handleSubmit(formData: FormData) {
    await submit(String(formData.get("email") ?? ""), String(formData.get("password") ?? ""));
  }

  return (
    <form action={handleSubmit} className="mt-7 space-y-5">
      <div>
        <label htmlFor="email" className="mb-2 block text-sm font-semibold text-slate-700">E-mail</label>
        <input autoComplete="username" className={inputClass} id="email" name="email" required type="email" />
      </div>
      <div>
        <label htmlFor="password" className="mb-2 block text-sm font-semibold text-slate-700">Palavra-passe</label>
        <input autoComplete="current-password" className={inputClass} id="password" name="password" required type="password" />
      </div>
      {error && <p role="alert" className="text-sm font-medium text-red-700">{error}</p>}
      <button
        className="h-11 w-full rounded-lg bg-blue-800 px-4 text-sm font-semibold text-white transition hover:bg-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-60"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? "A validar acesso..." : "Entrar"}
      </button>
      <p className="text-center text-xs">
        <a href="/recuperar-password" className="font-semibold text-blue-700 hover:text-blue-900">
          Esqueceu-se da palavra-passe?
        </a>
      </p>
    </form>
  );
}
