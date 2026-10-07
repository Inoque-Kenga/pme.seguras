import Link from "next/link";

type OrgOption = { id: string; name: string };

/** Seletor de organização por ligações (server-side, sem JS de cliente). */
export function OrgSwitcher({
  organizations,
  currentId,
  basePath,
}: {
  organizations: OrgOption[];
  currentId: string;
  basePath: string;
}) {
  if (organizations.length <= 1) return null;
  return (
    <nav aria-label="Selecionar organização" className="mb-6 flex flex-wrap items-center gap-2 text-sm">
      <span className="font-medium text-slate-500">Organização:</span>
      {organizations.map((organization) => (
        <Link
          key={organization.id}
          href={`${basePath}?org=${organization.id}`}
          className={`rounded-full px-3 py-1.5 font-medium transition ${
            organization.id === currentId
              ? "bg-blue-800 text-white"
              : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
          }`}
        >
          {organization.name}
        </Link>
      ))}
    </nav>
  );
}
