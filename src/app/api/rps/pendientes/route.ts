import { NextResponse } from "next/server";
import { importarPendientesRps, obtenerPendientesRps } from "@/lib/rps-pendientes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Carga inicial de la página: solo lectura (sirve caché de 5 min si está
    // caliente). La sincronización con escritura de estados la dispara
    // explícitamente el botón "Actualizar RPS" (POST accion=SINCRONIZAR).
    return NextResponse.json(await obtenerPendientesRps(false));
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudieron consultar los pedidos pendientes.";
    console.error("[api/rps/pendientes]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { confirmar?: string; accion?: string; completo?: boolean };
    const completo = Boolean(body.completo) || body.accion === "ESCANEO_COMPLETO";
    if (body.accion === "SINCRONIZAR" || body.accion === "ESCANEO_COMPLETO") {
      return NextResponse.json(await obtenerPendientesRps(true, completo));
    }
    if (body.confirmar !== "IMPORTAR") {
      return NextResponse.json({ error: "Falta confirmar la importación." }, { status: 400 });
    }
    return NextResponse.json(await importarPendientesRps(completo));
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudieron importar los pedidos.";
    console.error("[api/rps/pendientes/importar]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
