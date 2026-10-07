import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { FeedbackMessage } from "@/components/feedback-message";
import { PageHeader } from "@/components/page-header";
import { requireSession, resolveOrganization } from "@/lib/current-organization";
import { listOrganizationMembers } from "@/lib/services/users.service";
import { canManageTrainings, getQuizForUser, getTrainingModule } from "@/lib/services/training.service";
import { QuizForm } from "../quiz";
import { addQuestionAction, assignTrainingAction } from "../actions";

const inputClass =
  "h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100";

function formatDate(date: Date | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("pt-PT", { dateStyle: "short" }).format(date);
}

export default async function TrainingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string; trainingId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { organizationId, trainingId } = await params;
  const query = await searchParams;
  const session = await requireSession();
  const roles = Array.from(new Set(session.user.memberships.map((membership) => membership.role)));
  const ctx = await resolveOrganization(session, organizationId);
  if (!ctx) notFound();

  const trainingModule = await getTrainingModule(ctx.organization.id, trainingId);
  if (!trainingModule) notFound();

  const manageable = canManageTrainings(ctx.role);
  const members = manageable ? await listOrganizationMembers(ctx.organization.id) : [];

  // Questionário do utilizador atual (se tiver esta formação atribuída).
  const completionId = typeof query.completionId === "string" ? query.completionId : undefined;
  const quizData = completionId ? await getQuizForUser(ctx.organization.id, session.user.id, completionId) : null;

  const error = typeof query.error === "string" ? query.error : undefined;
  const success = typeof query.success === "string" ? query.success : undefined;

  return (
    <AppShell name={session.user.name ?? "Utilizador"} roles={roles}>
      <div className="mx-auto max-w-4xl">
        <PageHeader
          eyebrow={ctx.organization.name}
          title={trainingModule.title}
          description={trainingModule.description ?? "Formação de sensibilização."}
        />
        <FeedbackMessage error={error} success={success} />

        <section className="mb-6 rounded-xl border border-slate-200 bg-white p-6">
          <p className="text-xs text-slate-500">
            {trainingModule.duracaoMinutos ? `Duração estimada: ~${trainingModule.duracaoMinutos} minutos · ` : ""}
            Validade: {trainingModule.validadeMeses} meses
          </p>
          <article className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-800">{trainingModule.content}</article>
        </section>

        {quizData &&
          (quizData.completion.estado === "CONCLUIDO" ? (
            <section className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-6">
              <p className="font-bold text-emerald-900">✓ Formação concluída</p>
              <p className="mt-1 text-sm text-emerald-800">
                Pontuação: {quizData.completion.score}% · válida até {formatDate(quizData.completion.validoAte)}.
              </p>
            </section>
          ) : quizData.questions.length > 0 ? (
            <div className="mb-6">
              <QuizForm
                organizationId={ctx.organization.id}
                completionId={quizData.completion.id}
                questions={quizData.questions}
              />
            </div>
          ) : (
            <p className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
              Este módulo ainda não tem perguntas configuradas.
            </p>
          ))}

        {manageable && (
          <>
            <section className="mb-6 rounded-xl border border-slate-200 bg-white p-6">
              <h2 className="mb-4 text-base font-semibold text-slate-900">
                Perguntas do questionário ({trainingModule.questions.length}/5)
              </h2>
              {trainingModule.questions.length === 0 ? (
                <p className="mb-4 text-sm text-slate-500">Ainda sem perguntas — adicione até 5.</p>
              ) : (
                <ol className="mb-4 list-decimal space-y-3 pl-5 text-sm">
                  {trainingModule.questions.map((question) => (
                    <li key={question.id}>
                      <p className="font-medium text-slate-900">{question.pergunta}</p>
                      <ul className="mt-1 space-y-0.5 text-slate-600">
                        {(question.opcoes as string[]).map((opcao, index) => (
                          <li key={index} className={index === question.respostaCorretaIndex ? "font-semibold text-emerald-700" : ""}>
                            {index === question.respostaCorretaIndex ? "✓ " : "· "}
                            {opcao}
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ol>
              )}

              {trainingModule.questions.length < 5 && (
                <form action={addQuestionAction} className="space-y-3 border-t border-slate-100 pt-4">
                  <input type="hidden" name="org" value={ctx.organization.id} />
                  <input type="hidden" name="id" value={trainingModule.id} />
                  <input required name="pergunta" placeholder="Nova pergunta *" className={inputClass} />
                  <div className="grid gap-2 sm:grid-cols-2">
                    {[0, 1, 2, 3].map((index) => (
                      <input
                        key={index}
                        name={`opcao${index}`}
                        placeholder={`Opção ${index + 1}${index < 2 ? " *" : " (opcional)"}`}
                        required={index < 2}
                        className={inputClass}
                      />
                    ))}
                  </div>
                  <label className="block text-sm font-medium text-slate-700">
                    Resposta correta (1 = primeira opção, 2 = segunda...)
                    <input required name="respostaCorretaIndex" type="number" min={1} max={6} className={`${inputClass} mt-1 w-32`} />
                  </label>
                  <p className="text-xs text-slate-400">Indique a posição da opção correta (1 = primeira opção).</p>
                  <button type="submit" className="h-10 rounded-lg bg-slate-800 px-4 text-sm font-semibold text-white hover:bg-slate-900">
                    Adicionar pergunta
                  </button>
                </form>
              )}
            </section>

            <section className="mb-6 rounded-xl border border-slate-200 bg-white p-6">
              <h2 className="text-base font-semibold text-slate-900">Atribuir formação</h2>
              <form action={assignTrainingAction} className="mt-4 space-y-4">
                <input type="hidden" name="org" value={ctx.organization.id} />
                <input type="hidden" name="id" value={trainingModule.id} />
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="radio" name="atribuicaoGlobal" value="true" defaultChecked className="size-4" />
                  A toda a organização
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="radio" name="atribuicaoGlobal" value="false" className="size-4" />
                  Apenas a utilizadores específicos:
                </label>
                <select multiple name="userIds" size={Math.min(6, members.length)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                  {members.map((member) => (
                    <option key={member.user.id} value={member.user.id}>{member.user.name}</option>
                  ))}
                </select>
                <label className="block text-sm font-medium text-slate-700">
                  Data limite (opcional)
                  <input name="dataLimite" type="date" className={`${inputClass} mt-1 w-48`} />
                </label>
                <button type="submit" className="h-10 rounded-lg bg-blue-800 px-5 text-sm font-semibold text-white hover:bg-blue-900">
                  Atribuir
                </button>
              </form>

              {trainingModule.assignments.length > 0 && (
                <ul className="mt-4 space-y-1 border-t border-slate-100 pt-4 text-sm text-slate-600">
                  {trainingModule.assignments.map((assignment) => (
                    <li key={assignment.id}>
                      · {assignment.atribuicaoGlobal ? "Toda a organização" : "Utilizadores específicos"} —{" "}
                      {assignment._count.completions} destinatário(s), atribuída em {formatDate(assignment.dataAtribuicao)}
                      {assignment.dataLimite ? `, limite ${formatDate(assignment.dataLimite)}` : ""}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
