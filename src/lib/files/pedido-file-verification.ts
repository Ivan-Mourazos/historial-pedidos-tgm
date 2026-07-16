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
const CACHE_MS = 5 * 60 * 1000;
const cache = new Map<string, { expiresAt: number; value: Map<string, PedidoFileStatus> }>();

const normalizeNumber = (value: string) => value.toLocaleUpperCase("es-ES").replace(/[^A-Z0-9]/g, "");

export async function verifyPedidoFiles(numbers: string[]): Promise<Map<string, PedidoFileStatus>> {
  const normalized = [...new Set(numbers.map(normalizeNumber).filter(Boolean))];
  const cacheKey = normalized.slice().sort().join("|");
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const wanted = new Set(normalized);
  const result = new Map(normalized.map((number) => [number, { cad: false, excel: false }]));
  const roots = getDwgRoots();
  const stack = [...roots];

  while (stack.length > 0) {
    const folder = stack.pop() as string;
    let entries;
    try {
      entries = await readdir(folder, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(folder, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (!entry.isFile()) continue;
      const extension = path.extname(entry.name).toLocaleLowerCase("es-ES");
      if (!VALID_EXTENSIONS.has(extension)) continue;
      const base = normalizeNumber(path.basename(entry.name, extension).split(/[-_]/, 1)[0]);
      if (!wanted.has(base)) continue;
      const status = result.get(base) as PedidoFileStatus;
      if (extension === ".dwg") status.cad = true;
      if (EXCEL_EXTENSIONS.has(extension)) status.excel = true;
    }
  }

  cache.set(cacheKey, { expiresAt: Date.now() + CACHE_MS, value: result });
  return result;
}
