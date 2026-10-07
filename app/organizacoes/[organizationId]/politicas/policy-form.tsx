import { PolicyCategory, PolicyStatus } from "@prisma/client";
import { policyCategoryLabels, policyStatusLabels } from "@/lib/labels";

const inputClass =
  "h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100";

export type PolicyFormValues = {
  title?: string;
  content?: string;
  category?: PolicyCategory;
  status?: PolicyStatus;
};

export function PolicyForm({
  action,
  values = {},
  submitLabel,
  hiddenFields = {},
}: {
  action: (formData: FormData) => void | Promise<void>;
  values?: PolicyFormValues;
  submitLabel: string;
  hiddenFields?: Record<string, string>;
}) {
  return (
    <form action={action} className="grid gap-4">
      {Object.entries(hiddenFields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <label className="block text-sm font-medium text-slate-700">
        Título *
        <input required name="title" defaultValue={values.title} className={`${inputClass} mt-1`} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-slate-700">
          Categoria *
          <select name="category" defaultValue={values.category ?? "OUTRA"} className={`${inputClass} mt-1`}>
            {Object.values(PolicyCategory).map((value) => (
              <option key={value} value={value}>{policyCategoryLabels[value]}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Estado *
          <select name="status" defaultValue={values.status ?? "RASCUNHO"} className={`${inputClass} mt-1`}>
            {Object.values(PolicyStatus).map((value) => (
              <option key={value} value={value}>{policyStatusLabels[value]}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="block text-sm font-medium text-slate-700">
        Conteúdo da política * (texto simples ou Markdown)
        <textarea
          required
          name="content"
          rows={14}
          defaultValue={values.content}
          placeholder={"Exemplo:\n\n# Política de Palavras-passe\n\n1. Mínimo 12 caracteres...\n2. Nunca partilhar..."}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
        />
      </label>
      <p className="rounded-lg bg-blue-50 p-3 text-xs leading-5 text-blue-900">
        Ao editar uma política <strong>publicada</strong>, a versão anterior fica guardada no histórico e a versão é
        incrementada automaticamente.
      </p>
      <div>
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
