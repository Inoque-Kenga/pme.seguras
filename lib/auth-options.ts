import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const credentialsSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128),
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
      },
      async authorize(input) {
        const parsed = credentialsSchema.safeParse(input);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email.toLowerCase() },
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
        token.userId = signedInUser.id;
        token.memberships = signedInUser.memberships;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.userId ?? token.sub ?? "");
        session.user.memberships = Array.isArray(token.memberships)
          ? token.memberships
          : [];
      }
      return session;
    },
  },
};
