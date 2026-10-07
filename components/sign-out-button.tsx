"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

export function SignOutButton() {
  return (
    <button
      className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      onClick={() => signOut({ callbackUrl: "/login" })}
      type="button"
    >
      <LogOut aria-hidden="true" size={16} />
      <span className="hidden sm:inline">Terminar sessão</span>
    </button>
  );
}
