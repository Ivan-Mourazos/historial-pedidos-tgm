"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CamposTecnicosFamilia,
  camposTecnicosVacios,
  type CamposTecnicosValores,
} from "@/components/CamposTecnicosFamilia";
import { AbrirExcelButton } from "@/components/AbrirExcelButton";
import { AbrirZwcadButton } from "@/components/AbrirZwcadButton";
import { CrearEntidadModal } from "@/components/CrearEntidadModal";
import {
  Banner,
  Button,
  Card,
  DatePicker,
  Field,
  SelectControl,
  inputClass,
  labelClass,
  todayInputValue,
} from "@/components/ui";
import { dbService } from "@/lib/db/db-service";
import { formatMedida } from "@/lib/display";
import { ordenarFamilias } from "@/lib/familias";
import { tipoRemolqueCanonico } from "@/lib/tipos-remolque";
import { usaRecogidaRemolque } from "@/lib/recogida-remolque";
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
    <th className={`px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-app-muted ${className}`}>
      {children}
    </th>
  );
}

function CoincidenciaBadge({ exacta }: { exacta: boolean }) {
  if (exacta) {
    return <span className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-300">Exacto</span>;
  }
  return <span className="rounded-md bg-sky-500/12 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-700 dark:text-sky-300">Coincide</span>;
}

function valoresDesdeUrl(params: URLSearchParams): CamposTecnicosValores {
  const extra = Object.fromEntries(
    [...params.entries()].filter(([key]) => key.startsWith("campo_")).map(([key, value]) => [key.slice(6), value]),
  );
  return {
    ...camposTecnicosVacios,
    tipo: params.get("tipo") ?? "",
    largo: params.get("largo") ?? "",
    ancho: params.get("ancho") ?? "",
    alto: params.get("alto") ?? "",
    aguas: params.get("aguas") ?? "",
    aguasActivas: params.has("aguas"),
    radio: params.get("radio") ?? "",
    recogidaDelante: params.get("recogeDelante") ?? "",
    recogidaAtras: params.get("recogeAtras") ?? "",
    extra,
  };
}

