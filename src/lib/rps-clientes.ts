import "server-only";
import sql from "mssql";
import { getRpsPool } from "./db/rps-pool";

export interface ClienteRps {
  codigo: string;
  nombre: string;
  alias: string | null;
}

export interface LineaPedidoRps {
  numeroLinea: number;
  familia: "REMOLQUES" | "PUERTAS";
  tipo: string;
  largo: number | null;
  ancho: number | null;
  alto: number | null;
  altoDelante: number | null;
  altoAtras: number | null;
  aguas: number | null;
  altoBase: number | null;
  altoExtra: number | null;
  descripcion: string;
  detalle: string;
  requiereRevision: boolean;
  progresoPlanteo: number | null;
  estadoPlanteo: "PENDIENTE" | "REALIZADO" | "SIN_TAREA";
}

export interface PedidoRps {
  numero: string;
  fecha: string | null;
  cliente: ClienteRps;
  lineas: LineaPedidoRps[];
}

export interface PedidoPendienteRps extends LineaPedidoRps {
  numero: string;
  fecha: string | null;
  cliente: ClienteRps;
}

const limpiar = (value: string) => value.trim().toLocaleUpperCase("es-ES");

export async function buscarClientesRps(query: string): Promise<ClienteRps[]> {
  const q = limpiar(query);
  if (q.length < 2) return [];
  const pool = await getRpsPool();
  const result = await pool.request()
    .input("q", sql.VarChar(255), q)
    .query(`SELECT TOP 20 c.CodCustomer AS codigo,
        LTRIM(RTRIM(COALESCE(NULLIF(c.CompanyName, ''), c.Description))) AS nombre,
        NULLIF(LTRIM(RTRIM(cc.Alias)), '') AS alias
      FROM dbo.FACCustomer c
      LEFT JOIN dbo._FACCustomer_Custom cc ON cc.IDCustomer = c.IDCustomer
      WHERE c.CodCompany = '001' AND c.InactiveDate IS NULL
        AND (UPPER(c.CodCustomer) LIKE @q + '%' OR UPPER(c.CompanyName) LIKE '%' + @q + '%'
          OR UPPER(c.Description) LIKE '%' + @q + '%' OR UPPER(COALESCE(cc.Alias, '')) LIKE '%' + @q + '%')
      ORDER BY CASE WHEN UPPER(c.CodCustomer) = @q THEN 0 WHEN UPPER(COALESCE(cc.Alias, '')) = @q THEN 1
        WHEN UPPER(c.CodCustomer) LIKE @q + '%' THEN 2 ELSE 3 END, c.CompanyName`);
  return result.recordset as ClienteRps[];
}

export async function clienteRpsPorPedido(numero: string): Promise<ClienteRps | null> {
  const pedido = await pedidoRpsPorNumero(numero);
  return pedido?.cliente ?? null;
}

const numeroMedida = (value: string | undefined): number | null => {
  if (!value) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
};

