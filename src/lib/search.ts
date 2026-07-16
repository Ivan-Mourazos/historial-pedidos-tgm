import type { PedidoConRelaciones } from "./types";

export function searchTokens(value: string): string[] {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-ES")
    .split(/[\s×x/_\-.,;:()]+/)
    .filter(Boolean);
}

export function matchesSearch(haystack: string, query: string): boolean {
  const normalizedHaystack = searchTokens(haystack).join(" ");
  return searchTokens(query).every((token) => normalizedHaystack.includes(token));
}

export function pedidoSearchText(pedido: PedidoConRelaciones): string {
  return [
    pedido.numero_pedido,
    pedido.cliente?.nombre,
    pedido.tipo,
    pedido.largo,
    pedido.ancho,
    pedido.alto,
    pedido.alto_delante,
    pedido.alto_atras,
    pedido.aguas,
    pedido.radio,
    pedido.recogida_delante,
    pedido.recogida_atras,
    ...Object.values(pedido.datos_tecnicos ?? {}),
  ].filter((value) => value !== null && value !== undefined).join(" ");
}

