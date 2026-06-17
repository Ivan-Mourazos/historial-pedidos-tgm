import { formatMedida, formatMedidaCm } from "./normalize";
import { FAMILIA_PUERTAS, FAMILIA_REMOLQUES, type Pedido } from "./types";

// Resumen "250 × 140 × 80" (remolques) o "120 × 220" (puertas).
// Devuelve "—" si todos los campos relevantes son nulos.
export function resumenMedidas(
  pedido: Pick<Pedido, "largo" | "ancho" | "alto" | "tipo">,
  familiaNombre: string,
): string {
  if (familiaNombre === FAMILIA_REMOLQUES) {
    const vals = [pedido.largo, pedido.ancho, pedido.alto];
    if (vals.every((v) => v === null)) return "—";
    return vals.map((v) => formatMedida(v) || "—").join(" × ");
  }
  if (familiaNombre === FAMILIA_PUERTAS) {
    const vals = [pedido.ancho, pedido.alto];
    if (vals.every((v) => v === null)) return pedido.tipo ?? "—";
    const dim = vals.map((v) => formatMedida(v) || "—").join(" × ");
    return pedido.tipo ? `${pedido.tipo} — ${dim}` : dim;
  }
  const vals = [pedido.largo, pedido.ancho, pedido.alto].filter((v) => v !== null);
  return vals.length ? vals.map((v) => formatMedida(v)).join(" × ") : "—";
}

export { formatMedida, formatMedidaCm };
