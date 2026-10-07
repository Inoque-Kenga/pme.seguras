import { redirect } from "next/navigation";

/**
 * Compatibilidade: a verificação MFA está integrada no próprio /login
 * (segundo passo após a palavra-passe), por isso esta rota redireciona.
 */
export default function MfaVerifyRedirect() {
  redirect("/login");
}
