import "server-only";
import { getPool, SCHEMA } from "./db/sqlserver";
import { dbServer } from "./db/server-service";
import { pedidosRpsDesde, type LineaPedidoRps, type PedidoPendienteRps } from "./rps-clientes";
import type { PedidoInput } from "./types";

export interface ResumenPendientesRps {
  fechaDesde: string;
  pendientes: Array<PedidoPendienteRps & { coincideCon: string | null }>;
  totalLineasRps: number;
  totalRegistradas: number;
  totalImportables: number;
}

export interface ResultadoImportacionRps {
  importados: number;
  pendientesRevision: number;
  fechaDesde: string;
}

interface LineaLocal {
  numero: string;
  familia: string;
  tipo: string | null;
  largo: number | null;
  ancho: number | null;
  alto: number | null;
  aguas: number | null;
}

const normalizarNumero = (value: string) => value.toLocaleUpperCase("es-ES").replace(/[^A-Z0-9]/g, "");
const normalizarTipo = (value: string | null) => (value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-ES").trim();
const medida = (value: unknown): number | null => value === null || value === undefined ? null : Number(value);
const iguales = (a: number | null, b: number | null) => a === null || b === null ? a === b : Math.abs(a - b) < 0.01;

function puntuacion(linea: LineaPedidoRps, local: LineaLocal): number {
  let score = normalizarTipo(linea.tipo) === normalizarTipo(local.tipo) ? 0 : 1000;
  for (const [rps, valorLocal] of [[linea.largo, local.largo], [linea.ancho, local.ancho], [linea.alto, local.alto], [linea.aguas, local.aguas]] as const) {
    if (iguales(rps, valorLocal)) continue;
    if (rps === null || valorLocal === null) score += 500;
    else score += Math.abs(rps - valorLocal);
  }
  return score;
}

function esImportable(linea: PedidoPendienteRps): boolean {
  if (linea.requiereRevision || !linea.tipo.trim()) return false;
  if (linea.familia === "REMOLQUES") {
    return linea.largo !== null && linea.ancho !== null && linea.alto !== null;
  }
  return linea.ancho !== null && linea.alto !== null;
}

export async function obtenerPendientesRps(): Promise<ResumenPendientesRps> {
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
    pool.request().query(`SELECT p.numero_pedido AS numero, f.nombre AS familia, p.tipo,
        p.largo, p.ancho, p.alto, p.aguas
      FROM ${SCHEMA}.pedidos p
      INNER JOIN ${SCHEMA}.familias f ON f.id = p.familia_id`),
  ]);

  const localesPorPedido = new Map<string, LineaLocal[]>();
  for (const row of localesResult.recordset as Array<Record<string, unknown>>) {
    const local: LineaLocal = {
      numero: String(row.numero ?? ""),
      familia: String(row.familia ?? ""),
      tipo: row.tipo === null ? null : String(row.tipo),
      largo: medida(row.largo),
      ancho: medida(row.ancho),
      alto: medida(row.alto),
      aguas: medida(row.aguas),
    };
    const key = `${normalizarNumero(local.numero)}|${local.familia}`;
    localesPorPedido.set(key, [...(localesPorPedido.get(key) ?? []), local]);
  }

  const pendientesBase: PedidoPendienteRps[] = [];
  let totalLineasRps = 0;
  let totalRegistradas = 0;
  for (const pedido of pedidosRps) {
    for (const familia of ["REMOLQUES", "PUERTAS"] as const) {
      const lineas = pedido.lineas.filter((linea) => linea.familia === familia);
      if (lineas.length === 0) continue;
      totalLineasRps += lineas.length;
      const disponibles = [...(localesPorPedido.get(`${normalizarNumero(pedido.numero)}|${familia}`) ?? [])];
      const sinCoincidenciaExacta: LineaPedidoRps[] = [];
      for (const linea of lineas) {
        const indiceExacto = disponibles.findIndex((local) => puntuacion(linea, local) === 0);
        if (indiceExacto >= 0) {
          disponibles.splice(indiceExacto, 1);
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
        disponibles.splice(mejorIndice, 1);
        totalRegistradas += 1;
      }
    }
  }

  const todosLocales = [...localesPorPedido.values()].flat();
  const pendientes = pendientesBase.map((pendiente) => {
    const coincidencia = todosLocales.find((local) =>
      local.familia === pendiente.familia
      && normalizarNumero(local.numero) !== normalizarNumero(pendiente.numero)
      && puntuacion(pendiente, local) === 0,
    );
    return { ...pendiente, coincideCon: coincidencia?.numero ?? null };
  });

  return {
    fechaDesde,
    pendientes,
    totalLineasRps,
    totalRegistradas,
    totalImportables: pendientes.filter(esImportable).length,
  };
}

export async function importarPendientesRps(): Promise<ResultadoImportacionRps> {
  const resumen = await obtenerPendientesRps();
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
        aguas: linea.familia === "REMOLQUES" ? linea.aguas : null,
        radio: null,
        impresion_digital: false,
        fecha: linea.fecha,
        tecnico_id: null,
        observaciones: linea.detalle || linea.descripcion || null,
      } as PedidoInput;
      await dbServer.createPedido(pedido);
      importados += 1;
    }));
  }

  return {
    importados,
    pendientesRevision: resumen.pendientes.length - importables.length,
    fechaDesde: resumen.fechaDesde,
  };
}
