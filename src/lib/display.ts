import { formatMedida, formatMedidaCm } from "./normalize";
import { FAMILIA_PUERTAS, FAMILIA_REMOLQUES, type Pedido } from "./types";

// Resumen "250 × 140 × 80" (remolques) o "120 × 220" (puertas).
// Devuelve "—" si todos los campos relevantes son nulos.
export function resumenMedidas(
  pedido: Pick<Pedido, "largo" | "ancho" | "alto" | "aguas" | "radio" | "tipo" | "impresion_digital" | "datos_tecnicos">,
  familiaNombre: string,
): string {
  if (familiaNombre === FAMILIA_REMOLQUES) {
    const vals = [pedido.largo, pedido.ancho, pedido.alto];
    if (vals.every((v) => v === null)) return "—";
    const medidas = vals.map((v) => formatMedida(v) || "—").join(" × ");
    const extras = [
      pedido.radio !== null ? `Radio ${formatMedida(pedido.radio)}` : null,
      pedido.aguas !== null ? `Aguas ${formatMedida(pedido.aguas)}` : null,
    ].filter(Boolean);
    return extras.length ? `${medidas} · ${extras.join(" · ")}` : medidas;
  }
  if (familiaNombre === FAMILIA_PUERTAS) {
    const vals = [pedido.ancho, pedido.alto];
    const id = pedido.impresion_digital ? " · I.D." : "";
    if (vals.every((v) => v === null)) return pedido.tipo ? `${pedido.tipo}${id}` : (id.trim() || "—");
    const dim = vals.map((v) => formatMedida(v) || "—").join(" × ");
    return pedido.tipo ? `${pedido.tipo} — ${dim}${id}` : `${dim}${id}`;
  }
  const technicalEntries = Object.entries(pedido.datos_tecnicos ?? {});
  if (technicalEntries.length > 0) {
    return technicalEntries
      .slice(0, 4)
      .map(([key, value]) => `${key}: ${String(value ?? "—")}`)
      .join(" · ");
  }
  const vals = [pedido.largo, pedido.ancho, pedido.alto].filter((v) => v !== null);
  return vals.length ? vals.map((v) => formatMedida(v)).join(" × ") : "—";
}

// Fecha en formato español DD/MM/AAAA a partir del "YYYY-MM-DD" almacenado.
// Devuelve "—" si es nula y deja el valor tal cual si no encaja con el patrón.
export function formatFecha(fecha: string | null | undefined): string {
  if (!fecha) return "—";
  const m = fecha.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return fecha;
  const [, y, mes, d] = m;
  const date = new Date(Date.UTC(Number(y), Number(mes) - 1, Number(d)));
  return new Intl.DateTimeFormat("es-ES", { timeZone: "UTC" }).format(date);
}

export { formatMedida, formatMedidaCm };
