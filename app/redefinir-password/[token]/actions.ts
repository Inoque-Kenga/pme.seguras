"use server";

import { resetPasswordWithToken, validateResetToken } from "@/lib/services/password-reset.service";
import type { Result } from "@/lib/services/errors";

export async function validateTokenAction(token: string): Promise<boolean> {
  return validateResetToken(token);
}

export async function resetPasswordAction(input: {
  token: string;
  password: string;
  confirmPassword: string;
}): Promise<Result> {
  return resetPasswordWithToken(input);
}
