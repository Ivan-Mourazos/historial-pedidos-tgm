import { spawn } from "node:child_process";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { buildCadOpenUrl, buildClientOpenInfo, type ClientOpenInfo } from "@/lib/files/client-open";
import { normalizarNumeroPedido } from "@/lib/pedido-numero";

const DWG_EXTENSION = ".dwg";
const YEAR_PREFIX = "20";

export interface PedidoDwgOpenResult extends ClientOpenInfo {
  filePath: string;
  cadUrl?: string;
  openedOnServer: boolean;
}

function parseEnvList(value: string | undefined): string[] {
  return (value ?? "")
    .split(/[;\n]/)
    .map((item) => item.trim().replace(/^"|"$/g, ""))
    .filter(Boolean);
}

function assertPedidoSeguro(numeroPedido: string): string {
  const numero = normalizarNumeroPedido(numeroPedido);
  if (!/^[A-Z0-9_-]+$/.test(numero)) {
    throw new Error("Número de pedido no válido para abrir DWG.");
  }
  return numero;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    const info = await stat(filePath);
    return info.isFile();
  } catch {
    return false;
  }
}

export function getDwgRoots(): string[] {
  return parseEnvList(process.env.ZWCAD_DWG_ROOTS);
}

function getYearFolderFromPedido(numeroPedido: string): string | null {
  const match = numeroPedido.match(/^[A-Z]{2}(\d{2})/);
  return match ? `${YEAR_PREFIX}${match[1]}` : null;
}

export async function findDwgForPedido(numeroPedido: string): Promise<string> {
  const numero = assertPedidoSeguro(numeroPedido);
  const roots = getDwgRoots();
  if (roots.length === 0) {
    throw new Error("Falta configurar ZWCAD_DWG_ROOTS con la carpeta de pedidos DWG.");
  }

  const targetFile = `${numero}${DWG_EXTENSION}`;
  const targetLower = targetFile.toLowerCase();
  const yearFolder = getYearFolderFromPedido(numero);

  for (const root of roots) {
    if (yearFolder) {
      const yearPath = path.join(root, yearFolder, targetFile);
      if (await fileExists(yearPath)) return yearPath;
    }

    const directPath = path.join(root, targetFile);
    if (await fileExists(directPath)) return directPath;
  }

  for (const root of roots) {
    const stack = [root];
    while (stack.length > 0) {
      const current = stack.pop() as string;
      let entries;
      try {
        entries = await readdir(current, { withFileTypes: true });
      } catch {
        continue;
      }

      for (const entry of entries) {
        const fullPath = path.join(current, entry.name);
        if (entry.isFile() && entry.name.toLowerCase() === targetLower) {
          return fullPath;
        }
        if (entry.isDirectory()) stack.push(fullPath);
      }
    }
  }

  throw new Error(`No se encontró ${targetFile} en las carpetas configuradas.`);
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

export async function openDwgWithZwcad(filePath: string): Promise<void> {
  const zwcadExe = process.env.ZWCAD_EXE?.trim().replace(/^"|"$/g, "");

  if (zwcadExe) {
    await spawnDetached(zwcadExe, [filePath]);
    return;
  }

  if (process.platform !== "win32") {
    throw new Error("ZWCAD_EXE es obligatorio si la app no se ejecuta en Windows.");
  }

  await spawnDetached("cmd.exe", ["/c", "start", "", filePath]);
}

export async function openPedidoInZwcad(numeroPedido: string): Promise<string> {
  const filePath = await findDwgForPedido(numeroPedido);
  await openDwgWithZwcad(filePath);
  return filePath;
}

export async function getPedidoDwgOpenTarget(numeroPedido: string): Promise<PedidoDwgOpenResult> {
  const filePath = await findDwgForPedido(numeroPedido);

  if (process.platform === "win32" || process.env.ZWCAD_EXE?.trim()) {
    const clientInfo = buildClientOpenInfo(filePath, getDwgRoots());
    await openDwgWithZwcad(filePath);
    return {
      filePath,
      openedOnServer: true,
      ...clientInfo,
      cadUrl: buildCadOpenUrl(clientInfo.clientPath, clientInfo.fileUrl),
    };
  }

  const clientInfo = buildClientOpenInfo(filePath, getDwgRoots());
  if (!clientInfo.clientPath && !clientInfo.fileUrl) {
    throw new Error(
      "El servidor Linux encontró el DWG, pero falta configurar ZWCAD_CLIENT_ROOTS para convertir /mnt/oftecnica a la ruta de red Windows.",
    );
  }

  return {
    filePath,
    openedOnServer: false,
    ...clientInfo,
    cadUrl: buildCadOpenUrl(clientInfo.clientPath, clientInfo.fileUrl),
  };
}
