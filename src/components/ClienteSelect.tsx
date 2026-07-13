"use client";

import { useEffect, useState } from "react";
import { dbService } from "@/lib/db/db-service";
import { normalizarNombre } from "@/lib/normalize";
import type { Cliente } from "@/lib/types";
import { Button, SelectControl, inputClass, labelClass } from "./ui";

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
  const [consultaRps, setConsultaRps] = useState("");
  const [resultadosRps, setResultadosRps] = useState<Array<{ codigo: string; nombre: string; alias: string | null }>>([]);
  const [buscandoRps, setBuscandoRps] = useState(false);

  async function seleccionarRps(clienteRps: { codigo: string; nombre: string; alias: string | null }) {
    setError(null);
    try {
      const local = await dbService.getOrCreateClienteRps(clienteRps.codigo, clienteRps.nombre, clienteRps.alias);
      onClienteCreado?.(local);
      onChange(local.id);
      setConsultaRps("");
      setResultadosRps([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo vincular el cliente de RPS");
    }
  }

  useEffect(() => {
    const query = consultaRps.trim();
    if (query.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setBuscandoRps(true);
      try {
        const response = await fetch(`/api/rps/clientes?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Error consultando RPS");
        setResultadosRps(payload.clientes ?? []);
        const exacto = (payload.clientes ?? []).find((cliente: { codigo: string }) => cliente.codigo.toUpperCase() === query.toUpperCase());
        if (exacto) await seleccionarRps(exacto);
      } catch (e) {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Error consultando RPS");
      } finally {
        if (!controller.signal.aborted) setBuscandoRps(false);
      }
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  // seleccionarRps usa exclusivamente las props actuales del selector.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultaRps]);

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
      // Evita el error de índice único si existe fuera del catálogo visible
      // (por ejemplo, porque estaba inactivo).
      const nuevo = await dbService.getOrCreateCliente(limpio);
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
            className={`${inputClass} min-w-[180px] flex-1`}
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
        <div className="space-y-2">
          <div className="relative">
            <input
              className={inputClass}
              autoComplete="off"
              value={consultaRps}
              onChange={(event) => {
                const value = event.target.value;
                setConsultaRps(value);
                if (value.trim().length < 2) setResultadosRps([]);
              }}
              placeholder="Código, alias o nombre en RPS…"
              aria-label="Buscar cliente por código, alias o nombre en RPS"
            />
            {buscandoRps && <span className="absolute right-3 top-2.5 text-xs text-app-muted">Buscando…</span>}
            {resultadosRps.length > 0 && consultaRps && (
              <div className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-[var(--border)] bg-surface p-1 shadow-xl">
                {resultadosRps.map((cliente) => (
                  <button
                    key={cliente.codigo}
                    type="button"
                    onClick={() => seleccionarRps(cliente)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-2"
                  >
                    <span className="w-16 shrink-0 font-mono font-semibold text-brand">{cliente.codigo}</span>
                    <span className="min-w-0">
                      {cliente.alias && <span className="block truncate font-semibold text-app-text">{cliente.alias}</span>}
                      <span className="block truncate text-xs text-app-muted">{cliente.nombre}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
          <SelectControl
            className="min-w-[180px] flex-1"
            value={value ?? ""}
            onChange={(next) => onChange(next || null)}
            placeholder="— Selecciona cliente —"
            options={[
              { value: "", label: "— Selecciona cliente —" },
              ...clientes.map((c) => ({ value: c.id, label: c.nombre })),
            ]}
          />
          {permitirCrear && (
            <Button variant="secondary" onClick={() => setCreando(true)}>
              + Nuevo
            </Button>
          )}
          </div>
        </div>
      )}
      {error && <p className="mt-1 text-xs text-amber-700">{error}</p>}
    </div>
  );
}
