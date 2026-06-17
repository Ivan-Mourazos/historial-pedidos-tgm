"use client";

import { useState } from "react";
import { Banner, Button, Field, inputClass } from "./ui";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div
        className="w-full max-w-sm rounded-xl border border-[var(--border-strong)] bg-surface p-5"
        style={{ boxShadow: "var(--shadow-lg)" }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-app-text">{titulo}</h2>
          <button
            className="rounded-md p-1 text-app-muted transition-colors hover:bg-surface-2 hover:text-app-text"
            onClick={onCerrar}
            aria-label="Cerrar"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={onCerrar}>Cancelar</Button>
          <Button onClick={guardar} disabled={guardando || !nombre.trim()}>
            {guardando ? "Guardando…" : "Crear"}
          </Button>
        </div>
      </div>
    </div>
  );
}
