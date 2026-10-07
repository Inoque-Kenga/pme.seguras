"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex h-10 items-center rounded-lg bg-blue-800 px-5 text-sm font-semibold text-white hover:bg-blue-900 print:hidden"
      type="button"
    >
      🖨️ Imprimir / Guardar como PDF
    </button>
  );
}
