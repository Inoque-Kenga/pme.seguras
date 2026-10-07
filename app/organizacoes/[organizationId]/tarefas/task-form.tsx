import { Priority, TreatmentTaskStatus } from "@prisma/client";
import { priorityLabels, riskLevelLabels, treatmentTaskStatusLabels } from "@/lib/labels";

const inputClass =
  "h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100";

type MemberOption = { id: string; name: string };
type RiskOption = { id: string; title: string; riskLevel: keyof typeof riskLevelLabels };

export type TaskFormValues = {
  riskId?: string;
  title?: string;
  description?: string | null;
  assigneeId?: string | null;
  priority?: Priority;
  status?: TreatmentTaskStatus;
  dueDate?: Date | null;
};

function toDateInputValue(date?: Date | null) {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

export function TaskForm({
  action,
  members,
  risks,
  values = {},
  submitLabel,
  hiddenFields = {},
}: {
  action: (formData: FormData) => void | Promise<void>;
  members: MemberOption[];
  risks: RiskOption[];
  values?: TaskFormValues;
  submitLabel: string;
  hiddenFields?: Record<string, string>;
}) {
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      {Object.entries(hiddenFields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
        Risco associado *
        <select required name="riskId" defaultValue={values.riskId ?? ""} className={`${inputClass} mt-1`}>
          <option value="" disabled>
            Selecione o risco
          </option>
          {risks.map((risk) => (
            <option key={risk.id} value={risk.id}>
              {risk.title} ({riskLevelLabels[risk.riskLevel]})
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
        Título da tarefa *
        <input required name="title" defaultValue={values.title} className={`${inputClass} mt-1`} />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Prioridade *
        <select name="priority" defaultValue={values.priority ?? "MEDIUM"} className={`${inputClass} mt-1`}>
          {Object.values(Priority).map((priority) => (
            <option key={priority} value={priority}>{priorityLabels[priority]}</option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Estado *
        <select name="status" defaultValue={values.status ?? "NAO_INICIADA"} className={`${inputClass} mt-1`}>
          {Object.values(TreatmentTaskStatus).map((status) => (
            <option key={status} value={status}>{treatmentTaskStatusLabels[status]}</option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Responsável
        <select name="assigneeId" defaultValue={values.assigneeId ?? ""} className={`${inputClass} mt-1`}>
          <option value="">Sem responsável</option>
          {members.map((member) => (
            <option key={member.id} value={member.id}>{member.name}</option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Prazo
        <input name="dueDate" type="date" defaultValue={toDateInputValue(values.dueDate)} className={`${inputClass} mt-1`} />
      </label>
      <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
        Descrição
        <textarea
          name="description"
          rows={3}
          defaultValue={values.description ?? ""}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
        />
      </label>
      <div className="sm:col-span-2">
        <button
          type="submit"
          className="h-10 rounded-lg bg-blue-800 px-5 text-sm font-semibold text-white transition hover:bg-blue-900"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
