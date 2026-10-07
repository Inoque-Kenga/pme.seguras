import { z } from "zod";

/** Política de passwords: mínimo 12 caracteres, com maiúscula, minúscula e dígito. */
export const passwordPolicySchema = z
  .string()
  .min(12, "A palavra-passe deve ter pelo menos 12 caracteres.")
  .max(128, "A palavra-passe é demasiado longa.")
  .regex(/[a-z]/, "Inclua pelo menos uma letra minúscula.")
  .regex(/[A-Z]/, "Inclua pelo menos uma letra maiúscula.")
  .regex(/\d/, "Inclua pelo menos um dígito.");
