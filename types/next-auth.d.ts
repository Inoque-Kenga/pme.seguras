import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      sessionId?: string;
      memberships: { organizationId: string; role: string }[];
    } & NonNullable<DefaultSession["user"]>;
  }

  interface User {
    memberships: { organizationId: string; role: string }[];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    sessionId?: string;
    memberships?: { organizationId: string; role: string }[];
  }
}

import type { DefaultSession } from "next-auth";
