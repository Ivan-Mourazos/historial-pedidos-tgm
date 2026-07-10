"use client";

import { useEffect, useState } from "react";
import {
  Banner,
  Button,
  Field,
  inputClass,
  modalCompactClass,
  modalOverlayClass,
  modalPanelClass,
} from "./ui";

export function CrearEntidadModal({
  titulo,
  etiqueta,
  placeholder,
  onGuardar,
  onCerrar,
}: {
  titulo: string;
  etiqueta: string;
  placeholder: string;
  onGuardar: (nombre: string) => Promise<void>;
  onCerrar: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCerrar();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onCerrar]);

  async function guardar() {
    const limpio = nombre.trim();
    if (!limpio) return;
    setGuardando(true);
    setError(null);
    try {
      await onGuardar(limpio);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
      setGuardando(false);
    }
  }

  return (
    <div className={`${modalOverlayClass} flex items-center justify-center`}>
      <div
        aria-labelledby="crear-entidad-title"
        aria-modal="true"
        className={`${modalPanelClass} ${modalCompactClass} max-w-[360px] p-4`}
        role="dialog"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 id="crear-entidad-title" className="text-[15px] font-semibold tracking-tight text-app-text">
              {titulo}
            </h2>
          </div>
          <button
            type="button"
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-2 text-app-muted transition-colors hover:bg-[var(--border)] hover:text-app-text"
            onClick={onCerrar}
            aria-label="Cerrar"
          >
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        {error && <div className="mb-3"><Banner tone="warning">{error}</Banner></div>}
        <Field label={etiqueta}>
          <input
            autoFocus
            className={inputClass}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder={placeholder}
            onKeyDown={(e) => e.key === "Enter" && guardar()}
          />
        </Field>
        <div className="mt-4 flex justify-end gap-2 border-t border-[var(--border)] pt-3">
          <Button variant="secondary" className="h-8 px-3" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button
            className="h-8 px-3"
            onClick={guardar}
            disabled={guardando || !nombre.trim()}
          >
            {guardando ? "Guardando…" : "Crear"}
          </Button>
        </div>
      </div>
    </div>
  );
}
