import { RiskStatus } from "@prisma/client";
import { riskStatusLabels } from "@/lib/labels";

const inputClass =
  "h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100";

type Option = { id: string; name: string };

export type RiskFormValues = {
  title?: string;
  description?: string | null;
  assessmentId?: string | null;
  assetId?: string | null;
  threat?: string | null;
  vulnerability?: string | null;
  probability?: number;
  impact?: number;
  treatment?: string | null;
  ownerId?: string | null;
  dueDate?: Date | null;
  status?: RiskStatus;
};

function toDateInputValue(date?: Date | null) {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

const scaleLabels: Record<number, string> = {
  1: "1 — Muito baixa",
  2: "2 — Baixa",
  3: "3 — Moderada",
  4: "4 — Alta",
  5: "5 — Muito alta",
};

export function RiskForm({
  action,
  members,
  assets,
  assessments,
  values = {},
  submitLabel,
  hiddenFields = {},
}: {
  action: (formData: FormData) => void | Promise<void>;
  members: Option[];
  assets: Option[];
  assessments: Option[];
  values?: RiskFormValues;
  submitLabel: string;
  hiddenFields?: Record<string, string>;
}) {
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      {Object.entries(hiddenFields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
        Título do risco *
        <input required name="title" defaultValue={values.title} className={`${inputClass} mt-1`} />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Ameaça
        <input name="threat" placeholder="Ex.: ransomware, phishing" defaultValue={values.threat ?? ""} className={`${inputClass} mt-1`} />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Vulnerabilidade
        <input name="vulnerability" placeholder="Ex.: software desatualizado" defaultValue={values.vulnerability ?? ""} className={`${inputClass} mt-1`} />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Avaliação
        <select name="assessmentId" defaultValue={values.assessmentId ?? ""} className={`${inputClass} mt-1`}>
          <option value="">Sem avaliação</option>
          {assessments.map((assessment) => (
            <option key={assessment.id} value={assessment.id}>{assessment.name}</option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Ativo associado
        <select name="assetId" defaultValue={values.assetId ?? ""} className={`${inputClass} mt-1`}>
          <option value="">Sem ativo</option>
          {assets.map((asset) => (
            <option key={asset.id} value={asset.id}>{asset.name}</option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Probabilidade * (1 a 5)
        <select name="probability" defaultValue={values.probability ?? 3} className={`${inputClass} mt-1`}>
          {[1, 2, 3, 4, 5].map((value) => (
            <option key={value} value={value}>{scaleLabels[value]}</option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Impacto * (1 a 5)
        <select name="impact" defaultValue={values.impact ?? 3} className={`${inputClass} mt-1`}>
          {[1, 2, 3, 4, 5].map((value) => (
            <option key={value} value={value}>{scaleLabels[value]}</option>
          ))}
        </select>
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
        Prazo de tratamento
        <input name="dueDate" type="date" defaultValue={toDateInputValue(values.dueDate)} className={`${inputClass} mt-1`} />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Estado *
        <select name="status" defaultValue={values.status ?? "ABERTO"} className={`${inputClass} mt-1`}>
          {Object.values(RiskStatus).map((status) => (
            <option key={status} value={status}>{riskStatusLabels[status]}</option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-medium text-slate-700">
        &nbsp;
        <span className="invisible">.</span>
      </label>
      <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
        Plano de tratamento
        <textarea
          name="treatment"
          rows={2}
          placeholder="Como será tratado este risco (mitigar, aceitar, transferir...)"
          defaultValue={values.treatment ?? ""}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
        />
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
      <p className="rounded-lg bg-blue-50 p-3 text-xs leading-5 text-blue-900 sm:col-span-2">
        O <strong>nível do risco</strong> é calculado automaticamente: probabilidade × impacto.
        Bandas: 1-4 Baixo · 5-9 Médio · 10-16 Alto · 17-25 Crítico.
      </p>
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
