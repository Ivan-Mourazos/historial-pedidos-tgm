"use client";

import { useEffect, useState } from "react";
import { Banner, PageTitle, inputClass } from "@/components/ui";
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

  useEffect(() => {
    setCargando(true);
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
              className="overflow-hidden rounded-xl border border-[var(--border)] bg-surface"
              style={{ boxShadow: "var(--shadow-sm)" }}
            >
              {/* Cabecera */}
              <button
                className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-surface-2"
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
                      <tr className="border-b border-[var(--border)] bg-surface-2">
                        {["Nº Pedido", "Familia", "Medidas", "Fecha"].map((h) => (
                          <th
                            key={h}
                            className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-app-muted"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {c.pedidos.map((p, i) => {
                        const esRemolque = p.familia?.nombre === "REMOLQUES";
                        const tag = tagClass[(p.familia?.nombre as keyof typeof tagClass)] ?? tagClass.REMOLQUES;
                        return (
                          <tr
                            key={p.id}
                            className={`transition-colors hover:bg-surface-2 ${
                              i < c.pedidos.length - 1 ? "border-b border-[var(--border)]" : ""
                            }`}
                          >
                            <td className="px-4 py-2 font-mono font-semibold text-app-text">
                              {p.numero_pedido}
                            </td>
                            <td className="px-4 py-2">
                              <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${tag}`}>
                                {p.familia?.nombre ?? "—"}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-app-text">
                              {resumenMedidas(p, p.familia?.nombre ?? "")}
                            </td>
                            <td className="px-4 py-2 text-app-muted">{formatFecha(p.fecha)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {c.expandido && c.pedidos.length === 0 && (
                <p className="border-t border-[var(--border)] px-4 py-3 text-sm text-app-muted">
                  Sin pedidos registrados.
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
