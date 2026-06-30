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
        const resultados = await Promise.allSettled([
          dbService.getClientes(true),
          dbService.getFamilias(),
          dbService.getTecnicos(true),
          dbService.getTiposPuerta(true),
          dbService.getTiposRemolque(true),
        ]);
        if (!activo) return;

        const [clientesRes, familiasRes, tecnicosRes, puertasRes, remolquesRes] =
          resultados;
        const errores = resultados
          .filter((res): res is PromiseRejectedResult => res.status === "rejected")
          .map((res) =>
            res.reason instanceof Error ? res.reason.message : String(res.reason),
          );

        setClientes(clientesRes.status === "fulfilled" ? clientesRes.value : []);
        setFamilias(familiasRes.status === "fulfilled" ? familiasRes.value : []);
        setTecnicos(tecnicosRes.status === "fulfilled" ? tecnicosRes.value : []);
        setTiposPuerta(puertasRes.status === "fulfilled" ? puertasRes.value : []);
        setTiposRemolque(
          remolquesRes.status === "fulfilled"
            ? remolquesRes.value
            : TIPOS_REMOLQUE_BASE,
        );

        const erroresCriticos = errores.filter(
          (message) => !message.includes("tipos_remolque"),
        );
        if (erroresCriticos.length > 0) {
          setError(erroresCriticos[0]);
        }
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
