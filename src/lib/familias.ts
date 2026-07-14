import type { Familia } from "./types";

export type CampoTecnicoTipo = "boolean" | "number" | "select" | "text";

export interface CampoTecnicoDefinition {
  key: string;
  label: string;
  type: CampoTecnicoTipo;
  required?: boolean;
  unit?: string;
}

export interface FamiliaDefinition {
  nombre: string;
  orden: number;
  variante: "generic" | "puertas" | "remolques";
  campos: CampoTecnicoDefinition[];
  archivos: {
    cad: boolean;
    excel: boolean;
  };
}

const DEFINICIONES: Record<string, FamiliaDefinition> = {
  REMOLQUES: {
    nombre: "REMOLQUES",
    orden: 10,
    variante: "remolques",
    archivos: { cad: true, excel: true },
    campos: [
      { key: "tipo", label: "Tipo", type: "select", required: true },
      { key: "largo", label: "Largo", type: "number", required: true, unit: "cm" },
      { key: "ancho", label: "Ancho", type: "number", required: true, unit: "cm" },
      { key: "alto", label: "Altura", type: "number", required: true, unit: "cm" },
      { key: "alto_delante", label: "Alto delante", type: "number", unit: "cm" },
      { key: "alto_atras", label: "Alto detrás", type: "number", unit: "cm" },
      { key: "aguas", label: "Aguas", type: "number", unit: "cm" },
      { key: "radio", label: "Radio", type: "number", unit: "cm" },
      { key: "recogida_delante", label: "Recoge delante", type: "select" },
      { key: "recogida_atras", label: "Recoge atrás", type: "select" },
    ],
  },
  PUERTAS: {
    nombre: "PUERTAS",
    orden: 20,
    variante: "puertas",
    archivos: { cad: true, excel: false },
    campos: [
      { key: "tipo", label: "Tipo", type: "select", required: true },
      { key: "ancho", label: "Ancho", type: "number", required: true, unit: "cm" },
      { key: "alto", label: "Alto", type: "number", required: true, unit: "cm" },
      { key: "impresion_digital", label: "I.D.", type: "boolean" },
    ],
  },
};

export function getFamiliaDefinition(nombre: string): FamiliaDefinition {
  const key = nombre.trim().toLocaleUpperCase("es-ES");
  return DEFINICIONES[key] ?? {
    nombre: key,
    orden: 1_000,
    variante: "generic",
    archivos: { cad: true, excel: false },
    campos: [],
  };
}

export function ordenarFamilias<T extends Pick<Familia, "nombre">>(familias: T[]): T[] {
  return [...familias].sort((a, b) => {
    const aDef = getFamiliaDefinition(a.nombre);
    const bDef = getFamiliaDefinition(b.nombre);
    return aDef.orden - bDef.orden || a.nombre.localeCompare(b.nombre, "es");
  });
}

export function familiaPuedeTenerExcel(
  familiaNombre: string,
): boolean {
  const definition = getFamiliaDefinition(familiaNombre);
  return definition.archivos.excel;
}
