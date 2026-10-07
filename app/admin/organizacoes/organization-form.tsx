import { OrganizationSize } from "@prisma/client";
import { organizationSizeLabels } from "@/lib/labels";

const inputClass =
  "h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100";

type PlanOption = { id: string; name: string };

export type OrganizationFormValues = {
  name?: string;
  slug?: string;
  nif?: string | null;
  sector?: string | null;
  dimensao?: OrganizationSize | null;
  city?: string | null;
  provincia?: string | null;
  contactoNome?: string | null;
  contactoEmail?: string | null;
  contactoTelefone?: string | null;
  planoId?: string | null;
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

export function OrganizationForm({
  action,
  values = {},
  plans,
  submitLabel,
  hiddenFields = {},
}: {
  action: (formData: FormData) => void | Promise<void>;
  values?: OrganizationFormValues;
  plans: PlanOption[];
  submitLabel: string;
  hiddenFields?: Record<string, string>;
}) {
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Object.entries(hiddenFields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <Field label="Nome *">
        <input required name="name" defaultValue={values.name} className={inputClass} />
      </Field>
      <Field label="Slug (identificador) *">
        <input required name="slug" pattern="[a-z0-9-]+" defaultValue={values.slug} className={inputClass} />
      </Field>
      <Field label="NIF">
        <input name="nif" defaultValue={values.nif ?? ""} className={inputClass} />
      </Field>
      <Field label="Setor">
        <input name="sector" defaultValue={values.sector ?? ""} className={inputClass} />
      </Field>
      <Field label="Dimensão">
        <select name="dimensao" defaultValue={values.dimensao ?? ""} className={inputClass}>
          <option value="">—</option>
          {Object.values(OrganizationSize).map((size) => (
            <option key={size} value={size}>{organizationSizeLabels[size]}</option>
          ))}
        </select>
      </Field>
      <Field label="Plano">
        <select name="planoId" defaultValue={values.planoId ?? ""} className={inputClass}>
          <option value="">Sem plano</option>
          {plans.map((plan) => (
            <option key={plan.id} value={plan.id}>{plan.name}</option>
          ))}
        </select>
      </Field>
      <Field label="Cidade">
        <input name="city" defaultValue={values.city ?? ""} className={inputClass} />
      </Field>
      <Field label="Província">
        <input name="provincia" defaultValue={values.provincia ?? ""} className={inputClass} />
      </Field>
      <Field label="Nome do contacto">
        <input name="contactoNome" defaultValue={values.contactoNome ?? ""} className={inputClass} />
      </Field>
      <Field label="E-mail do contacto">
        <input name="contactoEmail" type="email" defaultValue={values.contactoEmail ?? ""} className={inputClass} />
      </Field>
      <Field label="Telefone do contacto">
        <input name="contactoTelefone" defaultValue={values.contactoTelefone ?? ""} className={inputClass} />
      </Field>
      <div className="flex items-end sm:col-span-2 lg:col-span-3">
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
