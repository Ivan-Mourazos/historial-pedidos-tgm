"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Banner,
  Button,
  Card,
  Field,
  PageTitle,
  inputClass,
} from "@/components/ui";
import { EditarPedidoModal } from "@/components/EditarPedidoModal";
import { dbService } from "@/lib/db/db-service";
import { formatMedida, formatMedidaCm } from "@/lib/display";
import type { PedidoConRelaciones } from "@/lib/types";
import { useCatalogos } from "@/lib/useCatalogos";

export default function HistoricoPage() {
  const cat = useCatalogos();
  const [pedidos, setPedidos] = useState<PedidoConRelaciones[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState<PedidoConRelaciones | null>(null);

  // Filtros
  const [fNumero, setFNumero] = useState("");
  const [fClienteId, setFClienteId] = useState("");
  const [fFamiliaId, setFFamiliaId] = useState("");
  const [fMedida, setFMedida] = useState("");
  const [fFecha, setFFecha] = useState("");
  const [fTecnicoId, setFTecnicoId] = useState("");

  async function cargar() {
    setCargando(true);
    setError(null);
    try {
      setPedidos(await dbService.getPedidos());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar el histórico");
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  const filtrados = useMemo(() => {
    const num = fNumero.trim().toUpperCase();
    const medida = fMedida.trim().replace(",", ".");
    return pedidos.filter((p) => {
      if (num && !p.numero_pedido.toUpperCase().includes(num)) return false;
      if (fClienteId && p.cliente_id !== fClienteId) return false;
      if (fFamiliaId && p.familia_id !== fFamiliaId) return false;
      if (fTecnicoId && p.tecnico_id !== fTecnicoId) return false;
      if (fFecha && p.fecha !== fFecha) return false;
      if (medida) {
        const medidas = [p.largo, p.ancho, p.alto, p.aguas, p.radio]
          .filter((v) => v !== null)
          .map((v) => String(v));
        if (!medidas.some((m) => m.includes(medida))) return false;
      }
      return true;
    });
  }, [pedidos, fNumero, fClienteId, fFamiliaId, fMedida, fFecha, fTecnicoId]);

  function limpiarFiltros() {
    setFNumero("");
    setFClienteId("");
    setFFamiliaId("");
    setFMedida("");
    setFFecha("");
    setFTecnicoId("");
  }

  async function borrar(p: PedidoConRelaciones) {
    if (!confirm(`¿Eliminar el pedido ${p.numero_pedido}?`)) return;
    try {
      await dbService.deletePedido(p.id);
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al eliminar el pedido");
    }
  }

  return (
    <div>
      <PageTitle
        title="Histórico de pedidos"
        subtitle={`${filtrados.length} de ${pedidos.length} pedidos`}
      />

      {(error || cat.error) && (
        <div className="mb-4">
          <Banner tone="warning">{error || cat.error}</Banner>
        </div>
      )}

      <Card className="mb-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Número de pedido">
            <input
              className={inputClass}
              value={fNumero}
              onChange={(e) => setFNumero(e.target.value)}
              placeholder="AR26…"
            />
          </Field>
          <Field label="Cliente">
            <select
              className={inputClass}
              value={fClienteId}
              onChange={(e) => setFClienteId(e.target.value)}
            >
              <option value="">Todos</option>
              {cat.clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Familia">
            <select
              className={inputClass}
              value={fFamiliaId}
              onChange={(e) => setFFamiliaId(e.target.value)}
            >
              <option value="">Todas</option>
              {cat.familias.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nombre}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Medida contiene">
            <input
              className={inputClass}
              value={fMedida}
              onChange={(e) => setFMedida(e.target.value)}
              placeholder="Ej. 140"
            />
          </Field>
          <Field label="Fecha">
            <input
              type="date"
              className={inputClass}
              value={fFecha}
              onChange={(e) => setFFecha(e.target.value)}
            />
          </Field>
          <Field label="Técnico">
            <select
              className={inputClass}
              value={fTecnicoId}
              onChange={(e) => setFTecnicoId(e.target.value)}
            >
              <option value="">Todos</option>
              {cat.tecnicos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="mt-3">
          <Button variant="secondary" onClick={limpiarFiltros}>
            Limpiar filtros
          </Button>
        </div>
      </Card>

      <Card className="overflow-x-auto">
        {cargando ? (
          <p className="text-sm text-slate-500">Cargando…</p>
        ) : filtrados.length === 0 ? (
          <p className="text-sm text-slate-500">
            No hay pedidos que coincidan con los filtros.
          </p>
        ) : (
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="py-2 pr-3 font-medium">Pedido</th>
                <th className="py-2 pr-3 font-medium">Cliente</th>
                <th className="py-2 pr-3 font-medium">Familia</th>
                <th className="py-2 pr-3 font-medium">Tipo</th>
                <th className="py-2 pr-3 font-medium">Largo</th>
                <th className="py-2 pr-3 font-medium">Ancho</th>
                <th className="py-2 pr-3 font-medium">Alto</th>
                <th className="py-2 pr-3 font-medium">Aguas</th>
                <th className="py-2 pr-3 font-medium">Radio</th>
                <th className="py-2 pr-3 font-medium">Fecha</th>
                <th className="py-2 pr-3 font-medium">Técnico</th>
                <th className="py-2 pr-3 font-medium">Observaciones</th>
                <th className="py-2 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((p) => (
                <tr key={p.id} className="border-b border-slate-100 align-top">
                  <td className="py-2 pr-3 font-mono text-slate-900">
                    {p.numero_pedido}
                  </td>
                  <td className="py-2 pr-3">{p.cliente?.nombre ?? "—"}</td>
                  <td className="py-2 pr-3">{p.familia?.nombre ?? "—"}</td>
                  <td className="py-2 pr-3">{p.tipo ?? "—"}</td>
                  <td className="py-2 pr-3">{formatMedida(p.largo) || "—"}</td>
                  <td className="py-2 pr-3">{formatMedida(p.ancho) || "—"}</td>
                  <td className="py-2 pr-3">{formatMedida(p.alto) || "—"}</td>
                  <td className="py-2 pr-3">
                    {p.aguas === null ? "—" : formatMedidaCm(p.aguas)}
                  </td>
                  <td className="py-2 pr-3">
                    {p.radio === null ? "—" : formatMedida(p.radio)}
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    {p.fecha ?? "—"}
                  </td>
                  <td className="py-2 pr-3">{p.tecnico?.nombre ?? "—"}</td>
                  <td className="py-2 pr-3 max-w-48 truncate" title={p.observaciones ?? ""}>
                    {p.observaciones ?? "—"}
                  </td>
                  <td className="py-2">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => setEditando(p)}
                      >
                        Editar
                      </Button>
                      <Button variant="danger" onClick={() => borrar(p)}>
                        Eliminar
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

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
        />
      )}
    </div>
  );
}
