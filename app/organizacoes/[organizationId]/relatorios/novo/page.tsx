import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { FeedbackMessage } from "@/components/feedback-message";
import { PageHeader } from "@/components/page-header";
import { requireSession, resolveOrganization } from "@/lib/current-organization";
import { canManageReports } from "@/lib/services/report.service";
import { generateReportAction } from "../actions";

const inputClass =
  "h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100";

export default async function NewReportPage({
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
  if (!canManageReports(ctx.role)) {
    redirect(`/organizacoes/${organizationId}/relatorios?error=O+seu+papel+n%C3%A3o+pode+gerar+relat%C3%B3rios.`);
  }

  const error = typeof query.error === "string" ? query.error : undefined;
  const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

  return (
    <AppShell name={session.user.name ?? "Utilizador"} roles={roles}>
      <div className="mx-auto max-w-2xl">
        <PageHeader
          eyebrow={ctx.organization.name}
          title="Gerar relatório mensal"
          description="Escolha o mês de referência. Se já existir um relatório para esse mês, é substituído pelos dados mais recentes."
        />
        <FeedbackMessage error={error} />
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <form action={generateReportAction} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="org" value={ctx.organization.id} />
            <label className="text-sm font-medium text-slate-700">
              Mês de referência *
              <input required name="mesReferencia" type="month" defaultValue={currentMonth} className={`${inputClass} mt-1`} />
            </label>
            <button type="submit" className="h-10 rounded-lg bg-blue-800 px-5 text-sm font-semibold text-white hover:bg-blue-900">
              Gerar relatório
            </button>
          </form>
        </section>
      </div>
    </AppShell>
  );
}
