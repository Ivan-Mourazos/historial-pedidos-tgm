"use client";

import { useEffect, useMemo, useState } from "react";
import { EditarPedidoModal } from "@/components/EditarPedidoModal";
import { Banner, PageTitle, inputClass } from "@/components/ui";
import { dbService } from "@/lib/db/db-service";
import { resumenMedidas, formatMedida } from "@/lib/display";
import { useCatalogos } from "@/lib/useCatalogos";
import type { PedidoConRelaciones } from "@/lib/types";

type FiltroFamilia = "TODOS" | "REMOLQUES" | "PUERTAS";

const tagClass = {
  REMOLQUES: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300",
  PUERTAS:   "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
};

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-app-muted">
      {children}
    </th>
  );
}

function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

export default function HistoricoPage() {
  const cat = useCatalogos();
  const [pedidos, setPedidos] = useState<PedidoConRelaciones[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [familia, setFamilia] = useState<FiltroFamilia>("TODOS");
  const [busqueda, setBusqueda] = useState("");
  const [editando, setEditando] = useState<PedidoConRelaciones | null>(null);

  async function cargar() {
    setCargando(true);
    dbService.getPedidos()
      .then(setPedidos)
      .catch((e) => setError(e instanceof Error ? e.message : "Error"))
      .finally(() => setCargando(false));
  }

  useEffect(() => { cargar(); }, []);

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return pedidos.filter((p) => {
      if (familia !== "TODOS" && p.familia?.nombre !== familia) return false;
      if (texto) {
        const hay = [p.numero_pedido, p.cliente?.nombre, p.tipo,
          String(p.largo ?? ""), String(p.ancho ?? ""), String(p.alto ?? "")]
          .join(" ").toLowerCase();
        if (!hay.includes(texto)) return false;
      }
      return true;
    });
    // Sin .sort(): el API ya devuelve created_at desc (más recientes primero)
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
            <table className="w-full min-w-[580px] text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  {/* Columnas fijas */}
                  <Th>Nº Pedido</Th>
                  <Th>Cliente</Th>
                  {/* Columnas según familia */}
                  {familia === "TODOS" && <Th>Familia</Th>}
                  {familia === "PUERTAS" && <Th>Tipo</Th>}
                  <Th>Medidas</Th>
                  {familia !== "PUERTAS" && <Th>Aguas</Th>}
                  {familia !== "PUERTAS" && <Th>Radio</Th>}
                  <Th>Fecha</Th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtrados.map((p, i) => {
                  const fNombre = p.familia?.nombre ?? "";
                  const esRemolque = fNombre === "REMOLQUES";
                  const tag = tagClass[(fNombre as keyof typeof tagClass)] ?? tagClass.REMOLQUES;
                  return (
                    <tr
                      key={p.id}
                      className={`transition-colors hover:bg-surface-2 ${
                        i < filtrados.length - 1 ? "border-b border-[var(--border)]" : ""
                      }`}
                    >
                      <td className="px-4 py-3 font-mono text-sm font-semibold text-app-text">
                        {p.numero_pedido}
                      </td>
                      <td className="px-4 py-3 text-app-text">{p.cliente?.nombre ?? "—"}</td>

                      {familia === "TODOS" && (
                        <td className="px-4 py-3">
                          <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${tag}`}>
                            {fNombre || "—"}
                          </span>
                        </td>
                      )}

                      {familia === "PUERTAS" && (
                        <td className="px-4 py-3 text-app-muted">{p.tipo ?? "—"}</td>
                      )}

                      <td className="px-4 py-3 text-app-text">
                        {familia === "PUERTAS"
                          ? [p.ancho, p.alto].map((v) => formatMedida(v) || "—").join(" × ")
                          : resumenMedidas(p, fNombre)
                        }
                      </td>

                      {familia !== "PUERTAS" && (
                        <td className="px-4 py-3 text-app-muted">
                          {esRemolque ? (formatMedida(p.aguas) || "—") : "—"}
                        </td>
                      )}
                      {familia !== "PUERTAS" && (
                        <td className="px-4 py-3 text-app-muted">
                          {esRemolque ? (formatMedida(p.radio) || "—") : "—"}
                        </td>
                      )}

                      <td className="px-4 py-3 text-app-muted">{p.fecha ?? "—"}</td>
                      <td className="px-3 py-3">
                        <button
                          onClick={() => setEditando(p)}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-app-muted transition-colors hover:bg-surface-2 hover:text-brand"
                          aria-label="Editar"
                        >
                          <PencilIcon />
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
    </div>
  );
}
