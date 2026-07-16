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
  altoDelante: number | null;
  altoAtras: number | null;
  alturasDistintas: boolean;
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
// Radio y recogidas son opcionales porque RPS no siempre los proporciona.
// Si se indica que hay aguas, su valor sí debe estar informado. No requiere cliente.
export function camposRequeridosCompletos(c: CriteriosBusqueda): boolean {
  if (c.familiaNombre === FAMILIA_REMOLQUES) {
    if (tipoNormalizado(c.tipo) === "") return false;
    const alturaCompleta = c.alturasDistintas
      ? c.altoDelante !== null && c.altoAtras !== null
      : c.alto !== null;
    const base = c.largo !== null && c.ancho !== null && alturaCompleta;
    if (!base) return false;
    if (esBaqueton(c.tipo)) return true;
    if (pideRadioYAguas(c.tipo)) {
      return !c.aguasActivas || c.aguas !== null;
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
  if (pedido.estado_planteo === "PENDIENTE") return false;
  if (pedido.cliente_id !== c.clienteId) return false;

  if (c.familiaNombre === FAMILIA_REMOLQUES) {
    if (tipoNormalizado(pedido.tipo) !== tipoNormalizado(c.tipo)) return false;
    const coincideAltura = c.alturasDistintas
      ? igualMedida(pedido.alto_delante, c.altoDelante) && igualMedida(pedido.alto_atras, c.altoAtras)
      : igualMedida(pedido.alto, c.alto);
    if (esBaqueton(c.tipo)) {
      return (
        igualMedida(pedido.largo, c.largo) &&
        igualMedida(pedido.ancho, c.ancho) &&
        coincideAltura
      );
    }
    return (
      igualMedida(pedido.largo, c.largo) &&
      igualMedida(pedido.ancho, c.ancho) &&
      coincideAltura &&
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

// Búsqueda en tiempo real con criterios parciales (cualquier campo puede ser null).
// Cada criterio informado se compara de forma exacta.
export function buscarConCriteriosParciales(
  pedidos: Pedido[],
  c: CriteriosBusqueda,
): Pedido[] {
  const hayCriterio =
    c.familiaNombre === FAMILIA_REMOLQUES
      ? c.tipo !== null || c.largo !== null || c.ancho !== null || c.alto !== null || c.altoDelante !== null || c.altoAtras !== null || c.aguas !== null || c.radio !== null || c.recogidaDelante !== "" || c.recogidaAtras !== ""
      : c.familiaNombre === FAMILIA_PUERTAS
        ? c.tipo !== null || c.ancho !== null || c.alto !== null || c.impresionDigital
        : Object.values(c.extra).some((value) => typeof value === "boolean" ? value : value.trim() !== "");

  if (!hayCriterio) return [];

  const encontrados = pedidos.filter((p) => {
    if (p.estado_planteo === "PENDIENTE") return false;
    if (c.clienteId && p.cliente_id !== c.clienteId) return false;

    if (c.familiaNombre === FAMILIA_REMOLQUES) {
      if (c.tipo && tipoNormalizado(c.tipo) !== "" && !tipoNormalizado(p.tipo).includes(tipoNormalizado(c.tipo))) return false;
      if (c.largo !== null && !igualMedida(p.largo, c.largo)) return false;
      if (c.ancho !== null && !igualMedida(p.ancho, c.ancho)) return false;
      if (c.alturasDistintas) {
        if (c.altoDelante !== null && !igualMedida(p.alto_delante, c.altoDelante)) return false;
        if (c.altoAtras !== null && !igualMedida(p.alto_atras, c.altoAtras)) return false;
      } else if (c.alto !== null && !igualMedida(p.alto, c.alto)) return false;
      if (pideRadioYAguas(c.tipo)) {
        if (c.aguasActivas && p.aguas === null) return false;
        if (!c.aguasActivas && p.aguas !== null) return false;
      }
      if (c.aguas !== null && !igualMedida(p.aguas, c.aguas)) return false;
      if (c.radio !== null && !igualMedida(p.radio, c.radio)) return false;
      if (c.recogidaDelante && recogidaNormalizada(p.recogida_delante) !== recogidaNormalizada(c.recogidaDelante)) return false;
      if (c.recogidaAtras && recogidaNormalizada(p.recogida_atras) !== recogidaNormalizada(c.recogidaAtras)) return false;
    } else if (c.familiaNombre === FAMILIA_PUERTAS) {
      if (p.impresion_digital !== c.impresionDigital) return false;
      if (c.tipo && tipoNormalizado(c.tipo) !== "" && !tipoNormalizado(p.tipo).includes(tipoNormalizado(c.tipo))) return false;
      if (c.ancho !== null && !igualMedida(p.ancho, c.ancho)) return false;
      if (c.alto !== null && !igualMedida(p.alto, c.alto)) return false;
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

  // Todos coinciden exactamente con lo informado; dentro del resultado se
  // priorizan los pedidos más recientes.
  const fechaOrden = (pedido: Pedido): number => {
    const valor = pedido.fecha ? `${pedido.fecha}T00:00:00Z` : pedido.created_at;
    const timestamp = Date.parse(valor);
    return Number.isNaN(timestamp) ? 0 : timestamp;
  };

  return encontrados.sort((a, b) => {
    const fecha = fechaOrden(b) - fechaOrden(a);
    if (fecha !== 0) return fecha;
    return b.numero_pedido.localeCompare(a.numero_pedido, "es", { numeric: true });
  });
}

// Calcula qué campos difieren entre un pedido y los criterios actuales.
// Solo compara campos que el usuario ha rellenado (no nulos en criterios).
export function calcularDiferencias(pedido: Pedido, c: CriteriosBusqueda): string[] {
  const diffs: string[] = [];
  if (c.familiaNombre === FAMILIA_REMOLQUES) {
    if (c.tipo && !tipoNormalizado(pedido.tipo).includes(tipoNormalizado(c.tipo))) diffs.push("tipo");
    if (c.largo !== null && !igualMedida(pedido.largo, c.largo)) diffs.push("largo");
    if (c.ancho !== null && !igualMedida(pedido.ancho, c.ancho)) diffs.push("ancho");
    if (c.alturasDistintas) {
      if (c.altoDelante !== null && !igualMedida(pedido.alto_delante, c.altoDelante)) diffs.push("alto_delante");
      if (c.altoAtras !== null && !igualMedida(pedido.alto_atras, c.altoAtras)) diffs.push("alto_atras");
    } else if (c.alto !== null && !igualMedida(pedido.alto, c.alto)) diffs.push("alto");
    if (c.aguas !== null && !igualMedida(pedido.aguas, c.aguas)) diffs.push("aguas");
    if (c.radio !== null && !igualMedida(pedido.radio, c.radio)) diffs.push("radio");
    if (c.recogidaDelante && recogidaNormalizada(pedido.recogida_delante) !== recogidaNormalizada(c.recogidaDelante)) diffs.push("recogida_delante");
    if (c.recogidaAtras && recogidaNormalizada(pedido.recogida_atras) !== recogidaNormalizada(c.recogidaAtras)) diffs.push("recogida_atras");
  } else if (c.familiaNombre === FAMILIA_PUERTAS) {
    if (c.tipo && !tipoNormalizado(pedido.tipo).includes(tipoNormalizado(c.tipo))) diffs.push("tipo");
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
