import type { CamposTecnicosValores } from "@/components/CamposTecnicosFamilia";
import type { CriteriosBusqueda } from "./matching";
import { parseMedida } from "./normalize";
import { FAMILIA_PUERTAS, FAMILIA_REMOLQUES } from "./types";

// Construye los criterios de búsqueda a partir de los campos del formulario.
export function construirCriterios(
  familiaNombre: string,
  clienteId: string | null,
  valores: CamposTecnicosValores,
): CriteriosBusqueda {
  return {
    familiaNombre,
    clienteId,
    largo: parseMedida(valores.largo),
    ancho: parseMedida(valores.ancho),
    alto: parseMedida(valores.alto),
    aguas: valores.aguasActivas ? parseMedida(valores.aguas) : null,
    aguasActivas: valores.aguasActivas,
    radio: parseMedida(valores.radio),
    tipo: valores.tipo.trim() === "" ? null : valores.tipo.trim(),
    impresionDigital: valores.impresionDigital,
  };
}

// Campos técnicos normalizados para guardar en el pedido, según la familia.
// Los campos no usados por la familia se guardan como null.
export function camposTecnicosParaGuardar(
  familiaNombre: string,
  valores: CamposTecnicosValores,
): {
  tipo: string | null;
  largo: number | null;
  ancho: number | null;
  alto: number | null;
  aguas: number | null;
  radio: number | null;
  impresion_digital: boolean;
} {
  if (familiaNombre === FAMILIA_REMOLQUES) {
    const tipo = valores.tipo.trim();
    const tipoNorm = tipo.toLowerCase();
    const usaRadioYAguas = tipoNorm === "ganado" || tipoNorm === "lona alta";
    return {
      tipo: tipo === "" ? null : tipo,
      largo: parseMedida(valores.largo),
      ancho: parseMedida(valores.ancho),
      alto: parseMedida(valores.alto),
      aguas: usaRadioYAguas && valores.aguasActivas ? parseMedida(valores.aguas) : null,
      radio: usaRadioYAguas ? parseMedida(valores.radio) : null,
      impresion_digital: false,
    };
  }
  if (familiaNombre === FAMILIA_PUERTAS) {
    return {
      tipo: valores.tipo.trim() === "" ? null : valores.tipo.trim(),
      largo: null,
      ancho: parseMedida(valores.ancho),
      alto: parseMedida(valores.alto),
      aguas: null,
      radio: null,
      impresion_digital: valores.impresionDigital,
    };
  }
  return {
    tipo: null,
    largo: null,
    ancho: null,
    alto: null,
    aguas: null,
    radio: null,
    impresion_digital: false,
  };
}
