import { NextResponse, type NextRequest } from "next/server";
import { AssetStatus, AssetType, Criticality } from "@prisma/client";
import { requireSession, resolveOrganization } from "@/lib/current-organization";
import { writeAuditLog } from "@/lib/audit-log.service";
import { listAssetsForExport, type AssetListParams } from "@/lib/services/asset.service";
import { assetStatusLabels, assetTypeLabels, criticalityLabels } from "@/lib/labels";

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await params;
  const session = await requireSession();
  const ctx = await resolveOrganization(session, organizationId);
  if (!ctx) {
    return NextResponse.json({ error: "Organização não encontrada ou sem acesso." }, { status: 404 });
  }

  const search = request.nextUrl.searchParams;
  const type = search.get("type") ?? "";
  const criticality = search.get("criticality") ?? "";
  const status = search.get("status") ?? "";
  const protecao = search.get("protecaoEndpoint") ?? "";
  const cifragem = search.get("cifragem") ?? "";

  const filters: AssetListParams = {
    search: search.get("search") ?? undefined,
    type: (Object.values(AssetType) as string[]).includes(type) ? (type as AssetType) : undefined,
    criticality: (Object.values(Criticality) as string[]).includes(criticality)
      ? (criticality as Criticality)
      : undefined,
    status: (Object.values(AssetStatus) as string[]).includes(status) ? (status as AssetStatus) : undefined,
    protecaoEndpoint: protecao === "" ? undefined : protecao === "true",
    cifragem: cifragem === "" ? undefined : cifragem === "true",
  };

  const assets = await listAssetsForExport(ctx.organization.id, filters);

  const header = ["Nome", "Tipo", "Criticidade", "Estado", "Proteção endpoint", "Cifragem"];
  const rows = assets.map((asset) =>
    [
      csvCell(asset.name),
      csvCell(assetTypeLabels[asset.type]),
      csvCell(criticalityLabels[asset.criticality]),
      csvCell(assetStatusLabels[asset.status]),
      csvCell(asset.protecaoEndpoint ? "Sim" : "Não"),
      csvCell(asset.cifragem ? "Sim" : "Não"),
    ].join(";"),
  );
  const csv = `﻿${header.map(csvCell).join(";")}\n${rows.join("\n")}`;

  await writeAuditLog({
    actorId: session.user.id,
    organizationId: ctx.organization.id,
    action: "EXPORT",
    resource: "asset",
    metadata: { total: assets.length },
  });

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ativos-${ctx.organization.slug}.csv"`,
    },
  });
}
