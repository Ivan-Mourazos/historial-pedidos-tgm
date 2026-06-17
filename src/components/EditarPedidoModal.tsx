"use client";

import { useState } from "react";
import {
  CamposTecnicosFamilia,
  type CamposTecnicosValores,
} from "./CamposTecnicosFamilia";
import { Banner, Button, Field, inputClass } from "./ui";
import { dbService } from "@/lib/db/db-service";
import { formatMedida } from "@/lib/normalize";
import { camposTecnicosParaGuardar } from "@/lib/pedido-helpers";
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
} from "@/lib/types";

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
}: {
  pedido: PedidoConRelaciones;
  familias: Familia[];
  tecnicos: Tecnico[];
  tiposPuerta: TipoPuerta[];
  onCerrar: () => void;
  onGuardado: () => void | Promise<void>;
}) {
  const [numero, setNumero] = useState(pedido.numero_pedido);
  const [familiaId, setFamiliaId] = useState(pedido.familia_id);
  const [fecha, setFecha] = useState(pedido.fecha ?? "");
  const [tecnicoId, setTecnicoId] = useState(pedido.tecnico_id ?? "");
  const [observaciones, setObservaciones] = useState(
    pedido.observaciones ?? "",
  );
  const [valores, setValores] = useState<CamposTecnicosValores>(
    valoresDesdePedido(pedido),
  );
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const familiaNombre =
    familias.find((f) => f.id === familiaId)?.nombre ?? "";
  const formatoOk = numeroPedidoEncajaFormato(numero);

  function setCampo(campo: keyof CamposTecnicosValores, valor: string) {
    setValores((v) => ({ ...v, [campo]: valor }));
  }

  async function guardar() {
    setError(null);
    const numeroNorm = normalizarNumeroPedido(numero);
    if (!numeroNorm) {
      setError("El número de pedido es obligatorio.");
      return;
    }
    setGuardando(true);
    try {
      // Si cambia el número, verifica que no choque con otro pedido.
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

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="my-8 w-full max-w-2xl rounded-lg bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            Editar pedido
          </h2>
          <button
            className="text-slate-400 hover:text-slate-700"
            onClick={onCerrar}
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4">
            <Banner tone="warning">{error}</Banner>
          </div>
        )}

        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Número de pedido"
              hint={!formatoOk ? AVISO_FORMATO_PEDIDO : undefined}
            >
              <input
                className={`${inputClass} font-mono ${
                  !formatoOk ? "border-amber-400" : ""
                }`}
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
                  <option key={f.id} value={f.id}>
                    {f.nombre}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">
              Datos técnicos
            </p>
            <CamposTecnicosFamilia
              familiaNombre={familiaNombre}
              valores={valores}
              onChange={setCampo}
              tiposPuerta={tiposPuerta}
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
                  <option key={t.id} value={t.id}>
                    {t.nombre}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Observaciones">
            <textarea
              className={`${inputClass} min-h-20`}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
            />
          </Field>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={guardando}>
            {guardando ? "Guardando…" : "Guardar cambios"}
          </Button>
        </div>
      </div>
    </div>
  );
}