function interpretarLinea(
  numeroLinea: number,
  description: string,
  comment: string | null,
  progresoPlanteoRaw: number | null = null,
  codigoArticuloRaw: string | null = null,
): LineaPedidoRps | null {
  const detalle = (comment ?? "").trim();
  const texto = `${description} ${detalle}`.toLocaleUpperCase("es-ES");
  const codigoArticulo = (codigoArticuloRaw ?? "").trim().toLocaleUpperCase("es-ES");
  const esPuerta = texto.includes("PUERTA ENROLLABLE") || texto.includes("PUERTA PLEGABLE") || texto.includes("PUERTA APILABLE");
  const esRemolque = codigoArticulo === "LONAREMOLQUE"
    || codigoArticulo === "LONAREMGANA"
    || texto.includes("LONA REMOLQUE")
    || texto.includes("CANVAS FOR TRAILER");
  if (!esPuerta && !esRemolque) return null;
  const match = texto.match(/MEDIDAS?\s+([0-9]+(?:[,.][0-9]+)?)\s*(?:CM)?\s*X\s*([0-9]+(?:[,.][0-9]+)?)\s*(?:CM)?(?:\s*X\s*([0-9]+(?:[,.][0-9]+)?)(?:\s*CM)?(?:\s*\/\s*([0-9]+(?:[,.][0-9]+)?)(?:\s*CM)?)?(?:\s*\+\s*([0-9]+(?:[,.][0-9]+)?)(?:\s*CM)?)?)?/i)
    ?? texto.match(/MEASURES?\s+([0-9]+(?:[,.][0-9]+)?)\s*(?:CM)?\s*X\s*([0-9]+(?:[,.][0-9]+)?)\s*(?:CM)?(?:\s*X\s*([0-9]+(?:[,.][0-9]+)?)(?:\s*CM)?(?:\s*\/\s*([0-9]+(?:[,.][0-9]+)?)(?:\s*CM)?)?(?:\s*\+\s*([0-9]+(?:[,.][0-9]+)?)(?:\s*CM)?)?)?/i);
  const primera = numeroMedida(match?.[1]);
  const segunda = numeroMedida(match?.[2]);
  const altoBase = numeroMedida(match?.[3]);
  const altoAtras = numeroMedida(match?.[4]);
  const altoExtra = numeroMedida(match?.[5]);
  const tipo = esPuerta
    ? (texto.includes("ENROLLABLE") ? "Enrollable" : "Apilable")
    : codigoArticulo === "LONAREMGANA" || texto.includes("GANADO")
      ? "Ganado"
      : (altoBase !== null && altoBase <= 25 && altoAtras === null && altoExtra === null ? "Baquetón" : "Lona alta");
  const progresoNumero = progresoPlanteoRaw == null ? null : Number(progresoPlanteoRaw);
  const progresoPlanteo = progresoNumero !== null && Number.isFinite(progresoNumero) ? progresoNumero : null;
  return {
    numeroLinea,
    familia: esPuerta ? "PUERTAS" : "REMOLQUES",
    tipo,
    largo: esPuerta ? null : primera,
    ancho: esPuerta ? primera : segunda,
    alto: esPuerta ? segunda : (altoAtras !== null ? null : altoBase === null ? null : altoBase + (altoExtra ?? 0)),
    altoDelante: esRemolque && altoAtras !== null ? altoBase : null,
    altoAtras: esRemolque && altoAtras !== null ? altoAtras : null,
    aguas: esRemolque ? altoExtra : null,
    altoBase,
    altoExtra,
    descripcion: description.trim(),
    detalle,
    requiereRevision: !match
      || (esPuerta ? primera === null || segunda === null : primera === null || segunda === null || altoBase === null),
    progresoPlanteo,
    estadoPlanteo: progresoPlanteo === null ? "SIN_TAREA" : progresoPlanteo >= 100 ? "REALIZADO" : "PENDIENTE",
  };
}

export async function pedidoRpsPorNumero(numero: string): Promise<PedidoRps | null> {
  const normalizado = limpiar(numero).replace(/[^A-Z0-9]/g, "");
  if (!normalizado) return null;
  const pool = await getRpsPool();
  const result = await pool.request()
    .input("numero", sql.VarChar(50), normalizado)
    .query(`SELECT TOP 1 o.IDOrder, o.CodOrder AS numero, o.OrderDate AS fecha,
        c.CodCustomer AS codigo, LTRIM(RTRIM(COALESCE(NULLIF(c.CompanyName, ''), c.Description))) AS nombre,
        NULLIF(LTRIM(RTRIM(cc.Alias)), '') AS alias
      FROM dbo.FACOrderSL o
      INNER JOIN dbo.FACCustomer c ON c.IDCustomer = o.IDCustomer
      LEFT JOIN dbo._FACCustomer_Custom cc ON cc.IDCustomer = c.IDCustomer
      WHERE o.CodCompany = '001'
        AND REPLACE(REPLACE(UPPER(o.CodOrder), '.', ''), ' ', '') = @numero
      ORDER BY o.OrderDate DESC`);
  const cabecera = result.recordset[0] as { IDOrder: string; numero: string; fecha: Date | null; codigo: string; nombre: string; alias: string | null } | undefined;
  if (!cabecera) return null;
  const lineasResult = await pool.request()
    .input("idOrder", sql.VarChar(255), cabecera.IDOrder)
    .query(`SELECT l.NumLine, l.Description, l.Comment, article.CodArticle,
        planteo.PercentProgress AS ProgresoPlanteo
      FROM dbo.FACOrderLineSL l
      LEFT JOIN dbo.STKArticle article ON article.IDArticle = l.IDArticle
      OUTER APPLY (
        SELECT TOP 1 t.PercentProgress
        FROM dbo.CPRMOTask t
        WHERE t.IDManufacturingOrder = l.IDManufacturingOrder
          AND (UPPER(t.Description) LIKE '%PLANTEAR%' OR UPPER(t.Description) LIKE '%PLANTEAMIENTO%')
        ORDER BY CASE WHEN t.CodMOTask = '5' THEN 0 ELSE 1 END, t.[Order]
      ) planteo
      WHERE l.IDOrder = @idOrder
      ORDER BY l.NumLine`);
  const lineas = lineasResult.recordset
    .map((linea: { NumLine: number; Description: string; Comment: string | null; ProgresoPlanteo: number | null; CodArticle: string | null }) =>
      interpretarLinea(linea.NumLine, linea.Description ?? "", linea.Comment, linea.ProgresoPlanteo, linea.CodArticle))
    .filter((linea: LineaPedidoRps | null): linea is LineaPedidoRps => linea !== null);
  return {
    numero: cabecera.numero,
    fecha: cabecera.fecha ? cabecera.fecha.toISOString().slice(0, 10) : null,
    cliente: { codigo: cabecera.codigo, nombre: cabecera.nombre, alias: cabecera.alias },
    lineas,
  };
}

