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
import { formatMedida } from "@/lib/display";
import {
  buscarConCriteriosParciales,
  calcularDiferencias,
  camposRequeridosCompletos,
  esCoincidenciaExacta,
} from "@/lib/matching";
import { construirCriterios, camposTecnicosParaGuardar } from "@/lib/pedido-helpers";
import {
  AVISO_FORMATO_PEDIDO,
  normalizarNumeroPedido,
  numeroPedidoEncajaFormato,
} from "@/lib/pedido-numero";
import {
  FAMILIA_REMOLQUES,
  type Pedido,
  type PedidoConRelaciones,
} from "@/lib/types";
import { useCatalogos } from "@/lib/useCatalogos";

function CheckIcon() {
  return (
    <svg width="10" height="8" viewBox="0 0 10 8" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1 4 3.5 6.5 9 1" />
    </svg>
  );
}

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return (
    <th className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-app-muted ${className}`}>
      {children}
    </th>
  );
}

export default function BuscadorPage() {
  const cat = useCatalogos();

  const [familiaId, setFamiliaId]             = useState<string>("");
  const [clienteId, setClienteId]             = useState<string | null>(null);
  const [valores, setValores]                 = useState<CamposTecnicosValores>(camposTecnicosVacios);
  const [pedidosFamilia, setPedidosFamilia]   = useState<PedidoConRelaciones[]>([]);
  const [clienteIdsDeFamilia, setClienteIdsDeFamilia] = useState<string[]>([]);

  const [numero, setNumero]               = useState("");
  const [fecha, setFecha]                 = useState("");
  const [tecnicoId, setTecnicoId]         = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [guardando, setGuardando]         = useState(false);
  const [okMsg, setOkMsg]                 = useState<string | null>(null);
  const [errorMsg, setErrorMsg]           = useState<string | null>(null);
  const [confirmarNumero, setConfirmarNumero] = useState(false);

  const [modalCliente, setModalCliente]         = useState(false);
  const [modalTecnico, setModalTecnico]         = useState(false);
  const [modalTipoPuerta, setModalTipoPuerta]   = useState(false);
  const [modalTipoRemolque, setModalTipoRemolque] = useState(false);
  const [tiposRemolqueExtra, setTiposRemolqueExtra] = useState<string[]>([]);
  const [mostrarRegistro, setMostrarRegistro]   = useState(false);

  const familia       = cat.familias.find((f) => f.id === familiaId);
  const familiaNombre = familia?.nombre ?? "";
  const esRemolques   = familiaNombre === FAMILIA_REMOLQUES;

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

  // Criterios sin cliente → búsqueda global en tiempo real
  const criterios = useMemo(
    () => construirCriterios(familiaNombre, null, valores),
    [familiaNombre, valores],
  );
  // Criterios con cliente → coincidencia exacta
  const criteriosConCliente = useMemo(
    () => construirCriterios(familiaNombre, clienteId, valores),
    [familiaNombre, clienteId, valores],
  );

  const completos       = camposRequeridosCompletos(criteriosConCliente);
  const hayAlgunCriterio = useMemo(
    () => Object.values(valores).some((v) => v !== ""),
    [valores],
  );

  // Resultados live: si hay cliente solo muestra los suyos, si no muestra todos
  const resultadosLive = useMemo(() => {
    if (!hayAlgunCriterio) return [];
    return buscarConCriteriosParciales(
      pedidosFamilia,
      clienteId ? criteriosConCliente : criterios,
    );
  }, [hayAlgunCriterio, pedidosFamilia, criterios, criteriosConCliente, clienteId]);

  // Coincidencia exacta (requiere cliente + todos los campos obligatorios)
  const exacto = useMemo(() => {
    if (!completos || !clienteId) return null;
    return (
      (pedidosFamilia.find((p) =>
        esCoincidenciaExacta(p, criteriosConCliente),
      ) as PedidoConRelaciones) ?? null
    );
  }, [completos, clienteId, pedidosFamilia, criteriosConCliente]);

  const formatoNumeroOk = numero.trim() === "" || numeroPedidoEncajaFormato(numero);

  function setCampo(campo: keyof CamposTecnicosValores, valor: string) {
    setValores((v) => ({ ...v, [campo]: valor }));
    setMostrarRegistro(false);
  }

  function limpiarBusqueda() {
    setClienteId(null);
    setValores(camposTecnicosVacios);
    setOkMsg(null);
    setErrorMsg(null);
    setConfirmarNumero(false);
    setMostrarRegistro(false);
  }

  const hayAlgoDato = !!clienteId || hayAlgunCriterio;

  async function guardar() {
    setErrorMsg(null);
    setOkMsg(null);
    const numeroNorm = normalizarNumeroPedido(numero);
    if (!numeroNorm || !clienteId || !familiaId || !completos) return;

    if (!confirmarNumero) {
      const existeNumero = await dbService.getPedidoByNumero(numeroNorm).catch(() => null);
      if (existeNumero) {
        setConfirmarNumero(true);
        setErrorMsg(
          `El número ${numeroNorm} ya existe con otra medida. Pulsa de nuevo para añadirlo igualmente.`,
        );
        return;
      }
    }

    setGuardando(true);
    try {
      const tecnicosCampos = camposTecnicosParaGuardar(familiaNombre, valores);
      await dbService.createPedido({
        numero_pedido: numeroNorm,
        cliente_id:    clienteId,
        familia_id:    familiaId,
        fecha:         fecha || null,
        tecnico_id:    tecnicoId || null,
        observaciones: observaciones.trim() || null,
        ...tecnicosCampos,
      });
      setOkMsg(`Pedido ${numeroNorm} registrado correctamente.`);
      setNumero("");
      setObservaciones("");
      setConfirmarNumero(false);
      setErrorMsg(null);
      setPedidosFamilia(await dbService.getPedidosPorFamilia(familiaId));
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setGuardando(false);
    }
  }

  const puedeGuardar =
    numero.trim() !== "" && !!clienteId && !!familiaId && completos && !guardando;

  return (
    <div>
      {/* ── Barra de familia + acciones ── */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div
          className="flex rounded-lg border border-[var(--border-strong)] bg-surface p-0.5"
          style={{ boxShadow: "var(--shadow-sm)" }}
        >
          {cat.familias.map((f) => (
            <button
              key={f.id}
              onClick={() => setFamiliaId(f.id)}
              className={`cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                familiaId === f.id
                  ? "bg-brand text-white shadow-sm"
                  : "text-app-muted hover:text-app-text"
              }`}
            >
              {f.nombre}
            </button>
          ))}
        </div>

        {hayAlgoDato && (
          <button
            onClick={limpiarBusqueda}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-app-muted transition-colors hover:bg-surface-2 hover:text-app-text"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            Limpiar
          </button>
        )}
      </div>

      {/* ── Formulario de búsqueda ── */}
      <Card className="mb-4">
        <div className="flex flex-wrap items-start gap-2">
          {/* Cliente */}
          <div className="min-w-[160px] flex-[2]">
            <span className={labelClass}>Cliente</span>
            <div className="flex items-center gap-1.5">
              <select
                className={`${inputClass} min-w-0 flex-1`}
                value={clienteId ?? ""}
                onChange={(e) => setClienteId(e.target.value || null)}
              >
                <option value="">— Todos —</option>
                {clientesDeFamilia.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Campos técnicos en línea */}
          {familiaNombre && (
            <CamposTecnicosFamilia
              familiaNombre={familiaNombre}
              valores={valores}
              onChange={setCampo}
              tiposPuerta={cat.tiposPuerta}
              pedidosFamilia={pedidosFamilia}
              inline
            />
          )}
        </div>
      </Card>

      {/* ── Cabecera de resultados ── */}
      {hayAlgunCriterio && (
        <div className="mb-2 flex items-center justify-between px-0.5">
          <p className="text-sm text-app-muted">
            {resultadosLive.length === 0
              ? "Sin resultados"
              : `${resultadosLive.length} pedido${resultadosLive.length !== 1 ? "s" : ""} encontrado${resultadosLive.length !== 1 ? "s" : ""}`}
          </p>
          {!clienteId && completos && (
            <p className="text-xs text-app-muted">
              Selecciona cliente para comprobar coincidencia exacta
            </p>
          )}
        </div>
      )}

      {/* Aviso tipo remolque */}
      {esRemolques && criterios.tipo && (
        <p className="mb-2 flex items-center gap-1.5 px-0.5 text-xs text-amber-400/80">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" className="shrink-0">
            <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm.75 4.5a.75.75 0 0 1-1.5 0v3a.75.75 0 0 1 1.5 0v-3zm-.75 6a.875.875 0 1 1 0-1.75.875.875 0 0 1 0 1.75z"/>
          </svg>
          Los registros anteriores pueden no tener el tipo estipulado — los resultados pueden ser incompletos.
        </p>
      )}

      {/* ── Tabla de resultados ── */}
      <div
        className="mb-4 overflow-hidden rounded-xl border border-[var(--border)] bg-surface"
        style={{ boxShadow: "var(--shadow-sm)" }}
      >
        {!hayAlgunCriterio ? (
          <p className="px-4 py-8 text-center text-sm text-app-muted">
            Introduce medidas para buscar pedidos similares.
          </p>
        ) : resultadosLive.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-app-muted">
            No se encontraron pedidos con estas medidas.
          </p>
        ) : (
          <div className="overflow-x-auto">
            {esRemolques ? (
              <table className="w-full min-w-[580px] text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <Th>Nº Pedido</Th>
                    <Th>Cliente</Th>
                    <Th>Tipo</Th>
                    <Th>Largo</Th>
                    <Th>Ancho</Th>
                    <Th>Altura</Th>
                    <Th>Aguas</Th>
                    <Th>Radio</Th>
                  </tr>
                </thead>
                <tbody>
                  {resultadosLive.map((p, i) => {
                    const pr       = p as PedidoConRelaciones;
                    const diffs    = calcularDiferencias(p as Pedido, criterios);
                    const isExacto = completos && diffs.length === 0;
                    const rowBg    = isExacto ? "bg-emerald-950/20" : "";
                    const sep      = i < resultadosLive.length - 1 ? "border-b border-[var(--border)]" : "";

                    function tdVal(field: keyof Pedido, diffKey: string, inCriteria: boolean) {
                      const val    = p[field] as number | null;
                      const isDiff = diffs.includes(diffKey);
                      const color  = inCriteria && !isDiff
                        ? "text-emerald-400 font-semibold"
                        : isDiff
                          ? "text-amber-400 font-semibold"
                          : "text-app-text";
                      return (
                        <td className={`px-4 py-3 tabular-nums ${color}`}>
                          {val !== null ? `${formatMedida(val)} cm` : "—"}
                        </td>
                      );
                    }

                    return (
                      <tr key={pr.id} className={`transition-colors hover:bg-surface-2 ${rowBg} ${sep}`}>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-2">
                            {isExacto && (
                              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500">
                                <CheckIcon />
                              </span>
                            )}
                            <span className={`font-mono font-bold ${isExacto ? "text-emerald-300" : "text-app-text"}`}>
                              {pr.numero_pedido}
                            </span>
                            {isExacto && (
                              <span className="rounded bg-emerald-900/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                                Exacto
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-app-muted">{pr.cliente?.nombre ?? "—"}</td>
                        <td className={`px-4 py-3 ${
                          criterios.tipo && !diffs.includes("tipo")
                            ? "text-emerald-400 font-semibold"
                            : diffs.includes("tipo")
                              ? "text-amber-400 font-semibold"
                              : "text-app-muted"
                        }`}>{pr.tipo ?? "—"}</td>
                        {tdVal("largo", "largo", criterios.largo !== null)}
                        {tdVal("ancho", "ancho", criterios.ancho !== null)}
                        {tdVal("alto",  "alto",  criterios.alto  !== null)}
                        {tdVal("aguas", "aguas", criterios.aguas !== null)}
                        {tdVal("radio", "radio", criterios.radio !== null)}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <table className="w-full min-w-[420px] text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <Th>Nº Pedido</Th>
                    <Th>Cliente</Th>
                    <Th>Tipo</Th>
                    <Th>Ancho</Th>
                    <Th>Alto</Th>
                  </tr>
                </thead>
                <tbody>
                  {resultadosLive.map((p, i) => {
                    const pr       = p as PedidoConRelaciones;
                    const diffs    = calcularDiferencias(p as Pedido, criterios);
                    const isExacto = completos && diffs.length === 0;
                    const rowBg    = isExacto ? "bg-emerald-950/20" : "";
                    const sep      = i < resultadosLive.length - 1 ? "border-b border-[var(--border)]" : "";

                    return (
                      <tr key={pr.id} className={`transition-colors hover:bg-surface-2 ${rowBg} ${sep}`}>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-2">
                            {isExacto && (
                              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500">
                                <CheckIcon />
                              </span>
                            )}
                            <span className={`font-mono font-bold ${isExacto ? "text-emerald-300" : "text-app-text"}`}>
                              {pr.numero_pedido}
                            </span>
                            {isExacto && (
                              <span className="rounded bg-emerald-900/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                                Exacto
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-app-muted">{pr.cliente?.nombre ?? "—"}</td>
                        <td className={`px-4 py-3 ${
                          criterios.tipo && !diffs.includes("tipo")
                            ? "text-emerald-400 font-semibold"
                            : diffs.includes("tipo")
                              ? "text-amber-400 font-semibold"
                              : "text-app-muted"
                        }`}>
                          {pr.tipo ?? "—"}
                        </td>
                        <td className={`px-4 py-3 tabular-nums ${
                          criterios.ancho !== null && !diffs.includes("ancho")
                            ? "text-emerald-400 font-semibold"
                            : diffs.includes("ancho")
                              ? "text-amber-400 font-semibold"
                              : "text-app-text"
                        }`}>
                          {pr.ancho !== null ? `${formatMedida(pr.ancho)} cm` : "—"}
                        </td>
                        <td className={`px-4 py-3 tabular-nums ${
                          criterios.alto !== null && !diffs.includes("alto")
                            ? "text-emerald-400 font-semibold"
                            : diffs.includes("alto")
                              ? "text-amber-400 font-semibold"
                              : "text-app-text"
                        }`}>
                          {pr.alto !== null ? `${formatMedida(pr.alto)} cm` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* ── Zona inferior: registro ── */}
      {hayAlgunCriterio && (
        <div className="mt-2">
          {/* Sin cliente: pide seleccionar */}
          {!clienteId && !mostrarRegistro && (
            <div className="mb-3 flex items-center justify-between rounded-lg border border-[var(--border-strong)] bg-surface-2 px-4 py-3 text-sm">
              <span className="text-app-muted">Selecciona un cliente para registrar este pedido.</span>
              <button
                type="button"
                onClick={() => setMostrarRegistro(true)}
                className="cursor-pointer rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[var(--brand-hover)]"
              >
                + Nuevo registro
              </button>
            </div>
          )}

          {/* Con cliente + coincidencia exacta: DWG banner + opción de registrar igualmente */}
          {clienteId && completos && exacto && !mostrarRegistro && (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-900/40 bg-emerald-950/20 px-4 py-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500">
                  <CheckIcon />
                </span>
                <span className="text-emerald-400">Coincidencia exacta —</span>
                <span className="font-mono font-semibold text-emerald-300">{exacto.numero_pedido}.dwg</span>
              </div>
              <button
                type="button"
                onClick={() => setMostrarRegistro(true)}
                className="cursor-pointer text-xs text-app-muted underline underline-offset-2 hover:text-app-text hover:no-underline"
              >
                Registrar igualmente con otro número
              </button>
            </div>
          )}

          {/* Con cliente + campos completos + sin coincidencia exacta: botón de registrar */}
          {clienteId && completos && !exacto && !mostrarRegistro && (
            <div className="mb-3 flex items-center justify-between rounded-lg border border-[var(--border-strong)] bg-surface-2 px-4 py-3 text-sm">
              <span className="text-app-muted">No existe este pedido para el cliente seleccionado.</span>
              <button
                type="button"
                onClick={() => setMostrarRegistro(true)}
                className="cursor-pointer rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[var(--brand-hover)]"
              >
                + Registrar pedido
              </button>
            </div>
          )}

          {/* Con cliente + campos incompletos: guía para completar medidas */}
          {clienteId && !completos && !mostrarRegistro && (
            <div className="mb-3 flex items-center justify-between rounded-lg border border-[var(--border-strong)] bg-surface-2 px-4 py-3 text-sm">
              <span className="text-app-muted">Completa todas las medidas para registrar el pedido.</span>
              <button
                type="button"
                onClick={() => setMostrarRegistro(true)}
                className="cursor-pointer text-xs text-brand underline underline-offset-2 hover:no-underline"
              >
                Registrar con medidas parciales
              </button>
            </div>
          )}

          {/* Formulario de registro */}
          {mostrarRegistro && (
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-app-text">Registrar como nuevo pedido</p>
            <button
              type="button"
              onClick={() => setMostrarRegistro(false)}
              className="cursor-pointer text-xs text-app-muted hover:text-app-text"
            >
              Cancelar
            </button>
          </div>

          {okMsg && (
            <div className="mb-3"><Banner tone="success">{okMsg}</Banner></div>
          )}
          {errorMsg && (
            <div className="mb-3"><Banner tone="warning">{errorMsg}</Banner></div>
          )}

          {/* Medidas: siempre visibles en el formulario para confirmar o completar */}
          <div className="mb-4 rounded-lg border border-[var(--border)] bg-surface-2 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-app-muted">Medidas</p>
            <div className="flex flex-wrap items-start gap-2">
              <CamposTecnicosFamilia
                familiaNombre={familiaNombre}
                valores={valores}
                onChange={(campo, valor) => setValores((v) => ({ ...v, [campo]: valor }))}
                tiposPuerta={cat.tiposPuerta}
                pedidosFamilia={pedidosFamilia}
                tiposRemolqueExtra={tiposRemolqueExtra}
                freeInput
                inline
                onNuevoTipo={() => esRemolques ? setModalTipoRemolque(true) : setModalTipoPuerta(true)}
              />
            </div>
          </div>

          {/* Línea: Cliente · Nº Pedido · Fecha · Técnico */}
          <div className="flex flex-wrap items-start gap-2">
            {!clienteId && (
              <div className="min-w-[160px] flex-[2]">
                <span className={labelClass}>Cliente *</span>
                <div className="flex items-center gap-1">
                  <select
                    className={`${inputClass} flex-1`}
                    value={clienteId ?? ""}
                    onChange={(e) => setClienteId(e.target.value || null)}
                  >
                    <option value="">— Cliente —</option>
                    {clientesDeFamilia.map((c) => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                  <Button variant="secondary" onClick={() => setModalCliente(true)}>+</Button>
                </div>
              </div>
            )}

            <div className="min-w-[120px] flex-[2]">
              <Field
                label="Nº Pedido *"
                hint={!formatoNumeroOk ? AVISO_FORMATO_PEDIDO : undefined}
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
            </div>

            <div className="min-w-[120px] flex-1">
              <Field label="Fecha">
                <input
                  type="date"
                  className={inputClass}
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                />
              </Field>
            </div>

            <div className="min-w-[120px] flex-[2]">
              <span className={labelClass}>Técnico</span>
              <div className="flex items-center gap-1">
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
          </div>

          {/* Línea: Observaciones */}
          <div className="mt-2">
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
              {guardando
                ? "Guardando…"
                : confirmarNumero
                  ? "Guardar igualmente"
                  : "Guardar pedido"}
            </Button>
          </div>
        </Card>
          )}
        </div>
      )}

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

      {modalTipoPuerta && (
        <CrearEntidadModal
          titulo="Nuevo tipo de puerta"
          etiqueta="Nombre"
          placeholder="Ej. Basculante"
          onCerrar={() => setModalTipoPuerta(false)}
          onGuardar={async (nombre) => {
            const nuevo = await dbService.createTipoPuerta(nombre);
            await cat.recargarTiposPuerta();
            setValores((v) => ({ ...v, tipo: nuevo.nombre }));
            setModalTipoPuerta(false);
          }}
        />
      )}

      {modalTipoRemolque && (
        <CrearEntidadModal
          titulo="Nuevo tipo de remolque"
          etiqueta="Nombre"
          placeholder="Ej. Frigorífico"
          onCerrar={() => setModalTipoRemolque(false)}
          onGuardar={async (nombre) => {
            setTiposRemolqueExtra((prev) => [...new Set([...prev, nombre])]);
            setValores((v) => ({ ...v, tipo: nombre }));
            setModalTipoRemolque(false);
          }}
        />
      )}
    </div>
  );
}
