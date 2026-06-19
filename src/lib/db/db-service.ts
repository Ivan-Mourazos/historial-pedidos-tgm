// Acceso a datos desde el cliente.
//
// Antes hablaba directamente con Supabase (PostgREST) desde el navegador.
// Ahora SQL Server vive detrás del servidor, así que cada método se despacha
// vía fetch al endpoint RPC /api/db, que ejecuta la query con el driver mssql.
//
// La interfaz pública (nombres y firmas de los métodos) es idéntica a la de
// dbServer, por lo que las páginas/componentes no necesitan cambios. El import
// de tipo no arrastra el driver mssql al bundle del cliente (se borra al
// compilar).

import type { DbServer } from "./server-service";

async function rpc<T>(method: string, args: unknown[]): Promise<T> {
  const response = await fetch("/api/db", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ method, args }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      (payload && payload.error) || `${response.status} ${response.statusText}`;
    throw new Error(`DB Error en ${method}: ${message}`);
  }

  return payload.data as T;
}

// Proxy que convierte cualquier acceso `dbService.metodo(...args)` en una
// llamada RPC. El cast a DbServer preserva el tipado de cada método.
export const dbService = new Proxy({} as DbServer, {
  get(_target, prop: string) {
    return (...args: unknown[]) => rpc(prop, args);
  },
});
