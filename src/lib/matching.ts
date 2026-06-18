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

// ¿Están completos los campos mínimos para buscar?
// Aguas/radio son siempre opcionales. No requiere cliente.
export function camposRequeridosCompletos(c: CriteriosBusqueda): boolean {
  if (c.familiaNombre === FAMILIA_REMOLQUES) {
    return c.largo !== null && c.ancho !== null && c.alto !== null;
  }

  if (c.familiaNombre === FAMILIA_PUERTAS) {
    return tipoNormalizado(c.tipo) !== "" && c.ancho !== null && c.alto !== null;
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

// Pedidos parecidos: misma familia, medidas principales dentro de ±1 cm.
// Si hay clienteId filtra por ese cliente; si no, busca en todos.
// Aguas/radio solo se comparan si el usuario los rellenó.
export function buscarParecidos(
  pedidos: Pedido[],
  c: CriteriosBusqueda,
): PedidoParecido[] {
  const resultado: PedidoParecido[] = [];

  for (const p of pedidos) {
    if (c.clienteId && p.cliente_id !== c.clienteId) continue;
    if (c.clienteId && esCoincidenciaExacta(p, c)) continue;

    const diferencias: string[] = [];

    if (c.familiaNombre === FAMILIA_REMOLQUES) {
      if (!dentroDeTolerancia(p.largo, c.largo)) continue;
      if (!dentroDeTolerancia(p.ancho, c.ancho)) continue;
      if (!dentroDeTolerancia(p.alto, c.alto)) continue;

      if (!igualMedida(p.largo, c.largo)) diferencias.push("largo");
      if (!igualMedida(p.ancho, c.ancho)) diferencias.push("ancho");
      if (!igualMedida(p.alto, c.alto)) diferencias.push("alto");
      // Aguas/radio: si el usuario los especificó, excluir registros sin ese campo y filtrar por tolerancia
      if (c.aguas !== null) {
        if (p.aguas === null) continue;
        if (!dentroDeTolerancia(p.aguas, c.aguas)) continue;
        if (!igualMedida(p.aguas, c.aguas)) diferencias.push("aguas");
      }
      if (c.radio !== null) {
        if (p.radio === null) continue;
        if (!dentroDeTolerancia(p.radio, c.radio)) continue;
        if (!igualMedida(p.radio, c.radio)) diferencias.push("radio");
      }
    } else if (c.familiaNombre === FAMILIA_PUERTAS) {
      if (!dentroDeTolerancia(p.ancho, c.ancho)) continue;
      if (!dentroDeTolerancia(p.alto, c.alto)) continue;

      if (tipoNormalizado(p.tipo) !== tipoNormalizado(c.tipo)) diferencias.push("tipo");
      if (!igualMedida(p.ancho, c.ancho)) diferencias.push("ancho");
      if (!igualMedida(p.alto, c.alto)) diferencias.push("alto");
    } else {
      continue;
    }

    resultado.push({ pedido: p, diferencias });
  }

  return resultado;
}

// Búsqueda en tiempo real con criterios parciales (cualquier campo puede ser null).
// Muestra resultados a medida que el usuario rellena campos.
// Cuando aguas/radio son especificados, excluye registros sin esos campos.
export function buscarConCriteriosParciales(
  pedidos: Pedido[],
  c: CriteriosBusqueda,
): Pedido[] {
  const hayCriterio =
    c.familiaNombre === FAMILIA_REMOLQUES
      ? c.largo !== null || c.ancho !== null || c.alto !== null || c.aguas !== null || c.radio !== null
      : c.tipo !== null || c.ancho !== null || c.alto !== null;

  if (!hayCriterio) return [];

  return pedidos.filter((p) => {
    if (c.clienteId && p.cliente_id !== c.clienteId) return false;

    if (c.familiaNombre === FAMILIA_REMOLQUES) {
      if (c.tipo && tipoNormalizado(c.tipo) !== "" && tipoNormalizado(p.tipo) !== tipoNormalizado(c.tipo)) return false;
      if (c.largo !== null && !dentroDeTolerancia(p.largo, c.largo)) return false;
      if (c.ancho !== null && !dentroDeTolerancia(p.ancho, c.ancho)) return false;
      if (c.alto !== null && !dentroDeTolerancia(p.alto, c.alto)) return false;
      if (c.aguas !== null) {
        if (p.aguas === null) return false;
        if (!dentroDeTolerancia(p.aguas, c.aguas)) return false;
      }
      if (c.radio !== null) {
        if (p.radio === null) return false;
        if (!dentroDeTolerancia(p.radio, c.radio)) return false;
      }
    } else if (c.familiaNombre === FAMILIA_PUERTAS) {
      if (c.tipo && tipoNormalizado(c.tipo) !== "" && tipoNormalizado(p.tipo) !== tipoNormalizado(c.tipo)) return false;
      if (c.ancho !== null && !dentroDeTolerancia(p.ancho, c.ancho)) return false;
      if (c.alto !== null && !dentroDeTolerancia(p.alto, c.alto)) return false;
    } else {
      return false;
    }

    return true;
  });
}

// Calcula qué campos difieren entre un pedido y los criterios actuales.
// Solo compara campos que el usuario ha rellenado (no nulos en criterios).
export function calcularDiferencias(pedido: Pedido, c: CriteriosBusqueda): string[] {
  const diffs: string[] = [];
  if (c.familiaNombre === FAMILIA_REMOLQUES) {
    if (c.tipo && tipoNormalizado(pedido.tipo) !== tipoNormalizado(c.tipo)) diffs.push("tipo");
    if (c.largo !== null && !igualMedida(pedido.largo, c.largo)) diffs.push("largo");
    if (c.ancho !== null && !igualMedida(pedido.ancho, c.ancho)) diffs.push("ancho");
    if (c.alto !== null && !igualMedida(pedido.alto, c.alto)) diffs.push("alto");
    if (c.aguas !== null && !igualMedida(pedido.aguas, c.aguas)) diffs.push("aguas");
    if (c.radio !== null && !igualMedida(pedido.radio, c.radio)) diffs.push("radio");
  } else if (c.familiaNombre === FAMILIA_PUERTAS) {
    if (c.tipo && tipoNormalizado(pedido.tipo) !== tipoNormalizado(c.tipo)) diffs.push("tipo");
    if (c.ancho !== null && !igualMedida(pedido.ancho, c.ancho)) diffs.push("ancho");
    if (c.alto !== null && !igualMedida(pedido.alto, c.alto)) diffs.push("alto");
  }
  return diffs;
}
