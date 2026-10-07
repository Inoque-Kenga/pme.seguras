"use server";

import { requestPasswordReset } from "@/lib/services/password-reset.service";
import type { Result } from "@/lib/services/errors";

export async function requestResetAction(input: { email: string }): Promise<Result<{ devResetLink?: string }>> {
  return requestPasswordReset({ email: input.email });
}
