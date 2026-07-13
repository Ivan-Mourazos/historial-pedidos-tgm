import { HistoricoClient } from "./HistoricoClient";
import { dbServer } from "@/lib/db/server-service";
import { ordenarFamilias } from "@/lib/familias";
import type { PedidoOrdenCampo } from "@/lib/types";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const SORT_FIELDS = new Set<PedidoOrdenCampo>([
  "aguas",
  "cliente",
  "fecha",
  "numero_pedido",
  "radio",
  "tipo",
]);

export default async function HistoricoPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const familiasPromise = dbServer.getFamilias();
  const tecnicosPromise = dbServer.getTecnicos(true);
  const tiposPuertaPromise = dbServer.getTiposPuerta(true);
  const tiposRemolquePromise = dbServer.getTiposRemolque(true);

  const familias = ordenarFamilias(await familiasPromise);
  const requestedFamily = one(params.familia);
  const selectedFamily = familias.find((family) => family.nombre === requestedFamily)
    ?? familias.find((family) => family.nombre === "REMOLQUES")
    ?? familias[0];

  const sortParam = one(params.sort) as PedidoOrdenCampo | undefined;
  const sortBy = sortParam && SORT_FIELDS.has(sortParam) ? sortParam : "fecha";
  const direction = one(params.dir) === "asc" ? "asc" : "desc";
  const page = positiveInt(one(params.page), 1);
  const query = one(params.q)?.trim() ?? "";

  const [pedidosPage, tecnicos, tiposPuerta, tiposRemolque] = await Promise.all([
    dbServer.getPedidosPage({
      familiaId: selectedFamily?.id,
      page,
      pageSize: 50,
      search: query,
      tipo: one(params.tipo),
      recogida: one(params.recogida),
      fechaDesde: one(params.desde),
      fechaHasta: one(params.hasta),
      estadoPlanteo: one(params.estado) === "PENDIENTE" ? "PENDIENTE"
        : one(params.estado) === "REALIZADO" ? "REALIZADO" : undefined,
      sortBy,
      sortDirection: direction,
    }),
    tecnicosPromise,
    tiposPuertaPromise,
    tiposRemolquePromise,
  ]);

  return (
    <HistoricoClient
      familias={familias}
      pedidosPage={pedidosPage}
      selectedFamilyName={selectedFamily?.nombre ?? ""}
      tecnicos={tecnicos}
      tiposPuerta={tiposPuerta}
      tiposRemolque={tiposRemolque}
    />
  );
}
