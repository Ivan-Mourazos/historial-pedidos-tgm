import "server-only";
import { getPool, SCHEMA, sql } from "./db/sqlserver";
import { dbServer } from "./db/server-service";
import { pedidosRpsDesde, type LineaPedidoRps, type PedidoPendienteRps } from "./rps-clientes";
import type { PedidoInput } from "./types";

export interface ResumenPendientesRps {
  fechaDesde: string;
  pendientes: Array<PedidoPendienteRps & { coincideCon: string | null }>;
  totalLineasRps: number;
  totalRegistradas: number;
  totalImportables: number;
  estadosActualizados: number;
}

export interface ResultadoImportacionRps {
  importados: number;
  pendientesRevision: number;
  fechaDesde: string;
}

interface CachePendientesRps {
  value?: ResumenPendientesRps;
  expiresAt: number;
  consulta?: Promise<ResumenPendientesRps>;
  sincronizacion?: Promise<ResumenPendientesRps>;
}

const CACHE_PENDIENTES_MS = 5 * 60 * 1000;
const globalPendientes = globalThis as typeof globalThis & {
  __cachePendientesRps?: CachePendientesRps;
};
const cachePendientes = globalPendientes.__cachePendientesRps ??= { expiresAt: 0 };

interface LineaLocal {
  id: string;
  numero: string;
  familia: string;
  tipo: string | null;
  largo: number | null;
  ancho: number | null;
  alto: number | null;
  altoDelante: number | null;
  altoAtras: number | null;
  aguas: number | null;
  estadoPlanteo: "PENDIENTE" | "REALIZADO";
  estadoManual: boolean;
  rpsNumeroLinea: number | null;
  rpsProgreso: number | null;
}

interface ActualizacionEstadoRps {
  id: string;
  numeroLinea: number;
  progreso: number | null;
}

