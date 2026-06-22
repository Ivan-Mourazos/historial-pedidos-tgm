import { NextResponse } from "next/server";
import { findExcelFilesForPedidos } from "@/lib/excel/pedido-excel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { numerosPedido?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!Array.isArray(body.numerosPedido)) {
    return NextResponse.json(
      { error: "Falta la lista de números de pedido." },
      { status: 400 },
    );
  }

  const numerosPedido = body.numerosPedido
    .filter((item): item is string => typeof item === "string")
    .slice(0, 500);

  try {
    const filesByPedido = await findExcelFilesForPedidos(numerosPedido);
    return NextResponse.json({
      filesByPedido: Object.fromEntries(
        Object.entries(filesByPedido).map(([numero, files]) => [
          numero,
          files.map((file) => ({ name: file.name })),
        ]),
      ),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[api/excel/batch]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
