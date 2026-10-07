import crypto from "node:crypto";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit-log.service";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { verifyLoginMfa } from "@/lib/services/mfa.service";
import { recordSession, revokeSessionById } from "@/lib/services/session.service";

const credentialsSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128),
  totp: z.string().trim().max(16).optional(),
});

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: { signIn: "/login", error: "/login" },
  providers: [
    CredentialsProvider({
      name: "Credenciais",
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Palavra-passe", type: "password" },
        totp: { label: "Código MFA", type: "text" },
      },
      async authorize(input) {
        const parsed = credentialsSchema.safeParse(input);
        if (!parsed.success) return null;
        const email = parsed.data.email.toLowerCase();

        // Rate limiting de login por e-mail (5 tentativas / 15 min).
        const limit = await checkRateLimit(`login:${email}`, RATE_LIMITS.login.maxAttempts, RATE_LIMITS.login.windowMs, {
          resource: "auth_login",
        });
        if (!limit.allowed) throw new Error("RATE_LIMITED");

        const user = await prisma.user.findUnique({
          where: { email },
          include: {
            memberships: {
              where: { status: "ACTIVE", organization: { status: "ACTIVE" } },
              select: { organizationId: true, role: true },
            },
          },
        });
        if (!user?.isActive || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
          return null;
        }

        // MFA: se ativo, exige código TOTP ou código de backup.
        if (user.mfaEnabled) {
          if (!parsed.data.totp) throw new Error("MFA_REQUIRED");
          const mfaOk = await verifyLoginMfa(user.id, parsed.data.totp);
          if (!mfaOk) {
            await writeAuditLog({
              actorId: user.id,
              action: "LOGIN",
              resource: "auth",
              metadata: { sucesso: false, motivo: "mfa_invalido" },
            });
            return null;
          }
        }

        await writeAuditLog({
          actorId: user.id,
          action: "LOGIN",
          resource: "auth",
          metadata: { sucesso: true },
        });
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          memberships: user.memberships,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const signedInUser = user as typeof user & {
          memberships: { organizationId: string; role: string }[];
        };
        // Regista a sessão emitida para gestão em /seguranca.
        const sessionId = crypto.randomUUID();
        token.sessionId = sessionId;
        token.userId = signedInUser.id;
        token.memberships = signedInUser.memberships;
        await recordSession(signedInUser.id, sessionId);
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.userId ?? token.sub ?? "");
        session.user.sessionId = typeof token.sessionId === "string" ? token.sessionId : undefined;
        session.user.memberships = Array.isArray(token.memberships)
          ? token.memberships
          : [];
      }
      return session;
    },
  },
  events: {
    async signOut({ token }) {
      const sessionId = typeof token.sessionId === "string" ? token.sessionId : undefined;
      const userId = String(token.userId ?? token.sub ?? "");
      if (sessionId) await revokeSessionById(sessionId);
      if (userId) {
        await writeAuditLog({
          actorId: userId,
          action: "LOGOUT",
          resource: "auth",
        });
      }
    },
  },
};
