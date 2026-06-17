import { formatMedida, formatMedidaCm } from "./normalize";
import { FAMILIA_PUERTAS, FAMILIA_REMOLQUES, type Pedido } from "./types";

// Resumen "250 x 140 x 80" (remolques) o "120 x 220" (puertas).
export function resumenMedidas(
  pedido: Pick<Pedido, "largo" | "ancho" | "alto">,
  familiaNombre: string,
): string {
  if (familiaNombre === FAMILIA_REMOLQUES) {
    return [pedido.largo, pedido.ancho, pedido.alto]
      .map((v) => formatMedida(v) || "—")
      .join(" x ");
  }
  if (familiaNombre === FAMILIA_PUERTAS) {
    return [pedido.ancho, pedido.alto]
      .map((v) => formatMedida(v) || "—")
      .join(" x ");
  }
  return [pedido.largo, pedido.ancho, pedido.alto]
    .filter((v) => v !== null)
    .map((v) => formatMedida(v))
    .join(" x ");
}

export { formatMedida, formatMedidaCm };