export async function pedidosRpsDesde(fechaDesde: string): Promise<PedidoRps[]> {
  const pool = await getRpsPool();
  const result = await pool.request()
    .input("fechaDesde", sql.Date, fechaDesde)
    .query(`SELECT o.IDOrder, o.CodOrder AS numero, o.OrderDate AS fecha,
        c.CodCustomer AS codigo,
        LTRIM(RTRIM(COALESCE(NULLIF(c.CompanyName, ''), c.Description))) AS nombre,
        NULLIF(LTRIM(RTRIM(cc.Alias)), '') AS alias,
        l.NumLine, l.Description, l.Comment, article.CodArticle,
        planteo.PercentProgress AS ProgresoPlanteo
      FROM dbo.FACOrderSL o
      INNER JOIN dbo.FACCustomer c ON c.IDCustomer = o.IDCustomer
      LEFT JOIN dbo._FACCustomer_Custom cc ON cc.IDCustomer = c.IDCustomer
      INNER JOIN dbo.FACOrderLineSL l ON l.IDOrder = o.IDOrder
      LEFT JOIN dbo.STKArticle article ON article.IDArticle = l.IDArticle
      OUTER APPLY (
        SELECT TOP 1 t.PercentProgress
        FROM dbo.CPRMOTask t
        WHERE t.IDManufacturingOrder = l.IDManufacturingOrder
          AND (UPPER(t.Description) LIKE '%PLANTEAR%' OR UPPER(t.Description) LIKE '%PLANTEAMIENTO%')
        ORDER BY CASE WHEN t.CodMOTask = '5' THEN 0 ELSE 1 END, t.[Order]
      ) planteo
      WHERE o.CodCompany = '001' AND o.OrderDate >= @fechaDesde
        AND REPLACE(REPLACE(UPPER(o.CodOrder), '.', ''), ' ', '') LIKE 'AR%'
        AND (
          article.CodArticle IN ('LONAREMOLQUE', 'LONAREMGANA')
          OR UPPER(COALESCE(l.Description, '') + ' ' + COALESCE(l.Comment, '')) LIKE '%LONA REMOLQUE%'
          OR UPPER(COALESCE(l.Description, '') + ' ' + COALESCE(l.Comment, '')) LIKE '%CANVAS FOR TRAILER%'
          OR UPPER(COALESCE(l.Description, '') + ' ' + COALESCE(l.Comment, '')) LIKE '%PUERTA ENROLLABLE%'
          OR UPPER(COALESCE(l.Description, '') + ' ' + COALESCE(l.Comment, '')) LIKE '%PUERTA PLEGABLE%'
          OR UPPER(COALESCE(l.Description, '') + ' ' + COALESCE(l.Comment, '')) LIKE '%PUERTA APILABLE%'
        )
      ORDER BY o.OrderDate DESC, o.CodOrder DESC, l.NumLine`);

  type Fila = {
    IDOrder: string; numero: string; fecha: Date | null; codigo: string; nombre: string; alias: string | null;
    NumLine: number; Description: string | null; Comment: string | null; ProgresoPlanteo: number | null;
    CodArticle: string | null;
  };
  const agrupados = new Map<string, PedidoRps>();
  for (const fila of result.recordset as Fila[]) {
    const linea = interpretarLinea(fila.NumLine, fila.Description ?? "", fila.Comment, fila.ProgresoPlanteo, fila.CodArticle);
    if (!linea) continue;
    let pedido = agrupados.get(fila.IDOrder);
    if (!pedido) {
      pedido = {
        numero: fila.numero,
        fecha: fila.fecha ? fila.fecha.toISOString().slice(0, 10) : null,
        cliente: { codigo: fila.codigo, nombre: fila.nombre, alias: fila.alias },
        lineas: [],
      };
      agrupados.set(fila.IDOrder, pedido);
    }
    pedido.lineas.push(linea);
  }
  return [...agrupados.values()];
}
