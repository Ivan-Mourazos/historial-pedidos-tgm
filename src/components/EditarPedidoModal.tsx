"use client";

import { useState } from "react";
import {
  CamposTecnicosFamilia,
  type CamposTecnicosValores,
} from "./CamposTecnicosFamilia";
import {
  Banner,
  Button,
  DatePicker,
  Field,
  SelectControl,
  inputClass,
  labelClass,
  modalCompactClass,
  modalOverlayClass,
  modalPanelClass,
} from "./ui";
import { dbService } from "@/lib/db/db-service";
import { formatMedida } from "@/lib/normalize";
import { camposTecnicosParaGuardar } from "@/lib/pedido-helpers";
import { tipoRemolqueCanonico } from "@/lib/tipos-remolque";
import {
  AVISO_FORMATO_PEDIDO,
  normalizarNumeroPedido,
  numeroPedidoEncajaFormato,
} from "@/lib/pedido-numero";
import type {
  Familia,
  PedidoConRelaciones,
  Tecnico,
  TipoPuerta,
  TipoRemolque,
} from "@/lib/types";

function valoresDesdePedido(p: PedidoConRelaciones): CamposTecnicosValores {
  return {
    largo: formatMedida(p.largo),
    ancho: formatMedida(p.ancho),
    alto: formatMedida(p.alto),
    aguas: formatMedida(p.aguas),
    radio: formatMedida(p.radio),
    tipo: tipoRemolqueCanonico(p.tipo),
    aguasActivas: p.aguas !== null,
    impresionDigital: p.impresion_digital,
  };
}

export function EditarPedidoModal({
  pedido,
  familias,
  tecnicos,
  tiposPuerta,
  tiposRemolque,
  onCerrar,
  onGuardado,
  onEliminar,
}: {
  pedido: PedidoConRelaciones;
  familias: Familia[];
  tecnicos: Tecnico[];
  tiposPuerta: TipoPuerta[];
  tiposRemolque: TipoRemolque[];
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

  function setCampo(campo: keyof CamposTecnicosValores, valor: string | boolean) {
    setValores((v) => {
      const siguiente = { ...v, [campo]: valor } as CamposTecnicosValores;
      if (campo === "tipo") {
        siguiente.radio = "";
        siguiente.aguas = "";
        siguiente.aguasActivas = false;
      }
      return siguiente;
    });
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
    <div className={modalOverlayClass}>
      <div className="flex min-h-full items-center justify-center">
      <div
        className={`${modalPanelClass} ${modalCompactClass} max-h-[calc(100vh-2rem)] max-w-[640px] overflow-hidden`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight text-app-text">
              Editar pedido
            </h2>
            <p className="mt-0.5 font-mono text-xs text-app-muted">
              {pedido.numero_pedido}
            </p>
          </div>
          <button
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-2 text-app-muted transition-colors hover:bg-[var(--border)] hover:text-app-text"
            onClick={onCerrar}
            aria-label="Cerrar"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="max-h-[calc(100vh-9rem)] overflow-y-auto px-4 py-3">
        {error && <div className="mb-3"><Banner tone="warning">{error}</Banner></div>}

        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
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
              <SelectControl
                value={familiaId}
                onChange={setFamiliaId}
                options={familias.map((f) => ({ value: f.id, label: f.nombre }))}
              />
            </Field>
          </div>

          <div className="rounded-[14px] border border-[var(--border)] bg-surface-2/45 p-3">
            <p className={`${labelClass} mb-2 text-xs`}>Datos técnicos</p>
            <CamposTecnicosFamilia
              familiaNombre={familiaNombre}
              valores={valores}
              onChange={setCampo}
              tiposPuerta={tiposPuerta}
              tiposRemolque={tiposRemolque}
              freeInput
              tiposRemolqueExtra={pedido.tipo ? [pedido.tipo] : []}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Fecha">
              <DatePicker value={fecha} onChange={setFecha} />
            </Field>
            <Field label="Técnico">
              <SelectControl
                value={tecnicoId}
                onChange={setTecnicoId}
                placeholder="— Sin asignar —"
                options={[
                  { value: "", label: "— Sin asignar —" },
                  ...tecnicos.map((t) => ({ value: t.id, label: t.nombre })),
                ]}
              />
            </Field>
          </div>

          <Field label="Observaciones">
            <textarea
              className={`${inputClass} min-h-[4.25rem] resize-y`}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Notas opcionales"
            />
          </Field>
        </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-[var(--border)] bg-surface/80 px-4 py-3 backdrop-blur">
          {onEliminar && (
            <Button
              variant="danger"
              className="h-8 bg-red-500/90 px-3 text-xs hover:bg-red-500"
              onClick={eliminar}
              disabled={eliminando}
            >
              {eliminando ? "Eliminando…" : confirmarEliminar ? "¿Confirmar eliminación?" : "Eliminar"}
            </Button>
          )}
          <div className="ml-auto flex gap-2">
            <Button variant="secondary" className="h-8 px-3 text-xs" onClick={onCerrar}>
              Cancelar
            </Button>
            <Button className="h-8 px-3 text-xs" onClick={guardar} disabled={guardando || !formatoOk}>
              {guardando ? "Guardando…" : "Guardar cambios"}
            </Button>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
