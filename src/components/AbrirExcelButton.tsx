"use client";

import { useEffect, useMemo, useState } from "react";

type Estado = "idle" | "opening" | "ok";

interface ExcelOpenResponse {
  error?: string;
  openedOnServer?: boolean;
  excelUrl?: string;
  clientPath?: string;
}

export interface ExcelFileOption {
  name: string;
}

const EXCEL_EMOJI = "📊";

function puedeTenerExcel(familiaNombre: string, tipo?: string | null): boolean {
  return familiaNombre === "REMOLQUES" && !(tipo ?? "").toLowerCase().includes("ganado");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function excelOptionLabel(fileName: string, numeroPedido: string, fallback = "Excel"): string {
  const nameWithoutExtension = fileName.replace(/\.[^.]+$/, "");
  const match = nameWithoutExtension.match(
    new RegExp(`^${escapeRegExp(numeroPedido)}\\s*-\\s*(.+)$`, "i"),
  );

  const suffix = match?.[1]?.trim();
  if (!suffix) return fallback;
  return /^\d+$/.test(suffix) ? `-${suffix}` : suffix;
}

export function AbrirExcelButton({
  numeroPedido,
  familiaNombre,
  tipo,
  label,
  files,
  className = "",
}: {
  numeroPedido: string;
  familiaNombre: string;
  tipo?: string | null;
  label?: string;
  files?: ExcelFileOption[];
  className?: string;
}) {
  const eligible = useMemo(
    () => puedeTenerExcel(familiaNombre, tipo),
    [familiaNombre, tipo],
  );
  const [estado, setEstado] = useState<Estado>("idle");
  const [discoveredFiles, setDiscoveredFiles] = useState<ExcelFileOption[]>([]);
  const [menuAbierto, setMenuAbierto] = useState(false);

  useEffect(() => {
    if (!eligible || files !== undefined) return;

    let activo = true;
    fetch("/api/excel/list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ numeroPedido }),
    })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as {
          files?: ExcelFileOption[];
          error?: string;
        };
        if (!res.ok) throw new Error(data.error ?? "No se pudo comprobar el Excel.");
        if (activo) setDiscoveredFiles(data.files ?? []);
      })
      .catch(() => {
        if (activo) setDiscoveredFiles([]);
      });

    return () => {
      activo = false;
    };
  }, [eligible, files, numeroPedido]);

  async function abrir(fileName: string) {
    if (estado === "opening") return;
    setEstado("opening");

    try {
      const res = await fetch("/api/excel/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numeroPedido, fileName }),
      });
      const data = (await res.json().catch(() => ({}))) as ExcelOpenResponse;
      if (!res.ok) throw new Error(data.error ?? "No se pudo abrir el Excel.");

      if (!data.openedOnServer) {
        if (data.excelUrl) {
          window.location.assign(data.excelUrl);
        } else if (data.clientPath) {
          await navigator.clipboard?.writeText(data.clientPath).catch(() => undefined);
          window.alert(`Ruta copiada al portapapeles:\n${data.clientPath}`);
        }
      }

      setEstado("ok");
      window.setTimeout(() => setEstado("idle"), 1400);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo abrir el Excel.";
      window.alert(message);
      setEstado("idle");
    }
  }

  const visibleFiles = files ?? discoveredFiles;

  if (!eligible || visibleFiles.length === 0) return null;

  const baseClass = label
    ? "inline-flex h-8 min-w-0 max-w-full items-center justify-center gap-1.5 rounded-full border border-emerald-200/70 bg-emerald-50/80 px-3 text-xs font-semibold text-emerald-800 shadow-sm ring-1 ring-black/5 transition-colors hover:bg-emerald-100 disabled:cursor-wait disabled:opacity-70 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200 dark:ring-white/10 dark:hover:border-emerald-400/30 dark:hover:bg-emerald-400/15"
    : "inline-flex h-8 min-w-0 max-w-full items-center justify-center gap-1.5 rounded-full border border-emerald-200/70 bg-emerald-50/80 px-2.5 text-xs font-semibold text-emerald-800 shadow-sm ring-1 ring-black/5 transition-colors hover:bg-emerald-100 disabled:cursor-wait disabled:opacity-70 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200 dark:ring-white/10 dark:hover:border-emerald-400/30 dark:hover:bg-emerald-400/15";

  if (visibleFiles.length > 1) {
    return (
      <div className={`relative inline-flex ${className}`}>
        <button
          type="button"
          onClick={() => setMenuAbierto((abierto) => !abierto)}
          className={`${baseClass} w-full`}
          title={`Abrir Excel de ${numeroPedido}`}
          aria-label={`Abrir Excel de ${numeroPedido}`}
          aria-expanded={menuAbierto}
        >
          <span aria-hidden="true">{EXCEL_EMOJI}</span>
          <span>Excel</span>
          <span aria-hidden="true" className="text-[10px]">▾</span>
        </button>

        {menuAbierto && (
          <div className="absolute left-0 top-9 z-30 min-w-[130px] overflow-hidden rounded-[14px] border border-white/10 bg-surface/95 py-1 shadow-xl ring-1 ring-black/5 backdrop-blur-xl dark:bg-slate-950/90 dark:ring-white/10">
            {visibleFiles.map((file) => (
              <button
                key={file.name}
                type="button"
                onClick={() => {
                  setMenuAbierto(false);
                  void abrir(file.name);
                }}
                className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-xs font-semibold text-emerald-800 transition-colors hover:bg-emerald-50 dark:text-emerald-200 dark:hover:bg-emerald-400/10"
                title={file.name}
              >
                <span aria-hidden="true">{EXCEL_EMOJI}</span>
                <span className="truncate">
                  {excelOptionLabel(file.name, numeroPedido, file.name)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  const fallback = label ?? "Excel";
  const text = estado === "opening"
    ? "Abriendo..."
    : estado === "ok"
      ? "Abierto"
      : excelOptionLabel(visibleFiles[0].name, numeroPedido, fallback);
  const title = `Abrir ${visibleFiles[0].name}`;

  return (
    <button
      type="button"
      onClick={() => void abrir(visibleFiles[0].name)}
      disabled={estado === "opening"}
      className={`${baseClass} ${className}`}
      title={title}
      aria-label={title}
    >
      <span aria-hidden="true">{EXCEL_EMOJI}</span>
      <span className="truncate">{text}</span>
    </button>
  );
}
