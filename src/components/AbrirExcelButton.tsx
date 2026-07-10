"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

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
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

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

  const cerrarMenu = useCallback(() => {
    setMenuAbierto(false);
    setMenuStyle(null);
  }, []);

  useEffect(() => {
    if (!menuAbierto) {
      return;
    }

    const updateMenuPosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const margin = 8;
      const gap = 6;
      const estimatedHeight = Math.min(240, visibleFiles.length * 32 + 8);
      const spaceBelow = window.innerHeight - rect.bottom - margin - gap;
      const openAbove = spaceBelow < estimatedHeight && rect.top > spaceBelow;
      const maxHeight = Math.max(80, Math.min(240, openAbove ? rect.top - margin - gap : spaceBelow));

      setMenuStyle({
        left: Math.min(rect.left, window.innerWidth - Math.max(rect.width, 130) - margin),
        maxHeight,
        minWidth: Math.max(rect.width, 130),
        position: "fixed",
        top: openAbove ? Math.max(margin, rect.top - gap - maxHeight) : rect.bottom + gap,
        zIndex: 2147483647,
      });
    };

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [menuAbierto, visibleFiles.length]);

  useEffect(() => {
    if (!menuAbierto) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) cerrarMenu();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [cerrarMenu, menuAbierto]);

  if (!eligible || visibleFiles.length === 0) return null;

  const baseClass = label
    ? "inline-flex h-8 min-w-0 max-w-full items-center justify-center gap-1.5 rounded-full border border-emerald-200/70 bg-emerald-50/80 px-3 text-xs font-semibold text-emerald-800 shadow-sm ring-1 ring-black/5 transition-colors hover:bg-emerald-100 disabled:cursor-wait disabled:opacity-70 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200 dark:ring-white/10 dark:hover:border-emerald-400/30 dark:hover:bg-emerald-400/15"
    : "inline-flex h-8 min-w-0 max-w-full items-center justify-center gap-1.5 rounded-full border border-emerald-200/70 bg-emerald-50/80 px-2.5 text-xs font-semibold text-emerald-800 shadow-sm ring-1 ring-black/5 transition-colors hover:bg-emerald-100 disabled:cursor-wait disabled:opacity-70 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200 dark:ring-white/10 dark:hover:border-emerald-400/30 dark:hover:bg-emerald-400/15";

  if (visibleFiles.length > 1) {
    return (
      <div className={`relative inline-flex ${className}`}>
        <button
          ref={triggerRef}
          type="button"
          onClick={() => (menuAbierto ? cerrarMenu() : setMenuAbierto(true))}
          className={`${baseClass} w-full`}
          title={`Abrir Excel de ${numeroPedido}`}
          aria-label={`Abrir Excel de ${numeroPedido}`}
          aria-expanded={menuAbierto}
        >
          <span aria-hidden="true">{EXCEL_EMOJI}</span>
          <span>Excel</span>
          <span aria-hidden="true" className="text-[10px]">▾</span>
        </button>

        {menuAbierto && menuStyle && typeof document !== "undefined" && createPortal(
          <div
            ref={menuRef}
            className="overflow-y-auto rounded-[14px] border border-white/10 bg-surface/95 py-1 shadow-xl ring-1 ring-black/5 backdrop-blur-xl dark:bg-slate-950/90 dark:ring-white/10"
            style={menuStyle}
          >
            {visibleFiles.map((file) => (
              <button
                key={file.name}
                type="button"
                onClick={() => {
                  cerrarMenu();
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
          </div>,
          document.body,
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
