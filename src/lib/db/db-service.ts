import { request } from "./client";
import { normalizarNombre } from "../normalize";
import type {
  Cliente,
  Familia,
  Pedido,
  PedidoConRelaciones,
  PedidoInput,
  Tecnico,
  TipoPuerta,
} from "../types";

const PEDIDO_SELECT =
  "*,cliente:cliente_id(id,nombre),familia:familia_id(id,nombre),tecnico:tecnico_id(id,nombre)";

export const dbService = {
  // ----------------------------- CLIENTES -----------------------------
  async getClientes(soloActivos = false): Promise<Cliente[]> {
    const filtro = soloActivos ? "&activo=eq.true" : "";
    return request<Cliente[]>(`clientes?select=*${filtro}&order=nombre.asc`);
  },

  async getClienteByNormalizado(
    nombreNormalizado: string,
  ): Promise<Cliente | null> {
    const res = await request<Cliente[]>(
      `clientes?nombre_normalizado=eq.${encodeURIComponent(nombreNormalizado)}`,
    );
    return res[0] ?? null;
  },

  async createCliente(nombre: string): Promise<Cliente> {
    const nombre_normalizado = normalizarNombre(nombre);
    const res = await request<Cliente[]>("clientes", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        nombre: nombre.trim(),
        nombre_normalizado,
        activo: true,
      }),
    });
    return res[0];
  },

  // Crea el cliente o devuelve el existente con el mismo nombre normalizado.
  async getOrCreateCliente(nombre: string): Promise<Cliente> {
    const normalizado = normalizarNombre(nombre);
    const existente = await this.getClienteByNormalizado(normalizado);
    if (existente) return existente;
    return this.createCliente(nombre);
  },

  async updateCliente(
    id: string,
    nombre: string,
    activo: boolean,
  ): Promise<Cliente> {
    const res = await request<Cliente[]>(`clientes?id=eq.${id}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        nombre: nombre.trim(),
        nombre_normalizado: normalizarNombre(nombre),
        activo,
        updated_at: new Date().toISOString(),
      }),
    });
    return res[0];
  },

  // ----------------------------- TECNICOS -----------------------------
  async getTecnicos(soloActivos = false): Promise<Tecnico[]> {
    const filtro = soloActivos ? "&activo=eq.true" : "";
    return request<Tecnico[]>(`tecnicos?select=*${filtro}&order=nombre.asc`);
  },

  async createTecnico(nombre: string): Promise<Tecnico> {
    const res = await request<Tecnico[]>("tecnicos", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ nombre: nombre.trim(), activo: true }),
    });
    return res[0];
  },

  async updateTecnico(
    id: string,
    nombre: string,
    activo: boolean,
  ): Promise<Tecnico> {
    const res = await request<Tecnico[]>(`tecnicos?id=eq.${id}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        nombre: nombre.trim(),
        activo,
        updated_at: new Date().toISOString(),
      }),
    });
    return res[0];
  },

  // ----------------------------- FAMILIAS -----------------------------
  async getFamilias(): Promise<Familia[]> {
    return request<Familia[]>(
      "familias?select=*&activo=eq.true&order=nombre.asc",
    );
  },

  // --------------------------- TIPOS PUERTA ---------------------------
  async getTiposPuerta(soloActivos = true): Promise<TipoPuerta[]> {
    const filtro = soloActivos ? "&activo=eq.true" : "";
    return request<TipoPuerta[]>(
      `tipos_puerta?select=*${filtro}&order=nombre.asc`,
    );
  },

  async createTipoPuerta(nombre: string): Promise<TipoPuerta> {
    const res = await request<TipoPuerta[]>("tipos_puerta", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ nombre: nombre.trim(), activo: true }),
    });
    return res[0];
  },

  // ----------------------------- PEDIDOS ------------------------------
  async getPedidos(): Promise<PedidoConRelaciones[]> {
    return request<PedidoConRelaciones[]>(
      `pedidos?select=${encodeURIComponent(PEDIDO_SELECT)}&order=created_at.desc`,
    );
  },

  // IDs de clientes que tienen al menos un pedido en esa familia.
  async getClienteIdsDeFamilia(familiaId: string): Promise<string[]> {
    const res = await request<{ cliente_id: string }[]>(
      `pedidos?select=cliente_id&familia_id=eq.${familiaId}`,
    );
    return [...new Set(res.map((r) => r.cliente_id))];
  },

  // Pedidos de un cliente y familia concretos (para búsqueda y parecidos).
  async getPedidosPorClienteFamilia(
    clienteId: string,
    familiaId: string,
  ): Promise<Pedido[]> {
    return request<Pedido[]>(
      `pedidos?cliente_id=eq.${clienteId}&familia_id=eq.${familiaId}&order=created_at.desc`,
    );
  },

  async getPedidoByNumero(numero: string): Promise<Pedido | null> {
    const res = await request<Pedido[]>(
      `pedidos?numero_pedido=eq.${encodeURIComponent(numero)}`,
    );
    return res[0] ?? null;
  },

  async createPedido(pedido: PedidoInput): Promise<Pedido> {
    const res = await request<Pedido[]>("pedidos", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(pedido),
    });
    return res[0];
  },

  async updatePedido(
    id: string,
    pedido: Partial<PedidoInput>,
  ): Promise<Pedido> {
    const res = await request<Pedido[]>(`pedidos?id=eq.${id}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        ...pedido,
        updated_at: new Date().toISOString(),
      }),
    });
    return res[0];
  },

  async deletePedido(id: string): Promise<void> {
    await request<void>(`pedidos?id=eq.${id}`, { method: "DELETE" });
  },
};
