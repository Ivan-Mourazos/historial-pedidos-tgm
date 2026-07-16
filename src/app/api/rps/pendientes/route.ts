import { NextResponse } from "next/server";
import { importarPendientesRps, obtenerPendientesRps } from "@/lib/rps-pendientes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await obtenerPendientesRps(true));
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudieron consultar los pedidos pendientes.";
    console.error("[api/rps/pendientes]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { confirmar?: string; accion?: string };
    if (body.accion === "SINCRONIZAR") {
      return NextResponse.json(await obtenerPendientesRps(true));
    }
    if (body.confirmar !== "IMPORTAR") {
      return NextResponse.json({ error: "Falta confirmar la importación." }, { status: 400 });
    }
    return NextResponse.json(await importarPendientesRps());
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudieron importar los pedidos.";
    console.error("[api/rps/pendientes/importar]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
