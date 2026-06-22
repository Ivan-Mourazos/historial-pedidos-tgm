import { NextResponse } from "next/server";
import { findExcelFilesForPedido } from "@/lib/excel/pedido-excel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { numeroPedido?: unknown };
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

  try {
    const files = await findExcelFilesForPedido(body.numeroPedido);
    return NextResponse.json({
      files: files.map((file) => ({ name: file.name })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[api/excel/list]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
