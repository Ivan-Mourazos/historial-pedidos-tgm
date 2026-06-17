"use client";

import { useState } from "react";
import { dbService } from "@/lib/db/db-service";
import { normalizarNombre } from "@/lib/normalize";
import type { Cliente } from "@/lib/types";
import { Button, inputClass, labelClass } from "./ui";

export function ClienteSelect({
  clientes,
  value,
  onChange,
  onClienteCreado,
  permitirCrear = true,
}: {
  clientes: Cliente[];
  value: string | null;
  onChange: (clienteId: string | null) => void;
  onClienteCreado?: (cliente: Cliente) => void;
  permitirCrear?: boolean;
}) {
  const [creando, setCreando] = useState(false);
  const [nombre, setNombre] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function crear() {
    const limpio = nombre.trim();
    if (!limpio) return;
    const normalizado = normalizarNombre(limpio);
    const existente = clientes.find(
      (c) => c.nombre_normalizado === normalizado,
    );
    if (existente) {
      onChange(existente.id);
      setCreando(false);
      setNombre("");
      setError(`Ya existía ese cliente: se ha seleccionado "${existente.nombre}".`);
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      const nuevo = await dbService.createCliente(limpio);
      onClienteCreado?.(nuevo);
      onChange(nuevo.id);
      setCreando(false);
      setNombre("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al crear cliente");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div>
      <span className={labelClass}>Cliente</span>
      {creando ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            className={`${inputClass} max-w-xs`}
            autoFocus
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre del nuevo cliente"
            onKeyDown={(e) => e.key === "Enter" && crear()}
          />
          <Button onClick={crear} disabled={guardando || !nombre.trim()}>
            {guardando ? "Creando…" : "Crear"}
          </Button>
          <Button variant="secondary" onClick={() => setCreando(false)}>
            Cancelar
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <select
            className={`${inputClass} max-w-xs`}
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value || null)}
          >
            <option value="">— Selecciona cliente —</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
          {permitirCrear && (
            <Button variant="secondary" onClick={() => setCreando(true)}>
              + Nuevo
            </Button>
          )}
        </div>
      )}
      {error && <p className="mt-1 text-xs text-amber-700">{error}</p>}
    </div>
  );
}
