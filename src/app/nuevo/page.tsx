"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CamposTecnicosFamilia,
  camposTecnicosVacios,
  type CamposTecnicosValores,
} from "@/components/CamposTecnicosFamilia";
import { ClienteSelect } from "@/components/ClienteSelect";
import {
  Banner,
  Button,
  Card,
  DatePicker,
  Field,
  PageTitle,
  SelectControl,
  inputClass,
  todayInputValue,
} from "@/components/ui";
import { dbService } from "@/lib/db/db-service";
import { resumenMedidas } from "@/lib/display";
import { ordenarFamilias } from "@/lib/familias";
import { claveTipoRemolque } from "@/lib/tipos-remolque";
import { usaRecogidaRemolque } from "@/lib/recogida-remolque";
import {
  camposRequeridosCompletos,
  esCoincidenciaExacta,
} from "@/lib/matching";
import {
  camposTecnicosParaGuardar,
  construirCriterios,
} from "@/lib/pedido-helpers";
import {
  AVISO_FORMATO_PEDIDO,
  normalizarNumeroPedido,
  numeroPedidoEncajaFormato,
} from "@/lib/pedido-numero";
import type { Pedido } from "@/lib/types";
import { useCatalogos } from "@/lib/useCatalogos";

function NuevoPedidoPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cat = useCatalogos();
  const catalogosCargando = cat.cargando;
  const familiasCatalogo = cat.familias;
  const recargarClientes = cat.recargarClientes;

  const valoresIniciales = (): CamposTecnicosValores => ({
    ...camposTecnicosVacios,
    tipo: searchParams.get("tipo") ?? "",
    largo: searchParams.get("largo") ?? "",
    ancho: searchParams.get("ancho") ?? "",
    alto: searchParams.get("alto") ?? "",
    altoDelante: searchParams.get("altoDelante") ?? "",
    altoAtras: searchParams.get("altoAtras") ?? "",
    alturasDistintas: searchParams.get("alturas") === "dos" || searchParams.has("altoDelante") || searchParams.has("altoAtras"),
    aguas: searchParams.get("aguas") ?? "",
    aguasActivas: searchParams.has("aguas"),
    radio: searchParams.get("radio") ?? "",
    recogidaDelante: searchParams.get("recogeDelante") ?? "",
    recogidaAtras: searchParams.get("recogeAtras") ?? "",
    extra: Object.fromEntries(
      [...searchParams.entries()].filter(([key]) => key.startsWith("campo_")).map(([key, value]) => [key.slice(6), value]),
    ),
  });

  const [numero, setNumero] = useState(() => normalizarNumeroPedido(searchParams.get("pedido") ?? ""));
  const [familiaId, setFamiliaId] = useState(() => searchParams.get("familia") ?? "");
  const [clienteId, setClienteId] = useState<string | null>(() => searchParams.get("cliente"));
  const [fecha, setFecha] = useState(todayInputValue);
  const [tecnicoId, setTecnicoId] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [valores, setValores] = useState<CamposTecnicosValores>(valoresIniciales);

  const [pedidosCliente, setPedidosCliente] = useState<Pedido[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  // Confirmaciones explícitas: duplicado técnico y número ya existente.
  const [confirmarDuplicado, setConfirmarDuplicado] = useState(false);
  const [confirmarNumero, setConfirmarNumero] = useState(false);
  const [avisoNumero, setAvisoNumero] = useState<string | null>(null);
  const [avisoRps, setAvisoRps] = useState<string | null>(null);
  const [pedidoRps, setPedidoRps] = useState<{
    numero: string;
    fecha: string | null;
    lineas: Array<{
      numeroLinea: number; familia: string; tipo: string; largo: number | null; ancho: number | null;
      alto: number | null; altoDelante: number | null; altoAtras: number | null; aguas: number | null;
      altoBase: number | null; altoExtra: number | null; descripcion: string;
      detalle: string; requiereRevision: boolean;
      progresoPlanteo: number | null; estadoPlanteo: "PENDIENTE" | "REALIZADO" | "SIN_TAREA";
    }>;
  } | null>(null);
  const [lineaRpsSeleccionada, setLineaRpsSeleccionada] = useState<{
    numeroLinea: number;
    progresoPlanteo: number | null;
  } | null>(null);
  const importacionInicialRps = useRef(false);

  const familia = cat.familias.find((f) => f.id === familiaId);
  const familiaNombre = familia?.nombre ?? "";
  const familiasOrdenadas = useMemo(() => ordenarFamilias(cat.familias), [cat.familias]);
  // En el alta deben aparecer todos los clientes activos, aunque todavía no
  // tengan pedidos en la familia seleccionada.
  const clientesDisponibles = cat.clientes;

  function cambiarFamilia(nextFamilyId: string) {
    setFamiliaId(nextFamilyId);
    setValores(camposTecnicosVacios);
    setConfirmarDuplicado(false);
    setConfirmarNumero(false);
    setAvisoNumero(null);
    setClienteId(null);
    setPedidosCliente([]);
    setLineaRpsSeleccionada(null);
  }

  function cambiarCliente(nextClientId: string | null) {
    setClienteId(nextClientId);
    setPedidosCliente([]);
  }

  // Carga pedidos del cliente+familia para detectar duplicado técnico.
  useEffect(() => {
    if (!clienteId || !familiaId) return;
    let activo = true;
    dbService
      .getPedidosPorClienteFamilia(clienteId, familiaId)
      .then((res) => activo && setPedidosCliente(res))
      .catch(() => activo && setPedidosCliente([]));
    return () => {
      activo = false;
    };
  }, [clienteId, familiaId]);

  const criterios = useMemo(
    () => construirCriterios(familiaNombre, clienteId, valores),
    [familiaNombre, clienteId, valores],
  );
  const completos = camposRequeridosCompletos(criterios);

  const duplicadoTecnico = useMemo(
    () =>
      completos
        ? pedidosCliente.find((p) => esCoincidenciaExacta(p, criterios)) ?? null
        : null,
    [completos, pedidosCliente, criterios],
  );

  const formatoNumeroOk =
    numero.trim() === "" || numeroPedidoEncajaFormato(numero);

  const hayCambiosSinGuardar = numero.trim() !== "" || observaciones.trim() !== "" ||
    Object.entries(valores).some(([key, value]) => key === "extra"
      ? Object.values(valores.extra).some((extra) => extra !== "" && extra !== false)
      : typeof value === "boolean" ? value : value !== "");

  useEffect(() => {
    if (!hayCambiosSinGuardar) return;
    const avisar = (event: BeforeUnloadEvent) => event.preventDefault();
    const interceptarEnlaces = (event: MouseEvent) => {
      const enlace = (event.target as HTMLElement | null)?.closest("a");
      if (!enlace || enlace.target === "_blank" || enlace.href === window.location.href) return;
      if (!window.confirm("Hay datos del pedido sin guardar. ¿Quieres salir igualmente?")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", avisar);
    document.addEventListener("click", interceptarEnlaces, true);
    return () => {
      window.removeEventListener("beforeunload", avisar);
      document.removeEventListener("click", interceptarEnlaces, true);
    };
  }, [hayCambiosSinGuardar]);

  function irAlHistorico() {
    if (!hayCambiosSinGuardar || window.confirm("Hay datos del pedido sin guardar. ¿Quieres salir igualmente?")) {
      router.push("/historico");
    }
  }

  function setCampo(
    campo: keyof CamposTecnicosValores,
    valor: string | boolean | Record<string, string | boolean>,
  ) {
    setValores((v) => {
      const siguiente = { ...v, [campo]: valor } as CamposTecnicosValores;
      if (campo === "tipo") {
        if (typeof valor === "string" && claveTipoRemolque(valor) === "baqueton" && v.alturasDistintas) {
          siguiente.altoDelante = "";
          siguiente.altoAtras = "";
          siguiente.alturasDistintas = false;
        }
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
    setConfirmarDuplicado(false);
  }

  async function completarClienteDesdePedido() {
    const pedido = normalizarNumeroPedido(numero);
    if (!pedido) return;
    setAvisoRps("Buscando cliente en RPS…");
    try {
      const response = await fetch(`/api/rps/pedido?numero=${encodeURIComponent(pedido)}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Error consultando RPS");
      if (!payload.cliente) {
        setAvisoRps("RPS no encontró ese número de pedido.");
        setPedidoRps(null);
        return;
      }
      const local = await dbService.getOrCreateClienteRps(payload.cliente.codigo, payload.cliente.nombre, payload.cliente.alias);
      await cat.recargarClientes();
      setClienteId(local.id);
      setPedidoRps(payload.pedido ?? null);
      setAvisoRps([payload.cliente.codigo, payload.cliente.alias, payload.cliente.nombre].filter(Boolean).join(" · "));
    } catch (e) {
      setAvisoRps(e instanceof Error ? e.message : "No se pudo consultar RPS");
    }
  }

  function aplicarLineaRps(linea: NonNullable<typeof pedidoRps>["lineas"][number]) {
    const familiaDestino = cat.familias.find((familia) => familia.nombre === linea.familia);
    if (familiaDestino) setFamiliaId(familiaDestino.id);
    setValores({
      ...camposTecnicosVacios,
      tipo: linea.tipo,
      largo: linea.largo === null ? "" : String(linea.largo).replace(".", ","),
      ancho: linea.ancho === null ? "" : String(linea.ancho).replace(".", ","),
      alto: linea.alto === null ? "" : String(linea.alto).replace(".", ","),
      altoDelante: linea.altoDelante === null ? "" : String(linea.altoDelante).replace(".", ","),
      altoAtras: linea.altoAtras === null ? "" : String(linea.altoAtras).replace(".", ","),
      alturasDistintas: linea.altoDelante !== null || linea.altoAtras !== null,
      aguas: linea.aguas === null ? "" : String(linea.aguas).replace(".", ","),
      aguasActivas: linea.aguas !== null,
    });
    if (pedidoRps?.fecha) setFecha(pedidoRps.fecha);
    if (linea.detalle) setObservaciones(linea.detalle);
    setLineaRpsSeleccionada({ numeroLinea: linea.numeroLinea, progresoPlanteo: linea.progresoPlanteo });
    setConfirmarDuplicado(false);
  }

  useEffect(() => {
    const pedidoInicial = searchParams.get("pedido");
    const lineaInicial = Number(searchParams.get("linea"));
    if (!pedidoInicial || !Number.isFinite(lineaInicial) || catalogosCargando || importacionInicialRps.current) return;
    importacionInicialRps.current = true;
    let activo = true;
    setAvisoRps("Cargando la línea seleccionada desde RPS…");
    void (async () => {
      try {
        const response = await fetch(`/api/rps/pedido?numero=${encodeURIComponent(pedidoInicial)}`);
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Error consultando RPS");
        const linea = payload.pedido?.lineas?.find((item: { numeroLinea: number }) => item.numeroLinea === lineaInicial);
        if (!payload.cliente || !linea) throw new Error("RPS ya no encuentra la línea seleccionada.");
        const local = await dbService.getOrCreateClienteRps(payload.cliente.codigo, payload.cliente.nombre, payload.cliente.alias);
        await recargarClientes();
        if (!activo) return;
        const familiaDestino = familiasCatalogo.find((familia) => familia.nombre === linea.familia);
        setClienteId(local.id);
        setPedidoRps(payload.pedido);
        setAvisoRps([payload.cliente.codigo, payload.cliente.alias, payload.cliente.nombre].filter(Boolean).join(" · "));
        if (familiaDestino) setFamiliaId(familiaDestino.id);
        setValores({
          ...camposTecnicosVacios,
          tipo: linea.tipo,
          largo: linea.largo === null ? "" : String(linea.largo).replace(".", ","),
          ancho: linea.ancho === null ? "" : String(linea.ancho).replace(".", ","),
          alto: linea.alto === null ? "" : String(linea.alto).replace(".", ","),
          altoDelante: linea.altoDelante === null ? "" : String(linea.altoDelante).replace(".", ","),
          altoAtras: linea.altoAtras === null ? "" : String(linea.altoAtras).replace(".", ","),
          alturasDistintas: linea.altoDelante !== null || linea.altoAtras !== null,
          aguas: linea.aguas === null ? "" : String(linea.aguas).replace(".", ","),
          aguasActivas: linea.aguas !== null,
        });
        if (payload.pedido.fecha) setFecha(payload.pedido.fecha);
        if (linea.detalle) setObservaciones(linea.detalle);
        setLineaRpsSeleccionada({ numeroLinea: linea.numeroLinea, progresoPlanteo: linea.progresoPlanteo });
      } catch (cause) {
        if (activo) setAvisoRps(cause instanceof Error ? cause.message : "No se pudo consultar RPS");
      }
    })();
    return () => { activo = false; };
  }, [catalogosCargando, familiasCatalogo, recargarClientes, searchParams]);

  const faltantesGuardar: string[] = [];
  if (!numero.trim()) faltantesGuardar.push("número de pedido");
  if (!clienteId) faltantesGuardar.push("cliente");
  if (!familiaId) faltantesGuardar.push("familia");
  if (!completos) faltantesGuardar.push("datos técnicos obligatorios");
  const formularioListo = faltantesGuardar.length === 0;
  const puedeGuardar = formularioListo
    && !guardando
    && (!avisoNumero || confirmarNumero);

  async function guardar() {
    setError(null);
    setOkMsg(null);

    const numeroNorm = normalizarNumeroPedido(numero);

    // 1. Comprobar número de pedido ya existente (aviso, no bloqueo).
    if (!confirmarNumero) {
      try {
        const existeNumero = await dbService.getPedidoByNumero(numeroNorm);
        if (existeNumero) {
          setAvisoNumero(
            `El número ${numeroNorm} ya existe (mismo pedido con otra medida). Pulsa de nuevo para añadirlo igualmente.`,
          );
          setConfirmarNumero(true);
          setGuardando(false);
          return;
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error comprobando el número");
        setGuardando(false);
        return;
      }
    }

    // 2. Comprobar duplicado técnico (ya calculado). Requiere confirmación.
    if (duplicadoTecnico && !confirmarDuplicado) {
      setConfirmarDuplicado(true);
      return;
    }

    setGuardando(true);
    try {
      const tecnicos = camposTecnicosParaGuardar(familiaNombre, valores);
      await dbService.createPedido({
        numero_pedido: numeroNorm,
        cliente_id: clienteId!,
        familia_id: familiaId,
        fecha: fecha || null,
        tecnico_id: tecnicoId || null,
        observaciones: observaciones.trim() || null,
        estado_planteo: "REALIZADO",
        estado_planteo_manual: true,
        rps_numero_linea: lineaRpsSeleccionada?.numeroLinea ?? null,
        rps_planteo_progreso: lineaRpsSeleccionada?.progresoPlanteo ?? null,
        ...tecnicos,
      });
      setOkMsg(`Pedido ${numeroNorm} guardado correctamente.`);
      // Limpia el formulario salvo familia/cliente para encadenar altas.
      setNumero("");
      setValores(camposTecnicosVacios);
      setObservaciones("");
      setLineaRpsSeleccionada(null);
      setConfirmarDuplicado(false);
      setPedidosCliente(
        await dbService.getPedidosPorClienteFamilia(clienteId!, familiaId),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar el pedido");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div>
      <PageTitle
        title="Nuevo pedido"
        subtitle="Registra un pedido realizado. Se avisa si ya existe uno igual."
        actions={
          <Button variant="secondary" onClick={irAlHistorico}>
            Ver histórico
          </Button>
        }
      />

      {cat.error && (
        <div className="mb-4">
          <Banner tone="warning">{cat.error}</Banner>
        </div>
      )}
      {error && (
        <div className="mb-4">
          <Banner tone="warning">{error}</Banner>
        </div>
      )}
      {okMsg && (
        <div className="mb-4">
          <Banner tone="success">{okMsg}</Banner>
        </div>
      )}

      <Card className="mb-4">
        <Field label="¿Qué vas a registrar? *">
          <SelectControl
            value={familiaId}
            onChange={cambiarFamilia}
            placeholder="— Selecciona una familia —"
            options={familiasOrdenadas.map((family) => ({ value: family.id, label: family.nombre }))}
          />
        </Field>
      </Card>

      {familiaNombre && <Card className="mb-5">
        <div className="space-y-4">
          <section>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-app-muted">
              Pedido y cliente
            </p>
            <div className="grid gap-3 lg:grid-cols-[minmax(190px,0.8fr)_minmax(260px,1.25fr)]">
              <Field
                label="Número de pedido *"
                hint={!formatoNumeroOk ? AVISO_FORMATO_PEDIDO : "Ej. AR2600000"}
              >
                <input
                  className={`${inputClass} font-mono ${
                    !formatoNumeroOk ? "border-amber-400" : ""
                  }`}
                  value={numero}
                  onChange={(e) => {
                    setNumero(e.target.value.toUpperCase());
                    setConfirmarNumero(false);
                    setAvisoNumero(null);
                    setAvisoRps(null);
                    setPedidoRps(null);
                    setLineaRpsSeleccionada(null);
                  }}
                  onBlur={completarClienteDesdePedido}
                  placeholder="AR2600000"
                />
              </Field>
              <ClienteSelect
                clientes={clientesDisponibles}
                value={clienteId}
                onChange={cambiarCliente}
                onClienteCreado={() => cat.recargarClientes()}
              />
              {avisoRps && (
                <div className="flex items-center gap-2 rounded-[10px] border border-sky-400/15 bg-sky-400/[0.06] px-2.5 py-2 text-xs text-app-muted lg:col-span-2">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" />
                  <span><span className="font-semibold text-app-text">RPS:</span> {avisoRps}</span>
                </div>
              )}
            </div>
          </section>

          {pedidoRps && pedidoRps.lineas.length > 0 && (
            <section className="border-t border-[var(--border)] pt-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-app-muted">Líneas encontradas en RPS</p>
                  <p className="mt-0.5 text-xs text-app-muted">Selecciona la línea que quieres registrar.</p>
                </div>
                <span className="rounded-lg border border-[var(--border)] bg-surface-2 px-2 py-1 font-mono text-xs font-semibold text-app-text">{pedidoRps.numero}</span>
              </div>
              <div className="space-y-2">
                {pedidoRps.lineas.map((linea) => {
                  const seleccionada = lineaRpsSeleccionada?.numeroLinea === linea.numeroLinea;
                  return (
                  <div
                    key={linea.numeroLinea}
                    className={`rounded-xl border p-3 transition-colors ${seleccionada
                      ? "border-orange-400/50 bg-orange-500/[0.06] shadow-[inset_3px_0_0_#fb923c]"
                      : "border-[var(--border)] bg-surface-2/55"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-app-text">Línea {linea.numeroLinea} · {linea.tipo}</span>
                          {linea.requiereRevision && <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-700 dark:text-amber-300">Revisar</span>}
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${linea.estadoPlanteo === "REALIZADO" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-amber-500/15 text-amber-700 dark:text-amber-300"}`}>
                            {linea.estadoPlanteo === "REALIZADO" ? "Planteado" : linea.estadoPlanteo === "PENDIENTE" ? "Pendiente" : "Sin tarea RPS"}
                          </span>
                        </div>
                        <p className="mt-1 font-mono text-sm font-semibold text-brand">
                          {[linea.largo, linea.ancho, linea.alto ?? (linea.altoDelante !== null || linea.altoAtras !== null ? `${linea.altoDelante ?? "—"}/${linea.altoAtras ?? "—"}` : null)].filter((value) => value !== null).join(" × ")} cm
                          {linea.aguas !== null && <span className="ml-2 font-sans text-xs font-normal text-app-muted">(alto base {linea.altoBase} + aguas {linea.aguas})</span>}
                        </p>
                      </div>
                      <Button
                        variant={seleccionada ? "primary" : "secondary"}
                        className="shrink-0"
                        onClick={() => aplicarLineaRps(linea)}
                        aria-pressed={seleccionada}
                      >
                        {seleccionada ? "✓ Datos aplicados" : "Usar esta línea"}
                      </Button>
                    </div>
                    <p className="mt-2 line-clamp-3 text-xs leading-5 text-app-muted" title={linea.detalle}>{linea.detalle || linea.descripcion}</p>
                  </div>
                  );
                })}
              </div>
            </section>
          )}

          {familiaNombre && (
            <section className="border-t border-[var(--border)] pt-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-app-muted">
                Datos técnicos
              </p>
              <CamposTecnicosFamilia
                familiaNombre={familiaNombre}
                valores={valores}
                onChange={setCampo}
                tiposPuerta={cat.tiposPuerta}
                tiposRemolque={cat.tiposRemolque}
                freeInput
              />
            </section>
          )}

          <section className="border-t border-[var(--border)] pt-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-app-muted">
              Planificación
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(170px,0.7fr)_minmax(220px,1fr)]">
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
                    ...cat.tecnicos.map((t) => ({ value: t.id, label: t.nombre })),
                  ]}
                />
              </Field>
            </div>
          </section>

          <section className="border-t border-[var(--border)] pt-4">
            <Field label="Observaciones">
              <textarea
                className={`${inputClass} min-h-16 resize-y`}
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Notas opcionales"
              />
            </Field>
          </section>

          {avisoNumero && <Banner tone="warning">{avisoNumero}</Banner>}

          {duplicadoTecnico && (
            <Banner tone="warning">
              Ya existe un pedido técnicamente igual: <span className="font-mono font-semibold">{duplicadoTecnico.numero_pedido}</span>{" "}
              ({resumenMedidas(duplicadoTecnico, familiaNombre)}).
              {confirmarDuplicado
                ? " Pulsa Guardar igualmente para registrarlo."
                : " Confirma antes de guardarlo nuevamente."}
            </Banner>
          )}

          <section className="-mx-3 -mb-3 flex items-center justify-between gap-4 border-t border-[var(--border)] bg-surface-2/35 px-3 py-3">
            <div className="min-w-0">
              <p className={`text-sm font-semibold ${formularioListo ? "text-emerald-700 dark:text-emerald-300" : "text-app-text"}`}>
                {formularioListo ? "Listo para guardar" : `Falta: ${faltantesGuardar.join(", ")}`}
              </p>
              <p className="mt-0.5 text-xs text-app-muted">
                {lineaRpsSeleccionada
                  ? `Se guardará vinculada a la línea ${lineaRpsSeleccionada.numeroLinea} de RPS.`
                  : "Radio, recogidas y observaciones pueden quedar vacíos."}
              </p>
            </div>
            <Button className="min-w-[168px] shrink-0" onClick={guardar} disabled={!puedeGuardar}>
              {guardando
                ? "Guardando…"
                : duplicadoTecnico && !confirmarDuplicado
                  ? "Confirmar duplicado"
                  : duplicadoTecnico && confirmarDuplicado
                    ? "Guardar igualmente"
                    : "Guardar pedido"}
            </Button>
          </section>
        </div>
      </Card>}
    </div>
  );
}

export default function NuevoPedidoPage() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-sm text-app-muted">Cargando formulario…</div>}>
      <NuevoPedidoPageContent />
    </Suspense>
  );
}
