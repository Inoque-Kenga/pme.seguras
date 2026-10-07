import Link from "next/link";
import {
  Building2,
  ClipboardList,
  DatabaseBackup,
  LayoutDashboard,
  ListTodo,
  Menu,
  Server,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Ticket,
  Users,
} from "lucide-react";
import { SignOutButton } from "@/components/sign-out-button";

const navigation = [
  { href: "/dashboard", label: "Painel inicial", icon: LayoutDashboard, roles: [] },
  { href: "/ativos", label: "Ativos", icon: Server, roles: [] },
  { href: "/avaliacoes", label: "Avaliações", icon: ClipboardList, roles: [] },
  { href: "/riscos", label: "Riscos", icon: ShieldAlert, roles: [] },
  { href: "/tarefas", label: "Tarefas", icon: ListTodo, roles: [] },
  { href: "/backups", label: "Backups", icon: DatabaseBackup, roles: [] },
  { href: "/tickets", label: "Tickets", icon: Ticket, roles: [] },
  { href: "/incidentes", label: "Incidentes", icon: Siren, roles: [] },
  { href: "/phishing", label: "Phishing", icon: ShieldAlert, roles: [] },
  { href: "/admin/organizacoes", label: "Organizações", icon: Building2, roles: ["SUPER_ADMIN", "ANALISTA_SEGURANCA"] },
  { href: "/admin/utilizadores", label: "Acessos", icon: Users, roles: ["SUPER_ADMIN"] },
];

export function AppShell({
  children,
  name,
  roles,
}: {
  children: React.ReactNode;
  name: string;
  roles: string[];
}) {
  const visibleNavigation = navigation.filter(
    (item) => item.roles.length === 0 || item.roles.some((role) => roles.includes(role)),
  );
  return (
    <div className="min-h-screen bg-slate-50 md:flex">
      <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white md:flex md:flex-col">
        <Link href="/dashboard" className="flex h-[72px] items-center gap-3 border-b border-slate-100 px-6">
          <span className="flex size-9 items-center justify-center rounded-xl bg-blue-800 text-white">
            <ShieldCheck aria-hidden="true" size={21} />
          </span>
          <span className="font-bold tracking-tight text-slate-900">CyberPME</span>
        </Link>
        <nav aria-label="Navegação principal" className="flex-1 space-y-1 px-3 py-5">
          {visibleNavigation.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              <Icon aria-hidden="true" size={18} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-slate-100 p-4 text-xs leading-5 text-slate-500">
          Dados de demonstração<br />Plataforma em desenvolvimento
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-10 flex h-[72px] items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-7">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg text-slate-500 md:hidden">
              <Menu aria-hidden="true" size={20} />
            </span>
            <p className="text-sm text-slate-500">Espaço de segurança</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm font-medium text-slate-700 sm:inline">{name}</span>
            <SignOutButton />
          </div>
        </header>
        <main className="p-4 sm:p-7 lg:p-10">{children}</main>
      </div>
    </div>
  );
}
