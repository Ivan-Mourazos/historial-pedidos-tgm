"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Banner, Button, Card, PageTitle, SelectControl, inputClass } from "@/components/ui";
import { formatNombreEmpresa } from "@/lib/display";

interface Pendiente {
  numero: string;
  fecha: string | null;
  cliente: { codigo: string; nombre: string; alias: string | null };
  numeroLinea: number;
  familia: "REMOLQUES" | "PUERTAS";
  tipo: string;
  largo: number | null;
  ancho: number | null;
  alto: number | null;
  altoDelante: number | null;
  altoAtras: number | null;
  aguas: number | null;
  descripcion: string;
  detalle: string;
  requiereRevision: boolean;
  coincideCon: string | null;
  progresoPlanteo: number | null;
  estadoPlanteo: "PENDIENTE" | "REALIZADO" | "SIN_TAREA";
  archivoCad: boolean;
  archivoExcel: boolean;
  registrado: boolean;
  datosCompletos: boolean;
  motivosRevision: string[];
  situacion: "SIN_ARCHIVO" | "REVISAR_DATOS" | "LISTO_HISTORICO";
}

interface Resumen {
  fechaDesde: string;
  pendientes: Pendiente[];
  totalLineasRps: number;
  totalRegistradas: number;
  totalImportables: number;
  estadosActualizados: number;
}

const normalizar = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-ES");
const fecha = (value: string | null) => value ? new Date(`${value}T00:00:00`).toLocaleDateString("es-ES") : "—";
const medida = (value: number | null) => value === null ? "—" : String(value).replace(".", ",");
const TAMANO_PAGINA = 50;

function medidas(pendiente: Pendiente) {
  const altura = pendiente.alto ?? (pendiente.altoDelante !== null || pendiente.altoAtras !== null
    ? `${medida(pendiente.altoDelante)}/${medida(pendiente.altoAtras)}`
    : null);
  const valores = pendiente.familia === "REMOLQUES"
    ? [pendiente.largo, pendiente.ancho, altura]
    : [pendiente.ancho, pendiente.alto];
  const dimensiones = valores.map((value) => typeof value === "string" ? value : medida(value)).join(" × ");
  return pendiente.aguas === null ? dimensiones : `${dimensiones} · Aguas ${medida(pendiente.aguas)}`;
}

