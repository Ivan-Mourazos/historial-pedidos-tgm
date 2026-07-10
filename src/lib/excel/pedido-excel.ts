import { spawn } from "node:child_process";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { getDwgRoots } from "@/lib/cad/zwcad";
import { buildClientOpenInfo, buildClientOpenUrl, type ClientOpenInfo } from "@/lib/files/client-open";
import { normalizarNumeroPedido } from "@/lib/pedido-numero";

const EXCEL_EXTENSIONS = [".xlsx", ".xlsm", ".xls", ".xlsb"];
const CACHE_TTL_MS = 30_000;

export interface PedidoExcelFile {
  name: string;
  path: string;
}

export interface PedidoExcelOpenResult extends PedidoExcelFile, ClientOpenInfo {
  excelUrl?: string;
  openedOnServer: boolean;
}

interface FolderCacheEntry {
  expiresAt: number;
  files: PedidoExcelFile[];
}

const folderCache = new Map<string, FolderCacheEntry>();

function assertPedidoSeguro(numeroPedido: string): string {
  const numero = normalizarNumeroPedido(numeroPedido);
  if (!/^[A-Z0-9_-]+$/.test(numero)) {
    throw new Error("Número de pedido no válido para abrir Excel.");
  }
  return numero;
}

function getYearFolderFromPedido(numeroPedido: string): string | null {
  const match = numeroPedido.match(/^[A-Z]{2}(\d{2})/);
  return match ? `20${match[1]}` : null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function excelSuffixOrder(fileName: string, numeroPedido: string): number {
  const exact = new RegExp(`^${escapeRegExp(numeroPedido)}\\.`, "i");
  if (exact.test(fileName)) return 0;

  const match = fileName.match(new RegExp(`^${escapeRegExp(numeroPedido)}\\s*-\\s*(\\d+)`, "i"));
  return match ? Number(match[1]) : 999_999;
}

function isExcelFile(fileName: string): boolean {
  return EXCEL_EXTENSIONS.includes(path.extname(fileName).toLowerCase());
}

async function getExcelFilesInFolder(folder: string): Promise<PedidoExcelFile[]> {
  const now = Date.now();
  const cached = folderCache.get(folder);
  if (cached && cached.expiresAt > now) return cached.files;

  let entries;
  try {
    entries = await readdir(folder, { withFileTypes: true });
  } catch {
    folderCache.set(folder, { expiresAt: now + CACHE_TTL_MS, files: [] });
    return [];
  }

  const files = entries
    .filter((entry) => entry.isFile() && isExcelFile(entry.name))
    .map((entry) => ({ name: entry.name, path: path.join(folder, entry.name) }));

  folderCache.set(folder, { expiresAt: now + CACHE_TTL_MS, files });
  return files;
}

function matchesPedidoExcel(fileName: string, numeroPedido: string): boolean {
  const base = escapeRegExp(numeroPedido);
  const ext = EXCEL_EXTENSIONS.map((item) => escapeRegExp(item.slice(1))).join("|");
  const pattern = new RegExp(`^${base}(?:\\s*-.+)?\\.(${ext})$`, "i");

  return pattern.test(fileName);
}

async function findMatchingExcelInFolder(folder: string, numeroPedido: string): Promise<PedidoExcelFile[]> {
  const files = await getExcelFilesInFolder(folder);

  return files
    .filter((file) => matchesPedidoExcel(file.name, numeroPedido))
    .sort((a, b) => {
      const suffixA = excelSuffixOrder(a.name, numeroPedido);
      const suffixB = excelSuffixOrder(b.name, numeroPedido);
      if (suffixA !== suffixB) return suffixA - suffixB;
      return a.name.localeCompare(b.name);
    });
}

export async function findExcelFilesForPedido(numeroPedido: string): Promise<PedidoExcelFile[]> {
  const numero = assertPedidoSeguro(numeroPedido);
  const roots = getDwgRoots();
  if (roots.length === 0) {
    throw new Error("Falta configurar ZWCAD_DWG_ROOTS con la carpeta de pedidos.");
  }

  const yearFolder = getYearFolderFromPedido(numero);
  const folders = roots.flatMap((root) => (
    yearFolder ? [path.join(root, yearFolder), root] : [root]
  ));

  const seen = new Set<string>();
  const files: PedidoExcelFile[] = [];
  for (const folder of folders) {
    const matches = await findMatchingExcelInFolder(folder, numero);
    for (const match of matches) {
      const key = match.path.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        files.push(match);
      }
    }
  }

  return files;
}

async function spawnDetached(command: string, args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });

    const timer = setTimeout(() => resolve(), 250);
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.unref();
  });
}

export async function openPedidoExcel(numeroPedido: string, fileName?: string): Promise<PedidoExcelOpenResult> {
  const files = await findExcelFilesForPedido(numeroPedido);
  if (files.length === 0) {
    throw new Error("No se encontró Excel para este pedido.");
  }

  const file = fileName
    ? files.find((item) => item.name === fileName)
    : files[0];

  if (!file) {
    throw new Error("El Excel seleccionado ya no está disponible.");
  }

  const clientInfo = buildClientOpenInfo(file.path, getDwgRoots());

  if (process.platform === "win32") {
    await spawnDetached("explorer.exe", [file.path]);
    return {
      ...file,
      ...clientInfo,
      excelUrl: buildClientOpenUrl("excel", clientInfo.clientPath, clientInfo.fileUrl),
      openedOnServer: true,
    };
  }

  const excelUrl = buildClientOpenUrl("excel", clientInfo.clientPath, clientInfo.fileUrl);
  if (!clientInfo.clientPath) {
    throw new Error(
      "El servidor Linux encontró el Excel, pero falta configurar ZWCAD_CLIENT_ROOTS para convertir su ruta a Windows.",
    );
  }

  return {
    ...file,
    ...clientInfo,
    excelUrl,
    openedOnServer: false,
  };
}
