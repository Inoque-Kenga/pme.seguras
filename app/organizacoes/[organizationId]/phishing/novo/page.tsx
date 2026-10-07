import { redirect } from "next/navigation";
import { PhishingChannel, PhishingClassification } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { FeedbackMessage } from "@/components/feedback-message";
import { PageHeader } from "@/components/page-header";
import { requireSession, resolveOrganization } from "@/lib/current-organization";
import { phishingChannelLabels, phishingClassificationLabels } from "@/lib/labels";
import { createPhishingReportAction } from "../actions";

const inputClass =
  "h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100";

export default async function NewPhishingReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { organizationId } = await params;
  const query = await searchParams;
  const session = await requireSession();
  const roles = Array.from(new Set(session.user.memberships.map((membership) => membership.role)));
  const ctx = await resolveOrganization(session, organizationId);

  if (!ctx) redirect("/dashboard?error=Organiza%C3%A7%C3%A3o+n%C3%A3o+encontrada.");

  const error = typeof query.error === "string" ? query.error : undefined;

  return (
    <AppShell name={session.user.name ?? "Utilizador"} roles={roles}>
      <div className="mx-auto max-w-3xl">
        <PageHeader
          eyebrow={ctx.organization.name}
          title="Reportar mensagem suspeita"
          description="Recebeu uma mensagem que parece phishing? Reporte-a aqui. Não clique em links nem responda à mensagem."
        />
        <FeedbackMessage error={error} />
        <section className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          <p className="font-semibold">Antes de reportar</p>
          <ul className="mt-1 list-inside list-disc">
            <li>Não clique em links nem abra anexos da mensagem suspeita.</li>
            <li>Não responda ao remetente nem forneça passwords ou códigos.</li>
            <li>Se já clicou ou forneceu dados, diga-o na descrição — a equipa vai ajudar.</li>
          </ul>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <form action={createPhishingReportAction} className="grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="org" value={ctx.organization.id} />
            <label className="block text-sm font-medium text-slate-700">
              Canal *
              <select name="canal" defaultValue="EMAIL" className={`${inputClass} mt-1`}>
                {Object.values(PhishingChannel).map((value) => (
                  <option key={value} value={value}>{phishingChannelLabels[value]}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Remetente *
              <input required name="remetente" placeholder="Ex.: apoio@banco-falso.example" className={`${inputClass} mt-1`} />
            </label>
            <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
              Assunto
              <input name="assunto" placeholder="Assunto da mensagem" className={`${inputClass} mt-1`} />
            </label>
            <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
              Ligação suspeita (URL)
              <input name="urlSuspeita" placeholder="Ex.: http://exemplo-suspeito.test/entrar" className={`${inputClass} mt-1`} />
            </label>
            <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
              Descrição *
              <textarea
                required
                name="descricao"
                rows={4}
                placeholder="O que diz a mensagem? Pede passwords, dinheiro ou dados? Já interagiu com ela?"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Quão preocupado está? *
              <select name="classificacaoInicial" defaultValue="MEDIA" className={`${inputClass} mt-1`}>
                {Object.values(PhishingClassification).map((value) => (
                  <option key={value} value={value}>{phishingClassificationLabels[value]}</option>
                ))}
              </select>
            </label>
            <div className="flex items-end">
              <button
                type="submit"
                className="h-10 rounded-lg bg-blue-800 px-5 text-sm font-semibold text-white transition hover:bg-blue-900"
              >
                Reportar mensagem
              </button>
            </div>
          </form>
        </section>
      </div>
    </AppShell>
  );
}
