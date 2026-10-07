import { IncidentSeverity, IncidentStatus, IncidentType } from "@prisma/client";
import { incidentSeverityLabels, incidentStatusLabels, incidentTypeLabels } from "@/lib/labels";

const inputClass =
  "h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100";

type Option = { id: string; name: string };

export type IncidentFormValues = {
  title?: string;
  description?: string | null;
  type?: IncidentType;
  severity?: IncidentSeverity;
  detectedAt?: Date;
  sistemasAfetados?: string | null;
  acoesImediatas?: string | null;
  licoesAprendidas?: string | null;
  responsavelId?: string | null;
  assetId?: string | null;
  status?: IncidentStatus;
};

function toLocalDateTimeValue(date?: Date) {
  if (!date) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function IncidentForm({
  action,
  members,
  assets,
  values = {},
  submitLabel,
  hiddenFields = {},
}: {
  action: (formData: FormData) => void | Promise<void>;
  members: Option[];
  assets: Option[];
  values?: IncidentFormValues;
  submitLabel: string;
  hiddenFields?: Record<string, string>;
}) {
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      {Object.entries(hiddenFields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
        Título do incidente *
        <input required name="title" defaultValue={values.title} className={`${inputClass} mt-1`} />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Tipo *
        <select name="type" defaultValue={values.type ?? "OUTRO"} className={`${inputClass} mt-1`}>
          {Object.values(IncidentType).map((value) => (
            <option key={value} value={value}>{incidentTypeLabels[value]}</option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Severidade *
        <select name="severity" defaultValue={values.severity ?? "MEDIUM"} className={`${inputClass} mt-1`}>
          {Object.values(IncidentSeverity).map((value) => (
            <option key={value} value={value}>{incidentSeverityLabels[value]}</option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Data e hora da ocorrência *
        <input
          required
          name="detectedAt"
          type="datetime-local"
          defaultValue={toLocalDateTimeValue(values.detectedAt ?? new Date())}
          className={`${inputClass} mt-1`}
        />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Estado *
        <select name="status" defaultValue={values.status ?? "REPORTADO"} className={`${inputClass} mt-1`}>
          {Object.values(IncidentStatus).map((value) => (
            <option key={value} value={value}>{incidentStatusLabels[value]}</option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Responsável
        <select name="responsavelId" defaultValue={values.responsavelId ?? ""} className={`${inputClass} mt-1`}>
          <option value="">Sem responsável</option>
          {members.map((member) => (
            <option key={member.id} value={member.id}>{member.name}</option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Ativo relacionado
        <select name="assetId" defaultValue={values.assetId ?? ""} className={`${inputClass} mt-1`}>
          <option value="">Sem ativo</option>
          {assets.map((asset) => (
            <option key={asset.id} value={asset.id}>{asset.name}</option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
        Sistemas afetados
        <input name="sistemasAfetados" placeholder="Ex.: Servidor de ficheiros, conta de e-mail da receção" defaultValue={values.sistemasAfetados ?? ""} className={`${inputClass} mt-1`} />
      </label>
      <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
        Ações imediatas tomadas
        <textarea
          name="acoesImediatas"
          rows={2}
          placeholder="Ex.: equipamento isolado da rede, password reposta"
          defaultValue={values.acoesImediatas ?? ""}
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
      <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
        Lições aprendidas (preencher no encerramento)
        <textarea
          name="licoesAprendidas"
          rows={2}
          defaultValue={values.licoesAprendidas ?? ""}
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
