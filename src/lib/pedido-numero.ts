// Validación del número de pedido: [Sede][Año][Correlativo]  ej. AR2600000
// No bloquea casos antiguos raros, pero avisa si el formato no encaja.
const FORMATO_PEDIDO = /^[A-Z]{2}[0-9]{2}[0-9]+$/;

export function numeroPedidoEncajaFormato(numero: string): boolean {
  return FORMATO_PEDIDO.test(numero.trim().toUpperCase());
}

// Normaliza para guardar/comparar: sin espacios y en mayúsculas.
export function normalizarNumeroPedido(numero: string): string {
  return numero.trim().toUpperCase();
}

export const AVISO_FORMATO_PEDIDO =
  "El número de pedido no encaja con el formato esperado (ej. AR2600000). Revísalo, pero puedes continuar.";
