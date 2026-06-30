"use client";

import { useEffect, useMemo, useState } from "react";
import { AbrirExcelButton, type ExcelFileOption } from "@/components/AbrirExcelButton";
import { AbrirZwcadButton } from "@/components/AbrirZwcadButton";
import { EditarPedidoModal } from "@/components/EditarPedidoModal";
import {
  Banner,
  PageTitle,
  inputClass,
  modalOverlayClass,
  modalPanelClass,
} from "@/components/ui";
import { dbService } from "@/lib/db/db-service";
import { formatMedida, formatFecha } from "@/lib/display";
import { repararMojibake, tipoRemolqueCanonico } from "@/lib/tipos-remolque";
import { useCatalogos } from "@/lib/useCatalogos";
import type { PedidoConRelaciones } from "@/lib/types";

type FiltroFamilia = "REMOLQUES" | "PUERTAS";
type ExcelPorPedido = Record<string, ExcelFileOption[]>;
type OrdenCampo = "numero_pedido" | "cliente" | "tipo" | "fecha" | "aguas" | "radio";
type OrdenDireccion = "asc" | "desc";
type OrdenHistorico = { campo: OrdenCampo; direccion: OrdenDireccion } | null;

function Th({
  children,
  className = "",
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <th className={`whitespace-nowrap px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-app-muted ${className}`}>
      {children}
    </th>
  );
}

