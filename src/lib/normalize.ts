// Normalización de nombres de cliente: trim + minúsculas + colapsar dobles espacios.
// "Remolcar", "remolcar", "REMOLCAR", "  Remolcar  " -> "remolcar"
export function normalizarNombre(nombre: string): string {
  return nombre.trim().toLowerCase().replace(/\s+/g, " ");
}

// Convierte la entrada del usuario (admite coma decimal) en número.
// "83,5" -> 83.5 ; "250" -> 250 ; "" -> null
export function parseMedida(valor: string | null | undefined): number | null {
  if (valor === null || valor === undefined) return null;
  const limpio = valor.trim().replace(",", ".");
  if (limpio === "") return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

// Indica si un texto de medida es un número válido (o vacío, que es válido como "sin valor").
export function esMedidaValida(valor: string): boolean {
  if (valor.trim() === "") return true;
  return parseMedida(valor) !== null;
}

// Muestra un número con coma decimal para el usuario. 83.5 -> "83,5"
export function formatMedida(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return "";
  // Quita ceros decimales innecesarios: 80.00 -> "80", 83.50 -> "83,5"
  const s = Number(valor).toString();
  return s.replace(".", ",");
}

// "83,5" + sufijo -> "83,5 cm". Vacío -> "vacío".
export function formatMedidaCm(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return "vacío";
  return `${formatMedida(valor)} cm`;
}
