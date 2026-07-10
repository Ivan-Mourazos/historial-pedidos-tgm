import {
  FAMILIA_PUERTAS,
  FAMILIA_REMOLQUES,
  type Pedido,
} from "./types";
import { claveTipoRemolque } from "./tipos-remolque";
import { getFamiliaDefinition } from "./familias";
import { usaRecogidaRemolque } from "./recogida-remolque";

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
  aguasActivas: boolean;
  radio: number | null;
  // PUERTAS
  tipo: string | null;
  impresionDigital: boolean;
  recogidaDelante: string;
  recogidaAtras: string;
  extra: Record<string, string | boolean>;
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
  return claveTipoRemolque(t);
}

function esBaqueton(t: string | null): boolean {
  const tipo = tipoNormalizado(t);
  return tipo === "baquetón" || tipo === "baqueton";
}

function pideRadioYAguas(t: string | null): boolean {
  const tipo = tipoNormalizado(t);
  return tipo === "ganado" || tipo === "lona alta";
}

function recogidaNormalizada(value: string | null | undefined): string {
  return (value ?? "").trim().toLocaleUpperCase("es-ES");
}

// ¿Están completos los campos mínimos para buscar?
// Aguas/radio son siempre opcionales. No requiere cliente.
export function camposRequeridosCompletos(c: CriteriosBusqueda): boolean {
  if (c.familiaNombre === FAMILIA_REMOLQUES) {
    if (tipoNormalizado(c.tipo) === "") return false;
    const base = c.largo !== null && c.ancho !== null && c.alto !== null;
    if (!base) return false;
    if (esBaqueton(c.tipo)) return true;
    if (pideRadioYAguas(c.tipo)) {
      const recogidaCompleta = !usaRecogidaRemolque(c.tipo)
        || (c.recogidaDelante !== "" && c.recogidaAtras !== "");
      return c.radio !== null && (!c.aguasActivas || c.aguas !== null) && recogidaCompleta;
    }
    return true;
  }

  if (c.familiaNombre === FAMILIA_PUERTAS) {
    return tipoNormalizado(c.tipo) !== "" && c.ancho !== null && c.alto !== null;
  }
  const definition = getFamiliaDefinition(c.familiaNombre);
  const hasValue = definition.campos.some((field) => {
    const value = c.extra[field.key];
    return typeof value === "boolean" ? value : typeof value === "string" && value.trim() !== "";
  });
  return definition.campos.length > 0 && hasValue && definition.campos
    .filter((field) => field.required)
    .every((field) => {
      const value = c.extra[field.key];
      return typeof value === "boolean" || (typeof value === "string" && value.trim() !== "");
    });
}

