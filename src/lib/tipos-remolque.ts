const REEMPLAZOS_MOJIBAKE: [string, string][] = [
  ["Ã¡", "á"],
  ["Ã©", "é"],
  ["Ã­", "í"],
  ["Ã³", "ó"],
  ["Ãº", "ú"],
  ["Ã±", "ñ"],
  ["Ã", "Á"],
  ["Ã‰", "É"],
  ["Ã", "Í"],
  ["Ã“", "Ó"],
  ["Ãš", "Ú"],
  ["Ã‘", "Ñ"],
];

export function repararMojibake(valor: string | null | undefined): string {
  let limpio = (valor ?? "").trim();
  for (const [mal, bien] of REEMPLAZOS_MOJIBAKE) {
    limpio = limpio.replaceAll(mal, bien);
  }
  return limpio;
}

export function claveTipoRemolque(valor: string | null | undefined): string {
  return repararMojibake(valor)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function tipoRemolqueCanonico(valor: string | null | undefined): string {
  const limpio = repararMojibake(valor);
  const clave = claveTipoRemolque(limpio);
  if (clave === "baqueton") return "Baquetón";
  if (clave === "ganado") return "Ganado";
  if (clave === "lona alta") return "Lona alta";
  return limpio;
}

export function ordenarTiposRemolque(a: string, b: string): number {
  const orden = ["baqueton", "ganado", "lona alta"];
  const ia = orden.indexOf(claveTipoRemolque(a));
  const ib = orden.indexOf(claveTipoRemolque(b));
  if (ia !== -1 || ib !== -1) {
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  }
  return a.localeCompare(b, "es", { sensitivity: "base" });
}
