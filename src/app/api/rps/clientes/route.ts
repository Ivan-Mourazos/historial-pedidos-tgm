import { NextResponse } from "next/server";
import { buscarClientesRps } from "@/lib/rps-clientes";

export async function GET(request: Request) {
  try {
    const q = new URL(request.url).searchParams.get("q") ?? "";
    return NextResponse.json({ clientes: await buscarClientesRps(q) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error consultando RPS" }, { status: 500 });
  }
}
