"use server";

import { z } from "zod";
import { TicketStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { backWithMessage, getActionContext } from "@/lib/action-context";
import { createTicket, setTicketStatus } from "@/lib/services/tickets.service";
import { fail } from "@/lib/services/common";

export async function createTicketAction(formData: FormData) {
  const { session, ctx } = await getActionContext(formData);
  const result = await createTicket(ctx, session.user.id, {
    title: formData.get("title"),
    description: formData.get("description"),
    category: formData.get("category"),
    priority: formData.get("priority"),
  });
  revalidatePath("/tickets");
  backWithMessage("/tickets", ctx.organization.id, result, "Ticket criado com sucesso.");
}

export async function setTicketStatusAction(formData: FormData) {
  const { session, ctx } = await getActionContext(formData);
  const status = z.nativeEnum(TicketStatus).safeParse(formData.get("status"));
  const result = status.success
    ? await setTicketStatus(ctx, session.user.id, String(formData.get("id")), status.data)
    : fail("Estado inválido.");
  revalidatePath("/tickets");
  backWithMessage("/tickets", ctx.organization.id, result, "Estado do ticket atualizado.");
}
