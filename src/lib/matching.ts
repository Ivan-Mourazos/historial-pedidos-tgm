import {
  FAMILIA_PUERTAS,
  FAMILIA_REMOLQUES,
  type Pedido,
} from "./types";

// Criterios de búsqueda construidos a partir del formulario.
// Las medidas ya vienen parseadas a número (o null para "vacío").
export interface CriteriosBusqueda {
  familiaNombre: string;
  clienteId: string | null;
  // REMOLQUES
  largo: number | null;
  ancho: number | null;
  alto: number | null;
  aguas: number | null;
  radio: number | null;
  // PUERTAS
  tipo: string | null;
  // Flags para saber si el usuario dejó intencionadamente vacío un opcional.
  // En remolques, aguas/radio vacío SOLO coincide con vacío, así que el vacío
  // siempre es un valor significativo y no requiere flag adicional.
}

// Redondeo a 2 decimales para comparar igual que DECIMAL(10,2) en la BD.
function r2(n: number | null): number | null {
  if (n === null || n === undefined) return null;
  return Math.round(n * 100) / 100;
}

function igualMedida(a: number | null, b: number | null): boolean {
  return r2(a) === r2(b);
}

function tipoNormalizado(t: string | null): string {
  return (t ?? "").trim().toLowerCase();
}

// ¿Están completos todos los campos requeridos para comprobar coincidencia exacta?
// Nota: en remolques, aguas/radio vacío es un valor válido (no "incompleto"),
// por eso NO se exigen rellenos.
export function camposRequeridosCompletos(c: CriteriosBusqueda): boolean {
  if (!c.clienteId) return false;

  if (c.familiaNombre === FAMILIA_REMOLQUES) {
    return c.largo !== null && c.ancho !== null && c.alto !== null;
  }

  if (c.familiaNombre === FAMILIA_PUERTAS) {
    return (
      tipoNormalizado(c.tipo) !== "" && c.ancho !== null && c.alto !== null
    );
  }

  return false;
}

// ¿Este pedido coincide EXACTAMENTE con los criterios para su familia?
export function esCoincidenciaExacta(
  pedido: Pedido,
  c: CriteriosBusqueda,
): boolean {
  if (pedido.cliente_id !== c.clienteId) return false;

  if (c.familiaNombre === FAMILIA_REMOLQUES) {
    return (
      igualMedida(pedido.largo, c.largo) &&
      igualMedida(pedido.ancho, c.ancho) &&
      igualMedida(pedido.alto, c.alto) &&
      igualMedida(pedido.aguas, c.aguas) &&
      igualMedida(pedido.radio, c.radio)
    );
  }

  if (c.familiaNombre === FAMILIA_PUERTAS) {
    return (
      tipoNormalizado(pedido.tipo) === tipoNormalizado(c.tipo) &&
      igualMedida(pedido.ancho, c.ancho) &&
      igualMedida(pedido.alto, c.alto)
    );
  }

  return false;
}

export interface PedidoParecido {
  pedido: Pedido;
  diferencias: string[];
}

const TOLERANCIA_CM = 1;

function dentroDeTolerancia(
  a: number | null,
  b: number | null,
): boolean {
  if (a === null || b === null) return a === b; // vacío solo "cerca" de vacío
  return Math.abs(a - b) <= TOLERANCIA_CM;
}

// Pedidos parecidos: mismo cliente + misma familia, medidas dentro de ±1 cm.
// Devuelve también la lista de campos que difieren para mostrar al usuario.
// Excluye los que ya son coincidencia exacta.
export function buscarParecidos(
  pedidos: Pedido[],
  c: CriteriosBusqueda,
): PedidoParecido[] {
  if (!c.clienteId) return [];

  const resultado: PedidoParecido[] = [];

  for (const p of pedidos) {
    if (p.cliente_id !== c.clienteId) continue;
    if (esCoincidenciaExacta(p, c)) continue;

    const diferencias: string[] = [];

    if (c.familiaNombre === FAMILIA_REMOLQUES) {
      if (!dentroDeTolerancia(p.largo, c.largo)) continue;
      if (!dentroDeTolerancia(p.ancho, c.ancho)) continue;
      if (!dentroDeTolerancia(p.alto, c.alto)) continue;

      if (!igualMedida(p.largo, c.largo)) diferencias.push("largo diferente");
      if (!igualMedida(p.ancho, c.ancho)) diferencias.push("ancho diferente");
      if (!igualMedida(p.alto, c.alto)) diferencias.push("altura diferente");
      if (!igualMedida(p.aguas, c.aguas)) diferencias.push("aguas diferente");
      if (!igualMedida(p.radio, c.radio)) diferencias.push("radio diferente");
    } else if (c.familiaNombre === FAMILIA_PUERTAS) {
      if (!dentroDeTolerancia(p.ancho, c.ancho)) continue;
      if (!dentroDeTolerancia(p.alto, c.alto)) continue;

      if (tipoNormalizado(p.tipo) !== tipoNormalizado(c.tipo))
        diferencias.push("tipo diferente");
      if (!igualMedida(p.ancho, c.ancho)) diferencias.push("ancho diferente");
      if (!igualMedida(p.alto, c.alto)) diferencias.push("alto diferente");
    } else {
      continue;
    }

    // Solo lo consideramos "parecido" si efectivamente difiere en algo
    // (si no difiere en nada sería exacto, ya filtrado arriba).
    if (diferencias.length > 0) {
      resultado.push({ pedido: p, diferencias });
    }
  }

  return resultado;
}
