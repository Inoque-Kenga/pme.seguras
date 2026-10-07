import Link from "next/link";

function pageHref(basePath: string, params: Record<string, string>, page: number) {
  const query = new URLSearchParams({ ...params, page: String(page) });
  return `${basePath}?${query.toString()}`;
}

export function Pagination({
  basePath,
  params,
  page,
  totalPages,
  total,
}: {
  basePath: string;
  params: Record<string, string>;
  page: number;
  totalPages: number;
  total: number;
}) {
  if (totalPages <= 1) {
    return <p className="mt-4 text-xs text-slate-500">{total} registo(s)</p>;
  }
  return (
    <nav aria-label="Paginação" className="mt-4 flex items-center justify-between text-sm">
      <p className="text-xs text-slate-500">
        Página {page} de {totalPages} · {total} registo(s)
      </p>
      <div className="flex gap-2">
        {page > 1 && (
          <Link
            href={pageHref(basePath, params, page - 1)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
          >
            ← Anterior
          </Link>
        )}
        {page < totalPages && (
          <Link
            href={pageHref(basePath, params, page + 1)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
          >
            Seguinte →
          </Link>
        )}
      </div>
    </nav>
  );
}
