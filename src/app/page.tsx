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
import { FAMILIA_REMOLQUES, type Pedido, type PedidoConRelaciones } from "@/lib/types";
import { useCatalogos } from "@/lib/useCatalogos";

export default function BuscadorPage() {
  const cat = useCatalogos();

  const [familiaId, setFamiliaId] = useState<string>("");
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [valores, setValores] = useState<CamposTecnicosValores>(camposTecnicosVacios);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [pedidosFamilia, setPedidosFamilia] = useState<PedidoConRelaciones[]>([]);
  const [cargandoPedidos, setCargandoPedidos] = useState(false);
  const [clienteIdsDeFamilia, setClienteIdsDeFamilia] = useState<string[]>([]);

  const [numero, setNumero] = useState("");
  const [fecha, setFecha] = useState("");
  const [tecnicoId, setTecnicoId] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmarNumero, setConfirmarNumero] = useState(false);

  const [modalCliente, setModalCliente] = useState(false);
  const [modalTecnico, setModalTecnico] = useState(false);

  const familia = cat.familias.find((f) => f.id === familiaId);
  const familiaNombre = familia?.nombre ?? "";

  const clientesDeFamilia =
    clienteIdsDeFamilia.length > 0
      ? cat.clientes.filter((c) => clienteIdsDeFamilia.includes(c.id))
      : cat.clientes;

  useEffect(() => {
    if (!familiaId && cat.familias.length > 0) setFamiliaId(cat.familias[0].id);
  }, [cat.familias, familiaId]);

  useEffect(() => {
    setValores(camposTecnicosVacios);
    setClienteId(null);
    setConfirmarNumero(false);
    setPedidosFamilia([]);
    if (!familiaId) return;
    dbService.getClienteIdsDeFamilia(familiaId).then(setClienteIdsDeFamilia);
    dbService.getPedidosPorFamilia(familiaId).then(setPedidosFamilia);
  }, [familiaId]);

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
    () => (completos && clienteId ? pedidos.find((p) => esCoincidenciaExacta(p, criterios)) ?? null : null),
    [completos, clienteId, pedidos, criterios],
  );
  const parecidos = useMemo(
    () => (exacto || !completos ? [] : buscarParecidos(pedidos, criterios)),
    [exacto, completos, pedidos, criterios],
  );
  const parecidosGlobal = useMemo(
    () => (!clienteId && completos ? buscarParecidos(pedidosFamilia, criterios) : []),
    [clienteId, completos, pedidosFamilia, criterios],
  );

  const formatoNumeroOk = numero.trim() === "" || numeroPedidoEncajaFormato(numero);

  function setCampo(campo: keyof CamposTecnicosValores, valor: string) {
    setValores((v) => ({ ...v, [campo]: valor }));
  }

  function limpiarBusqueda() {
    setClienteId(null);
    setValores(camposTecnicosVacios);
    setPedidos([]);
    setOkMsg(null);
    setErrorMsg(null);
    setConfirmarNumero(false);
  }

  const hayAlgoDato = !!clienteId || Object.values(valores).some((v) => v !== "");

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

  const puedeGuardar = numero.trim() !== "" && !!clienteId && !!familiaId && completos && !guardando;

  return (
    <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">

      {/* ── Columna izquierda: selector + formulario ── */}
      <div>
        {/* Selector de familia */}
        <div className="mb-4 flex gap-2">
          {cat.familias.map((f) => (
            <button
              key={f.id}
              onClick={() => setFamiliaId(f.id)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold tracking-wide transition-all ${
                familiaId === f.id
                  ? "bg-brand text-white shadow-sm"
                  : "border border-[var(--border-strong)] bg-surface text-app-muted hover:bg-surface-2 hover:text-app-text"
              }`}
            >
              {f.nombre}
            </button>
          ))}
        </div>

        {/* Formulario búsqueda */}
        <Card className="relative">
          {hayAlgoDato && (
            <button
              onClick={limpiarBusqueda}
              className="absolute right-3 top-3 flex items-center gap-1 rounded-md px-2 py-1 text-xs text-app-muted transition-colors hover:bg-surface-2 hover:text-app-text"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              Limpiar
            </button>
          )}
          <div className="grid gap-4">
            <div>
              <span className={labelClass}>Cliente</span>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className={`${inputClass} flex-1`}
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
      </div>

      {/* ── Columna derecha: resultado + registro ── */}
      <div className="mt-4 grid gap-4 lg:mt-[3.25rem]">

        {/* Resultado */}
        <div>
          {!completos ? (
            <Banner tone="neutral">
              {!clienteId
                ? "Introduce las medidas para buscar pedidos similares."
                : "Faltan datos para comprobar coincidencia exacta."}
            </Banner>
          ) : cargandoPedidos ? (
            <Banner tone="neutral">Comprobando…</Banner>
          ) : exacto ? (
            <div
              className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/30"
              style={{ boxShadow: "var(--shadow-sm)" }}
            >
              <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                Ya existe un pedido igual
              </p>
              <div className="mt-2 grid gap-1 text-sm">
                <p className="text-emerald-900 dark:text-emerald-200">
                  <span className="text-emerald-600 dark:text-emerald-400">Pedido:</span>{" "}
                  <span className="font-mono text-base font-bold">{exacto.numero_pedido}</span>
                </p>
                <p className="text-emerald-900 dark:text-emerald-200">
                  <span className="text-emerald-600 dark:text-emerald-400">Medidas:</span>{" "}
                  {resumenMedidas(exacto, familiaNombre)}
                </p>
                {familiaNombre === FAMILIA_REMOLQUES ? (
                  <p className="text-emerald-900 dark:text-emerald-200">
                    <span className="text-emerald-600 dark:text-emerald-400">Aguas:</span>{" "}
                    {formatMedidaCm(exacto.aguas)}{" · "}
                    <span className="text-emerald-600 dark:text-emerald-400">Radio:</span>{" "}
                    {formatMedidaCm(exacto.radio)}
                  </p>
                ) : (
                  <p className="text-emerald-900 dark:text-emerald-200">
                    <span className="text-emerald-600 dark:text-emerald-400">Tipo:</span>{" "}
                    {exacto.tipo ?? "—"}
                  </p>
                )}
              </div>
              <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-500">
                Archivo: <span className="font-mono font-medium">{exacto.numero_pedido}.dwg</span>
              </p>
            </div>
          ) : clienteId ? (
            /* Con cliente: resultado exacto o parecidos de ese cliente */
            <div className="grid gap-3">
              <Banner tone="info">No existe ningún pedido igual para este cliente.</Banner>
              {parecidos.length > 0 && (
                <Card>
                  <p className="mb-2 text-sm font-medium text-app-muted">Pedidos parecidos del cliente:</p>
                  <ul className="grid gap-0.5 text-sm">
                    {parecidos.map(({ pedido, diferencias }) => (
                      <li
                        key={pedido.id}
                        className="flex flex-wrap items-center gap-x-2 rounded-lg px-2 py-1.5 hover:bg-surface-2"
                      >
                        <span className="font-mono font-semibold text-app-text">{pedido.numero_pedido}</span>
                        <span className="text-app-muted">·</span>
                        <span className="text-app-muted">{resumenMedidas(pedido, familiaNombre)}</span>
                        <span className="ml-auto text-xs text-brand">{diferencias.join(", ")}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </div>
          ) : (
            /* Sin cliente: parecidos de toda la familia */
            <div className="grid gap-3">
              {parecidosGlobal.length > 0 ? (
                <Card>
                  <p className="mb-2 text-sm font-medium text-app-muted">
                    Pedidos similares encontrados ({parecidosGlobal.length}):
                  </p>
                  <ul className="grid gap-0.5 text-sm">
                    {parecidosGlobal.map(({ pedido, diferencias }) => (
                      <li
                        key={pedido.id}
                        className="flex flex-wrap items-center gap-x-2 rounded-lg px-2 py-1.5 hover:bg-surface-2"
                      >
                        <span className="font-mono font-semibold text-app-text">{pedido.numero_pedido}</span>
                        <span className="text-app-muted">·</span>
                        {"cliente" in pedido && (pedido as PedidoConRelaciones).cliente && (
                          <span className="text-app-muted text-xs">{(pedido as PedidoConRelaciones).cliente!.nombre}</span>
                        )}
                        <span className="text-app-muted">·</span>
                        <span className="text-app-muted">{resumenMedidas(pedido, familiaNombre)}</span>
                        <span className="ml-auto text-xs text-brand">{diferencias.join(", ")}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              ) : (
                <Banner tone="info">No se encontraron pedidos similares con esas medidas.</Banner>
              )}
              <Banner tone="neutral">Selecciona un cliente para comprobar coincidencia exacta y registrar.</Banner>
            </div>
          )}
        </div>

        {/* Registro inline */}
        {completos && !exacto && clienteId && (
        <Card>
          <p className="mb-3 text-sm font-semibold text-app-text">
            Registrar como nuevo pedido
          </p>

          {okMsg && <div className="mb-3"><Banner tone="success">{okMsg}</Banner></div>}
          {errorMsg && <div className="mb-3"><Banner tone="warning">{errorMsg}</Banner></div>}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Número de pedido *"
              hint={!formatoNumeroOk ? AVISO_FORMATO_PEDIDO : "Ej. AR2600000"}
            >
              <input
                className={`${inputClass} font-mono ${!formatoNumeroOk ? "!border-amber-500" : ""}`}
                value={numero}
                onChange={(e) => {
                  setNumero(e.target.value.toUpperCase());
                  setConfirmarNumero(false);
                  setErrorMsg(null);
                }}
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

      </div>{/* fin columna derecha */}

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
