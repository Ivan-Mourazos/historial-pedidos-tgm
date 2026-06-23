import path from "node:path";

export interface ClientOpenInfo {
  clientPath?: string;
  fileUrl?: string;
}

function parseEnvList(value: string | undefined): string[] {
  return (value ?? "")
    .split(/[;\n]/)
    .map((item) => item.trim().replace(/^"|"$/g, ""))
    .filter(Boolean);
}

function trimTrailingSeparators(value: string): string {
  return value.replace(/[\\/]+$/g, "");
}

function toComparablePath(value: string): string {
  return path.resolve(value).toLowerCase();
}

function joinClientPath(clientRoot: string, relativePath: string): string {
  const cleanRoot = trimTrailingSeparators(clientRoot);
  const relativeParts = relativePath.split(/[\\/]+/).filter(Boolean);

  if (cleanRoot.startsWith("\\\\") || /^[A-Za-z]:[\\/]/.test(cleanRoot)) {
    return `${cleanRoot}\\${relativeParts.join("\\")}`;
  }

  return `${cleanRoot}/${relativeParts.join("/")}`;
}

function encodeFileUrlParts(parts: string[]): string {
  return parts.map((part) => encodeURIComponent(part)).join("/");
}

export function clientPathToFileUrl(clientPath: string): string | undefined {
  const windowsPath = clientPath.replace(/\//g, "\\");

  if (windowsPath.startsWith("\\\\")) {
    const parts = windowsPath.slice(2).split("\\").filter(Boolean);
    if (parts.length < 2) return undefined;
    const [server, ...rest] = parts;
    return `file://${server}/${encodeFileUrlParts(rest)}`;
  }

  const driveMatch = windowsPath.match(/^([A-Za-z]):\\(.+)$/);
  if (driveMatch) {
    return `file:///${driveMatch[1]}:/${encodeFileUrlParts(driveMatch[2].split("\\").filter(Boolean))}`;
  }

  if (clientPath.startsWith("/")) {
    return `file:///${encodeFileUrlParts(clientPath.split("/").filter(Boolean))}`;
  }

  return undefined;
}

export function buildExcelOpenUrl(fileUrl?: string): string | undefined {
  return fileUrl ? `ms-excel:ofe|u|${fileUrl}` : undefined;
}

export function buildCadOpenUrl(clientPath?: string, fileUrl?: string): string | undefined {
  if (!clientPath) return undefined;

  const template = process.env.ZWCAD_CLIENT_CAD_URL_TEMPLATE?.trim();
  if (!template) return undefined;

  return template
    .replaceAll("{path}", encodeURIComponent(clientPath))
    .replaceAll("{rawPath}", clientPath)
    .replaceAll("{fileUrl}", encodeURIComponent(fileUrl ?? ""));
}

export function buildClientOpenInfo(filePath: string, serverRoots: string[]): ClientOpenInfo {
  const clientRoots = parseEnvList(process.env.ZWCAD_CLIENT_ROOTS);

  for (const [index, serverRoot] of serverRoots.entries()) {
    const relativePath = path.relative(serverRoot, filePath);
    const isInsideRoot = relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
    if (!isInsideRoot) continue;

    const clientRoot = clientRoots[index] ?? (serverRoot.startsWith("\\\\") ? serverRoot : undefined);
    if (!clientRoot) continue;

    const clientPath = relativePath ? joinClientPath(clientRoot, relativePath) : trimTrailingSeparators(clientRoot);
    return {
      clientPath,
      fileUrl: clientPathToFileUrl(clientPath),
    };
  }

  if (process.platform === "win32") {
    return {
      clientPath: filePath,
      fileUrl: clientPathToFileUrl(filePath),
    };
  }

  const resolvedFilePath = toComparablePath(filePath);
  for (const [index, serverRoot] of serverRoots.entries()) {
    const resolvedRoot = toComparablePath(serverRoot);
    if (resolvedFilePath.startsWith(`${resolvedRoot}${path.sep}`)) {
      const relativePath = path.relative(serverRoot, filePath);
      const clientRoot = clientRoots[index];
      if (!clientRoot) continue;

      const clientPath = joinClientPath(clientRoot, relativePath);
      return {
        clientPath,
        fileUrl: clientPathToFileUrl(clientPath),
      };
    }
  }

  return {};
}
