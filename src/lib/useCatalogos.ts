"use client";

import { useCallback, useEffect, useState } from "react";
import { dbService } from "./db/db-service";
import type { Cliente, Familia, Tecnico, TipoPuerta } from "./types";

export interface Catalogos {
  clientes: Cliente[];
  familias: Familia[];
  tecnicos: Tecnico[];
  tiposPuerta: TipoPuerta[];
  cargando: boolean;
  error: string | null;
  recargarClientes: () => Promise<void>;
}

export function useCatalogos(): Catalogos {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [familias, setFamilias] = useState<Familia[]>([]);
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([]);
  const [tiposPuerta, setTiposPuerta] = useState<TipoPuerta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const recargarClientes = useCallback(async () => {
    setClientes(await dbService.getClientes(true));
  }, []);

  useEffect(() => {
    let activo = true;
    (async () => {
      setCargando(true);
      setError(null);
      try {
        const [cl, fa, te, tp] = await Promise.all([
          dbService.getClientes(true),
          dbService.getFamilias(),
          dbService.getTecnicos(true),
          dbService.getTiposPuerta(true),
        ]);
        if (!activo) return;
        setClientes(cl);
        setFamilias(fa);
        setTecnicos(te);
        setTiposPuerta(tp);
      } catch (e) {
        if (!activo) return;
        setError(
          e instanceof Error ? e.message : "Error al cargar los catálogos",
        );
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
    cargando,
    error,
    recargarClientes,
  };
}
