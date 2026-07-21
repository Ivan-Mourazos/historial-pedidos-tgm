import "server-only";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { getDwgRoots } from "@/lib/cad/zwcad";

export interface PedidoFileStatus {
  cad: boolean;
  excel: boolean;
}

const VALID_EXTENSIONS = new Set([".dwg", ".xlsx", ".xlsm", ".xls", ".xlsb"]);
const EXCEL_EXTENSIONS = new Set([".xlsx", ".xlsm", ".xls", ".xlsb"]);
const INDEX_CACHE_MS = 5 * 60 * 1000;
// Carpetas de año (2022, 2023, …) donde se guardan los pedidos, como en
// findDwgForPedido (root/<año>/<numero>.dwg).
const YEAR_FOLDER = /^20\d{2}$/;

const normalizeNumber = (value: string) => value.toLocaleUpperCase("es-ES").replace(/[^A-Z0-9]/g, "");

let indexCache: { expiresAt: number; value: Map<string, PedidoFileStatus> } | null = null;
let indexBuilding: Promise<Map<string, PedidoFileStatus>> | null = null;

async function readDirSafe(folder: string) {
  try {
    return await readdir(folder, { withFileTypes: true });
  } catch {
    return [];
  }
}

function indexFile(index: Map<string, PedidoFileStatus>, fileName: string) {
  const extension = path.extname(fileName).toLocaleLowerCase("es-ES");
  if (!VALID_EXTENSIONS.has(extension)) return;
  const base = normalizeNumber(path.basename(fileName, extension).split(/[-_]/, 1)[0]);
  if (!base) return;
  let status = index.get(base);
  if (!status) index.set(base, status = { cad: false, excel: false });
  if (extension === ".dwg") status.cad = true;
  if (EXCEL_EXTENSIONS.has(extension)) status.excel = true;
}

// Construye un índice { numero -> {cad, excel} } leyendo SOLO las raíces y sus
// carpetas de año, en paralelo. Evita el recorrido recursivo del árbol completo
// (que en red tardaba >90 s). Asume que los ficheros viven en root/ o
// root/<año>/, igual que la app los localiza para abrirlos.
async function buildIndex(): Promise<Map<string, PedidoFileStatus>> {
  const index = new Map<string, PedidoFileStatus>();
  await Promise.all(getDwgRoots().map(async (root) => {
    const carpetasAnio: string[] = [];
    for (const entry of await readDirSafe(root)) {
      if (entry.isFile()) indexFile(index, entry.name);
      else if (entry.isDirectory() && YEAR_FOLDER.test(entry.name)) carpetasAnio.push(path.join(root, entry.name));
    }
    await Promise.all(carpetasAnio.map(async (folder) => {
      for (const entry of await readDirSafe(folder)) {
        if (entry.isFile()) indexFile(index, entry.name);
      }
    }));
  }));
  return index;
}

async function getIndex(): Promise<Map<string, PedidoFileStatus>> {
  if (indexCache && indexCache.expiresAt > Date.now()) return indexCache.value;
  indexBuilding ??= buildIndex()
    .then((value) => {
      indexCache = { expiresAt: Date.now() + INDEX_CACHE_MS, value };
      return value;
    })
    .finally(() => { indexBuilding = null; });
  return indexBuilding;
}

export async function verifyPedidoFiles(numbers: string[]): Promise<Map<string, PedidoFileStatus>> {
  const normalized = [...new Set(numbers.map(normalizeNumber).filter(Boolean))];
  const index = await getIndex();
  return new Map(normalized.map((number) => [number, index.get(number) ?? { cad: false, excel: false }]));
}
