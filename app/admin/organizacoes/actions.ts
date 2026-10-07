"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { redirectWithResult, requireSuperAdminSession } from "@/lib/action-context";
import { archiveOrganization, createOrganization, updateOrganization } from "@/lib/services/organization.service";

function readInput(formData: FormData) {
  return {
    name: formData.get("name"),
    slug: formData.get("slug"),
    nif: formData.get("nif"),
    sector: formData.get("sector"),
    dimensao: formData.get("dimensao") || undefined,
    city: formData.get("city"),
    provincia: formData.get("provincia"),
    contactoNome: formData.get("contactoNome"),
    contactoEmail: formData.get("contactoEmail"),
    contactoTelefone: formData.get("contactoTelefone"),
    planoId: formData.get("planoId"),
  };
}

export async function createOrganizationAction(formData: FormData) {
  const session = await requireSuperAdminSession();
  const result = await createOrganization(session.user.id, readInput(formData));
  revalidatePath("/admin/organizacoes");
  if (result.ok) redirect(`/admin/organizacoes/${result.data.id}?success=Organiza%C3%A7%C3%A3o+criada+com+sucesso.`);
  redirectWithResult("/admin/organizacoes/nova", result, "");
}

export async function updateOrganizationAction(formData: FormData) {
  const session = await requireSuperAdminSession();
  const id = String(formData.get("id") ?? "");
  const result = await updateOrganization(session.user.id, id, readInput(formData));
  revalidatePath("/admin/organizacoes");
  redirectWithResult(`/admin/organizacoes/${id}`, result, "Organização atualizada com sucesso.");
}

export async function archiveOrganizationAction(formData: FormData) {
  const session = await requireSuperAdminSession();
  const id = String(formData.get("id") ?? "");
  const result = await archiveOrganization(session.user.id, id);
  revalidatePath("/admin/organizacoes");
  redirectWithResult("/admin/organizacoes", result, "Organização arquivada com sucesso.");
}
