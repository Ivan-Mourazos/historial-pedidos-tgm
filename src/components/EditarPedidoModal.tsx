"use client";

import { useState } from "react";
import {
  CamposTecnicosFamilia,
  type CamposTecnicosValores,
} from "./CamposTecnicosFamilia";
import { Banner, Button, Field, inputClass, labelClass } from "./ui";
import { dbService } from "@/lib/db/db-service";
import { formatMedida } from "@/lib/normalize";
import { camposTecnicosParaGuardar } from "@/lib/pedido-helpers";
import {
  AVISO_FORMATO_PEDIDO,
  normalizarNumeroPedido,
  numeroPedidoEncajaFormato,
} from "@/lib/pedido-numero";
import type { Familia, PedidoConRelaciones, Tecnico, TipoPuerta } from "@/lib/types";

function valoresDesdePedido(p: PedidoConRelaciones): CamposTecnicosValores {
  return {
    largo: formatMedida(p.largo),
    ancho: formatMedida(p.ancho),
    alto: formatMedida(p.alto),
    aguas: formatMedida(p.aguas),
    radio: formatMedida(p.radio),
    tipo: p.tipo ?? "",
  };
}

export function EditarPedidoModal({
  pedido,
  familias,
  tecnicos,
  tiposPuerta,
  onCerrar,
  onGuardado,
  onEliminar,
}: {
  pedido: PedidoConRelaciones;
  familias: Familia[];
  tecnicos: Tecnico[];
  tiposPuerta: TipoPuerta[];
  onCerrar: () => void;
  onGuardado: () => void | Promise<void>;
  onEliminar?: () => void | Promise<void>;
}) {
  const [numero, setNumero] = useState(pedido.numero_pedido);
  const [familiaId, setFamiliaId] = useState(pedido.familia_id);
  const [fecha, setFecha] = useState(pedido.fecha ?? "");
  const [tecnicoId, setTecnicoId] = useState(pedido.tecnico_id ?? "");
  const [observaciones, setObservaciones] = useState(pedido.observaciones ?? "");
  const [valores, setValores] = useState<CamposTecnicosValores>(valoresDesdePedido(pedido));
  const [guardando, setGuardando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [confirmarEliminar, setConfirmarEliminar] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const familiaNombre = familias.find((f) => f.id === familiaId)?.nombre ?? "";
  const formatoOk = numeroPedidoEncajaFormato(numero);

  function setCampo(campo: keyof CamposTecnicosValores, valor: string) {
    setValores((v) => ({ ...v, [campo]: valor }));
  }

  async function guardar() {
    setError(null);
    const numeroNorm = normalizarNumeroPedido(numero);
    if (!numeroNorm) { setError("El número de pedido es obligatorio."); return; }
    setGuardando(true);
    try {
      if (numeroNorm !== pedido.numero_pedido) {
        const otro = await dbService.getPedidoByNumero(numeroNorm);
        if (otro && otro.id !== pedido.id) {
          setError(`Ya existe otro pedido con el número ${numeroNorm}.`);
          setGuardando(false);
          return;
        }
      }
      const tecnicosCampos = camposTecnicosParaGuardar(familiaNombre, valores);
      await dbService.updatePedido(pedido.id, {
        numero_pedido: numeroNorm,
        familia_id: familiaId,
        fecha: fecha || null,
        tecnico_id: tecnicoId || null,
        observaciones: observaciones.trim() || null,
        ...tecnicosCampos,
      });
      await onGuardado();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
      setGuardando(false);
    }
  }

  async function eliminar() {
    if (!confirmarEliminar) { setConfirmarEliminar(true); return; }
    setEliminando(true);
    try {
      await dbService.deletePedido(pedido.id);
      await onEliminar?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al eliminar");
      setEliminando(false);
      setConfirmarEliminar(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm">
      <div className="flex min-h-full items-center justify-center p-4">
      <div
        className="w-full max-w-2xl rounded-xl border border-[var(--border-strong)] bg-surface p-5"
        style={{ boxShadow: "var(--shadow-lg)" }}
      >
        {/* Cabecera */}
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-app-text">Editar pedido</h2>
            <p className="mt-0.5 font-mono text-sm text-app-muted">{pedido.numero_pedido}</p>
          </div>
          <button
            className="rounded-md p-1 text-app-muted transition-colors hover:bg-surface-2 hover:text-app-text"
            onClick={onCerrar}
            aria-label="Cerrar"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {error && <div className="mb-4"><Banner tone="warning">{error}</Banner></div>}

        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Número de pedido"
              hint={!formatoOk ? AVISO_FORMATO_PEDIDO : undefined}
            >
              <input
                className={`${inputClass} font-mono ${!formatoOk ? "!border-amber-500" : ""}`}
                value={numero}
                onChange={(e) => setNumero(e.target.value.toUpperCase())}
              />
            </Field>
            <Field label="Familia">
              <select
                className={inputClass}
                value={familiaId}
                onChange={(e) => setFamiliaId(e.target.value)}
              >
                {familias.map((f) => (
                  <option key={f.id} value={f.id}>{f.nombre}</option>
                ))}
              </select>
            </Field>
          </div>

          <div>
            <p className={`${labelClass} mb-2`}>Datos técnicos</p>
            <CamposTecnicosFamilia
              familiaNombre={familiaNombre}
              valores={valores}
              onChange={setCampo}
              tiposPuerta={tiposPuerta}
              freeInput
              tiposRemolqueExtra={pedido.tipo ? [pedido.tipo] : []}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Fecha">
              <input
                type="date"
                className={inputClass}
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </Field>
            <Field label="Técnico">
              <select
                className={inputClass}
                value={tecnicoId}
                onChange={(e) => setTecnicoId(e.target.value)}
              >
                <option value="">— Sin asignar —</option>
                {tecnicos.map((t) => (
                  <option key={t.id} value={t.id}>{t.nombre}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Observaciones">
            <textarea
              className={`${inputClass} min-h-[5rem] resize-y`}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Notas opcionales"
            />
          </Field>
        </div>

        <div className="mt-5 flex items-center justify-between gap-2">
          {/* Eliminar */}
          {onEliminar && (
            <Button
              variant="danger"
              onClick={eliminar}
              disabled={eliminando}
            >
              {eliminando ? "Eliminando…" : confirmarEliminar ? "¿Confirmar eliminación?" : "Eliminar"}
            </Button>
          )}
          <div className="ml-auto flex gap-2">
            <Button variant="secondary" onClick={onCerrar}>Cancelar</Button>
            <Button onClick={guardar} disabled={guardando || !formatoOk}>
              {guardando ? "Guardando…" : "Guardar cambios"}
            </Button>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
