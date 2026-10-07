import { BackupFrequency, BackupJobStatus } from "@prisma/client";
import { backupFrequencyLabels, backupJobStatusLabels } from "@/lib/labels";

const inputClass =
  "h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100";

export type BackupFormValues = {
  sistemaAtivo?: string;
  fornecedor?: string | null;
  frequencia?: BackupFrequency;
  ultimaExecucao?: Date | null;
  estado?: BackupJobStatus;
  tamanhoGB?: number | null;
  localizacao?: string | null;
  retencaoDias?: number | null;
  rtoHoras?: number | null;
  rpoHoras?: number | null;
  ultimoTesteRestauracao?: Date | null;
  notas?: string | null;
};

function toDateInputValue(date?: Date | null) {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

export function BackupForm({
  action,
  values = {},
  submitLabel,
  hiddenFields = {},
}: {
  action: (formData: FormData) => void | Promise<void>;
  values?: BackupFormValues;
  submitLabel: string;
  hiddenFields?: Record<string, string>;
}) {
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Object.entries(hiddenFields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <Field label="Sistema protegido *">
        <input required name="sistemaAtivo" placeholder="Ex.: Ficheiros financeiros" defaultValue={values.sistemaAtivo} className={inputClass} />
      </Field>
      <Field label="Fornecedor">
        <input name="fornecedor" placeholder="Ex.: Backblaze, OneDrive" defaultValue={values.fornecedor ?? ""} className={inputClass} />
      </Field>
      <Field label="Frequência *">
        <select name="frequencia" defaultValue={values.frequencia ?? "DIARIA"} className={inputClass}>
          {Object.values(BackupFrequency).map((value) => (
            <option key={value} value={value}>{backupFrequencyLabels[value]}</option>
          ))}
        </select>
      </Field>
      <Field label="Última execução">
        <input name="ultimaExecucao" type="date" defaultValue={toDateInputValue(values.ultimaExecucao)} className={inputClass} />
      </Field>
      <Field label="Estado *">
        <select name="estado" defaultValue={values.estado ?? "DESCONHECIDO"} className={inputClass}>
          {Object.values(BackupJobStatus).map((value) => (
            <option key={value} value={value}>{backupJobStatusLabels[value]}</option>
          ))}
        </select>
      </Field>
      <Field label="Tamanho (GB)">
        <input name="tamanhoGB" type="number" min={0} step="0.1" defaultValue={values.tamanhoGB ?? ""} className={inputClass} />
      </Field>
      <Field label="Localização">
        <input name="localizacao" placeholder="Ex.: Cloud, NAS local" defaultValue={values.localizacao ?? ""} className={inputClass} />
      </Field>
      <Field label="Retenção (dias)">
        <input name="retencaoDias" type="number" min={1} defaultValue={values.retencaoDias ?? ""} className={inputClass} />
      </Field>
      <Field label="RTO (horas)">
        <input name="rtoHoras" type="number" min={0} defaultValue={values.rtoHoras ?? ""} className={inputClass} />
      </Field>
      <Field label="RPO (horas)">
        <input name="rpoHoras" type="number" min={0} defaultValue={values.rpoHoras ?? ""} className={inputClass} />
      </Field>
      <Field label="Último teste de restauração">
        <input name="ultimoTesteRestauracao" type="date" defaultValue={toDateInputValue(values.ultimoTesteRestauracao)} className={inputClass} />
      </Field>
      <Field label="Notas">
        <input name="notas" defaultValue={values.notas ?? ""} className={inputClass} />
      </Field>
      <p className="rounded-lg bg-blue-50 p-3 text-xs leading-5 text-blue-900 sm:col-span-2 lg:col-span-3">
        <strong>RTO</strong> = quanto tempo a organização aceita ficar sem o sistema; <strong>RPO</strong> = quantos
        dados (em horas) aceita perder. Teste a restauração regularmente — um backup nunca testado pode não servir.
      </p>
      <div className="sm:col-span-2 lg:col-span-3">
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
