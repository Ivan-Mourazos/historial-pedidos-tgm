export const TIPOS_RECOGIDA_REMOLQUE = [
  "NO",
  "GOMA",
  "CREMALLERA",
  "VELCRO",
  "PUENTES ESVA",
  "PUENTES LATERALES",
  "PUENTES HIJOS DE PEDRO LOPEZ",
] as const;

export function usaRecogidaRemolque(tipo: string | null | undefined): boolean {
  return tipo?.trim().toLocaleLowerCase("es-ES") === "lona alta";
}

