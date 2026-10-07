"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/current-organization";
import { createUser, setUserActive } from "@/lib/services/users.service";
import { fail, type ServiceResult } from "@/lib/services/common";

function back(result: ServiceResult, successMessage: string): never {
  const params = new URLSearchParams();
  if (result.ok) params.set("success", successMessage);
  else params.set("error", result.error);
  redirect(`/admin/utilizadores?${params.toString()}`);
}

async function requireSuperAdmin() {
  const session = await requireSession();
  return {
    session,
    isSuperAdmin: session.user.memberships.some((membership) => membership.role === "SUPER_ADMIN"),
  };
}

export async function createUserAction(formData: FormData) {
  const { session, isSuperAdmin } = await requireSuperAdmin();
  const result = isSuperAdmin
    ? await createUser(session.user.id, {
        name: formData.get("name"),
        email: formData.get("email"),
        password: formData.get("password"),
        organizationId: formData.get("organizationId"),
        role: formData.get("role"),
      })
    : fail("Apenas o super administrador pode criar utilizadores.");
  revalidatePath("/admin/utilizadores");
  back(result, "Utilizador criado com sucesso.");
}

export async function setUserActiveAction(formData: FormData) {
  const { session, isSuperAdmin } = await requireSuperAdmin();
  const result = isSuperAdmin
    ? await setUserActive(session.user.id, String(formData.get("id")), formData.get("isActive") === "true")
    : fail("Apenas o super administrador pode alterar utilizadores.");
  revalidatePath("/admin/utilizadores");
  back(result, "Estado do utilizador atualizado.");
}
