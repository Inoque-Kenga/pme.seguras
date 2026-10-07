"use client";

import { useTransition } from "react";
import { revokeOtherSessionsAction, revokeSessionAction } from "./actions";

type SessionRow = {
  id: string;
  device: string;
  ipAddress: string;
  createdAt: string;
  isCurrent: boolean;
};

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("pt-PT", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
}

export function SessionsCard({ sessions }: { sessions: SessionRow[] }) {
  const [isPending, startTransition] = useTransition();

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Sessões ativas ({sessions.length})</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Dispositivos com sessão iniciada nesta conta. Termine qualquer sessão que não reconheça.
          </p>
        </div>
        {sessions.length > 1 && (
          <button
            onClick={() => startTransition(async () => { await revokeOtherSessionsAction(); })}
            disabled={isPending}
            className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
            type="button"
          >
            Terminar todas as outras
          </button>
        )}
      </div>

      {sessions.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">
          Nenhuma sessão registada. As sessões passam a ser registadas a partir do próximo início de sessão.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-100">
          {sessions.map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
              <div>
                <p className="font-medium text-slate-800">
                  {entry.device}
                  {entry.isCurrent && (
                    <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
                      esta sessão
                    </span>
                  )}
                </p>
                <p className="text-xs text-slate-500">
                  {entry.ipAddress} · desde {formatDate(entry.createdAt)}
                </p>
              </div>
              {!entry.isCurrent && (
                <button
                  onClick={() => startTransition(async () => { await revokeSessionAction(entry.id); })}
                  disabled={isPending}
                  className="text-xs font-semibold text-red-700 hover:text-red-900 disabled:opacity-60"
                  type="button"
                >
                  Terminar sessão
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
