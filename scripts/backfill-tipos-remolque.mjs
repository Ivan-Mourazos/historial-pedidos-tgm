/**
 * Completa el tipo de los remolques realizados que todavía no lo tienen.
 *
 * Fuentes, por prioridad:
 *   1. RPS LONAREMGANA -> Ganado.
 *   2. OF de la línea RPS + hoja RPS del Excel (BAQU/LONA).
 *
 * Por defecto solo audita. Añade --apply para guardar los cambios.
 */
import fs from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";
import sql from "mssql";
import XLSX from "xlsx";

const APPLY = process.argv.includes("--apply");
const EXCEL_EXTENSIONS = new Set([".xlsb", ".xlsm", ".xlsx", ".xls"]);

function loadEnv(file = ".env.local") {
  if (!fs.existsSync(file)) return;
  for (const rawLine of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function databaseConfig(prefix) {
  const server = process.env[`${prefix}_HOST`];
  const database = process.env[`${prefix}_DATABASE`];
  const user = process.env[`${prefix}_USER`];
  const password = process.env[`${prefix}_PASSWORD`];
  if (!server || !database || !user || !password) {
    throw new Error(`Falta configurar ${prefix}_HOST/DATABASE/USER/PASSWORD.`);
  }
  return {
    server,
    port: Number(process.env[`${prefix}_PORT`] || 1433),
    database,
    user,
    password,
    options: {
      encrypt: process.env[`${prefix}_ENCRYPT`] === "true",
      trustServerCertificate: process.env[`${prefix}_TRUST_SERVER_CERT`] !== "false",
    },
    requestTimeout: 120_000,
  };
}

const normalizeText = (value) => String(value ?? "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .trim()
  .toUpperCase();

const normalizeOrder = (value) => normalizeText(value).replace(/[^A-Z0-9]/g, "");

function normalizeOf(value) {
  const normalized = normalizeText(value).replace(/\.0+$/, "").replace(/[^A-Z0-9]/g, "");
  if (/^\d+$/.test(normalized)) return normalized.replace(/^0+/, "");
  return normalized;
}

const asNumber = (value) => value === null || value === undefined ? null : Number(value);
const closeEnough = (a, b) => a === null || b === null ? a === b : Math.abs(a - b) < 0.01;

function parseMeasures(description, comment) {
  const text = normalizeText(`${description ?? ""} ${comment ?? ""}`);
  const match = text.match(/MEDIDAS?\s+([0-9]+(?:[,.][0-9]+)?)\s*(?:CM)?\s*X\s*([0-9]+(?:[,.][0-9]+)?)\s*(?:CM)?(?:\s*X\s*([0-9]+(?:[,.][0-9]+)?)(?:\s*CM)?(?:\s*\/\s*([0-9]+(?:[,.][0-9]+)?)(?:\s*CM)?)?(?:\s*\+\s*([0-9]+(?:[,.][0-9]+)?)(?:\s*CM)?)?)?/i)
    ?? text.match(/MEASURES?\s+([0-9]+(?:[,.][0-9]+)?)\s*(?:CM)?\s*X\s*([0-9]+(?:[,.][0-9]+)?)\s*(?:CM)?(?:\s*X\s*([0-9]+(?:[,.][0-9]+)?)(?:\s*CM)?(?:\s*\/\s*([0-9]+(?:[,.][0-9]+)?)(?:\s*CM)?)?(?:\s*\+\s*([0-9]+(?:[,.][0-9]+)?)(?:\s*CM)?)?)?/i);
  if (!match) return null;
  const number = (raw) => raw ? Number(raw.replace(",", ".")) : null;
  const altoBase = number(match[3]);
  const altoAtras = number(match[4]);
  const aguas = number(match[5]);
  return {
    largo: number(match[1]),
    ancho: number(match[2]),
    alto: altoAtras !== null ? null : altoBase === null ? null : altoBase + (aguas ?? 0),
    altoDelante: altoAtras !== null ? altoBase : null,
    altoAtras,
    aguas,
  };
}

function sameMeasures(local, rpsLine) {
  const parsed = parseMeasures(rpsLine.description, rpsLine.comment);
  return parsed !== null
    && closeEnough(local.largo, parsed.largo)
    && closeEnough(local.ancho, parsed.ancho)
    && (parsed.altoAtras !== null
      ? closeEnough(local.altoDelante, parsed.altoDelante) && closeEnough(local.altoAtras, parsed.altoAtras)
      : closeEnough(local.alto, parsed.alto))
    && (local.aguas === null || closeEnough(local.aguas, parsed.aguas));
}

function sameExcelMeasures(local, excelRow) {
  const measures = excelRow.measures;
  return measures !== null
    && local.largo !== null
    && local.ancho !== null
    && local.alto !== null
    && closeEnough(local.largo, measures.largo)
    && closeEnough(local.ancho, measures.ancho)
    && closeEnough(local.alto, measures.alto)
    && (local.aguas === null || measures.aguas === null || closeEnough(local.aguas, measures.aguas));
}

async function buildExcelIndex(roots, orders) {
  const index = new Map();
  const years = new Set([...orders].map((order) => order.match(/^AR(\d{2})/)?.[1]).filter(Boolean).map((yy) => `20${yy}`));
  const folders = new Set();
  for (const root of roots) {
    folders.add(root);
    for (const year of years) folders.add(path.join(root, year));
  }

  for (const folder of folders) {
    let entries;
    try {
      entries = await readdir(folder, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isFile() || !EXCEL_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
      const match = entry.name.match(/^(AR\d{7})(?:\s*[-_].+)?\.(?:xlsb|xlsm|xlsx|xls)$/i);
      if (!match) continue;
      const order = normalizeOrder(match[1]);
      if (!orders.has(order)) continue;
      const files = index.get(order) ?? [];
      files.push(path.join(folder, entry.name));
      index.set(order, files);
    }
  }
  return index;
}

function excelClassifications(file) {
  const workbook = XLSX.readFile(file, { cellFormula: true, cellText: true });
  const rpsSheetName = workbook.SheetNames.find((name) => normalizeText(name) === "RPS");
  if (!rpsSheetName) return [];
  const sheet = workbook.Sheets[rpsSheetName];
  const found = [];
  const outputSheets = [];
  const sheetMetadata = workbook.Workbook?.Sheets ?? [];
  for (const [index, sheetName] of workbook.SheetNames.entries()) {
    const sheet = workbook.Sheets[sheetName];
    const codeName = normalizeText(sheetMetadata[index]?.CodeName);
    const isBaqueton = codeName === "HOJA1" || normalizeText(sheet["A1"]?.v).startsWith("BAQUET");
    const isLona = codeName === "HOJA4"
      || (normalizeText(sheet["S2"]?.v).includes("PEDIDO") && normalizeText(sheet["B3"]?.v).includes("PEDIDO"));
    const tipo = isBaqueton ? "Baquetón" : isLona ? "Lona alta" : null;
    if (!tipo) continue;
    const measures = tipo === "Baquetón"
      ? { largo: asNumber(sheet["C12"]?.v), ancho: asNumber(sheet["C13"]?.v), alto: asNumber(sheet["C14"]?.v), aguas: null }
      : { largo: asNumber(sheet["C11"]?.v), ancho: asNumber(sheet["C12"]?.v), alto: asNumber(sheet["C13"]?.v), aguas: asNumber(sheet["C17"]?.v) };
    outputSheets.push({
      of: /^0*\d+$/.test(sheetName.trim()) ? normalizeOf(sheetName) : "",
      tipo,
      measures,
      file,
    });
  }
  for (const address of Object.keys(sheet)) {
    if (address.startsWith("!")) continue;
    const cell = XLSX.utils.decode_cell(address);
    const header = normalizeText(sheet[address]?.w ?? sheet[address]?.v);
    const tipo = header.startsWith("BAQU") ? "Baquetón" : header === "LONA" ? "Lona alta" : null;
    if (!tipo) continue;
    const valueAddress = XLSX.utils.encode_cell({ r: cell.r + 1, c: cell.c });
    const of = normalizeOf(sheet[valueAddress]?.v ?? sheet[valueAddress]?.w);
    if (of) {
      const candidates = outputSheets.filter((item) => item.tipo === tipo);
      const output = candidates.find((item) => item.of === of) ?? (candidates.length === 1 ? candidates[0] : null);
      found.push({ of, tipo, file, measures: output?.measures ?? null });
    }
  }
  for (const output of outputSheets) {
    if (output.of && !found.some((item) => item.of === output.of && item.tipo === output.tipo)) found.push(output);
  }
  return found;
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

loadEnv();
const roots = (process.env.ZWCAD_DWG_ROOTS ?? "").split(";").map((item) => item.trim()).filter(Boolean);
if (roots.length === 0) throw new Error("Falta configurar ZWCAD_DWG_ROOTS.");

const historicalPool = await new sql.ConnectionPool(databaseConfig("SQLSERVER")).connect();
const rpsPool = await new sql.ConnectionPool(databaseConfig("RPS_SQLSERVER")).connect();

try {
  const missingResult = await historicalPool.request().query(`
    SELECT p.id, p.numero_pedido, p.largo, p.ancho, p.alto, p.alto_delante, p.alto_atras, p.aguas, p.rps_numero_linea
    FROM historico.pedidos p
    INNER JOIN historico.familias f ON f.id = p.familia_id
    WHERE f.nombre = 'REMOLQUES'
      AND p.estado_planteo = 'REALIZADO'
      AND NULLIF(LTRIM(RTRIM(p.tipo)), '') IS NULL
    ORDER BY p.numero_pedido, p.rps_numero_linea, p.id`);

  const missing = missingResult.recordset.map((row) => ({
    id: String(row.id),
    order: normalizeOrder(row.numero_pedido),
    largo: asNumber(row.largo),
    ancho: asNumber(row.ancho),
    alto: asNumber(row.alto),
    altoDelante: asNumber(row.alto_delante),
    altoAtras: asNumber(row.alto_atras),
    aguas: asNumber(row.aguas),
    rpsLine: asNumber(row.rps_numero_linea),
  }));
  const orders = new Set(missing.map((row) => row.order));
  console.log(`Remolques realizados sin tipo: ${missing.length} (${orders.size} pedidos).`);

  const rpsResult = await rpsPool.request().query(`
    SELECT REPLACE(REPLACE(UPPER(o.CodOrder), '.', ''), ' ', '') AS numero,
      l.NumLine, article.CodArticle, mo.CodManufacturingOrder,
      l.Description, l.Comment
    FROM dbo.FACOrderSL o
    INNER JOIN dbo.FACOrderLineSL l ON l.IDOrder = o.IDOrder
    LEFT JOIN dbo.STKArticle article ON article.IDArticle = l.IDArticle
    LEFT JOIN dbo.CPRManufacturingOrder mo ON mo.IDManufacturingOrder = l.IDManufacturingOrder
    WHERE o.CodCompany = '001' AND o.OrderDate >= '20240101'
      AND REPLACE(REPLACE(UPPER(o.CodOrder), '.', ''), ' ', '') LIKE 'AR%'
      AND (
        article.CodArticle IN ('LONAREMOLQUE', 'LONAREMGANA')
        OR UPPER(COALESCE(l.Description, '') + ' ' + COALESCE(l.Comment, '')) LIKE '%LONA REMOLQUE%'
        OR UPPER(COALESCE(l.Description, '') + ' ' + COALESCE(l.Comment, '')) LIKE '%CANVAS FOR TRAILER%'
      )`);

  const rpsByOrder = new Map();
  for (const row of rpsResult.recordset) {
    const order = normalizeOrder(row.numero);
    if (!orders.has(order)) continue;
    const lines = rpsByOrder.get(order) ?? [];
    lines.push({
      line: Number(row.NumLine),
      article: normalizeText(row.CodArticle),
      of: normalizeOf(row.CodManufacturingOrder),
      description: row.Description,
      comment: row.Comment,
    });
    rpsByOrder.set(order, lines);
  }

  const excelIndex = await buildExcelIndex(roots, orders);
  const excelOrders = [...excelIndex.entries()];
  console.log(`Pedidos con Excel localizado: ${excelOrders.length}/${orders.size}. Leyendo hojas RPS...`);
  const excelResults = await mapWithConcurrency(excelOrders, 8, async ([order, files]) => {
    const classifications = [];
    for (const file of files) {
      try {
        classifications.push(...excelClassifications(file));
      } catch (error) {
        console.warn(`No se pudo leer ${path.basename(file)}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    return [order, classifications];
  });
  const excelByOrder = new Map(excelResults);

  const proposals = [];
  const unresolved = [];
  for (const local of missing) {
    const lines = rpsByOrder.get(local.order) ?? [];
    let rpsLine = local.rpsLine === null ? null : lines.find((line) => line.line === local.rpsLine) ?? null;
    if (!rpsLine) {
      const exact = lines.filter((line) => sameMeasures(local, line));
      if (exact.length === 1) rpsLine = exact[0];
      else if (lines.length === 1) rpsLine = lines[0];
    }

    if (rpsLine?.article === "LONAREMGANA") {
      proposals.push({ ...local, tipo: "Ganado", source: "RPS LONAREMGANA", of: rpsLine.of });
      continue;
    }

    const excelRows = excelByOrder.get(local.order) ?? [];
    if (rpsLine?.of) {
      const matches = excelRows.filter((item) => item.of === rpsLine.of);
      const types = [...new Set(matches.map((item) => item.tipo))];
      if (types.length === 1) {
        proposals.push({ ...local, tipo: types[0], source: "Excel por OF", of: rpsLine.of });
        continue;
      }
      const measureMatches = matches.filter((item) => sameExcelMeasures(local, item));
      const measureTypes = [...new Set(measureMatches.map((item) => item.tipo))];
      if (measureTypes.length === 1) {
        proposals.push({ ...local, tipo: measureTypes[0], source: "Excel por OF y medidas", of: rpsLine.of });
        continue;
      }
    }

    const measureMatches = excelRows.filter((item) => sameExcelMeasures(local, item));
    const measureTypes = [...new Set(measureMatches.map((item) => item.tipo))];
    if (measureTypes.length === 1) {
      proposals.push({ ...local, tipo: measureTypes[0], source: "Excel por medidas", of: rpsLine?.of ?? "" });
      continue;
    }

    const uniqueTypes = [...new Set(excelRows.map((item) => item.tipo))];
    if (uniqueTypes.length === 1) {
      proposals.push({ ...local, tipo: uniqueTypes[0], source: "Excel único del pedido", of: rpsLine?.of ?? "" });
      continue;
    }

    if (local.alto !== null) {
      const tipo = local.alto <= 25 && (local.aguas === null || closeEnough(local.aguas, 0))
        ? "Baquetón"
        : "Lona alta";
      proposals.push({ ...local, tipo, source: "Medidas como último recurso", of: rpsLine?.of ?? "" });
      continue;
    }

    unresolved.push({
      ...local,
      reason: lines.length === 0
        ? "sin línea RPS"
        : excelRows.length === 0
          ? "sin clasificación en Excel"
          : "varias líneas/tipos sin OF coincidente",
      of: rpsLine?.of ?? "",
    });
  }

  const counts = proposals.reduce((acc, item) => {
    acc[item.tipo] = (acc[item.tipo] ?? 0) + 1;
    return acc;
  }, {});
  const sources = proposals.reduce((acc, item) => {
    acc[item.source] = (acc[item.source] ?? 0) + 1;
    return acc;
  }, {});
  console.table(Object.entries(counts).map(([tipo, cantidad]) => ({ tipo, cantidad })));
  console.table(Object.entries(sources).map(([fuente, cantidad]) => ({ fuente, cantidad })));
  console.log(`Clasificables: ${proposals.length}. Pendientes de revisión: ${unresolved.length}.`);
  if (unresolved.length > 0) {
    console.table(unresolved.slice(0, 30).map((item) => ({
      pedido: item.order,
      linea_rps: item.rpsLine,
      of: item.of,
      medidas: [item.largo, item.ancho, item.alto, item.aguas].map((value) => value ?? "—").join(" x "),
      motivo: item.reason,
    })));
  }

  if (!APPLY) {
    console.log("Auditoría terminada. Ejecuta con --apply para guardar únicamente estas propuestas.");
  } else if (proposals.length > 0) {
    const transaction = new sql.Transaction(historicalPool);
    await transaction.begin();
    let updated = 0;
    try {
      for (const proposal of proposals) {
        const result = await new sql.Request(transaction)
          .input("id", sql.UniqueIdentifier, proposal.id)
          .input("tipo", sql.NVarChar(100), proposal.tipo)
          .query(`UPDATE historico.pedidos
            SET tipo = @tipo, updated_at = SYSDATETIMEOFFSET()
            WHERE id = @id AND NULLIF(LTRIM(RTRIM(tipo)), '') IS NULL`);
        updated += result.rowsAffected[0] ?? 0;
      }
      await transaction.commit();
      console.log(`Actualizados: ${updated}.`);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  const completenessResult = await historicalPool.request().query(`
    SELECT p.tipo, COUNT(*) AS total,
      SUM(CASE WHEN p.largo IS NULL THEN 1 ELSE 0 END) AS sin_largo,
      SUM(CASE WHEN p.ancho IS NULL THEN 1 ELSE 0 END) AS sin_ancho,
      SUM(CASE WHEN p.alto IS NULL AND (p.alto_delante IS NULL OR p.alto_atras IS NULL) THEN 1 ELSE 0 END) AS sin_alto,
      SUM(CASE WHEN p.aguas IS NULL THEN 1 ELSE 0 END) AS sin_aguas,
      SUM(CASE WHEN p.radio IS NULL THEN 1 ELSE 0 END) AS sin_radio,
      SUM(CASE WHEN p.recogida_delante IS NULL AND p.recogida_atras IS NULL THEN 1 ELSE 0 END) AS sin_recogida
    FROM historico.pedidos p
    INNER JOIN historico.familias f ON f.id = p.familia_id
    WHERE f.nombre = 'REMOLQUES' AND p.estado_planteo = 'REALIZADO'
    GROUP BY p.tipo
    ORDER BY p.tipo`);
  console.log("Campos vacíos actuales en remolques realizados (algunos son opcionales o no aplican):");
  console.table(completenessResult.recordset);
  const incompleteCoreResult = await historicalPool.request().query(`
    SELECT p.numero_pedido, p.tipo, p.rps_numero_linea, p.largo, p.ancho, p.alto, p.alto_delante, p.alto_atras
    FROM historico.pedidos p
    INNER JOIN historico.familias f ON f.id = p.familia_id
    WHERE f.nombre = 'REMOLQUES' AND p.estado_planteo = 'REALIZADO'
      AND (p.largo IS NULL OR p.ancho IS NULL OR (p.alto IS NULL AND (p.alto_delante IS NULL OR p.alto_atras IS NULL)))
    ORDER BY p.numero_pedido, p.rps_numero_linea`);
  if (incompleteCoreResult.recordset.length > 0) {
    console.log("Registros que todavía tienen alguna medida principal vacía:");
    console.table(incompleteCoreResult.recordset);
  }
} finally {
  await Promise.all([historicalPool.close(), rpsPool.close()]);
}
