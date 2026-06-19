// Endpoint RPC que ejecuta los métodos de acceso a datos en el servidor.
// El dbService del cliente envía { method, args } y aquí se despacha contra
// dbServer (SQL Server). Mantener este puente permite que toda la UI siga
// llamando a dbService con las mismas firmas que tenía con Supabase.

import { NextResponse } from "next/server";
import { dbServer } from "@/lib/db/server-service";

// mssql/tedious requieren el runtime de Node (no Edge).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Method = keyof typeof dbServer;

export async function POST(req: Request) {
  let body: { method?: string; args?: unknown[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { method, args = [] } = body;

  // Sólo se permiten métodos que existan en dbServer (whitelist implícita).
  if (
    typeof method !== "string" ||
    !Object.prototype.hasOwnProperty.call(dbServer, method) ||
    typeof dbServer[method as Method] !== "function"
  ) {
    return NextResponse.json(
      { error: `Método no permitido: ${method}` },
      { status: 400 },
    );
  }

  try {
    const fn = dbServer[method as Method] as (
      ...a: unknown[]
    ) => Promise<unknown>;
    const result = await fn.apply(dbServer, args);
    return NextResponse.json({ data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[api/db] Error en ${method}:`, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
