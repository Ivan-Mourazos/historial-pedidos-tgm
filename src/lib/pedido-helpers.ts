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
    aguas: parseMedida(valores.aguas),
    radio: parseMedida(valores.radio),
    tipo: valores.tipo.trim() === "" ? null : valores.tipo.trim(),
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
} {
  if (familiaNombre === FAMILIA_REMOLQUES) {
    return {
      tipo: valores.tipo.trim() === "" ? null : valores.tipo.trim(),
      largo: parseMedida(valores.largo),
      ancho: parseMedida(valores.ancho),
      alto: parseMedida(valores.alto),
      aguas: parseMedida(valores.aguas),
      radio: parseMedida(valores.radio),
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
    };
  }
  return {
    tipo: null,
    largo: null,
    ancho: null,
    alto: null,
    aguas: null,
    radio: null,
  };
}
