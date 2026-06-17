"use client";

import { useEffect, useMemo, useState } from "react";
import { Banner, Card, PageTitle, inputClass } from "@/components/ui";
import { dbService } from "@/lib/db/db-service";
import { formatMedida, formatMedidaCm } from "@/lib/display";
import type { PedidoConRelaciones } from "@/lib/types";

type FiltroFamilia = "TODOS" | "REMOLQUES" | "PUERTAS";

export default function HistoricoPage() {
  const [pedidos, setPedidos] = useState<PedidoConRelaciones[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [familia, setFamilia] = useState<FiltroFamilia>("TODOS");
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    setCargando(true);
    dbService.getPedidos()
      .then(setPedidos)
      .catch((e) => setError(e instanceof Error ? e.message : "Error"))
      .finally(() => setCargando(false));
  }, []);

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return pedidos
      .filter((p) => {
        if (familia !== "TODOS" && p.familia?.nombre !== familia) return false;
        if (texto) {
          const haystack = [
            p.numero_pedido,
            p.cliente?.nombre,
            p.tipo,
            String(p.largo ?? ""),
            String(p.ancho ?? ""),
            String(p.alto ?? ""),
          ].join(" ").toLowerCase();
          if (!haystack.includes(texto)) return false;
        }
        return true;
      })
      .sort((a, b) => a.numero_pedido.localeCompare(b.numero_pedido));
  }, [pedidos, familia, busqueda]);

  const tabs: FiltroFamilia[] = ["TODOS", "REMOLQUES", "PUERTAS"];

  return (
    <div>
      <PageTitle
        title="Histórico de pedidos"
        subtitle={`${filtrados.length} pedidos`}
      />

      {error && <div className="mb-4"><Banner tone="warning">{error}</Banner></div>}

      {/* Filtros */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex gap-1">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setFamilia(t)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                familia === t
                  ? "bg-slate-900 text-white"
                  : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {t === "TODOS" ? "Todos" : t.charAt(0) + t.slice(1).toLowerCase()}
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

      <Card className="overflow-x-auto">
        {cargando ? (
          <p className="text-sm text-slate-500">Cargando…</p>
        ) : filtrados.length === 0 ? (
          <p className="text-sm text-slate-500">No hay pedidos que coincidan.</p>
        ) : (
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="py-2 pr-4 font-medium">Nº Pedido</th>
                <th className="py-2 pr-4 font-medium">Cliente</th>
                <th className="py-2 pr-4 font-medium">Familia</th>
                <th className="py-2 pr-4 font-medium">Medidas</th>
                <th className="py-2 pr-4 font-medium">Aguas / Radio</th>
                <th className="py-2 font-medium">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((p) => {
                const esRemolque = p.familia?.nombre === "REMOLQUES";
                return (
                  <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-2 pr-4 font-mono font-semibold text-slate-900">
                      {p.numero_pedido}
                    </td>
                    <td className="py-2 pr-4 text-slate-700">{p.cliente?.nombre ?? "—"}</td>
                    <td className="py-2 pr-4">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        esRemolque
                          ? "bg-blue-100 text-blue-800"
                          : "bg-amber-100 text-amber-800"
                      }`}>
                        {p.familia?.nombre ?? "—"}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-slate-700">
                      {esRemolque
                        ? [p.largo, p.ancho, p.alto].map((v) => formatMedida(v) || "—").join(" × ")
                        : p.tipo
                          ? `${p.tipo} — ${[p.ancho, p.alto].map((v) => formatMedida(v) || "—").join(" × ")}`
                          : [p.ancho, p.alto].map((v) => formatMedida(v) || "—").join(" × ")
                      }
                    </td>
                    <td className="py-2 pr-4 text-slate-500 text-xs">
                      {esRemolque
                        ? [
                            p.aguas !== null ? `Aguas ${formatMedidaCm(p.aguas)}` : null,
                            p.radio !== null ? `Radio ${formatMedida(p.radio)}` : null,
                          ].filter(Boolean).join(" · ") || "—"
                        : "—"
                      }
                    </td>
                    <td className="py-2 text-slate-500">{p.fecha ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
