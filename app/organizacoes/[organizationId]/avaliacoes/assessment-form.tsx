import { AssessmentStatus } from "@prisma/client";
import { assessmentStatusLabels } from "@/lib/labels";

const inputClass =
  "h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100";

type MemberOption = { id: string; name: string };

export type AssessmentFormValues = {
  title?: string;
  description?: string | null;
  domain?: string | null;
  ownerId?: string | null;
  startDate?: Date;
  endDate?: Date | null;
  status?: AssessmentStatus;
};

function toDateInputValue(date?: Date | null) {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

export function AssessmentForm({
  action,
  members,
  values = {},
  submitLabel,
  hiddenFields = {},
}: {
  action: (formData: FormData) => void | Promise<void>;
  members: MemberOption[];
  values?: AssessmentFormValues;
  submitLabel: string;
  hiddenFields?: Record<string, string>;
}) {
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      {Object.entries(hiddenFields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
        Título *
        <input required name="title" defaultValue={values.title} className={`${inputClass} mt-1`} />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Domínio (opcional)
        <input name="domain" placeholder="Ex.: Infraestrutura, RGPD" defaultValue={values.domain ?? ""} className={`${inputClass} mt-1`} />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Responsável
        <select name="ownerId" defaultValue={values.ownerId ?? ""} className={`${inputClass} mt-1`}>
          <option value="">Sem responsável</option>
          {members.map((member) => (
            <option key={member.id} value={member.id}>{member.name}</option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Data de início *
        <input required name="startDate" type="date" defaultValue={toDateInputValue(values.startDate ?? new Date())} className={`${inputClass} mt-1`} />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Data de fim (opcional)
        <input name="endDate" type="date" defaultValue={toDateInputValue(values.endDate)} className={`${inputClass} mt-1`} />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Estado *
        <select name="status" defaultValue={values.status ?? "RASCUNHO"} className={`${inputClass} mt-1`}>
          {Object.values(AssessmentStatus).map((status) => (
            <option key={status} value={status}>{assessmentStatusLabels[status]}</option>
          ))}
        </select>
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
