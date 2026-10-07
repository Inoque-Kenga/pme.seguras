import { Suspense } from "react";
import { ShieldCheck } from "lucide-react";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
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
          <h1 className="text-2xl font-bold text-slate-900">Iniciar sessão</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Aceda ao espaço seguro da sua organização.
          </p>
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
          <p className="mt-7 border-t border-slate-100 pt-5 text-xs leading-5 text-slate-500">
            Não partilhe passwords, códigos de verificação ou informações bancárias por e-mail ou WhatsApp.
          </p>
        </section>
        <p className="mt-5 text-center text-xs text-slate-500">
          Ambiente de demonstração. Não introduza credenciais reais.
        </p>
      </div>
    </main>
  );
}
