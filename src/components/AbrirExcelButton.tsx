"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { familiaPuedeTenerExcel } from "@/lib/familias";

type Estado = "checking" | "idle" | "ok" | "opening";

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
  label,
  files,
  className = "",
  compact = false,
}: {
  numeroPedido: string;
  familiaNombre: string;
  label?: string;
  files?: ExcelFileOption[];
  className?: string;
  compact?: boolean;
}) {
  const eligible = familiaPuedeTenerExcel(familiaNombre);
  const [estado, setEstado] = useState<Estado>("idle");
  const [discoveredFiles, setDiscoveredFiles] = useState<ExcelFileOption[] | undefined>();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const visibleFiles = files ?? discoveredFiles;

  const cerrarMenu = useCallback(() => {
    setMenuAbierto(false);
    setMenuStyle(null);
    triggerRef.current?.focus();
  }, []);

  async function descubrir(): Promise<ExcelFileOption[]> {
    setEstado("checking");
    try {
      const response = await fetch("/api/excel/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numeroPedido }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        files?: ExcelFileOption[];
        error?: string;
      };
      if (!response.ok) throw new Error(data.error ?? "No se pudo comprobar el Excel.");
      const found = data.files ?? [];
      setDiscoveredFiles(found);
      return found;
    } finally {
      setEstado("idle");
    }
  }

  async function abrir(fileName: string) {
    if (estado === "opening") return;
    setEstado("opening");
    try {
      const response = await fetch("/api/excel/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numeroPedido, fileName }),
      });
      const data = (await response.json().catch(() => ({}))) as ExcelOpenResponse;
      if (!response.ok) throw new Error(data.error ?? "No se pudo abrir el Excel.");

      if (!data.openedOnServer) {
        if (data.clientPath) {
          await navigator.clipboard?.writeText(data.clientPath).catch(() => undefined);
        }
        if (data.excelUrl) {
          window.location.assign(data.excelUrl);
        } else if (data.clientPath) {
          window.alert(`Instala el protocolo TGM en este PC. La ruta se ha copiado al portapapeles:\n${data.clientPath}`);
        }
      }

      setEstado("ok");
      window.setTimeout(() => setEstado("idle"), 1400);
    } catch (error) {
      setEstado("idle");
      window.alert(error instanceof Error ? error.message : "No se pudo abrir el Excel.");
    }
  }

  async function handleTrigger() {
    if (menuAbierto) {
      cerrarMenu();
      return;
    }
    try {
      const available = visibleFiles ?? await descubrir();
      if (available.length === 0) {
        window.alert(`No se encontró ningún Excel para ${numeroPedido}.`);
      } else if (available.length === 1) {
        await abrir(available[0].name);
      } else {
        setMenuAbierto(true);
      }
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "No se pudo comprobar el Excel.");
    }
  }

  useEffect(() => {
    if (!menuAbierto || !visibleFiles) return;
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
  }, [menuAbierto, visibleFiles]);

  useEffect(() => {
    if (!menuAbierto) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) cerrarMenu();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") cerrarMenu();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [cerrarMenu, menuAbierto]);

  if (!eligible || (files !== undefined && files.length === 0)) return null;

  const baseClass = "inline-flex h-8 min-w-0 max-w-full items-center justify-center gap-1.5 rounded-full border border-emerald-200/70 bg-emerald-50/80 px-2.5 text-xs font-semibold text-emerald-800 shadow-sm ring-1 ring-black/5 transition-colors hover:bg-emerald-100 disabled:cursor-wait disabled:opacity-70 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200 dark:ring-white/10";
  const text = estado === "checking"
    ? "Buscando…"
    : estado === "opening"
      ? "Abriendo…"
      : estado === "ok"
        ? "Abierto"
        : visibleFiles?.length === 1
          ? excelOptionLabel(visibleFiles[0].name, numeroPedido, label ?? "Excel")
          : label ?? "Excel";

  return (
    <div className={`relative inline-flex ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => void handleTrigger()}
        disabled={estado === "checking" || estado === "opening"}
        className={`${baseClass} ${compact ? "" : "w-full"}`}
        title={`Abrir Excel de ${numeroPedido}`}
        aria-label={`Abrir Excel de ${numeroPedido}`}
        aria-expanded={menuAbierto}
        aria-haspopup="menu"
      >
        <span aria-hidden="true">{EXCEL_EMOJI}</span>
        {!compact && <span className="truncate">{text}</span>}
        {(visibleFiles?.length ?? 0) > 1 && <span aria-hidden="true" className="text-[10px]">▾</span>}
      </button>

      {menuAbierto && menuStyle && visibleFiles && typeof document !== "undefined" && createPortal(
        <div
          ref={menuRef}
          className="overflow-y-auto rounded-[14px] border border-white/10 bg-surface/95 py-1 shadow-xl ring-1 ring-black/5 backdrop-blur-xl dark:bg-slate-950/90 dark:ring-white/10"
          style={menuStyle}
          role="menu"
        >
          {visibleFiles.map((file) => (
            <button
              key={file.name}
              type="button"
              role="menuitem"
              onClick={() => { cerrarMenu(); void abrir(file.name); }}
              className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-xs font-semibold text-emerald-800 transition-colors hover:bg-emerald-50 dark:text-emerald-200 dark:hover:bg-emerald-400/10"
              title={file.name}
            >
              <span aria-hidden="true">{EXCEL_EMOJI}</span>
              <span className="truncate">{excelOptionLabel(file.name, numeroPedido, file.name)}</span>
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}
