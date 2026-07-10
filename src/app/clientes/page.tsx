"use client";

import { useEffect, useState } from "react";
import { AbrirExcelButton } from "@/components/AbrirExcelButton";
import { AbrirZwcadButton } from "@/components/AbrirZwcadButton";
import {
  Banner,
  PageTitle,
  inputClass,
  modalOverlayClass,
  modalPanelClass,
} from "@/components/ui";
import { dbService } from "@/lib/db/db-service";
import { resumenMedidas, formatFecha } from "@/lib/display";
import type { Cliente, PedidoConRelaciones } from "@/lib/types";

interface ClienteConPedidos extends Cliente {
  pedidos: PedidoConRelaciones[];
  expandido: boolean;
}

const tagClass = {
  REMOLQUES: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300",
  PUERTAS:   "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
};

export default function ClientesPage() {
  const [clientes, setClientes] = useState<ClienteConPedidos[]>([]);
  const [pedidos, setPedidos] = useState<PedidoConRelaciones[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [verComentario, setVerComentario] = useState<PedidoConRelaciones | null>(null);

  useEffect(() => {
    if (!verComentario) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setVerComentario(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [verComentario]);

  useEffect(() => {
    Promise.all([dbService.getClientes(), dbService.getPedidos()])
      .then(([cl, pe]) => {
        setPedidos(pe);
        setClientes(
          cl.map((c) => ({
            ...c,
            pedidos: pe
              .filter((p) => p.cliente_id === c.id)
              .sort((a, b) => a.numero_pedido.localeCompare(b.numero_pedido)),
            expandido: false,
          })).sort((a, b) => a.nombre.localeCompare(b.nombre)),
        );
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Error"))
      .finally(() => setCargando(false));
  }, []);

  const clientesFiltrados = clientes.filter((c) =>
    c.nombre.toLowerCase().includes(busqueda.toLowerCase().trim()),
  );

  function toggle(id: string) {
    setClientes((prev) =>
      prev.map((c) => (c.id === id ? { ...c, expandido: !c.expandido } : c)),
    );
  }

  return (
    <div>
      <PageTitle
        title="Clientes"
        subtitle={`${clientesFiltrados.length} clientes · ${pedidos.length} pedidos en total`}
      />

      {error && <div className="mb-4"><Banner tone="warning">{error}</Banner></div>}

      <div className="mb-4">
        <input
          className={`${inputClass} max-w-xs`}
          placeholder="Buscar cliente…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      {cargando ? (
        <p className="text-sm text-app-muted">Cargando…</p>
      ) : (
        <div className="grid gap-1.5">
          {clientesFiltrados.map((c) => (
            <div
              key={c.id}
              className="overflow-hidden rounded-[18px] border border-white/10 bg-surface/80 shadow-sm ring-1 ring-black/5 backdrop-blur-xl dark:bg-slate-950/50 dark:ring-white/10"
              style={{ boxShadow: "var(--shadow-sm)" }}
            >
              {/* Cabecera */}
              <button
                className="flex w-full items-center justify-between px-3 py-2.5 text-left transition-colors hover:bg-surface-2/70"
                onClick={() => toggle(c.id)}
              >
                <div className="flex items-center gap-2.5">
                  <span className="font-medium text-app-text">{c.nombre}</span>
                  {!c.activo && (
                    <span className="rounded-full border border-[var(--border-strong)] px-2 py-0.5 text-xs text-app-muted">
                      Inactivo
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-sm text-app-muted">
                    {c.pedidos.length}{" "}
                    {c.pedidos.length === 1 ? "pedido" : "pedidos"}
                  </span>
                  <span
                    className={`text-xs text-app-muted transition-transform duration-200 ${
                      c.expandido ? "rotate-180" : ""
                    }`}
                  >
                    ▼
                  </span>
                </div>
              </button>

              {/* Pedidos expandidos */}
              {c.expandido && c.pedidos.length > 0 && (
                <div className="border-t border-[var(--border)]">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border)] bg-surface-2/55">
                        {["Nº PEDIDO", "FAMILIA", "MEDIDAS", "FECHA", "ARCHIVOS"].map((h) => (
                          <th
                            key={h}
                            className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-app-muted"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {c.pedidos.map((p, i) => {
                        const tag = tagClass[(p.familia?.nombre as keyof typeof tagClass)] ?? tagClass.REMOLQUES;
                        const esRemolque = p.familia?.nombre === "REMOLQUES";
                        return (
                          <tr
                            key={p.id}
                            className={`transition-colors hover:bg-surface-2/70 ${
                              i < c.pedidos.length - 1 ? "border-b border-[var(--border)]" : ""
                            }`}
                          >
                            <td className="px-3 py-2 font-mono font-semibold text-app-text">
                              {p.numero_pedido}
                            </td>
                            <td className="px-3 py-2">
                              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tag}`}>
                                {p.familia?.nombre ?? "—"}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-app-text">
                              {resumenMedidas(p, p.familia?.nombre ?? "")}
                            </td>
                            <td className="px-3 py-2 text-app-muted">{formatFecha(p.fecha)}</td>
                            <td className="w-[230px] px-3 py-2">
                              <div className="flex h-8 items-center gap-2">
                                {esRemolque && (
                                  <div className="flex w-[86px] items-center justify-start">
                                    <AbrirExcelButton
                                      numeroPedido={p.numero_pedido}
                                      familiaNombre={p.familia?.nombre ?? ""}
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
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {c.expandido && c.pedidos.length === 0 && (
                <p className="border-t border-[var(--border)] px-3 py-2.5 text-sm text-app-muted">
                  Sin pedidos registrados.
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal ver comentario */}
      {verComentario && (
        <div
          className={`${modalOverlayClass} flex items-center justify-center`}
          onClick={() => setVerComentario(null)}
        >
          <div
            aria-labelledby="cliente-comentario-title"
            aria-modal="true"
            className={`${modalPanelClass} max-w-[460px] p-4`}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 id="cliente-comentario-title" className="text-[15px] font-semibold tracking-tight text-app-text">Comentario</h2>
                <p className="mt-0.5 font-mono text-xs text-app-muted">
                  {verComentario.numero_pedido}
                </p>
              </div>
              <button
                type="button"
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
