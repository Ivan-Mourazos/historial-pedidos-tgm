"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { AbrirExcelButton } from "@/components/AbrirExcelButton";
import { AbrirZwcadButton } from "@/components/AbrirZwcadButton";
import { EditarPedidoModal } from "@/components/EditarPedidoModal";
import { SearchHighlight } from "@/components/SearchHighlight";
import {
  PageTitle,
  SelectControl,
  inputClass,
  modalOverlayClass,
  modalPanelClass,
} from "@/components/ui";
import { formatAlturaRemolque, formatFecha, formatMedida } from "@/lib/display";
import { familiaPuedeTenerExcel, getFamiliaDefinition } from "@/lib/familias";
import { tipoRemolqueCanonico } from "@/lib/tipos-remolque";
import { TIPOS_RECOGIDA_REMOLQUE } from "@/lib/recogida-remolque";
import type {
  Familia,
  PedidoConRelaciones,
  PedidoOrdenCampo,
  PedidoPage,
  Tecnico,
  TipoPuerta,
  TipoRemolque,
} from "@/lib/types";

type OrdenDireccion = "asc" | "desc";

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return (
    <th className={`whitespace-nowrap px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-app-muted ${className}`}>
      {children}
    </th>
  );
}

function SortTh({
  children,
  campo,
  activeField,
  direction,
  onSort,
  className = "",
}: {
  children: React.ReactNode;
  campo: PedidoOrdenCampo;
  activeField: PedidoOrdenCampo;
  direction: OrdenDireccion;
  onSort: (campo: PedidoOrdenCampo) => void;
  className?: string;
}) {
  const active = activeField === campo;
  return (
    <th
      aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}
      className={`whitespace-nowrap px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-app-muted ${className}`}
    >
      <button
        type="button"
        onClick={() => onSort(campo)}
        className="inline-flex items-center gap-1 rounded py-0.5 text-left uppercase transition-colors hover:text-app-text"
        title={`Ordenar por ${String(children).toLocaleLowerCase("es-ES")}`}
      >
        <span>{children}</span>
        <span aria-hidden="true" className={`text-[11px] ${active ? "text-brand" : "text-app-muted/60"}`}>
          {active ? (direction === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </button>
    </th>
  );
}

function PencilIcon() {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function genericTechnicalSummary(pedido: PedidoConRelaciones): string {
  const entries = Object.entries(pedido.datos_tecnicos ?? {});
  if (entries.length === 0) return "—";
  return entries
    .slice(0, 4)
    .map(([key, value]) => `${key}: ${String(value ?? "—")}`)
    .join(" · ");
}

export function HistoricoClient({
  familias,
  pedidosPage,
  selectedFamilyName,
  tecnicos,
  tiposPuerta,
  tiposRemolque,
}: {
  familias: Familia[];
  pedidosPage: PedidoPage;
  selectedFamilyName: string;
  tecnicos: Tecnico[];
  tiposPuerta: TipoPuerta[];
  tiposRemolque: TipoRemolque[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentSearch = searchParams.get("q") ?? "";
  const searchTimer = useRef<number | null>(null);
  const submittedSearch = useRef(currentSearch);
  const [isPending, startTransition] = useTransition();
  const [searchValue, setSearchValue] = useState(currentSearch);
  const [editando, setEditando] = useState<PedidoConRelaciones | null>(null);
  const [verComentario, setVerComentario] = useState<PedidoConRelaciones | null>(null);
  const [mostrarFiltros, setMostrarFiltros] = useState(
    () => searchParams.has("tipo") || searchParams.has("recogida") || searchParams.has("desde") || searchParams.has("hasta"),
  );
  const definition = getFamiliaDefinition(selectedFamilyName);
  const isDoors = definition.variante === "puertas";
  const isTrailers = definition.variante === "remolques";
  const activeSort = (searchParams.get("sort") as PedidoOrdenCampo | null) ?? "fecha";
  const direction: OrdenDireccion = searchParams.get("dir") === "asc" ? "asc" : "desc";

  const hrefWith = useCallback((changes: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (!value) next.delete(key);
      else next.set(key, value);
    }
    const query = next.toString();
    return query ? `${pathname}?${query}` : pathname;
  }, [pathname, searchParams]);

  const navigate = useCallback((changes: Record<string, string | null>) => {
    startTransition(() => router.replace(hrefWith(changes), { scroll: false }));
  }, [hrefWith, router]);

  useEffect(() => () => {
    if (searchTimer.current !== null) window.clearTimeout(searchTimer.current);
  }, []);

  useEffect(() => {
    if (currentSearch === submittedSearch.current) return;
    submittedSearch.current = currentSearch;
    setSearchValue(currentSearch);
  }, [currentSearch]);

  useEffect(() => {
    if (!verComentario) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setVerComentario(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [verComentario]);

  function changeSort(campo: PedidoOrdenCampo) {
    const nextDirection = activeSort === campo && direction === "asc" ? "desc" : "asc";
    navigate({ sort: campo, dir: nextDirection, page: null });
  }

  function clearSearch() {
    if (searchTimer.current !== null) window.clearTimeout(searchTimer.current);
    submittedSearch.current = "";
    setSearchValue("");
    navigate({ q: null, page: null });
  }

  function clearFilters() {
    navigate({ tipo: null, recogida: null, desde: null, hasta: null, page: null });
  }

  const start = pedidosPage.total === 0 ? 0 : (pedidosPage.page - 1) * pedidosPage.pageSize + 1;
  const end = Math.min(pedidosPage.total, pedidosPage.page * pedidosPage.pageSize);

  return (
    <div className={isPending ? "opacity-75 transition-opacity" : "transition-opacity"}>
      <PageTitle
        title="Histórico de pedidos"
        subtitle={`${start}–${end} de ${pedidosPage.total} pedidos`}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div
          aria-label="Familia de pedido"
          className="flex flex-wrap rounded-[16px] border border-white/10 bg-surface/75 p-0.5 shadow-sm ring-1 ring-black/5 backdrop-blur-xl dark:ring-white/10"
          role="group"
        >
          {familias.map((family) => (
            <button
              key={family.id}
              type="button"
              aria-pressed={selectedFamilyName === family.nombre}
              onClick={() => navigate({ familia: family.nombre, page: null })}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                selectedFamilyName === family.nombre
                  ? "bg-brand text-white shadow-sm"
                  : "text-app-muted hover:text-app-text"
              }`}
            >
              {family.nombre}
            </button>
          ))}
        </div>
        <div className="relative w-full max-w-xs">
          <input
            aria-label="Buscar pedidos"
            aria-busy={isPending}
            autoComplete="off"
            className={`${inputClass} ${searchValue ? "pr-9" : ""}`}
            name="buscar-pedidos"
            placeholder="Nº, cliente, tipo o 250x300…"
            value={searchValue}
            onChange={(event) => {
              const nextValue = event.target.value;
              setSearchValue(nextValue);
              if (searchTimer.current !== null) window.clearTimeout(searchTimer.current);
              searchTimer.current = window.setTimeout(() => {
                const value = nextValue.trim();
                submittedSearch.current = value;
                navigate({ q: value || null, page: null });
              }, 250);
            }}
          />
          {searchValue && <button type="button" aria-label="Borrar búsqueda" title="Borrar" className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-base text-app-muted hover:bg-surface-2 hover:text-app-text" onClick={clearSearch}>×</button>}
        </div>
        <button
          type="button"
          aria-expanded={mostrarFiltros}
          onClick={() => setMostrarFiltros((actual) => !actual)}
          className="inline-flex h-9 items-center rounded-xl border border-[var(--border)] bg-surface px-3 text-sm font-medium text-app-text transition-colors hover:bg-surface-2"
        >
          Filtros
          {["tipo", "recogida", "desde", "hasta"].some((key) => searchParams.has(key)) && (
            <span className="ml-2 h-2 w-2 rounded-full bg-brand" aria-label="Filtros activos" />
          )}
        </button>
        {(["tipo", "recogida", "desde", "hasta"].some((key) => searchParams.has(key))) && (
          <button type="button" onClick={clearFilters} className="rounded-lg px-2 py-1.5 text-sm text-app-muted hover:bg-surface-2 hover:text-app-text">Borrar filtros</button>
        )}
      </div>

      {mostrarFiltros && (
        <div className="mb-4 grid grid-cols-4 gap-3 rounded-xl border border-[var(--border)] bg-surface/70 p-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-app-muted">Tipo</label>
            <SelectControl
              value={searchParams.get("tipo") ?? ""}
              clearable
              onChange={(value) => navigate({ tipo: value || null, page: null })}
              options={[
                { value: "", label: "Todos" },
                ...(isTrailers ? tiposRemolque : tiposPuerta).map((tipo) => ({ value: tipo.nombre, label: tipo.nombre })),
              ]}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-app-muted">Recogida</label>
            <SelectControl
              disabled={!isTrailers}
              value={searchParams.get("recogida") ?? ""}
              clearable
              onChange={(value) => navigate({ recogida: value || null, page: null })}
              options={[{ value: "", label: "Todas" }, ...TIPOS_RECOGIDA_REMOLQUE.map((value) => ({ value, label: value }))]}
            />
          </div>
          <label className="text-xs font-medium text-app-muted">Desde
            <input type="date" className={`${inputClass} mt-1`} value={searchParams.get("desde") ?? ""} onChange={(event) => navigate({ desde: event.target.value || null, page: null })} />
          </label>
          <label className="text-xs font-medium text-app-muted">Hasta
            <input type="date" className={`${inputClass} mt-1`} value={searchParams.get("hasta") ?? ""} onChange={(event) => navigate({ hasta: event.target.value || null, page: null })} />
          </label>
        </div>
      )}

      <div className="overflow-hidden rounded-[18px] border border-white/10 bg-surface/80 shadow-sm ring-1 ring-black/5 backdrop-blur-xl dark:bg-slate-950/50 dark:ring-white/10">
        {pedidosPage.items.length === 0 ? (
          <p className="px-4 py-6 text-sm text-app-muted">No hay pedidos que coincidan.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[910px] table-fixed text-sm">
              <colgroup>
                <col className="w-[98px]" />
                <col className="w-[128px]" />
                <col className="w-[80px]" />
                <col className="w-[120px]" />
                {isTrailers && <col className="w-[60px]" />}
                {isTrailers && <col className="w-[60px]" />}
                {isTrailers && <col className="w-[112px]" />}
                {isDoors && <col className="w-[64px]" />}
                <col className="w-[85px]" />
                <col className="w-[168px]" />
              </colgroup>
              <thead className="bg-surface/95">
                <tr className="border-b border-[var(--border)]">
                  <SortTh campo="numero_pedido" activeField={activeSort} direction={direction} onSort={changeSort}>Nº Pedido</SortTh>
                  <SortTh campo="cliente" activeField={activeSort} direction={direction} onSort={changeSort}>Cliente</SortTh>
                  <SortTh campo="tipo" activeField={activeSort} direction={direction} onSort={changeSort}>Tipo</SortTh>
                  <Th>{definition.variante === "generic" ? "Datos técnicos" : "Medidas"}</Th>
                  {isTrailers && <SortTh campo="aguas" activeField={activeSort} direction={direction} onSort={changeSort}>Aguas</SortTh>}
                  {isTrailers && <SortTh campo="radio" activeField={activeSort} direction={direction} onSort={changeSort}>Radio</SortTh>}
                  {isTrailers && <Th>Recogida</Th>}
                  {isDoors && <Th>I.D.</Th>}
                  <SortTh campo="fecha" activeField={activeSort} direction={direction} onSort={changeSort}>Fecha</SortTh>
                  <Th>Acciones</Th>
                </tr>
              </thead>
              <tbody>
                {pedidosPage.items.map((pedido, index) => {
                  const familyName = pedido.familia?.nombre ?? selectedFamilyName;
                  const excelEligible = familiaPuedeTenerExcel(familyName);
                  return (
                    <tr
                      key={pedido.id}
                      className={`transition-colors hover:bg-surface-2/70 ${index < pedidosPage.items.length - 1 ? "border-b border-[var(--border)]" : ""}`}
                    >
                      <td className="whitespace-nowrap px-3 py-3">
                        <p className="font-mono text-sm font-semibold text-app-text"><SearchHighlight text={pedido.numero_pedido} query={currentSearch} /></p>
                        <span className="mt-1 inline-flex rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-300">Verificado</span>
                      </td>
                      <td className="max-w-[180px] truncate px-3 py-3 text-app-text" title={pedido.cliente?.nombre}><SearchHighlight text={pedido.cliente?.nombre ?? "—"} query={currentSearch} /></td>
                      <td className="max-w-[150px] truncate px-3 py-3 text-app-muted">
                        <SearchHighlight text={isTrailers ? tipoRemolqueCanonico(pedido.tipo) || "—" : pedido.tipo ?? "—"} query={currentSearch} />
                      </td>
                      <td className="max-w-[320px] truncate whitespace-nowrap px-3 py-3 text-app-text">
                        <SearchHighlight text={isDoors
                          ? [pedido.ancho, pedido.alto].map((value) => formatMedida(value) || "—").join(" × ")
                          : isTrailers
                            ? [formatMedida(pedido.largo) || "—", formatMedida(pedido.ancho) || "—", formatAlturaRemolque(pedido) || "—"].join(" × ")
                            : genericTechnicalSummary(pedido)} query={currentSearch} />
                      </td>
                      {isTrailers && <td className="whitespace-nowrap px-3 py-3 text-app-muted"><SearchHighlight text={formatMedida(pedido.aguas) || "—"} query={currentSearch} /></td>}
                      {isTrailers && <td className="whitespace-nowrap px-3 py-3 text-app-muted"><SearchHighlight text={formatMedida(pedido.radio) || "—"} query={currentSearch} /></td>}
                      {isTrailers && (
                        <td className="px-3 py-3 text-xs leading-4 text-app-muted">
                          {pedido.recogida_delante || pedido.recogida_atras ? (
                            <>
                              <span className="block truncate" title={pedido.recogida_delante ?? undefined}><strong>Del.:</strong> {pedido.recogida_delante ?? "—"}</span>
                              <span className="block truncate" title={pedido.recogida_atras ?? undefined}><strong>Atr.:</strong> {pedido.recogida_atras ?? "—"}</span>
                            </>
                          ) : "—"}
                        </td>
                      )}
                      {isDoors && <td className="whitespace-nowrap px-3 py-3 text-app-muted">{pedido.impresion_digital ? "Sí" : "No"}</td>}
                      <td className="whitespace-nowrap px-3 py-3 text-app-muted">{formatFecha(pedido.fecha)}</td>
                      <td className="px-3 py-3">
                        <div className="flex h-8 items-center gap-1.5">
                          {excelEligible && (
                            <AbrirExcelButton numeroPedido={pedido.numero_pedido} familiaNombre={familyName} compact />
                          )}
                          <AbrirZwcadButton numeroPedido={pedido.numero_pedido} compact />
                          {pedido.observaciones && (
                            <button
                              type="button"
                              onClick={() => setVerComentario(pedido)}
                              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-surface-2/70 text-xs font-semibold text-app-muted shadow-sm ring-1 ring-black/5 transition-colors hover:bg-[var(--border)] hover:text-app-text dark:ring-white/10"
                              title="Ver comentario"
                              aria-label={`Ver comentario de ${pedido.numero_pedido}`}
                            >
                              <span aria-hidden="true">💬</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setEditando(pedido)}
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-orange-400/25 bg-orange-400/10 text-orange-200 shadow-sm ring-1 ring-black/5 transition-colors hover:bg-orange-400/20 focus-visible:ring-2 focus-visible:ring-brand dark:ring-white/10"
                            aria-label={`Editar ${pedido.numero_pedido}`}
                            title="Editar pedido"
                          >
                            <PencilIcon />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pedidosPage.totalPages > 1 && (
        <nav aria-label="Paginación del histórico" className="mt-4 flex items-center justify-between gap-3">
          <span className="text-sm text-app-muted">Página {pedidosPage.page} de {pedidosPage.totalPages}</span>
          <div className="flex gap-2">
            {pedidosPage.page > 1 ? (
              <Link className="inline-flex h-9 items-center rounded-[12px] border border-[var(--border)] bg-surface px-3 text-sm font-medium text-app-text hover:bg-surface-2" href={hrefWith({ page: String(pedidosPage.page - 1) })}>Anterior</Link>
            ) : <span aria-disabled="true" className="inline-flex h-9 items-center rounded-[12px] border border-[var(--border)] px-3 text-sm text-app-muted opacity-50">Anterior</span>}
            {pedidosPage.page < pedidosPage.totalPages ? (
              <Link className="inline-flex h-9 items-center rounded-[12px] bg-brand px-3 text-sm font-medium text-white hover:bg-[var(--brand-hover)]" href={hrefWith({ page: String(pedidosPage.page + 1) })}>Siguiente</Link>
            ) : <span aria-disabled="true" className="inline-flex h-9 items-center rounded-[12px] bg-brand px-3 text-sm text-white opacity-50">Siguiente</span>}
          </div>
        </nav>
      )}

      {editando && (
        <EditarPedidoModal
          pedido={editando}
          familias={familias}
          tecnicos={tecnicos}
          tiposPuerta={tiposPuerta}
          tiposRemolque={tiposRemolque}
          onCerrar={() => setEditando(null)}
          onGuardado={async () => { setEditando(null); router.refresh(); }}
          onEliminar={async () => { setEditando(null); router.refresh(); }}
        />
      )}

      {verComentario && (
        <div className={`${modalOverlayClass} flex items-center justify-center`} onClick={() => setVerComentario(null)}>
          <div
            aria-labelledby="comentario-title"
            aria-modal="true"
            className={`${modalPanelClass} max-w-[460px] p-4`}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 id="comentario-title" className="text-[15px] font-semibold tracking-tight text-app-text">Comentario</h2>
                <p className="mt-0.5 font-mono text-xs text-app-muted">{verComentario.numero_pedido}</p>
              </div>
              <button type="button" className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-surface-2 text-app-muted hover:text-app-text" onClick={() => setVerComentario(null)} aria-label="Cerrar comentario">×</button>
            </div>
            <p className="max-h-[55vh] overflow-y-auto whitespace-pre-wrap break-words rounded-[12px] border border-[var(--border)] bg-surface-2/45 p-3 text-sm leading-6 text-app-text">{verComentario.observaciones}</p>
          </div>
        </div>
      )}
    </div>
  );
}
