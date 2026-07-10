export interface Cliente {
  id: string;
  nombre: string;
  nombre_normalizado: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Tecnico {
  id: string;
  nombre: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Familia {
  id: string;
  nombre: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface TipoPuerta {
  id: string;
  nombre: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface TipoRemolque {
  id: string;
  nombre: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Pedido {
  id: string;
  numero_pedido: string;
  cliente_id: string;
  familia_id: string;
  tipo: string | null;
  largo: number | null;
  ancho: number | null;
  alto: number | null;
  aguas: number | null;
  radio: number | null;
  impresion_digital: boolean;
  fecha: string | null;
  tecnico_id: string | null;
  observaciones: string | null;
  datos_tecnicos?: Record<string, string | number | boolean | null> | null;
  datos_tecnicos_version?: number;
  created_at: string;
  updated_at: string;
}

// Pedido con datos relacionados embebidos (PostgREST resource embedding).
export interface PedidoConRelaciones extends Pedido {
  cliente?: Pick<Cliente, "id" | "nombre"> | null;
  familia?: Pick<Familia, "id" | "nombre"> | null;
  tecnico?: Pick<Tecnico, "id" | "nombre"> | null;
}

export const FAMILIA_REMOLQUES = "REMOLQUES";
export const FAMILIA_PUERTAS = "PUERTAS";

export type PedidoInput = Omit<
  Pedido,
  "id" | "created_at" | "updated_at"
>;

export type PedidoOrdenCampo =
  | "aguas"
  | "cliente"
  | "fecha"
  | "numero_pedido"
  | "radio"
  | "tipo";

export interface PedidoPageQuery {
  familiaId?: string;
  familiaNombre?: string;
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: PedidoOrdenCampo;
  sortDirection?: "asc" | "desc";
}

export interface PedidoPage {
  items: PedidoConRelaciones[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
