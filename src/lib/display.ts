import { formatMedida, formatMedidaCm } from "./normalize";
import { FAMILIA_PUERTAS, FAMILIA_REMOLQUES, type Pedido } from "./types";

const CONECTORES_NOMBRE = new Set(["de", "del", "el", "la", "las", "los", "y", "e"]);
const FORMAS_JURIDICAS = new Map([
  ["sa", "S.A."],
  ["sl", "S.L."],
  ["slu", "S.L.U."],
  ["slne", "S.L.N.E."],
  ["cb", "C.B."],
  ["sc", "S.C."],
  ["scoop", "S.Coop."],
  ["ute", "UTE"],
]);

/** Convierte nombres íntegramente en mayúsculas a una lectura natural sin tocar el dato original. */
export function formatNombreEmpresa(nombre: string): string {
  const limpio = nombre.trim();
  if (!limpio || /\p{Ll}/u.test(limpio)) return limpio;

  let esPrimeraPalabra = true;
  return limpio
    .toLocaleLowerCase("es-ES")
    .split(/(\s+|[·/(),&-]+)/)
    .map((parte) => {
      if (!/\p{L}/u.test(parte)) return parte;
      const clave = parte.replace(/[^a-záéíóúüñ]/gu, "");
      const formaJuridica = FORMAS_JURIDICAS.get(clave);
      if (formaJuridica) {
        esPrimeraPalabra = false;
        return formaJuridica;
      }
      if (!esPrimeraPalabra && CONECTORES_NOMBRE.has(clave)) return parte;
      esPrimeraPalabra = false;
      return parte.replace(/\p{L}/u, (letra) => letra.toLocaleUpperCase("es-ES"));
    })
    .join("");
}

export function formatAlturaRemolque(
  pedido: Pick<Pedido, "alto" | "alto_delante" | "alto_atras">,
): string {
  const delante = pedido.alto_delante ?? null;
  const atras = pedido.alto_atras ?? null;
  if (delante !== null || atras !== null) {
    return `${formatMedida(delante) || "—"}/${formatMedida(atras) || "—"}`;
  }
  return formatMedida(pedido.alto);
}

// Resumen "250 × 140 × 80" (remolques) o "120 × 220" (puertas).
// Devuelve "—" si todos los campos relevantes son nulos.
export function resumenMedidas(
  pedido: Pick<Pedido, "largo" | "ancho" | "alto" | "alto_delante" | "alto_atras" | "aguas" | "radio" | "tipo" | "impresion_digital" | "datos_tecnicos" | "recogida_delante" | "recogida_atras">,
  familiaNombre: string,
): string {
  if (familiaNombre === FAMILIA_REMOLQUES) {
    const altura = formatAlturaRemolque(pedido);
    if (pedido.largo === null && pedido.ancho === null && !altura) return "—";
    const medidas = [formatMedida(pedido.largo) || "—", formatMedida(pedido.ancho) || "—", altura || "—"].join(" × ");
    const extras = [
      pedido.radio !== null ? `Radio ${formatMedida(pedido.radio)}` : null,
      pedido.aguas !== null ? `Aguas ${formatMedida(pedido.aguas)}` : null,
      pedido.recogida_delante ? `Recoge delante ${pedido.recogida_delante}` : null,
      pedido.recogida_atras ? `Recoge atrás ${pedido.recogida_atras}` : null,
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