function SortTh({
  children,
  campo,
  orden,
  onSort,
  className = "",
}: {
  children: React.ReactNode;
  campo: OrdenCampo;
  orden: OrdenHistorico;
  onSort: (campo: OrdenCampo) => void;
  className?: string;
}) {
  const activo = orden?.campo === campo;

  return (
    <th className={`whitespace-nowrap px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-app-muted ${className}`}>
      <button
        type="button"
        onClick={() => onSort(campo)}
        className="inline-flex items-center gap-1 rounded py-0.5 text-left uppercase transition-colors hover:text-app-text"
        title={`Ordenar por ${String(children).toLowerCase()}`}
      >
        <span>{children}</span>
        <span className={`text-[11px] ${activo ? "text-brand" : "text-app-muted/60"}`}>
          {activo ? (orden.direccion === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </button>
    </th>
  );
}

function normalizarTexto(valor?: string | null) {
  return repararMojibake(valor);
}

function estaVacio(valor: string | number | null | undefined) {
  return valor === null || valor === undefined || valor === "";
}

function compararConVaciosAlFinal<T extends string | number | null | undefined>(
  a: T,
  b: T,
  direccion: OrdenDireccion,
  comparar: (a: NonNullable<T>, b: NonNullable<T>) => number,
) {
  const aVacio = estaVacio(a);
  const bVacio = estaVacio(b);
  if (aVacio || bVacio) {
    if (aVacio && bVacio) return 0;
    return aVacio ? 1 : -1;
  }

  const resultado = comparar(a as NonNullable<T>, b as NonNullable<T>);
  return direccion === "asc" ? resultado : -resultado;
}

function compararTexto(a: string, b: string) {
  return a.localeCompare(b, "es", { numeric: true, sensitivity: "base" });
}

function fechaOrdenable(fecha?: string | null) {
  if (!fecha) return null;
  const time = new Date(fecha).getTime();
  return Number.isNaN(time) ? null : time;
}

function compararPedidos(a: PedidoConRelaciones, b: PedidoConRelaciones, orden: OrdenHistorico) {
  if (!orden) return 0;

  switch (orden.campo) {
    case "numero_pedido":
      return compararConVaciosAlFinal(
        normalizarTexto(a.numero_pedido),
        normalizarTexto(b.numero_pedido),
        orden.direccion,
        compararTexto,
      );
    case "cliente":
      return compararConVaciosAlFinal(
        normalizarTexto(a.cliente?.nombre),
        normalizarTexto(b.cliente?.nombre),
        orden.direccion,
        compararTexto,
      );
    case "tipo":
      return compararConVaciosAlFinal(
        normalizarTexto(a.tipo),
        normalizarTexto(b.tipo),
        orden.direccion,
        compararTexto,
      );
    case "fecha":
      return compararConVaciosAlFinal(
        fechaOrdenable(a.fecha),
        fechaOrdenable(b.fecha),
        orden.direccion,
        (x, y) => x - y,
      );
    case "aguas":
      return compararConVaciosAlFinal(a.aguas, b.aguas, orden.direccion, (x, y) => x - y);
    case "radio":
      return compararConVaciosAlFinal(a.radio, b.radio, orden.direccion, (x, y) => x - y);
    default:
      return 0;
  }
}

function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function puedeTenerExcel(familiaNombre: string, tipo?: string | null): boolean {
  return familiaNombre === "REMOLQUES" && !(tipo ?? "").toLowerCase().includes("ganado");
}

export default function HistoricoPage() {
  const cat = useCatalogos();
  const [pedidos, setPedidos] = useState<PedidoConRelaciones[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [familia, setFamilia] = useState<FiltroFamilia>("REMOLQUES");
  const [busqueda, setBusqueda] = useState("");
  const [editando, setEditando] = useState<PedidoConRelaciones | null>(null);
  const [verComentario, setVerComentario] = useState<PedidoConRelaciones | null>(null);
  const [excelPorPedido, setExcelPorPedido] = useState<ExcelPorPedido>({});
  const [orden, setOrden] = useState<OrdenHistorico>(null);

  async function cargar() {
    setCargando(true);
    dbService.getPedidos()
      .then(setPedidos)
      .catch((e) => setError(e instanceof Error ? e.message : "Error"))
      .finally(() => setCargando(false));
  }

  useEffect(() => { cargar(); }, []);

  useEffect(() => {
    if (familia !== "REMOLQUES" || pedidos.length === 0) return;

    const numerosPedido = [
      ...new Set(
        pedidos
          .filter((p) => puedeTenerExcel(p.familia?.nombre ?? "", p.tipo))
          .map((p) => p.numero_pedido),
      ),
    ];
    if (numerosPedido.length === 0) return;

    let activo = true;
    fetch("/api/excel/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ numerosPedido }),
    })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as {
          filesByPedido?: ExcelPorPedido;
        };
        if (activo && res.ok) setExcelPorPedido(data.filesByPedido ?? {});
      })
      .catch(() => {
        if (activo) setExcelPorPedido({});
      });

    return () => {
      activo = false;
    };
  }, [familia, pedidos]);

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    const resultado = pedidos.filter((p) => {
      if (p.familia?.nombre !== familia) return false;
      if (texto) {
        const hay = [p.numero_pedido, p.cliente?.nombre, p.tipo,
          String(p.largo ?? ""), String(p.ancho ?? ""), String(p.alto ?? "")]
          .join(" ").toLowerCase();
        if (!hay.includes(texto)) return false;
      }
      return true;
    });
    if (!orden) return resultado;
    return [...resultado].sort((a, b) => compararPedidos(a, b, orden));
  }, [pedidos, familia, busqueda, orden]);

  function cambiarOrden(campo: OrdenCampo) {
    setOrden((actual) => {
      if (actual?.campo !== campo) return { campo, direccion: "asc" };
      return { campo, direccion: actual.direccion === "asc" ? "desc" : "asc" };
    });
  }

  const tabs: { key: FiltroFamilia; label: string }[] = [
    { key: "REMOLQUES", label: "REMOLQUES" },
    { key: "PUERTAS", label: "PUERTAS" },
  ];
  const esPuertas = familia === "PUERTAS";

  return (
    <div>
      <PageTitle title="Histórico de pedidos" subtitle={`${filtrados.length} pedidos`} />

      {error && <div className="mb-4"><Banner tone="warning">{error}</Banner></div>}

      {/* Filtros */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div
        className="flex rounded-full border border-white/10 bg-surface/75 p-0.5 shadow-sm ring-1 ring-black/5 backdrop-blur-xl dark:ring-white/10"
          style={{ boxShadow: "var(--shadow-sm)" }}
        >
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setFamilia(t.key)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                familia === t.key
                  ? "bg-brand text-white shadow-sm"
                  : "text-app-muted hover:text-app-text"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <input
          className={`${inputClass} max-w-xs`}
          placeholder="Buscar por nº, cliente, medida…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      {/* Tabla */}
      <div
        className="overflow-hidden rounded-[18px] border border-white/10 bg-surface/80 shadow-sm ring-1 ring-black/5 backdrop-blur-xl dark:bg-slate-950/50 dark:ring-white/10"
        style={{ boxShadow: "var(--shadow-sm)" }}
      >
        {cargando ? (
          <p className="px-4 py-6 text-sm text-app-muted">Cargando…</p>
        ) : filtrados.length === 0 ? (
          <p className="px-4 py-6 text-sm text-app-muted">No hay pedidos que coincidan.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <SortTh campo="numero_pedido" orden={orden} onSort={cambiarOrden}>Nº Pedido</SortTh>
                  <SortTh campo="cliente" orden={orden} onSort={cambiarOrden}>Cliente</SortTh>
                  <SortTh campo="tipo" orden={orden} onSort={cambiarOrden}>Tipo</SortTh>
                  <Th>MEDIDAS</Th>
                  {!esPuertas && <SortTh campo="aguas" orden={orden} onSort={cambiarOrden}>Aguas</SortTh>}
                  {!esPuertas && <SortTh campo="radio" orden={orden} onSort={cambiarOrden}>Radio</SortTh>}
                  {esPuertas && <Th>I.D.</Th>}
                  <SortTh campo="fecha" orden={orden} onSort={cambiarOrden}>Fecha</SortTh>
                  <Th className={esPuertas ? "w-[130px]" : "w-[230px]"}>ACCIONES</Th>
                  <Th className="w-[82px]">EDITAR</Th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((p, i) => {
                  const fNombre = p.familia?.nombre ?? "";
                  const esRemolque = fNombre === "REMOLQUES";
                  return (
                    <tr
                      key={p.id}
                      className={`transition-colors hover:bg-surface-2/70 ${
                        i < filtrados.length - 1 ? "border-b border-[var(--border)]" : ""
                      }`}
                    >
                      <td className="whitespace-nowrap px-3 py-3 font-mono text-sm font-semibold text-app-text">
                        {p.numero_pedido}
                      </td>
                      <td className="max-w-[180px] truncate px-3 py-3 text-app-text">
                        {p.cliente?.nombre ?? "—"}
                      </td>

                      <td className="max-w-[150px] truncate px-3 py-3 text-app-muted">
                        {esRemolque ? tipoRemolqueCanonico(p.tipo) || "—" : p.tipo ?? "—"}
                      </td>

                      <td className="whitespace-nowrap px-3 py-3 text-app-text">
                        {esPuertas
                          ? [p.ancho, p.alto].map((v) => formatMedida(v) || "—").join(" × ")
                          : [p.largo, p.ancho, p.alto].map((v) => formatMedida(v) || "—").join(" × ")
                        }
                      </td>

                      {!esPuertas && (
                        <td className="whitespace-nowrap px-3 py-3 text-app-muted">
                          {esRemolque ? (formatMedida(p.aguas) || "—") : "—"}
                        </td>
                      )}
                      {!esPuertas && (
                        <td className="whitespace-nowrap px-3 py-3 text-app-muted">
                          {esRemolque ? (formatMedida(p.radio) || "—") : "—"}
                        </td>
                      )}
                      {esPuertas && (
                        <td className="whitespace-nowrap px-3 py-3 text-app-muted">
                          {p.impresion_digital ? "Sí" : "No"}
                        </td>
                      )}

                      <td className="whitespace-nowrap px-3 py-3 text-app-muted">{formatFecha(p.fecha)}</td>
                      <td className={`${esPuertas ? "w-[130px]" : "w-[230px]"} px-3 py-3`}>
                        <div className="flex h-8 items-center gap-2">
                          {!esPuertas && (
                            <div className="flex w-[86px] items-center justify-start">
                              <AbrirExcelButton
                                numeroPedido={p.numero_pedido}
                                familiaNombre={fNombre}
                                tipo={p.tipo}
                                files={excelPorPedido[p.numero_pedido] ?? []}
                                className="w-[86px]"
                              />
                            </div>
                          )}
                          <div className="flex w-[86px] items-center justify-start">
                            <AbrirZwcadButton
                              numeroPedido={p.numero_pedido}
                              label="CAD"
                              className="w-[86px]"
                            />
                          </div>
                          {p.observaciones && (
                            <button
                              onClick={() => setVerComentario(p)}
                              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-surface-2/70 text-xs font-semibold text-app-muted shadow-sm ring-1 ring-black/5 transition-colors hover:bg-[var(--border)] hover:text-app-text dark:ring-white/10"
                              title="Ver comentario"
                              aria-label={`Ver comentario de ${p.numero_pedido}`}
                            >
                              <span aria-hidden="true">💬</span>
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="w-[82px] border-l border-[var(--border)] px-2 py-3">
                        <button
                          onClick={() => setEditando(p)}
                          className="inline-flex h-8 w-[74px] items-center justify-start gap-1 rounded-full border border-orange-200/70 bg-orange-50/80 px-2 text-xs font-semibold text-orange-700 shadow-sm ring-1 ring-black/5 transition-colors hover:bg-orange-100 dark:border-orange-400/25 dark:bg-orange-400/10 dark:text-orange-200 dark:ring-white/10 dark:hover:border-orange-400/35 dark:hover:bg-orange-400/15"
                          aria-label={`Editar ${p.numero_pedido}`}
                        >
                          <PencilIcon />
                          <span className="text-left">Editar</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal edición */}
      {editando && (
        <EditarPedidoModal
          pedido={editando}
          familias={cat.familias}
          tecnicos={cat.tecnicos}
          tiposPuerta={cat.tiposPuerta}
          tiposRemolque={cat.tiposRemolque}
          onCerrar={() => setEditando(null)}
          onGuardado={async () => {
            setEditando(null);
            await cargar();
          }}
          onEliminar={async () => {
            setEditando(null);
            await cargar();
          }}
        />
      )}

      {/* Modal ver comentario */}
      {verComentario && (
        <div
          className={`${modalOverlayClass} flex items-center justify-center`}
          onClick={() => setVerComentario(null)}
        >
          <div
            className={`${modalPanelClass} max-w-[460px] p-4`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-[15px] font-semibold tracking-tight text-app-text">Comentario</h2>
                <p className="mt-0.5 font-mono text-xs text-app-muted">
                  {verComentario.numero_pedido}
                </p>
              </div>
              <button
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-2 text-app-muted transition-colors hover:bg-[var(--border)] hover:text-app-text"
                onClick={() => setVerComentario(null)}
                aria-label="Cerrar"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <p className="max-h-[55vh] overflow-y-auto whitespace-pre-wrap break-words rounded-[12px] border border-[var(--border)] bg-surface-2/45 p-3 text-sm leading-6 text-app-text">
              {verComentario.observaciones}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