const normalizarNumero = (value: string) => value.toLocaleUpperCase("es-ES").replace(/[^A-Z0-9]/g, "");
const normalizarTipo = (value: string | null) => (value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-ES").trim();
const medida = (value: unknown): number | null => value === null || value === undefined ? null : Number(value);
const iguales = (a: number | null, b: number | null) => a === null || b === null ? a === b : Math.abs(a - b) < 0.01;
const medidaClave = (value: number | null) => value === null ? "—" : (Math.round(value * 100) / 100).toFixed(2);

function firmaTecnica(linea: Pick<LineaPedidoRps | LineaLocal, "familia" | "tipo" | "largo" | "ancho" | "alto" | "altoDelante" | "altoAtras" | "aguas">): string {
  return [
    linea.familia,
    normalizarTipo(linea.tipo),
    medidaClave(linea.largo),
    medidaClave(linea.ancho),
    medidaClave(linea.alto),
    medidaClave(linea.altoDelante),
    medidaClave(linea.altoAtras),
    medidaClave(linea.aguas),
  ].join("|");
}

function puntuacion(linea: LineaPedidoRps, local: LineaLocal): number {
  let score = normalizarTipo(linea.tipo) === normalizarTipo(local.tipo) ? 0 : 1000;
  for (const [rps, valorLocal] of [[linea.largo, local.largo], [linea.ancho, local.ancho], [linea.alto, local.alto], [linea.altoDelante, local.altoDelante], [linea.altoAtras, local.altoAtras], [linea.aguas, local.aguas]] as const) {
    if (iguales(rps, valorLocal)) continue;
    if (rps === null || valorLocal === null) score += 500;
    else score += Math.abs(rps - valorLocal);
  }
  return score;
}

function esImportable(linea: PedidoPendienteRps): boolean {
  if (linea.requiereRevision || !linea.tipo.trim()) return false;
  if (linea.familia === "REMOLQUES") {
    const alturaCompleta = linea.alto !== null || (linea.altoDelante !== null && linea.altoAtras !== null);
    return linea.largo !== null && linea.ancho !== null && alturaCompleta;
  }
  return linea.ancho !== null && linea.alto !== null;
}

function estadoDesdeRps(linea: LineaPedidoRps): "PENDIENTE" | "REALIZADO" | null {
  if (linea.progresoPlanteo === null) return null;
  return linea.progresoPlanteo >= 100 ? "REALIZADO" : "PENDIENTE";
}

async function guardarEstadosRps(actualizaciones: ActualizacionEstadoRps[]): Promise<number> {
  if (actualizaciones.length === 0) return 0;
  const pool = await getPool();
  // SQL Server 2014 no dispone de OPENJSON. Actualizamos cada relación dentro
  // de una única transacción para mantener la operación atómica y compatible.
  const unicas = [...new Map(actualizaciones.map((item) => [item.id, item])).values()];
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  let actualizadas = 0;
  try {
    for (const actualizacion of unicas) {
      const result = await new sql.Request(transaction)
        .input("id", sql.UniqueIdentifier, actualizacion.id)
        .input("numeroLinea", sql.Int, actualizacion.numeroLinea)
        .input("progreso", sql.Decimal(5, 2), actualizacion.progreso)
        .query(`UPDATE ${SCHEMA}.pedidos
      SET rps_numero_linea = @numeroLinea,
          rps_planteo_progreso = @progreso,
          estado_planteo = CASE
            WHEN estado_planteo_manual = 1 OR @progreso IS NULL THEN estado_planteo
            WHEN @progreso >= 100 THEN 'REALIZADO'
            ELSE 'PENDIENTE'
          END,
          updated_at = SYSDATETIMEOFFSET()
      WHERE id = @id
        AND (
          ISNULL(rps_numero_linea, -1) <> ISNULL(@numeroLinea, -1)
         OR ISNULL(rps_planteo_progreso, -1) <> ISNULL(@progreso, -1)
         OR (
           estado_planteo_manual = 0 AND @progreso IS NOT NULL
           AND estado_planteo <> CASE WHEN @progreso >= 100 THEN 'REALIZADO' ELSE 'PENDIENTE' END
         )
        )`);
      actualizadas += result.rowsAffected[0] ?? 0;
    }
    await transaction.commit();
    return actualizadas;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function calcularPendientesRps(sincronizarEstados: boolean): Promise<ResumenPendientesRps> {
  const pool = await getPool();
  const inicioResult = await pool.request().query(
    `SELECT TOP 1 UPPER(REPLACE(REPLACE(numero_pedido, '.', ''), ' ', '')) AS numero
     FROM ${SCHEMA}.pedidos
     WHERE UPPER(REPLACE(REPLACE(numero_pedido, '.', ''), ' ', '')) LIKE 'AR[0-9][0-9]%'
     ORDER BY UPPER(REPLACE(REPLACE(numero_pedido, '.', ''), ' ', '')) ASC`,
  );
  const numeroArMasAntiguo = String(inicioResult.recordset[0]?.numero ?? "");
  const anioPedido = numeroArMasAntiguo.match(/^AR(\d{2})/)?.[1];
  const fechaDesde = anioPedido ? `20${anioPedido}-01-01` : new Date().toISOString().slice(0, 10);
  const [pedidosRps, localesResult] = await Promise.all([
    pedidosRpsDesde(fechaDesde),
    pool.request().query(`SELECT p.id, p.numero_pedido AS numero, f.nombre AS familia, p.tipo,
        p.largo, p.ancho, p.alto, p.alto_delante, p.alto_atras, p.aguas, p.estado_planteo,
        p.estado_planteo_manual, p.rps_numero_linea, p.rps_planteo_progreso
      FROM ${SCHEMA}.pedidos p
      INNER JOIN ${SCHEMA}.familias f ON f.id = p.familia_id`),
  ]);

  const localesPorPedido = new Map<string, LineaLocal[]>();
  for (const row of localesResult.recordset as Array<Record<string, unknown>>) {
    const local: LineaLocal = {
      id: String(row.id),
      numero: String(row.numero ?? ""),
      familia: String(row.familia ?? ""),
      tipo: row.tipo === null ? null : String(row.tipo),
      largo: medida(row.largo),
      ancho: medida(row.ancho),
      alto: medida(row.alto),
      altoDelante: medida(row.alto_delante),
      altoAtras: medida(row.alto_atras),
      aguas: medida(row.aguas),
      estadoPlanteo: row.estado_planteo === "PENDIENTE" ? "PENDIENTE" : "REALIZADO",
      estadoManual: Boolean(row.estado_planteo_manual),
      rpsNumeroLinea: medida(row.rps_numero_linea),
      rpsProgreso: medida(row.rps_planteo_progreso),
    };
    const key = `${normalizarNumero(local.numero)}|${local.familia}`;
    const grupo = localesPorPedido.get(key);
    if (grupo) grupo.push(local);
    else localesPorPedido.set(key, [local]);
  }

  const pendientesBase: PedidoPendienteRps[] = [];
  const actualizaciones: ActualizacionEstadoRps[] = [];
  let totalLineasRps = 0;
  let totalRegistradas = 0;
  const relacionar = (linea: LineaPedidoRps, local: LineaLocal) => {
    const estadoRps = estadoDesdeRps(linea);
    const necesitaActualizacion = local.rpsNumeroLinea !== linea.numeroLinea
      || !iguales(local.rpsProgreso, linea.progresoPlanteo)
      || (!local.estadoManual && estadoRps !== null && local.estadoPlanteo !== estadoRps);
    local.rpsNumeroLinea = linea.numeroLinea;
    local.rpsProgreso = linea.progresoPlanteo;
    if (!local.estadoManual && estadoRps) local.estadoPlanteo = estadoRps;
    if (sincronizarEstados && necesitaActualizacion) {
      actualizaciones.push({ id: local.id, numeroLinea: linea.numeroLinea, progreso: linea.progresoPlanteo });
    }
  };
  for (const pedido of pedidosRps) {
    for (const familia of ["REMOLQUES", "PUERTAS"] as const) {
      const lineas = pedido.lineas.filter((linea) => linea.familia === familia);
      if (lineas.length === 0) continue;
      totalLineasRps += lineas.length;
      const disponibles = [...(localesPorPedido.get(`${normalizarNumero(pedido.numero)}|${familia}`) ?? [])];
      const sinCoincidenciaExacta: LineaPedidoRps[] = [];
      for (const linea of lineas) {
        const indiceVinculado = disponibles.findIndex((local) => local.rpsNumeroLinea === linea.numeroLinea);
        const indiceExacto = indiceVinculado >= 0
          ? indiceVinculado
          : disponibles.findIndex((local) => puntuacion(linea, local) === 0);
        if (indiceExacto >= 0) {
          const [local] = disponibles.splice(indiceExacto, 1);
          relacionar(linea, local);
          totalRegistradas += 1;
        } else {
          sinCoincidenciaExacta.push(linea);
        }
      }
      for (const linea of sinCoincidenciaExacta) {
        if (disponibles.length === 0) {
          pendientesBase.push({ ...linea, numero: pedido.numero, fecha: pedido.fecha, cliente: pedido.cliente });
          continue;
        }
        let mejorIndice = 0;
        let mejorPuntuacion = puntuacion(linea, disponibles[0]);
        for (let index = 1; index < disponibles.length; index += 1) {
          const actual = puntuacion(linea, disponibles[index]);
          if (actual < mejorPuntuacion) {
            mejorIndice = index;
            mejorPuntuacion = actual;
          }
        }
        const [local] = disponibles.splice(mejorIndice, 1);
        relacionar(linea, local);
        totalRegistradas += 1;
      }
    }
  }

  const todosLocales = [...localesPorPedido.values()].flat();
  const estadosActualizados = sincronizarEstados ? await guardarEstadosRps(actualizaciones) : 0;
  const localesRealizados = todosLocales.filter((local) => local.estadoPlanteo === "REALIZADO");
  const realizadosPorFirma = new Map<string, LineaLocal[]>();
  for (const local of localesRealizados) {
    const firma = firmaTecnica(local);
    const grupo = realizadosPorFirma.get(firma);
    if (grupo) grupo.push(local);
    else realizadosPorFirma.set(firma, [local]);
  }
  const pendientes = pendientesBase.map((pendiente) => {
    const numeroPendiente = normalizarNumero(pendiente.numero);
    const coincidencia = realizadosPorFirma.get(firmaTecnica(pendiente))
      ?.find((local) => normalizarNumero(local.numero) !== numeroPendiente);
    return { ...pendiente, coincideCon: coincidencia?.numero ?? null };
  });

  return {
    fechaDesde,
    pendientes,
    totalLineasRps,
    totalRegistradas,
    totalImportables: pendientes.filter(esImportable).length,
    estadosActualizados,
  };
}

export async function obtenerPendientesRps(sincronizarEstados = false): Promise<ResumenPendientesRps> {
  if (!sincronizarEstados && cachePendientes.value && cachePendientes.expiresAt > Date.now()) {
    return cachePendientes.value;
  }

  if (sincronizarEstados) {
    if (cachePendientes.sincronizacion) return cachePendientes.sincronizacion;
    const sincronizacion = calcularPendientesRps(true);
    cachePendientes.sincronizacion = sincronizacion;
    try {
      const value = await sincronizacion;
      cachePendientes.value = value;
      cachePendientes.expiresAt = Date.now() + CACHE_PENDIENTES_MS;
      return value;
    } finally {
      if (cachePendientes.sincronizacion === sincronizacion) cachePendientes.sincronizacion = undefined;
    }
  }

  if (cachePendientes.sincronizacion) return cachePendientes.sincronizacion;
  if (cachePendientes.consulta) return cachePendientes.consulta;
  const consulta = calcularPendientesRps(false);
  cachePendientes.consulta = consulta;
  try {
    const value = await consulta;
    cachePendientes.value = value;
    cachePendientes.expiresAt = Date.now() + CACHE_PENDIENTES_MS;
    return value;
  } finally {
    if (cachePendientes.consulta === consulta) cachePendientes.consulta = undefined;
  }
}

export async function importarPendientesRps(): Promise<ResultadoImportacionRps> {
  const resumen = await obtenerPendientesRps(true);
  const importables = resumen.pendientes.filter(esImportable);
  const familias = await dbServer.getFamilias();
  const familiaPorNombre = new Map(familias.map((familia) => [familia.nombre, familia.id]));
  const clientesUnicos = new Map<string, { codigo: string; nombre: string; alias: string | null }>();
  for (const linea of importables) clientesUnicos.set(linea.cliente.codigo, linea.cliente);

  const clienteIdPorCodigo = new Map<string, string>();
  for (const cliente of clientesUnicos.values()) {
    const local = await dbServer.getOrCreateClienteRps(cliente.codigo, cliente.nombre, cliente.alias);
    clienteIdPorCodigo.set(cliente.codigo, local.id);
  }

  let importados = 0;
  const tamanoLote = 8;
  for (let inicio = 0; inicio < importables.length; inicio += tamanoLote) {
    const lote = importables.slice(inicio, inicio + tamanoLote);
    await Promise.all(lote.map(async (linea) => {
      const familiaId = familiaPorNombre.get(linea.familia);
      const clienteId = clienteIdPorCodigo.get(linea.cliente.codigo);
      if (!familiaId || !clienteId) throw new Error(`No se pudo relacionar ${linea.numero}, línea ${linea.numeroLinea}.`);
      const pedido = {
        numero_pedido: normalizarNumero(linea.numero),
        cliente_id: clienteId,
        familia_id: familiaId,
        tipo: linea.tipo,
        largo: linea.familia === "REMOLQUES" ? linea.largo : null,
        ancho: linea.ancho,
        alto: linea.alto,
        alto_delante: linea.altoDelante,
        alto_atras: linea.altoAtras,
        aguas: linea.familia === "REMOLQUES" ? linea.aguas : null,
        radio: null,
        impresion_digital: false,
        fecha: linea.fecha,
        tecnico_id: null,
        observaciones: linea.detalle || linea.descripcion || null,
        estado_planteo: linea.estadoPlanteo === "REALIZADO" ? "REALIZADO" : "PENDIENTE",
        estado_planteo_manual: false,
        rps_numero_linea: linea.numeroLinea,
        rps_planteo_progreso: linea.progresoPlanteo,
      } as PedidoInput;
      await dbServer.createPedido(pedido);
      importados += 1;
    }));
  }

  cachePendientes.value = undefined;
  cachePendientes.expiresAt = 0;

  return {
    importados,
    pendientesRevision: resumen.pendientes.length - importables.length,
    fechaDesde: resumen.fechaDesde,
  };
}
