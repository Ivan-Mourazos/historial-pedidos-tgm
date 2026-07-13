import { NextResponse } from "next/server";
import { pedidoRpsPorNumero } from "@/lib/rps-clientes";

export async function GET(request: Request) {
  try {
    const numero = new URL(request.url).searchParams.get("numero") ?? "";
    const pedido = await pedidoRpsPorNumero(numero);
    return NextResponse.json({ pedido, cliente: pedido?.cliente ?? null });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error consultando RPS" }, { status: 500 });
  }
}
