"use client";

import { useEffect, useState } from "react";
import { Banner, Card, PageTitle } from "@/components/ui";
import { dbService } from "@/lib/db/db-service";
import { formatMedida } from "@/lib/display";
import type { Cliente, PedidoConRelaciones } from "@/lib/types";

interface ClienteConPedidos extends Cliente {
  pedidos: PedidoConRelaciones[];
  expandido: boolean;
}

export default function ClientesPage() {
  const [clientes, setClientes] = useState<ClienteConPedidos[]>([]);
  const [pedidos, setPedidos] = useState<PedidoConRelaciones[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCargando(true);
    Promise.all([dbService.getClientes(), dbService.getPedidos()])
      .then(([cl, pe]) => {
        setPedidos(pe);
        setClientes(
          cl.map((c) => ({
            ...c,
            pedidos: pe.filter((p) => p.cliente_id === c.id)
              .sort((a, b) => a.numero_pedido.localeCompare(b.numero_pedido)),
            expandido: false,
          }))
          .sort((a, b) => a.nombre.localeCompare(b.nombre))
        );
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Error"))
      .finally(() => setCargando(false));
  }, []);

  function toggleExpandir(id: string) {
    setClientes((prev) =>
      prev.map((c) => c.id === id ? { ...c, expandido: !c.expandido } : c)
    );
  }

  const total = pedidos.length;

  return (
    <div>
      <PageTitle
        title="Clientes"
        subtitle={`${clientes.length} clientes · ${total} pedidos en total`}
      />

      {error && <div className="mb-4"><Banner tone="warning">{error}</Banner></div>}

      {cargando ? (
        <p className="text-sm text-slate-500">Cargando…</p>
      ) : (
        <div className="grid gap-2">
          {clientes.map((c) => (
            <Card key={c.id} className="p-0 overflow-hidden">
              {/* Cabecera cliente */}
              <button
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition-colors"
                onClick={() => toggleExpandir(c.id)}
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium text-slate-900">{c.nombre}</span>
                  {!c.activo && (
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-500">
                      Inactivo
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-400">
                    {c.pedidos.length} {c.pedidos.length === 1 ? "pedido" : "pedidos"}
                  </span>
                  <span className="text-slate-400 text-sm">{c.expandido ? "▲" : "▼"}</span>
                </div>
              </button>

              {/* Pedidos del cliente */}
              {c.expandido && c.pedidos.length > 0 && (
                <div className="border-t border-slate-100">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                        <th className="px-4 py-2 text-left font-medium">Nº Pedido</th>
                        <th className="px-4 py-2 text-left font-medium">Familia</th>
                        <th className="px-4 py-2 text-left font-medium">Medidas</th>
                        <th className="px-4 py-2 text-left font-medium">Fecha</th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.pedidos.map((p) => {
                        const esRemolque = p.familia?.nombre === "REMOLQUES";
                        return (
                          <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50">
                            <td className="px-4 py-2 font-mono font-semibold text-slate-900">
                              {p.numero_pedido}
                            </td>
                            <td className="px-4 py-2">
                              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                esRemolque
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-amber-100 text-amber-800"
                              }`}>
                                {p.familia?.nombre ?? "—"}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-slate-700">
                              {esRemolque
                                ? [p.largo, p.ancho, p.alto].map((v) => formatMedida(v) || "—").join(" × ")
                                : p.tipo
                                  ? `${p.tipo} — ${[p.ancho, p.alto].map((v) => formatMedida(v) || "—").join(" × ")}`
                                  : [p.ancho, p.alto].map((v) => formatMedida(v) || "—").join(" × ")
                              }
                            </td>
                            <td className="px-4 py-2 text-slate-500">{p.fecha ?? "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {c.expandido && c.pedidos.length === 0 && (
                <p className="border-t border-slate-100 px-4 py-3 text-sm text-slate-400">
                  Sin pedidos registrados.
                </p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
