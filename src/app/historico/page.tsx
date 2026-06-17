"use client";

import { useEffect, useMemo, useState } from "react";
import { Banner, Card, PageTitle, inputClass } from "@/components/ui";
import { dbService } from "@/lib/db/db-service";
import { resumenMedidas, formatMedida, formatMedidaCm } from "@/lib/display";
import type { PedidoConRelaciones } from "@/lib/types";

type FiltroFamilia = "TODOS" | "REMOLQUES" | "PUERTAS";

const tagClass = {
  REMOLQUES: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300",
  PUERTAS:   "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
};

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
          const hay = [p.numero_pedido, p.cliente?.nombre, p.tipo,
            String(p.largo ?? ""), String(p.ancho ?? ""), String(p.alto ?? "")]
            .join(" ").toLowerCase();
          if (!hay.includes(texto)) return false;
        }
        return true;
      })
      .sort((a, b) => a.numero_pedido.localeCompare(b.numero_pedido));
  }, [pedidos, familia, busqueda]);

  const tabs: { key: FiltroFamilia; label: string }[] = [
    { key: "TODOS", label: "Todos" },
    { key: "REMOLQUES", label: "Remolques" },
    { key: "PUERTAS", label: "Puertas" },
  ];

  return (
    <div>
      <PageTitle title="Histórico de pedidos" subtitle={`${filtrados.length} pedidos`} />

      {error && <div className="mb-4"><Banner tone="warning">{error}</Banner></div>}

      {/* Filtros */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div
          className="flex rounded-lg border border-[var(--border-strong)] bg-surface p-0.5"
          style={{ boxShadow: "var(--shadow-sm)" }}
        >
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setFamilia(t.key)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
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
        className="overflow-hidden rounded-xl border border-[var(--border)] bg-surface"
        style={{ boxShadow: "var(--shadow-sm)" }}
      >
        {cargando ? (
          <p className="px-4 py-6 text-sm text-app-muted">Cargando…</p>
        ) : filtrados.length === 0 ? (
          <p className="px-4 py-6 text-sm text-app-muted">No hay pedidos que coincidan.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  {["Nº Pedido", "Cliente", "Familia", "Medidas", "Aguas / Radio", "Fecha"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-app-muted"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtrados.map((p, i) => {
                  const esRemolque = p.familia?.nombre === "REMOLQUES";
                  const tag = tagClass[(p.familia?.nombre as keyof typeof tagClass)] ?? tagClass.REMOLQUES;
                  return (
                    <tr
                      key={p.id}
                      className={`border-b border-[var(--border)] transition-colors hover:bg-surface-2 ${
                        i === filtrados.length - 1 ? "border-b-0" : ""
                      }`}
                    >
                      <td className="px-4 py-3 font-mono text-sm font-semibold text-app-text">
                        {p.numero_pedido}
                      </td>
                      <td className="px-4 py-3 text-app-text">{p.cliente?.nombre ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${tag}`}>
                          {p.familia?.nombre ?? "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-app-text">
                        {resumenMedidas(p, p.familia?.nombre ?? "")}
                      </td>
                      <td className="px-4 py-3 text-xs text-app-muted">
                        {esRemolque
                          ? [
                              p.aguas !== null ? `A ${formatMedidaCm(p.aguas)}` : null,
                              p.radio !== null ? `R ${formatMedida(p.radio)}` : null,
                            ].filter(Boolean).join(" · ") || "—"
                          : "—"
                        }
                      </td>
                      <td className="px-4 py-3 text-app-muted">{p.fecha ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
