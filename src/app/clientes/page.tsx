"use client";

import { useEffect, useState } from "react";
import { dbService } from "@/lib/db/db-service";
import { normalizarNombre } from "@/lib/normalize";
import type { Cliente } from "@/lib/types";
import {
  Banner,
  Button,
  Card,
  Field,
  PageTitle,
  inputClass,
} from "@/components/ui";

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [nuevoNombre, setNuevoNombre] = useState("");
  const [guardando, setGuardando] = useState(false);

  const [editId, setEditId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState("");

  async function cargar() {
    setCargando(true);
    setError(null);
    try {
      setClientes(await dbService.getClientes());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar clientes");
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  async function crear() {
    const nombre = nuevoNombre.trim();
    if (!nombre) return;
    const normalizado = normalizarNombre(nombre);
    if (clientes.some((c) => c.nombre_normalizado === normalizado)) {
      setError(`Ya existe un cliente equivalente a "${nombre}".`);
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      await dbService.createCliente(nombre);
      setNuevoNombre("");
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al crear cliente");
    } finally {
      setGuardando(false);
    }
  }

  function empezarEdicion(c: Cliente) {
    setEditId(c.id);
    setEditNombre(c.nombre);
  }

  async function guardarEdicion(c: Cliente, activo: boolean) {
    try {
      await dbService.updateCliente(
        c.id,
        editId === c.id ? editNombre : c.nombre,
        activo,
      );
      setEditId(null);
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al actualizar cliente");
    }
  }

  return (
    <div>
      <PageTitle
        title="Clientes"
        subtitle="Alta y gestión de clientes. Se evitan duplicados por mayúsculas/espacios."
      />

      {error && (
        <div className="mb-4">
          <Banner tone="warning">{error}</Banner>
        </div>
      )}

      <Card className="mb-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-64 flex-1">
            <Field label="Nuevo cliente">
              <input
                className={inputClass}
                value={nuevoNombre}
                onChange={(e) => setNuevoNombre(e.target.value)}
                placeholder="Nombre del cliente"
                onKeyDown={(e) => e.key === "Enter" && crear()}
              />
            </Field>
          </div>
          <Button onClick={crear} disabled={guardando || !nuevoNombre.trim()}>
            {guardando ? "Guardando…" : "Crear cliente"}
          </Button>
        </div>
      </Card>

      <Card>
        {cargando ? (
          <p className="text-sm text-slate-500">Cargando…</p>
        ) : clientes.length === 0 ? (
          <p className="text-sm text-slate-500">No hay clientes todavía.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="py-2 pr-3 font-medium">Nombre</th>
                <th className="py-2 pr-3 font-medium">Estado</th>
                <th className="py-2 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => (
                <tr key={c.id} className="border-b border-slate-100">
                  <td className="py-2 pr-3">
                    {editId === c.id ? (
                      <input
                        className={inputClass}
                        value={editNombre}
                        onChange={(e) => setEditNombre(e.target.value)}
                      />
                    ) : (
                      <span className="text-slate-900">{c.nombre}</span>
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        c.activo
                          ? "bg-green-100 text-green-800"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {c.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="py-2">
                    <div className="flex justify-end gap-2">
                      {editId === c.id ? (
                        <>
                          <Button
                            variant="primary"
                            onClick={() => guardarEdicion(c, c.activo)}
                          >
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
                            onClick={() => empezarEdicion(c)}
                          >
                            Editar
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => guardarEdicion(c, !c.activo)}
                          >
                            {c.activo ? "Desactivar" : "Activar"}
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
