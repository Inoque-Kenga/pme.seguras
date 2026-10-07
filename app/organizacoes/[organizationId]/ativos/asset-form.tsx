import { AssetStatus, AssetType, Criticality } from "@prisma/client";
import { assetStatusLabels, assetTypeLabels, criticalityLabels } from "@/lib/labels";

const inputClass =
  "h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100";

export type AssetFormValues = {
  name?: string;
  type?: AssetType;
  marcaModelo?: string | null;
  numeroSerie?: string | null;
  sistemaOperativo?: string | null;
  ip?: string | null;
  location?: string | null;
  owner?: string | null;
  criticality?: Criticality;
  status?: AssetStatus;
  protecaoEndpoint?: boolean;
  ultimaAtualizacao?: Date | null;
  mfaAplicavel?: boolean;
  cifragem?: boolean;
  description?: string | null;
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function toDateInputValue(date?: Date | null) {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

export function AssetForm({
  action,
  values = {},
  submitLabel,
  hiddenFields = {},
}: {
  action: (formData: FormData) => void | Promise<void>;
  values?: AssetFormValues;
  submitLabel: string;
  hiddenFields?: Record<string, string>;
}) {
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Object.entries(hiddenFields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <Field label="Nome do ativo *">
        <input required name="name" defaultValue={values.name} className={inputClass} />
      </Field>
      <Field label="Tipo *">
        <select name="type" defaultValue={values.type ?? "HARDWARE"} className={inputClass}>
          {Object.values(AssetType).map((type) => (
            <option key={type} value={type}>{assetTypeLabels[type]}</option>
          ))}
        </select>
      </Field>
      <Field label="Marca / Modelo">
        <input name="marcaModelo" defaultValue={values.marcaModelo ?? ""} className={inputClass} />
      </Field>
      <Field label="Número de série">
        <input name="numeroSerie" defaultValue={values.numeroSerie ?? ""} className={inputClass} />
      </Field>
      <Field label="Sistema operativo">
        <input name="sistemaOperativo" defaultValue={values.sistemaOperativo ?? ""} className={inputClass} />
      </Field>
      <Field label="Endereço IP">
        <input name="ip" placeholder="192.168.1.10" defaultValue={values.ip ?? ""} className={inputClass} />
      </Field>
      <Field label="Localização">
        <input name="location" defaultValue={values.location ?? ""} className={inputClass} />
      </Field>
      <Field label="Proprietário / responsável">
        <input name="owner" defaultValue={values.owner ?? ""} className={inputClass} />
      </Field>
      <Field label="Criticidade *">
        <select name="criticality" defaultValue={values.criticality ?? "MEDIUM"} className={inputClass}>
          {Object.values(Criticality).map((criticality) => (
            <option key={criticality} value={criticality}>{criticalityLabels[criticality]}</option>
          ))}
        </select>
      </Field>
      <Field label="Estado *">
        <select name="status" defaultValue={values.status ?? "ACTIVE"} className={inputClass}>
          {Object.values(AssetStatus).map((status) => (
            <option key={status} value={status}>{assetStatusLabels[status]}</option>
          ))}
        </select>
      </Field>
      <Field label="Última atualização">
        <input name="ultimaAtualizacao" type="date" defaultValue={toDateInputValue(values.ultimaAtualizacao)} className={inputClass} />
      </Field>
      <div className="flex items-end">
        <label className="flex h-10 items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="protecaoEndpoint" defaultChecked={values.protecaoEndpoint} className="size-4 rounded border-slate-300" />
          Proteção de endpoint (antivírus/EDR)
        </label>
      </div>
      <div className="flex items-end">
        <label className="flex h-10 items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="mfaAplicavel" defaultChecked={values.mfaAplicavel} className="size-4 rounded border-slate-300" />
          MFA aplicável
        </label>
      </div>
      <div className="flex items-end">
        <label className="flex h-10 items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="cifragem" defaultChecked={values.cifragem} className="size-4 rounded border-slate-300" />
          Disco/dados cifrados
        </label>
      </div>
      <div className="sm:col-span-2 lg:col-span-3">
        <Field label="Notas">
          <textarea
            name="description"
            rows={3}
            defaultValue={values.description ?? ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
          />
        </Field>
      </div>
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
