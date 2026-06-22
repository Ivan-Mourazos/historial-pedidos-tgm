import { NextResponse } from "next/server";
import { openPedidoExcel } from "@/lib/excel/pedido-excel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { numeroPedido?: unknown; fileName?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (typeof body.numeroPedido !== "string" || body.numeroPedido.trim() === "") {
    return NextResponse.json(
      { error: "Falta el número de pedido." },
      { status: 400 },
    );
  }

  if (body.fileName !== undefined && typeof body.fileName !== "string") {
    return NextResponse.json(
      { error: "Archivo Excel no válido." },
      { status: 400 },
    );
  }

  try {
    const file = await openPedidoExcel(body.numeroPedido, body.fileName);
    return NextResponse.json({ ok: true, fileName: file.name });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[api/excel/open]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
