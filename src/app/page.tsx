"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CamposTecnicosFamilia,
  camposTecnicosVacios,
  type CamposTecnicosValores,
} from "@/components/CamposTecnicosFamilia";
import { CrearEntidadModal } from "@/components/CrearEntidadModal";
import { Banner, Button, Card, Field, inputClass, labelClass } from "@/components/ui";
import { dbService } from "@/lib/db/db-service";
import { resumenMedidas, formatMedidaCm } from "@/lib/display";
import {
  buscarParecidos,
  camposRequeridosCompletos,
  esCoincidenciaExacta,
} from "@/lib/matching";
import { construirCriterios, camposTecnicosParaGuardar } from "@/lib/pedido-helpers";
import {
  AVISO_FORMATO_PEDIDO,
  normalizarNumeroPedido,
  numeroPedidoEncajaFormato,
} from "@/lib/pedido-numero";
import { FAMILIA_REMOLQUES, type Pedido } from "@/lib/types";
import { useCatalogos } from "@/lib/useCatalogos";

export default function BuscadorPage() {
  const cat = useCatalogos();

  // ── Búsqueda ──────────────────────────────────────────────────────────────
  const [familiaId, setFamiliaId] = useState<string>("");
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [valores, setValores] = useState<CamposTecnicosValores>(camposTecnicosVacios);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [cargandoPedidos, setCargandoPedidos] = useState(false);
  const [clienteIdsDeFamilia, setClienteIdsDeFamilia] = useState<string[]>([]);

  // ── Registro inline ───────────────────────────────────────────────────────
  const [numero, setNumero] = useState("");
  const [fecha, setFecha] = useState("");
  const [tecnicoId, setTecnicoId] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmarNumero, setConfirmarNumero] = useState(false);

  // ── Modales ───────────────────────────────────────────────────────────────
  const [modalCliente, setModalCliente] = useState(false);
  const [modalTecnico, setModalTecnico] = useState(false);

  const familia = cat.familias.find((f) => f.id === familiaId);
  const familiaNombre = familia?.nombre ?? "";

  // Solo clientes que tienen pedidos en la familia seleccionada
  const clientesDeFamilia = clienteIdsDeFamilia.length > 0
    ? cat.clientes.filter((c) => clienteIdsDeFamilia.includes(c.id))
    : cat.clientes;

  // Primera familia por defecto
  useEffect(() => {
    if (!familiaId && cat.familias.length > 0) setFamiliaId(cat.familias[0].id);
  }, [cat.familias, familiaId]);

  // Resetear y cargar clientes de la familia al cambiar familia
  useEffect(() => {
    setValores(camposTecnicosVacios);
    setClienteId(null);
    setConfirmarNumero(false);
    if (!familiaId) return;
    dbService.getClienteIdsDeFamilia(familiaId).then(setClienteIdsDeFamilia);
  }, [familiaId]);

  // Cargar pedidos del cliente+familia para comparar
  useEffect(() => {
    if (!clienteId || !familiaId) { setPedidos([]); return; }
    let activo = true;
    setCargandoPedidos(true);
    dbService.getPedidosPorClienteFamilia(clienteId, familiaId)
      .then((r) => activo && setPedidos(r))
      .catch(() => activo && setPedidos([]))
      .finally(() => activo && setCargandoPedidos(false));
    return () => { activo = false; };
  }, [clienteId, familiaId]);

  const criterios = useMemo(
    () => construirCriterios(familiaNombre, clienteId, valores),
    [familiaNombre, clienteId, valores],
  );
  const completos = camposRequeridosCompletos(criterios);
  const exacto = useMemo(
    () => completos ? pedidos.find((p) => esCoincidenciaExacta(p, criterios)) ?? null : null,
    [completos, pedidos, criterios],
  );
  const parecidos = useMemo(
    () => exacto ? [] : buscarParecidos(pedidos, criterios),
    [exacto, pedidos, criterios],
  );

  const formatoNumeroOk = numero.trim() === "" || numeroPedidoEncajaFormato(numero);

  function setCampo(campo: keyof CamposTecnicosValores, valor: string) {
    setValores((v) => ({ ...v, [campo]: valor }));
  }

  // ── Guardar pedido ─────────────────────────────────────────────────────────
  async function guardar() {
    setErrorMsg(null);
    setOkMsg(null);
    const numeroNorm = normalizarNumeroPedido(numero);
    if (!numeroNorm || !clienteId || !familiaId || !completos) return;

    if (!confirmarNumero) {
      const existeNumero = await dbService.getPedidoByNumero(numeroNorm).catch(() => null);
      if (existeNumero) {
        setConfirmarNumero(true);
        setErrorMsg(`El número ${numeroNorm} ya existe con otra medida. Pulsa de nuevo para añadirlo igualmente.`);
        return;
      }
    }

    setGuardando(true);
    try {
      const tecnicosCampos = camposTecnicosParaGuardar(familiaNombre, valores);
      await dbService.createPedido({
        numero_pedido: numeroNorm,
        cliente_id: clienteId,
        familia_id: familiaId,
        fecha: fecha || null,
        tecnico_id: tecnicoId || null,
        observaciones: observaciones.trim() || null,
        ...tecnicosCampos,
      });
      setOkMsg(`Pedido ${numeroNorm} registrado correctamente.`);
      setNumero("");
      setObservaciones("");
      setConfirmarNumero(false);
      setErrorMsg(null);
      setPedidos(await dbService.getPedidosPorClienteFamilia(clienteId, familiaId));
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setGuardando(false);
    }
  }

  const puedeGuardar =
    numero.trim() !== "" && !!clienteId && !!familiaId && completos && !guardando;

  const clienteActual = cat.clientes.find((c) => c.id === clienteId);
  const tecnicoActual = cat.tecnicos.find((t) => t.id === tecnicoId);

  return (
    <div className="max-w-2xl mx-auto">
      {/* ── Cabecera familia ── */}
      <div className="mb-4 flex gap-2">
        {cat.familias.map((f) => (
          <button
            key={f.id}
            onClick={() => setFamiliaId(f.id)}
            className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
              familiaId === f.id
                ? "bg-slate-900 text-white"
                : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {f.nombre}
          </button>
        ))}
      </div>

      <Card className="mb-4">
        <div className="grid gap-4">
          {/* Cliente */}
          <div>
            <span className={labelClass}>Cliente</span>
            <div className="flex flex-wrap items-center gap-2">
              <select
                className={`${inputClass} max-w-xs`}
                value={clienteId ?? ""}
                onChange={(e) => setClienteId(e.target.value || null)}
              >
                <option value="">— Selecciona cliente —</option>
                {clientesDeFamilia.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
              <Button variant="secondary" onClick={() => setModalCliente(true)}>
                + Nuevo
              </Button>
            </div>
          </div>

          {/* Campos técnicos */}
          {familiaNombre && (
            <CamposTecnicosFamilia
              familiaNombre={familiaNombre}
              valores={valores}
              onChange={setCampo}
              tiposPuerta={cat.tiposPuerta}
            />
          )}
        </div>
      </Card>

      {/* ── Resultado búsqueda ── */}
      <div className="mb-4">
        {!clienteId || !familiaNombre ? (
          <Banner tone="neutral">Selecciona cliente e introduce las medidas.</Banner>
        ) : !completos ? (
          <Banner tone="neutral">Faltan datos para comprobar coincidencia exacta.</Banner>
        ) : cargandoPedidos ? (
          <Banner tone="neutral">Comprobando…</Banner>
        ) : exacto ? (
          <Card className="border-green-300 bg-green-50">
            <p className="text-base font-semibold text-green-800">Ya existe un pedido igual</p>
            <div className="mt-2 grid gap-1 text-sm text-green-900">
              <p>
                <span className="font-medium">Pedido:</span>{" "}
                <span className="font-mono text-base font-bold">{exacto.numero_pedido}</span>
              </p>
              <p>
                <span className="font-medium">Medidas:</span>{" "}
                {resumenMedidas(exacto, familiaNombre)}
              </p>
              {familiaNombre === FAMILIA_REMOLQUES ? (
                <p>
                  <span className="font-medium">Aguas:</span> {formatMedidaCm(exacto.aguas)}
                  {" · "}
                  <span className="font-medium">Radio:</span> {formatMedidaCm(exacto.radio)}
                </p>
              ) : (
                <p><span className="font-medium">Tipo:</span> {exacto.tipo ?? "—"}</p>
              )}
            </div>
            <p className="mt-2 text-xs text-green-700">
              Archivo: <span className="font-mono">{exacto.numero_pedido}.dwg</span>
            </p>
          </Card>
        ) : (
          <div className="grid gap-3">
            <Banner tone="info">No existe ningún pedido exactamente igual.</Banner>
            {parecidos.length > 0 && (
              <Card>
                <p className="mb-2 text-sm font-medium text-slate-600">Pedidos parecidos para revisar:</p>
                <ul className="grid gap-1 text-sm">
                  {parecidos.map(({ pedido, diferencias }) => (
                    <li key={pedido.id} className="flex flex-wrap items-center gap-x-2 border-b border-slate-100 py-1 last:border-0">
                      <span className="font-mono text-slate-900">{pedido.numero_pedido}</span>
                      <span className="text-slate-400">—</span>
                      <span className="text-slate-700">{resumenMedidas(pedido, familiaNombre)}</span>
                      <span className="text-amber-700 text-xs">({diferencias.join(", ")})</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* ── Registro inline (solo si los campos están completos y no hay exacto) ── */}
      {completos && !exacto && clienteId && (
        <Card className="border-slate-300">
          <p className="mb-3 text-sm font-semibold text-slate-700">Registrar como nuevo pedido</p>

          {okMsg && <div className="mb-3"><Banner tone="success">{okMsg}</Banner></div>}
          {errorMsg && <div className="mb-3"><Banner tone="warning">{errorMsg}</Banner></div>}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Número de pedido *"
              hint={!formatoNumeroOk ? AVISO_FORMATO_PEDIDO : "Ej. AR2600000"}
            >
              <input
                className={`${inputClass} font-mono ${!formatoNumeroOk ? "border-amber-400" : ""}`}
                value={numero}
                onChange={(e) => { setNumero(e.target.value.toUpperCase()); setConfirmarNumero(false); setErrorMsg(null); }}
                placeholder="AR2600000"
              />
            </Field>

            <Field label="Fecha">
              <input
                type="date"
                className={inputClass}
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </Field>

            <div>
              <span className={labelClass}>Técnico</span>
              <div className="flex items-center gap-2">
                <select
                  className={`${inputClass} flex-1`}
                  value={tecnicoId}
                  onChange={(e) => setTecnicoId(e.target.value)}
                >
                  <option value="">— Sin asignar —</option>
                  {cat.tecnicos.map((t) => (
                    <option key={t.id} value={t.id}>{t.nombre}</option>
                  ))}
                </select>
                <Button variant="secondary" onClick={() => setModalTecnico(true)}>+</Button>
              </div>
            </div>

            <Field label="Observaciones">
              <input
                className={inputClass}
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Notas opcionales"
              />
            </Field>
          </div>

          <div className="mt-4">
            <Button onClick={guardar} disabled={!puedeGuardar}>
              {guardando ? "Guardando…" : confirmarNumero ? "Guardar igualmente" : "Guardar pedido"}
            </Button>
          </div>
        </Card>
      )}

      {/* ── Modales ── */}
      {modalCliente && (
        <CrearEntidadModal
          titulo="Nuevo cliente"
          etiqueta="Nombre"
          placeholder="Nombre del cliente"
          onCerrar={() => setModalCliente(false)}
          onGuardar={async (nombre) => {
            const nuevo = await dbService.getOrCreateCliente(nombre);
            await cat.recargarClientes();
            setClienteId(nuevo.id);
            setModalCliente(false);
          }}
        />
      )}

      {modalTecnico && (
        <CrearEntidadModal
          titulo="Nuevo técnico"
          etiqueta="Nombre"
          placeholder="Nombre del técnico"
          onCerrar={() => setModalTecnico(false)}
          onGuardar={async (nombre) => {
            const nuevo = await dbService.createTecnico(nombre);
            await cat.recargarTecnicos();
            setTecnicoId(nuevo.id);
            setModalTecnico(false);
          }}
        />
      )}
    </div>
  );
}
