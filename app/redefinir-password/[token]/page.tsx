import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { validateResetToken } from "@/lib/services/password-reset.service";
import { ResetForm } from "./reset-form";

export default async function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const valid = await validateResetToken(token);

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-blue-800 text-white">
            <ShieldCheck aria-hidden="true" size={27} />
          </div>
          <div>
            <p className="text-xl font-bold tracking-tight text-slate-900">CyberPME</p>
            <p className="text-sm text-slate-500">Segurança clara para a sua empresa</p>
          </div>
        </div>
        <section className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
          {valid ? (
            <>
              <h1 className="text-2xl font-bold text-slate-900">Definir nova palavra-passe</h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Mínimo 12 caracteres, com maiúsculas, minúsculas e dígitos. Por segurança, todas as sessões ativas
                serão terminadas.
              </p>
              <ResetForm token={token} />
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-slate-900">Ligação inválida</h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Esta ligação de recuperação é inválida, já foi usada ou expirou (validade de 1 hora).
              </p>
              <Link
                href="/recuperar-password"
                className="mt-6 inline-flex h-11 items-center rounded-lg bg-blue-800 px-5 text-sm font-semibold text-white hover:bg-blue-900"
              >
                Pedir nova ligação
              </Link>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
