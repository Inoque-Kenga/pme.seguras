import { Priority, TicketCategory } from "@prisma/client";
import { priorityLabels, ticketCategoryLabels } from "@/lib/labels";

const inputClass =
  "h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100";

type Option = { id: string; name: string };

export type TicketFormValues = {
  title?: string;
  description?: string | null;
  category?: TicketCategory;
  priority?: Priority;
  slaHoras?: number | null;
  assetId?: string | null;
};

export function TicketForm({
  action,
  assets,
  values = {},
  submitLabel,
  hiddenFields = {},
}: {
  action: (formData: FormData) => void | Promise<void>;
  assets: Option[];
  values?: TicketFormValues;
  submitLabel: string;
  hiddenFields?: Record<string, string>;
}) {
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      {Object.entries(hiddenFields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
        Assunto *
        <input required name="title" defaultValue={values.title} className={`${inputClass} mt-1`} />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Categoria *
        <select name="category" defaultValue={values.category ?? "SUPORTE"} className={`${inputClass} mt-1`}>
          {Object.values(TicketCategory).map((value) => (
            <option key={value} value={value}>{ticketCategoryLabels[value]}</option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Prioridade *
        <select name="priority" defaultValue={values.priority ?? "MEDIUM"} className={`${inputClass} mt-1`}>
          {Object.values(Priority).map((value) => (
            <option key={value} value={value}>{priorityLabels[value]}</option>
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
      <label className="block text-sm font-medium text-slate-700">
        SLA (horas)
        <input name="slaHoras" type="number" min={1} placeholder="Ex.: 24" defaultValue={values.slaHoras ?? ""} className={`${inputClass} mt-1`} />
      </label>
      <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
        Descrição
        <textarea
          name="description"
          rows={4}
          placeholder="Descreva o problema ou pedido com o máximo de detalhe possível."
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