// ¿Este pedido coincide EXACTAMENTE con los criterios para su familia?
export function esCoincidenciaExacta(
  pedido: Pedido,
  c: CriteriosBusqueda,
): boolean {
  if (pedido.cliente_id !== c.clienteId) return false;

  if (c.familiaNombre === FAMILIA_REMOLQUES) {
    if (tipoNormalizado(pedido.tipo) !== tipoNormalizado(c.tipo)) return false;
    if (esBaqueton(c.tipo)) {
      return (
        igualMedida(pedido.largo, c.largo) &&
        igualMedida(pedido.ancho, c.ancho) &&
        igualMedida(pedido.alto, c.alto)
      );
    }
    return (
      igualMedida(pedido.largo, c.largo) &&
      igualMedida(pedido.ancho, c.ancho) &&
      igualMedida(pedido.alto, c.alto) &&
      igualMedida(pedido.aguas, c.aguas) &&
      igualMedida(pedido.radio, c.radio) &&
      (!usaRecogidaRemolque(c.tipo) || (
        recogidaNormalizada(pedido.recogida_delante) === recogidaNormalizada(c.recogidaDelante) &&
        recogidaNormalizada(pedido.recogida_atras) === recogidaNormalizada(c.recogidaAtras)
      ))
    );
  }

  if (c.familiaNombre === FAMILIA_PUERTAS) {
    return (
      tipoNormalizado(pedido.tipo) === tipoNormalizado(c.tipo) &&
      igualMedida(pedido.ancho, c.ancho) &&
      igualMedida(pedido.alto, c.alto) &&
      pedido.impresion_digital === c.impresionDigital
    );
  }
  const definition = getFamiliaDefinition(c.familiaNombre);
  const stored = pedido.datos_tecnicos ?? {};
  return definition.campos.every((field) => {
    const expected = c.extra[field.key];
    const actual = stored[field.key];
    if (field.type === "number") {
      const parsed = typeof expected === "string" ? Number(expected.replace(",", ".")) : null;
      return Number.isFinite(parsed) && r2(typeof actual === "number" ? actual : Number(actual)) === r2(parsed);
    }
    return String(actual ?? "").trim().toLocaleLowerCase("es-ES") === String(expected ?? "").trim().toLocaleLowerCase("es-ES");
  });
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
      if (c.tipo && tipoNormalizado(p.tipo) !== tipoNormalizado(c.tipo)) continue;
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
      if (c.recogidaDelante && recogidaNormalizada(p.recogida_delante) !== recogidaNormalizada(c.recogidaDelante)) diferencias.push("recogida_delante");
      if (c.recogidaAtras && recogidaNormalizada(p.recogida_atras) !== recogidaNormalizada(c.recogidaAtras)) diferencias.push("recogida_atras");
    } else if (c.familiaNombre === FAMILIA_PUERTAS) {
      if (p.impresion_digital !== c.impresionDigital) continue;
      if (!dentroDeTolerancia(p.ancho, c.ancho)) continue;
      if (!dentroDeTolerancia(p.alto, c.alto)) continue;

      if (tipoNormalizado(p.tipo) !== tipoNormalizado(c.tipo)) diferencias.push("tipo");
      if (!igualMedida(p.ancho, c.ancho)) diferencias.push("ancho");
      if (!igualMedida(p.alto, c.alto)) diferencias.push("alto");
    } else {
      const stored = p.datos_tecnicos ?? {};
      const definition = getFamiliaDefinition(c.familiaNombre);
      const matches = definition.campos.every((field) => {
        const expected = c.extra[field.key];
        if (expected === "" || expected === undefined) return true;
        return String(stored[field.key] ?? "").toLocaleLowerCase("es-ES") === String(expected).toLocaleLowerCase("es-ES");
      });
      if (!matches) continue;
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
      ? c.tipo !== null || c.largo !== null || c.ancho !== null || c.alto !== null || c.aguas !== null || c.radio !== null || c.recogidaDelante !== "" || c.recogidaAtras !== ""
      : c.familiaNombre === FAMILIA_PUERTAS
        ? c.tipo !== null || c.ancho !== null || c.alto !== null || c.impresionDigital
        : Object.values(c.extra).some((value) => typeof value === "boolean" ? value : value.trim() !== "");

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
      if (c.recogidaDelante && recogidaNormalizada(p.recogida_delante) !== recogidaNormalizada(c.recogidaDelante)) return false;
      if (c.recogidaAtras && recogidaNormalizada(p.recogida_atras) !== recogidaNormalizada(c.recogidaAtras)) return false;
    } else if (c.familiaNombre === FAMILIA_PUERTAS) {
      if (p.impresion_digital !== c.impresionDigital) return false;
      if (c.tipo && tipoNormalizado(c.tipo) !== "" && tipoNormalizado(p.tipo) !== tipoNormalizado(c.tipo)) return false;
      if (c.ancho !== null && !dentroDeTolerancia(p.ancho, c.ancho)) return false;
      if (c.alto !== null && !dentroDeTolerancia(p.alto, c.alto)) return false;
    } else {
      const stored = p.datos_tecnicos ?? {};
      const definition = getFamiliaDefinition(c.familiaNombre);
      return definition.campos.every((field) => {
        const expected = c.extra[field.key];
        if (expected === "" || expected === undefined || expected === false) return true;
        return String(stored[field.key] ?? "").toLocaleLowerCase("es-ES") === String(expected).toLocaleLowerCase("es-ES");
      });
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
    if (c.recogidaDelante && recogidaNormalizada(pedido.recogida_delante) !== recogidaNormalizada(c.recogidaDelante)) diffs.push("recogida_delante");
    if (c.recogidaAtras && recogidaNormalizada(pedido.recogida_atras) !== recogidaNormalizada(c.recogidaAtras)) diffs.push("recogida_atras");
  } else if (c.familiaNombre === FAMILIA_PUERTAS) {
    if (c.tipo && tipoNormalizado(pedido.tipo) !== tipoNormalizado(c.tipo)) diffs.push("tipo");
    if (c.ancho !== null && !igualMedida(pedido.ancho, c.ancho)) diffs.push("ancho");
    if (c.alto !== null && !igualMedida(pedido.alto, c.alto)) diffs.push("alto");
    if (pedido.impresion_digital !== c.impresionDigital) diffs.push("impresion_digital");
  } else {
    const stored = pedido.datos_tecnicos ?? {};
    for (const [key, value] of Object.entries(c.extra)) {
      if (value !== "" && String(stored[key] ?? "") !== String(value)) diffs.push(key);
    }
  }
  return diffs;
}
