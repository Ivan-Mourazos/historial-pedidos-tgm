"use client";

import { useCallback, useEffect, useState } from "react";
import { dbService } from "./db/db-service";
import type {
  Cliente,
  Familia,
  Tecnico,
  TipoPuerta,
  TipoRemolque,
} from "./types";

const TIPOS_REMOLQUE_BASE: TipoRemolque[] = ["Baquetón", "Ganado", "Lona alta"].map(
  (nombre) => ({
    id: `base-${nombre.toLowerCase().replace(/\s+/g, "-")}`,
    nombre,
    activo: true,
    created_at: "",
    updated_at: "",
  }),
);

export interface Catalogos {
  clientes: Cliente[];
  familias: Familia[];
  tecnicos: Tecnico[];
  tiposPuerta: TipoPuerta[];
  tiposRemolque: TipoRemolque[];
  cargando: boolean;
  error: string | null;
  recargarClientes: () => Promise<void>;
  recargarTecnicos: () => Promise<void>;
  recargarTiposPuerta: () => Promise<void>;
  recargarTiposRemolque: () => Promise<void>;
}

export function useCatalogos(): Catalogos {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [familias, setFamilias] = useState<Familia[]>([]);
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([]);
  const [tiposPuerta, setTiposPuerta] = useState<TipoPuerta[]>([]);
  const [tiposRemolque, setTiposRemolque] = useState<TipoRemolque[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const recargarClientes = useCallback(async () => {
    setClientes(await dbService.getClientes(true));
  }, []);

  const recargarTecnicos = useCallback(async () => {
    setTecnicos(await dbService.getTecnicos(true));
  }, []);

  const recargarTiposPuerta = useCallback(async () => {
    setTiposPuerta(await dbService.getTiposPuerta(true));
  }, []);

  const recargarTiposRemolque = useCallback(async () => {
    try {
      setTiposRemolque(await dbService.getTiposRemolque(true));
    } catch {
      setTiposRemolque(TIPOS_REMOLQUE_BASE);
    }
  }, []);

  useEffect(() => {
    let activo = true;
    (async () => {
      setCargando(true);
      setError(null);
      try {
        const result = await dbService.getCatalogos();
        if (!activo) return;
        setClientes(result.clientes);
        setFamilias(result.familias);
        setTecnicos(result.tecnicos);
        setTiposPuerta(result.tiposPuerta);
        setTiposRemolque(result.tiposRemolque.length > 0 ? result.tiposRemolque : TIPOS_REMOLQUE_BASE);
      } catch (loadError) {
        if (activo) setError(loadError instanceof Error ? loadError.message : "Error al cargar catálogos");
      } finally {
        if (activo) setCargando(false);
      }
    })();
    return () => {
      activo = false;
    };
  }, []);

  return {
    clientes,
    familias,
    tecnicos,
    tiposPuerta,
    tiposRemolque,
    cargando,
    error,
    recargarClientes,
    recargarTecnicos,
    recargarTiposPuerta,
    recargarTiposRemolque,
  };
}
