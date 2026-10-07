"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";

/**
 * Botão com confirmação antes de executar uma ação destrutiva.
 * O formulário dentro do diálogo invoca a server action recebida.
 */
export function ConfirmAction({
  triggerLabel,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  action,
  fields,
  tone = "danger",
}: {
  triggerLabel: string;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  action: (formData: FormData) => void | Promise<void>;
  fields: Record<string, string>;
  tone?: "danger" | "primary";
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className={`text-xs font-semibold ${
            tone === "danger" ? "text-red-700 hover:text-red-900" : "text-blue-700 hover:text-blue-900"
          }`}
        >
          {triggerLabel}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-900/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl focus:outline-none">
          <Dialog.Title className="text-lg font-bold text-slate-900">{title}</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm leading-6 text-slate-600">{description}</Dialog.Description>
          <div className="mt-6 flex justify-end gap-3">
            <Dialog.Close asChild>
              <button
                type="button"
                className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                {cancelLabel}
              </button>
            </Dialog.Close>
            <form action={action}>
              {Object.entries(fields).map(([name, value]) => (
                <input key={name} type="hidden" name={name} value={value} />
              ))}
              <button
                type="submit"
                className={`h-10 rounded-lg px-4 text-sm font-semibold text-white ${
                  tone === "danger" ? "bg-red-700 hover:bg-red-800" : "bg-blue-800 hover:bg-blue-900"
                }`}
              >
                {confirmLabel}
              </button>
            </form>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
