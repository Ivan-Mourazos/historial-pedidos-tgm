"use client";

import { useEffect, useState } from "react";
import { dbService } from "@/lib/db/db-service";
import type { Tecnico } from "@/lib/types";
import {
  Banner,
  Button,
  Card,
  Field,
  PageTitle,
  inputClass,
} from "@/components/ui";

export default function TecnicosPage() {
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [nuevoNombre, setNuevoNombre] = useState("");
  const [guardando, setGuardando] = useState(false);

  const [editId, setEditId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState("");

  async function cargar() {
    try {
      setTecnicos(await dbService.getTecnicos());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar técnicos");
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    let active = true;
    dbService.getTecnicos()
      .then((items) => { if (active) setTecnicos(items); })
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Error al cargar técnicos");
      })
      .finally(() => { if (active) setCargando(false); });
    return () => { active = false; };
  }, []);

  async function crear() {
    const nombre = nuevoNombre.trim();
    if (!nombre) return;
    setGuardando(true);
    setError(null);
    try {
      await dbService.createTecnico(nombre);
      setNuevoNombre("");
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al crear técnico");
    } finally {
      setGuardando(false);
    }
  }

  async function guardarEdicion(t: Tecnico, activo: boolean) {
    try {
      await dbService.updateTecnico(
        t.id,
        editId === t.id ? editNombre : t.nombre,
        activo,
      );
      setEditId(null);
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al actualizar técnico");
    }
  }

  return (
    <div>
      <PageTitle
        title="Técnicos"
        subtitle="Lista de técnicos seleccionables al registrar un pedido."
      />

      {error && (
        <div className="mb-4">
          <Banner tone="warning">{error}</Banner>
        </div>
      )}

      <Card className="mb-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-64 flex-1">
            <Field label="Nuevo técnico">
              <input
                className={inputClass}
                value={nuevoNombre}
                onChange={(e) => setNuevoNombre(e.target.value)}
                placeholder="Nombre del técnico"
                onKeyDown={(e) => e.key === "Enter" && crear()}
              />
            </Field>
          </div>
          <Button onClick={crear} disabled={guardando || !nuevoNombre.trim()}>
            {guardando ? "Guardando…" : "Crear técnico"}
          </Button>
        </div>
      </Card>

      <Card>
        {cargando ? (
          <p className="text-sm text-slate-500">Cargando…</p>
        ) : tecnicos.length === 0 ? (
          <p className="text-sm text-slate-500">No hay técnicos todavía.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-app-muted">
                <th className="py-2 pr-3 text-[11px] font-semibold uppercase tracking-wider">Nombre</th>
                <th className="py-2 pr-3 text-[11px] font-semibold uppercase tracking-wider">Estado</th>
                <th className="py-2 text-right text-[11px] font-semibold uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {tecnicos.map((t) => (
                <tr key={t.id} className="border-b border-[var(--border)] transition-colors hover:bg-surface-2/60">
                  <td className="py-2 pr-3">
                    {editId === t.id ? (
                      <input
                        className={inputClass}
                        value={editNombre}
                        onChange={(e) => setEditNombre(e.target.value)}
                      />
                    ) : (
                      <span className="text-app-text">{t.nombre}</span>
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        t.activo
                          ? "bg-green-100 text-green-800 dark:bg-green-400/10 dark:text-green-200"
                          : "bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-300"
                      }`}
                    >
                      {t.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="py-2">
                    <div className="flex justify-end gap-2">
                      {editId === t.id ? (
                        <>
                          <Button onClick={() => guardarEdicion(t, t.activo)}>
                            Guardar
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => setEditId(null)}
                          >
                            Cancelar
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="secondary"
                            onClick={() => {
                              setEditId(t.id);
                              setEditNombre(t.nombre);
                            }}
                          >
                            Editar
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => guardarEdicion(t, !t.activo)}
                          >
                            {t.activo ? "Desactivar" : "Activar"}
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
