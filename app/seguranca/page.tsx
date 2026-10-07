import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireSession } from "@/lib/action-context";
import { prisma } from "@/lib/prisma";
import { countBackupCodes } from "@/lib/services/mfa.service";
import { describeUserAgent, listRecentLogins, listUserSessions } from "@/lib/services/session.service";
import { BackupCodesCard } from "./backup-codes-card";
import { ChangePasswordForm } from "./change-password-form";
import { MfaCard } from "./mfa-card";
import { SessionsCard } from "./sessions-card";

export default async function SecurityPage() {
  const session = await requireSession();
  const roles = Array.from(new Set(session.user.memberships.map((membership) => membership.role)));

  const [user, sessions, logins, backupCodesRemaining] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id }, select: { mfaEnabled: true } }),
    listUserSessions(session.user.id),
    listRecentLogins(session.user.id),
    countBackupCodes(session.user.id),
  ]);

  const mfaEnabled = user?.mfaEnabled ?? false;

  return (
    <AppShell name={session.user.name ?? "Utilizador"} roles={roles}>
      <div className="mx-auto max-w-4xl">
        <PageHeader
          eyebrow="A minha conta"
          title="Segurança"
          description="Gerir MFA, palavra-passe, sessões ativas e a atividade recente da sua conta."
        />

        <div className="space-y-6">
          <MfaCard mfaEnabled={mfaEnabled} />
          {mfaEnabled && <BackupCodesCard remaining={backupCodesRemaining} />}
          <ChangePasswordForm />
          <SessionsCard
            sessions={sessions.map((entry) => ({
              id: entry.id,
              device: describeUserAgent(entry.userAgent),
              ipAddress: entry.ipAddress ?? "Desconhecido",
              createdAt: entry.createdAt.toISOString(),
              isCurrent: entry.id === session.user.sessionId,
            }))}
          />

          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="mb-4 text-base font-semibold text-slate-900">Últimos inícios de sessão</h2>
            {logins.length === 0 ? (
              <p className="text-sm text-slate-500">Ainda não há registos de início de sessão.</p>
            ) : (
              <ul className="divide-y divide-slate-100 text-sm">
                {logins.map((login) => {
                  const metadata = login.metadata as { sucesso?: boolean } | null;
                  return (
                    <li key={login.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                      <span className="text-slate-700">
                        {new Intl.DateTimeFormat("pt-PT", { dateStyle: "short", timeStyle: "short" }).format(login.createdAt)}
                        <span className="ml-2 text-xs text-slate-400">
                          {describeUserAgent(login.userAgent)} · {login.ipAddress ?? "IP desconhecido"}
                        </span>
                      </span>
                      <StatusBadge
                        label={metadata?.sucesso === false ? "Falhado" : "Sucesso"}
                        tone={metadata?.sucesso === false ? "red" : "green"}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}