function BuscadorPageContent() {
  const cat = useCatalogos();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [familiaId, setFamiliaId]             = useState<string>(() => searchParams.get("familia") ?? "");
  const [clienteId, setClienteId]             = useState<string | null>(() => searchParams.get("cliente"));
  const [valores, setValores]                 = useState<CamposTecnicosValores>(() => valoresDesdeUrl(new URLSearchParams(searchParams.toString())));
  const [pedidosFamilia, setPedidosFamilia]   = useState<PedidoConRelaciones[]>([]);
  const [clienteIdsDeFamilia, setClienteIdsDeFamilia] = useState<string[] | null>(null);

  const [numero, setNumero]               = useState("");
  const [fecha, setFecha]                 = useState(todayInputValue);
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
  const [mostrarRegistro, setMostrarRegistro]   = useState(false);
  const [limiteResultados, setLimiteResultados] = useState(50);

  const familiasOrdenadas = useMemo(
    () => ordenarFamilias(cat.familias),
    [cat.familias],
  );
  const selectedFamiliaId = familiaId || familiasOrdenadas[0]?.id || "";
  const familia       = cat.familias.find((f) => f.id === selectedFamiliaId);
  const familiaNombre = familia?.nombre ?? "";
  const esRemolques   = familiaNombre === FAMILIA_REMOLQUES;

  const clientesDeFamilia = useMemo(
    () =>
      clienteIdsDeFamilia === null
        ? []
        : cat.clientes.filter(
            (c) => clienteIdsDeFamilia.includes(c.id) || c.id === clienteId,
          ),
    [cat.clientes, clienteId, clienteIdsDeFamilia],
  );
  const pedidosParaOpciones = useMemo(
    () => (
      clienteId
        ? pedidosFamilia.filter((p) => p.cliente_id === clienteId)
        : pedidosFamilia
    ),
    [clienteId, pedidosFamilia],
  );

  useEffect(() => {
    if (!selectedFamiliaId) return;
    let active = true;
    Promise.all([
      dbService.getClienteIdsDeFamilia(selectedFamiliaId),
      dbService.getPedidosPorFamilia(selectedFamiliaId),
    ]).then(([clientIds, pedidos]) => {
      if (!active) return;
      setClienteIdsDeFamilia(clientIds);
      setPedidosFamilia(pedidos);
    }).catch(() => {
      if (!active) return;
      setClienteIdsDeFamilia([]);
      setPedidosFamilia([]);
    });
    return () => { active = false; };
  }, [selectedFamiliaId]);

  function cambiarFamilia(nextFamilyId: string) {
    setFamiliaId(nextFamilyId);
    setValores(camposTecnicosVacios);
    setClienteId(null);
    setConfirmarNumero(false);
    setPedidosFamilia([]);
    setClienteIdsDeFamilia(null);
    setLimiteResultados(50);
  }

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
    () =>
      Object.entries(valores).some(([key, value]) => {
        if (key === "extra") {
          return Object.values(valores.extra).some((extraValue) =>
            typeof extraValue === "boolean" ? extraValue : extraValue !== "",
          );
        }
        return typeof value === "boolean" ? value : value !== "";
      }),
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
  const resultadosVisibles = resultadosLive.slice(0, limiteResultados);

  useEffect(() => {
    if (!familiasOrdenadas.length) return;
    const params = new URLSearchParams();
    params.set("familia", selectedFamiliaId);
    if (clienteId) params.set("cliente", clienteId);
    const campos: Array<[string, string]> = [
      ["tipo", valores.tipo], ["largo", valores.largo], ["ancho", valores.ancho],
      ["alto", valores.alto], ["radio", valores.radio],
      ["recogeDelante", valores.recogidaDelante], ["recogeAtras", valores.recogidaAtras],
    ];
    if (valores.aguasActivas && valores.aguas) campos.push(["aguas", valores.aguas]);
    for (const [key, value] of campos) if (value) params.set(key, value);
    for (const [key, value] of Object.entries(valores.extra)) if (value !== "" && value !== false) params.set(`campo_${key}`, String(value));
    const query = params.toString();
    router.replace(query ? `/?${query}` : "/", { scroll: false });
  }, [clienteId, familiasOrdenadas.length, router, selectedFamiliaId, valores]);

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

  function setCampo(
    campo: keyof CamposTecnicosValores,
    valor: string | boolean | Record<string, string | boolean>,
  ) {
    setValores((v) => {
      const siguiente = { ...v, [campo]: valor } as CamposTecnicosValores;
      if (campo === "tipo") {
        siguiente.radio = "";
        siguiente.aguas = "";
        siguiente.aguasActivas = false;
        if (typeof valor === "string" && !usaRecogidaRemolque(valor)) {
          siguiente.recogidaDelante = "";
          siguiente.recogidaAtras = "";
        }
      }
      return siguiente;
    });
    setLimiteResultados(50);
    setMostrarRegistro(false);
  }

  function limpiarBusqueda() {
    setClienteId(null);
    setValores(camposTecnicosVacios);
    setOkMsg(null);
    setErrorMsg(null);
    setConfirmarNumero(false);
    setMostrarRegistro(false);
    setLimiteResultados(50);
  }

  function abrirAlta() {
    const params = new URLSearchParams();
    params.set("familia", selectedFamiliaId);
    if (clienteId) params.set("cliente", clienteId);
    const campos: Array<[string, string]> = [
      ["tipo", valores.tipo], ["largo", valores.largo], ["ancho", valores.ancho],
      ["alto", valores.alto], ["radio", valores.radio],
      ["recogeDelante", valores.recogidaDelante], ["recogeAtras", valores.recogidaAtras],
    ];
    if (valores.aguasActivas && valores.aguas) campos.push(["aguas", valores.aguas]);
    for (const [key, value] of campos) if (value) params.set(key, value);
    for (const [key, value] of Object.entries(valores.extra)) if (value !== "" && value !== false) params.set(`campo_${key}`, String(value));
    router.push(`/nuevo?${params.toString()}`);
  }

  const hayAlgoDato = !!clienteId || hayAlgunCriterio;

  async function guardar() {
    setErrorMsg(null);
    setOkMsg(null);
    const numeroNorm = normalizarNumeroPedido(numero);
    if (!numeroNorm || !clienteId || !selectedFamiliaId || !completos) return;

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
        familia_id:    selectedFamiliaId,
        fecha:         fecha || null,
        tecnico_id:    tecnicoId || null,
        observaciones: observaciones.trim() || null,
        estado_planteo: "REALIZADO",
        estado_planteo_manual: true,
        ...tecnicosCampos,
      });
      setOkMsg(`Pedido ${numeroNorm} registrado correctamente.`);
      setNumero("");
      setObservaciones("");
      setConfirmarNumero(false);
      setErrorMsg(null);
      setPedidosFamilia(await dbService.getPedidosPorFamilia(selectedFamiliaId));
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setGuardando(false);
    }
  }

  const puedeGuardar =
    numero.trim() !== "" && !!clienteId && !!selectedFamiliaId && completos && !guardando;

  return (
    <div>
      <div className="mb-3 flex items-end justify-between gap-6 border-b border-[var(--border)] pb-3">
        <div>
          <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-brand">Archivo técnico</p>
          <h1 className="text-xl font-bold tracking-tight text-app-text">Buscar pedidos</h1>
          <p className="mt-1 text-sm text-app-muted">Selecciona cualquier dato; las demás opciones se adaptan automáticamente.</p>
        </div>
        {hayAlgoDato && (
          <button type="button" onClick={limpiarBusqueda} className="rounded-lg px-3 py-2 text-sm font-medium text-app-muted transition-colors hover:bg-surface-2 hover:text-app-text">
            Limpiar búsqueda
          </button>
        )}
      </div>
      {/* ── Barra de familia + acciones ── */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div
          className="flex rounded-full border border-white/10 bg-surface/75 p-0.5 shadow-sm ring-1 ring-black/5 backdrop-blur-xl dark:ring-white/10"
          style={{ boxShadow: "var(--shadow-sm)" }}
        >
          {familiasOrdenadas.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={selectedFamiliaId === f.id}
              onClick={() => cambiarFamilia(f.id)}
              className={`cursor-pointer rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                selectedFamiliaId === f.id
                  ? "bg-brand text-white shadow-sm"
                  : "text-app-muted hover:text-app-text"
              }`}
            >
              {f.nombre}
            </button>
          ))}
        </div>

      </div>

      {/* ── Formulario de búsqueda ── */}
      <Card className="mb-4">
        <div className="flex flex-wrap items-start gap-2">
          {/* Cliente */}
          <div className="min-w-[160px] flex-[2]">
            <span className={labelClass}>Cliente</span>
            <div className="flex items-center gap-1.5">
              <SelectControl
                className="min-w-0 flex-1"
                value={clienteId ?? ""}
                onChange={(next) => {
                  setClienteId(next || null);
                  setLimiteResultados(50);
                }}
                placeholder="— Todos —"
                options={[
                  { value: "", label: "— Todos —" },
                  ...clientesDeFamilia.map((c) => ({ value: c.id, label: c.nombre })),
                ]}
              />
            </div>
          </div>

          {/* Campos técnicos en línea */}
          {familiaNombre && (
            <CamposTecnicosFamilia
              familiaNombre={familiaNombre}
              valores={valores}
              onChange={setCampo}
              tiposPuerta={cat.tiposPuerta}
              tiposRemolque={cat.tiposRemolque}
              pedidosFamilia={pedidosParaOpciones}
              inline
            />
          )}
        </div>
      </Card>

      {/* ── Registro contextual: siempre antes de los resultados ── */}
      {hayAlgunCriterio && (
        <div className="mb-4 scroll-mt-20">
          {/* Sin cliente: pide seleccionar */}
          {!clienteId && !mostrarRegistro && (
            <div className="flex items-center justify-between rounded-[16px] border border-white/10 bg-surface-2/70 px-3 py-2.5 text-sm shadow-sm ring-1 ring-black/5 backdrop-blur-xl dark:ring-white/10">
              <span className="text-app-muted">Selecciona un cliente para registrar este pedido.</span>
              <button
                type="button"
                onClick={abrirAlta}
                className="cursor-pointer rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[var(--brand-hover)]"
              >
                + Nuevo registro
              </button>
            </div>
          )}

          {/* Con cliente + coincidencia exacta: DWG banner + opción de registrar igualmente */}
          {clienteId && completos && exacto && !mostrarRegistro && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-emerald-500/20 bg-emerald-500/10 px-3 py-2.5 text-sm shadow-sm ring-1 ring-black/5 backdrop-blur-xl dark:ring-white/10">
              <div className="flex items-center gap-2">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500">
                  <CheckIcon />
                </span>
                <span className="text-emerald-400">Coincidencia exacta —</span>
                <span className="font-mono font-semibold text-emerald-300">{exacto.numero_pedido}.dwg</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <AbrirExcelButton
                  numeroPedido={exacto.numero_pedido}
                  familiaNombre={familiaNombre}
                  label="Abrir Excel"
                />
                <AbrirZwcadButton numeroPedido={exacto.numero_pedido} label="Abrir en ZWCAD" />
                <button
                  type="button"
                  onClick={abrirAlta}
                  className="cursor-pointer text-xs text-app-muted underline underline-offset-2 hover:text-app-text hover:no-underline"
                >
                  Registrar igualmente con otro número
                </button>
              </div>
            </div>
          )}

          {/* Con cliente + campos completos + sin coincidencia exacta: botón de registrar */}
          {clienteId && completos && !exacto && !mostrarRegistro && (
            <div className="flex items-center justify-between rounded-[16px] border border-white/10 bg-surface-2/70 px-3 py-2.5 text-sm shadow-sm ring-1 ring-black/5 backdrop-blur-xl dark:ring-white/10">
              <span className="text-app-muted">No hay coincidencia exacta para este cliente y esas medidas.</span>
              <button
                type="button"
                onClick={abrirAlta}
                className="cursor-pointer rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[var(--brand-hover)]"
              >
                + Registrar pedido
              </button>
            </div>
          )}

          {/* Con cliente + campos incompletos: guía para completar medidas */}
          {clienteId && !completos && !mostrarRegistro && (
            <div className="flex items-center justify-between rounded-[16px] border border-white/10 bg-surface-2/70 px-3 py-2.5 text-sm shadow-sm ring-1 ring-black/5 backdrop-blur-xl dark:ring-white/10">
              <span className="text-app-muted">Completa todas las medidas para registrar el pedido.</span>
              <button
                type="button"
                onClick={abrirAlta}
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
          <div className="mb-3 rounded-[16px] border border-white/10 bg-surface-2/55 p-3 ring-1 ring-black/5 dark:ring-white/10">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-app-muted">Medidas</p>
            <div className="flex flex-wrap items-start gap-2">
              <CamposTecnicosFamilia
                familiaNombre={familiaNombre}
                valores={valores}
                onChange={(campo, valor) => {
                  setValores((v) => {
                    const siguiente = { ...v, [campo]: valor } as CamposTecnicosValores;
                    if (campo === "tipo") {
                      siguiente.radio = "";
                      siguiente.aguas = "";
                      siguiente.aguasActivas = false;
                      if (typeof valor === "string" && !usaRecogidaRemolque(valor)) {
                        siguiente.recogidaDelante = "";
                        siguiente.recogidaAtras = "";
                      }
                    }
                    return siguiente;
                  });
                }}
                tiposPuerta={cat.tiposPuerta}
                tiposRemolque={cat.tiposRemolque}
                pedidosFamilia={pedidosFamilia}
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
                  <SelectControl
                    className="flex-1"
                    value={clienteId ?? ""}
                    onChange={(next) => setClienteId(next || null)}
                    placeholder="— Cliente —"
                    options={[
                      { value: "", label: "— Cliente —" },
                      ...clientesDeFamilia.map((c) => ({ value: c.id, label: c.nombre })),
                    ]}
                  />
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
                <DatePicker value={fecha} onChange={setFecha} />
              </Field>
            </div>

            <div className="min-w-[120px] flex-[2]">
              <span className={labelClass}>Técnico</span>
              <div className="flex items-center gap-1">
                <SelectControl
                  className="flex-1"
                  value={tecnicoId}
                  onChange={setTecnicoId}
                  placeholder="— Sin asignar —"
                  options={[
                    { value: "", label: "— Sin asignar —" },
                    ...cat.tecnicos.map((t) => ({ value: t.id, label: t.nombre })),
                  ]}
                />
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

      {/* ── Cabecera de resultados ── */}
      {hayAlgunCriterio && (
        <div className="mb-2 flex items-center justify-between px-0.5">
          <p className="text-sm text-app-muted">
            {resultadosLive.length === 0
              ? "Sin coincidencias"
              : `${resultadosLive.length} pedido${resultadosLive.length !== 1 ? "s" : ""} encontrado${resultadosLive.length !== 1 ? "s" : ""}`}
          </p>
          {resultadosLive.length > 1 ? (
            <p className="text-xs text-app-muted">
              Solo combinaciones existentes · más recientes primero
            </p>
          ) : !clienteId && completos && (
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
        className="mb-4 overflow-hidden rounded-[18px] border border-white/10 bg-surface/80 shadow-sm ring-1 ring-black/5 backdrop-blur-xl dark:bg-slate-950/50 dark:ring-white/10"
        style={{ boxShadow: "var(--shadow-sm)" }}
      >
        {!hayAlgunCriterio ? (
          <p className="px-4 py-8 text-center text-sm text-app-muted">
            Selecciona cualquier medida para localizar planteos anteriores.
          </p>
        ) : resultadosLive.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-app-muted">
            No existe ningún pedido realizado con esa combinación exacta.
          </p>
        ) : (
          <div className="overflow-x-auto">
            {esRemolques ? (
              <table className="w-full min-w-[580px] text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <Th>Nº PEDIDO</Th>
                    <Th>CLIENTE</Th>
                    <Th>TIPO</Th>
                    <Th>LARGO</Th>
                    <Th>ANCHO</Th>
                    <Th>ALTURA</Th>
                    <Th>AGUAS</Th>
                    <Th>RADIO</Th>
                    <Th>RECOGIDA</Th>
                    <Th className="w-[190px]">ARCHIVOS</Th>
                  </tr>
                </thead>
                <tbody>
                  {resultadosVisibles.map((p, i) => {
                    const pr       = p as PedidoConRelaciones;
                    const diffs    = calcularDiferencias(p as Pedido, criterios);
                    const isExacto = completos && diffs.length === 0;
                    const rowBg    = isExacto ? "bg-emerald-950/20" : "";
                    const sep      = i < resultadosVisibles.length - 1 ? "border-b border-[var(--border)]" : "";

                    function tdVal(field: keyof Pedido, diffKey: string, inCriteria: boolean) {
                      const val    = p[field] as number | null;
                      const isDiff = diffs.includes(diffKey);
                      const color  = inCriteria && !isDiff
                        ? "text-emerald-400 font-semibold"
                        : isDiff
                          ? "text-amber-400 font-semibold"
                          : "text-app-text";
                      return (
                        <td className={`px-3 py-2.5 tabular-nums ${color}`}>
                          {val !== null ? `${formatMedida(val)} cm` : "—"}
                        </td>
                      );
                    }

                    return (
                      <tr key={pr.id} className={`transition-colors hover:bg-surface-2/70 ${rowBg} ${sep}`}>
                        <td className="px-3 py-2.5">
                          <span className="flex items-center gap-2">
                            {isExacto && (
                              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500">
                                <CheckIcon />
                              </span>
                            )}
                            <span className={`font-mono font-bold ${isExacto ? "text-emerald-300" : "text-app-text"}`}>
                              {pr.numero_pedido}
                            </span>
                            <CoincidenciaBadge exacta={isExacto} />
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-app-muted">{pr.cliente?.nombre ?? "—"}</td>
                        <td className={`px-3 py-2.5 ${
                          criterios.tipo && !diffs.includes("tipo")
                            ? "text-emerald-400 font-semibold"
                            : diffs.includes("tipo")
                              ? "text-amber-400 font-semibold"
                              : "text-app-muted"
                        }`}>{tipoRemolqueCanonico(pr.tipo) || "—"}</td>
                        {tdVal("largo", "largo", criterios.largo !== null)}
                        {tdVal("ancho", "ancho", criterios.ancho !== null)}
                        {tdVal("alto",  "alto",  criterios.alto  !== null)}
                        {tdVal("aguas", "aguas", criterios.aguas !== null)}
                        {tdVal("radio", "radio", criterios.radio !== null)}
                        <td className="min-w-[190px] px-3 py-2.5 text-xs text-app-muted">
                          <span className="block"><strong>Del.:</strong> {pr.recogida_delante ?? "—"}</span>
                          <span className="block"><strong>Atr.:</strong> {pr.recogida_atras ?? "—"}</span>
                        </td>
                        <td className="w-[190px] px-3 py-2.5">
                          <div className="flex h-8 items-center gap-2">
                            <div className="flex w-[86px] items-center justify-start">
                            <AbrirExcelButton
                              numeroPedido={pr.numero_pedido}
                              familiaNombre={familiaNombre}
                              className="w-[86px]"
                            />
                            </div>
                            <div className="flex w-[86px] items-center justify-start">
                              <AbrirZwcadButton
                                numeroPedido={pr.numero_pedido}
                                label="CAD"
                                className="w-[86px]"
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <Th>Nº PEDIDO</Th>
                    <Th>CLIENTE</Th>
                    <Th>TIPO</Th>
                    <Th>ANCHO</Th>
                    <Th>ALTO</Th>
                    <Th>I.D.</Th>
                    <Th className="w-[100px]">CAD</Th>
                  </tr>
                </thead>
                <tbody>
                  {resultadosVisibles.map((p, i) => {
                    const pr       = p as PedidoConRelaciones;
                    const diffs    = calcularDiferencias(p as Pedido, criterios);
                    const isExacto = completos && diffs.length === 0;
                    const rowBg    = isExacto ? "bg-emerald-950/20" : "";
                    const sep      = i < resultadosVisibles.length - 1 ? "border-b border-[var(--border)]" : "";

                    return (
                      <tr key={pr.id} className={`transition-colors hover:bg-surface-2/70 ${rowBg} ${sep}`}>
                        <td className="px-3 py-2.5">
                          <span className="flex items-center gap-2">
                            {isExacto && (
                              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500">
                                <CheckIcon />
                              </span>
                            )}
                            <span className={`font-mono font-bold ${isExacto ? "text-emerald-300" : "text-app-text"}`}>
                              {pr.numero_pedido}
                            </span>
                            <CoincidenciaBadge exacta={isExacto} />
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-app-muted">{pr.cliente?.nombre ?? "—"}</td>
                        <td className={`px-3 py-2.5 ${
                          criterios.tipo && !diffs.includes("tipo")
                            ? "text-emerald-400 font-semibold"
                            : diffs.includes("tipo")
                              ? "text-amber-400 font-semibold"
                              : "text-app-muted"
                        }`}>
                          {pr.tipo ?? "—"}
                        </td>
                        <td className={`px-3 py-2.5 tabular-nums ${
                          criterios.ancho !== null && !diffs.includes("ancho")
                            ? "text-emerald-400 font-semibold"
                            : diffs.includes("ancho")
                              ? "text-amber-400 font-semibold"
                              : "text-app-text"
                        }`}>
                          {pr.ancho !== null ? `${formatMedida(pr.ancho)} cm` : "—"}
                        </td>
                        <td className={`px-3 py-2.5 tabular-nums ${
                          criterios.alto !== null && !diffs.includes("alto")
                            ? "text-emerald-400 font-semibold"
                            : diffs.includes("alto")
                              ? "text-amber-400 font-semibold"
                              : "text-app-text"
                        }`}>
                          {pr.alto !== null ? `${formatMedida(pr.alto)} cm` : "—"}
                        </td>
                        <td className={`px-3 py-2.5 ${
                          !diffs.includes("impresion_digital")
                            ? "text-emerald-400 font-semibold"
                            : "text-amber-400 font-semibold"
                        }`}>
                          {pr.impresion_digital ? "Sí" : "No"}
                        </td>
                        <td className="w-[100px] px-3 py-2.5">
                          <AbrirZwcadButton
                            numeroPedido={pr.numero_pedido}
                            label="CAD"
                            className="w-[86px]"
                          />
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

      {resultadosLive.length > resultadosVisibles.length && (
        <div className="-mt-1 mb-5 flex items-center justify-center border-t border-[var(--border)] pt-3">
          <Button variant="secondary" onClick={() => setLimiteResultados((actual) => actual + 25)}>
            Mostrar 25 más ({resultadosLive.length - resultadosVisibles.length} restantes)
          </Button>
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
            const nuevo = await dbService.createTipoRemolque(nombre);
            await cat.recargarTiposRemolque();
            setValores((v) => ({ ...v, tipo: nuevo.nombre }));
            setModalTipoRemolque(false);
          }}
        />
      )}
    </div>
  );
}

export default function BuscadorPage() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-sm text-app-muted">Cargando buscador…</div>}>
      <BuscadorPageContent />
    </Suspense>
  );
}