export default function PendientesPage() {
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [familia, setFamilia] = useState<"TODOS" | "REMOLQUES" | "PUERTAS">("TODOS");
  const [estado, setEstado] = useState<"TODOS" | "SIN_ARCHIVO" | "REVISAR_DATOS" | "LISTO_HISTORICO">("TODOS");
  const [buscar, setBuscar] = useState("");
  const [pagina, setPagina] = useState(1);
  const [importando, setImportando] = useState(false);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [modoCompleto, setModoCompleto] = useState(false);

  async function cargar(completo: boolean) {
    setCargando(true);
    setError(null);
    setModoCompleto(completo);
    try {
      const response = await fetch("/api/rps/pendientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ accion: completo ? "ESCANEO_COMPLETO" : "SINCRONIZAR" }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "No se pudo consultar RPS.");
      setResumen(payload);
      if (payload.estadosActualizados > 0) {
        setOkMsg(`${payload.estadosActualizados} estados de planteo actualizados desde RPS.`);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo consultar RPS.");
    } finally {
      setCargando(false);
    }
  }

  async function importarSeguros() {
    setImportando(true);
    setError(null);
    setOkMsg(null);
    try {
      const response = await fetch("/api/rps/pendientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmar: "IMPORTAR", completo: modoCompleto }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "No se pudieron registrar los pedidos.");
      setOkMsg(`${payload.importados} pedidos verificados añadidos al histórico. ${payload.pendientesRevision} continúan pendientes.`);
      await cargar(modoCompleto);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudieron registrar los pedidos.");
    } finally {
      setImportando(false);
    }
  }

  useEffect(() => {
    let activo = true;
    void fetch("/api/rps/pendientes", {
      method: "GET",
      cache: "no-store",
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "No se pudo consultar RPS.");
        if (activo) setResumen(payload);
      })
      .catch((cause) => {
        if (activo) setError(cause instanceof Error ? cause.message : "No se pudo consultar RPS.");
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => { activo = false; };
  }, []);

  const filtrados = useMemo(() => {
    const query = normalizar(buscar.trim());
    return (resumen?.pendientes ?? []).filter((pendiente) => {
      if (familia !== "TODOS" && pendiente.familia !== familia) return false;
      if (estado !== "TODOS" && pendiente.situacion !== estado) return false;
      if (!query) return true;
      return normalizar([
        pendiente.numero, pendiente.cliente.codigo, pendiente.cliente.alias ?? "", pendiente.cliente.nombre,
        pendiente.tipo, medidas(pendiente), pendiente.detalle, ...pendiente.motivosRevision,
      ].join(" ")).includes(query);
    });
  }, [buscar, estado, familia, resumen]);
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / TAMANO_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const visibles = filtrados.slice((paginaActual - 1) * TAMANO_PAGINA, paginaActual * TAMANO_PAGINA);

  const inicio = resumen?.fechaDesde ? fecha(resumen.fechaDesde) : "el primer registro";
  const requierenRevision = resumen?.pendientes.filter((pendiente) => pendiente.situacion === "REVISAR_DATOS").length ?? 0;
  const sinArchivo = resumen?.pendientes.filter((pendiente) => pendiente.situacion === "SIN_ARCHIVO").length ?? 0;

  return (
    <div>
      <PageTitle
        title="Pendientes de RPS"
        subtitle={`Todos los trabajos de RPS que aún no están verificados en el histórico, desde ${inicio}.`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" disabled={cargando || importando} onClick={() => void cargar(false)}>{cargando && !modoCompleto ? "Actualizando…" : "Actualizar RPS"}</Button>
            <Button variant="secondary" disabled={cargando || importando} onClick={() => void cargar(true)} title="Recorre todo el histórico (más lento)">{cargando && modoCompleto ? "Escaneando…" : "Escaneo completo"}</Button>
            <Button disabled={cargando || importando || !resumen?.totalImportables} onClick={() => void importarSeguros()}>
              {importando ? "Verificando…" : `Pasar al histórico${resumen?.totalImportables ? ` (${resumen.totalImportables})` : ""}`}
            </Button>
          </div>
        }
      />

      {error && <div className="mb-4"><Banner tone="warning">{error}</Banner></div>}
      {okMsg && <div className="mb-4"><Banner tone="success">{okMsg}</Banner></div>}

      {!cargando && resumen && (
        <div className="mb-4 grid gap-2 sm:grid-cols-3">
          <button type="button" onClick={() => { setEstado("REVISAR_DATOS"); setPagina(1); }} className="rounded-[14px] border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-left transition-colors hover:bg-amber-400/15">
            <span className="block text-2xl font-bold tabular-nums text-amber-700 dark:text-amber-300">{requierenRevision}</span>
            <span className="text-xs font-semibold text-amber-800 dark:text-amber-200">Requieren revisión manual</span>
            <span className="mt-1 block text-[11px] text-app-muted">Tienen CAD o Excel, pero sus datos no son fiables o están incompletos.</span>
          </button>
          <button type="button" onClick={() => { setEstado("SIN_ARCHIVO"); setPagina(1); }} className="rounded-[14px] border border-white/10 bg-surface/70 px-4 py-3 text-left transition-colors hover:bg-surface-2">
            <span className="block text-2xl font-bold tabular-nums text-app-text">{sinArchivo}</span>
            <span className="text-xs font-semibold text-app-text">Esperando CAD o Excel</span>
            <span className="mt-1 block text-[11px] text-app-muted">No requieren revisar medidas todavía: no se consideran realizados.</span>
          </button>
          <div className="rounded-[14px] border border-emerald-400/20 bg-emerald-400/8 px-4 py-3">
            <span className="block text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300">{resumen.totalImportables}</span>
            <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">Listos para histórico</span>
            <span className="mt-1 block text-[11px] text-app-muted">Archivo encontrado y medidas completas.</span>
          </div>
        </div>
      )}

      <div className="mb-4 grid grid-cols-[minmax(280px,1fr)_auto_170px] gap-2">
        <input
          className={inputClass}
          value={buscar}
          onChange={(event) => { setBuscar(event.target.value); setPagina(1); }}
          placeholder="Buscar por pedido, cliente, código o medida…"
          aria-label="Buscar pedidos pendientes"
        />
        <div className="flex rounded-[12px] border border-[var(--border)] bg-surface p-0.5">
          {(["TODOS", "REMOLQUES", "PUERTAS"] as const).map((opcion) => (
            <button
              key={opcion}
              type="button"
              onClick={() => { setFamilia(opcion); setPagina(1); }}
              className={`h-8 rounded-[9px] px-3 text-xs font-semibold transition-colors ${familia === opcion ? "bg-brand text-white" : "text-app-muted hover:text-app-text"}`}
            >
              {opcion === "TODOS" ? "Todos" : opcion === "REMOLQUES" ? "Remolques" : "Puertas"}
            </button>
          ))}
        </div>
        <SelectControl
          value={estado}
          onChange={(value) => { setEstado(value as typeof estado); setPagina(1); }}
          options={[
            { value: "TODOS", label: "Todos los estados" },
            { value: "SIN_ARCHIVO", label: "Sin CAD ni Excel" },
            { value: "REVISAR_DATOS", label: "Archivo · revisar datos" },
            { value: "LISTO_HISTORICO", label: "Listos para histórico" },
          ]}
          placeholder="Estado"
        />
      </div>

      <Card className="overflow-hidden !p-0">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <p className="text-sm font-semibold text-app-text">
            {cargando ? "Comparando con el histórico…" : `${filtrados.length} pendiente${filtrados.length === 1 ? "" : "s"}`}
          </p>
          {resumen && (
            <p className="text-xs text-app-muted">
              {resumen.totalRegistradas} de {resumen.totalLineasRps} líneas relacionadas · {resumen.totalImportables} listas
            </p>
          )}
        </div>

        {!cargando && filtrados.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm font-semibold text-app-text">No quedan líneas pendientes con estos filtros.</p>
            <p className="mt-1 text-xs text-app-muted">{modoCompleto ? "Actualiza RPS para comprobar si han entrado nuevos pedidos." : "Se muestran los últimos meses. Usa “Escaneo completo” para revisar todo el histórico."}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-fixed border-collapse text-left">
              <colgroup>
                <col className="w-[14%]" />
                <col className="w-[21%]" />
                <col className="w-[16%]" />
                <col className="w-[14%]" />
                <col className="w-[20%]" />
                <col className="w-[15%]" />
              </colgroup>
              <thead className="bg-surface-2/70 text-[11px] uppercase tracking-wide text-app-muted">
                <tr>
                  <th className="px-4 py-2.5">Pedido / línea</th>
                  <th className="px-3 py-2.5">Cliente</th>
                  <th className="px-3 py-2.5">Trabajo</th>
                  <th className="px-3 py-2.5">Medidas</th>
                  <th className="px-3 py-2.5">Situación / motivo</th>
                  <th className="px-4 py-2.5 text-right">Acción</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((pendiente) => (
                  <tr key={`${pendiente.numero}-${pendiente.numeroLinea}`} className={`border-t border-[var(--border)] transition-colors hover:bg-surface-2/60 ${pendiente.situacion === "REVISAR_DATOS" ? "shadow-[inset_3px_0_0_#f59e0b]" : ""}`}>
                    <td className="px-4 py-3">
                      <p className="font-mono text-sm font-semibold text-app-text">{pendiente.numero}</p>
                      <p className="mt-0.5 text-xs text-app-muted">Línea {pendiente.numeroLinea}</p>
                      <p className="mt-1 text-[11px] text-app-muted">{fecha(pendiente.fecha)}</p>
                    </td>
                    <td className="px-3 py-3">
                      <p className="truncate text-sm font-medium text-app-text" title={formatNombreEmpresa(pendiente.cliente.alias ?? pendiente.cliente.nombre)}>{formatNombreEmpresa(pendiente.cliente.alias ?? pendiente.cliente.nombre)}</p>
                      {pendiente.cliente.alias && <p className="truncate text-xs text-app-muted" title={formatNombreEmpresa(pendiente.cliente.nombre)}>{formatNombreEmpresa(pendiente.cliente.nombre)}</p>}
                      <p className="mt-0.5 font-mono text-xs text-app-muted">{pendiente.cliente.codigo}</p>
                    </td>
                    <td className="px-3 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-app-muted">{pendiente.familia === "REMOLQUES" ? "Remolque" : "Puerta"}</p>
                      <div className="mt-1 flex min-w-0 items-center gap-1.5">
                        <span className="truncate text-sm font-medium text-app-text" title={pendiente.tipo}>{pendiente.tipo}</span>
                        {pendiente.situacion === "REVISAR_DATOS" && <span className="shrink-0 rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">Faltan datos</span>}
                      </div>
                    </td>
                    <td className="px-3 py-3 font-mono text-sm font-semibold text-app-text" title={medidas(pendiente)}>
                      <span className="block truncate">{medidas(pendiente)}</span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col items-start gap-1">
                        <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-semibold ${pendiente.situacion === "LISTO_HISTORICO" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : pendiente.situacion === "REVISAR_DATOS" ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" : "bg-slate-500/15 text-slate-600 dark:text-slate-300"}`}>
                          {pendiente.situacion === "LISTO_HISTORICO" ? "Listo para histórico" : pendiente.situacion === "REVISAR_DATOS" ? "Archivo · revisar datos" : "Sin archivo"}
                        </span>
                        {(pendiente.archivoCad || pendiente.archivoExcel) && (
                          <span className="text-[10px] font-medium text-app-muted">{[pendiente.archivoCad ? "CAD" : "", pendiente.archivoExcel ? "Excel" : ""].filter(Boolean).join(" + ")} encontrado</span>
                        )}
                        {pendiente.situacion === "REVISAR_DATOS" && (
                          <ul className="mt-1 space-y-0.5 text-[11px] leading-4 text-amber-800 dark:text-amber-200">
                            {pendiente.motivosRevision.map((motivo) => <li key={motivo}>• {motivo}</li>)}
                          </ul>
                        )}
                        {pendiente.coincideCon ? (
                          <span className="inline-flex max-w-full rounded-full bg-sky-400/15 px-2 py-1 text-[10px] font-semibold text-sky-700 dark:text-sky-300" title={`Coincide técnicamente con ${pendiente.coincideCon}`}>
                            <span className="truncate">Diseño {pendiente.coincideCon}</span>
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-orange-400/15 px-2 py-1 text-[10px] font-semibold text-orange-700 dark:text-orange-300">Sin registrar</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {pendiente.situacion === "REVISAR_DATOS" ? (
                        <Link href={`/nuevo?pedido=${encodeURIComponent(pendiente.numero)}&linea=${pendiente.numeroLinea}`} className="inline-flex h-8 items-center justify-center whitespace-nowrap rounded-[10px] bg-brand px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[var(--brand-hover)]">Revisar medidas</Link>
                      ) : pendiente.situacion === "LISTO_HISTORICO" ? (
                        <span className="text-xs font-medium text-emerald-600 dark:text-emerald-300">Listo</span>
                      ) : (
                        <span className="text-xs text-app-muted">Esperando archivo</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!cargando && totalPaginas > 1 && (
          <div className="flex items-center justify-between border-t border-[var(--border)] px-4 py-3">
            <p className="text-xs text-app-muted">
              Mostrando {(paginaActual - 1) * TAMANO_PAGINA + 1}–{Math.min(paginaActual * TAMANO_PAGINA, filtrados.length)} de {filtrados.length}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="secondary" disabled={paginaActual === 1} onClick={() => setPagina((actual) => Math.max(1, actual - 1))}>Anterior</Button>
              <span className="min-w-24 text-center text-xs font-medium text-app-muted">Página {paginaActual} de {totalPaginas}</span>
              <Button variant="secondary" disabled={paginaActual === totalPaginas} onClick={() => setPagina((actual) => Math.min(totalPaginas, actual + 1))}>Siguiente</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
