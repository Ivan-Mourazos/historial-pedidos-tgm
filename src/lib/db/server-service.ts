// Implementación server-side del acceso a datos contra SQL Server.
// Reemplaza al antiguo cliente PostgREST/Supabase. Se ejecuta SOLO en el
// servidor (lo invoca la API route src/app/api/db/route.ts) porque depende
// del driver mssql y de una conexión TCP a la base de datos.

import { getPool, SCHEMA, sql } from "./sqlserver";
import { normalizarNombre } from "../normalize";
import type {
  Cliente,
  Familia,
  Pedido,
  PedidoConRelaciones,
  PedidoInput,
  PedidoOrdenCampo,
  PedidoPage,
  PedidoPageQuery,
  Tecnico,
  TipoPuerta,
  TipoRemolque,
} from "../types";

const TIPOS_REMOLQUE_BASE = ["Baquetón", "Ganado", "Lona alta"];

function tiposRemolqueFallback(): TipoRemolque[] {
  const now = new Date().toISOString();
  return TIPOS_REMOLQUE_BASE.map((nombre) => ({
    id: `base-${nombre.toLowerCase().replace(/\s+/g, "-")}`,
    nombre,
    activo: true,
    created_at: now,
    updated_at: now,
  }));
}

function esTablaTiposRemolqueNoCreada(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("tipos_remolque");
}

// Tipos mssql por columna de "pedidos", para enlazar parámetros correctamente.
const PEDIDO_COLUMN_TYPES: Record<string, () => sql.ISqlType> = {
  numero_pedido: () => sql.NVarChar(50),
  cliente_id: () => sql.UniqueIdentifier(),
  familia_id: () => sql.UniqueIdentifier(),
  tecnico_id: () => sql.UniqueIdentifier(),
  tipo: () => sql.NVarChar(100),
  largo: () => sql.Decimal(10, 2),
  ancho: () => sql.Decimal(10, 2),
  alto: () => sql.Decimal(10, 2),
  aguas: () => sql.Decimal(10, 2),
  radio: () => sql.Decimal(10, 2),
  recogida_delante: () => sql.NVarChar(100),
  recogida_atras: () => sql.NVarChar(100),
  impresion_digital: () => sql.Bit(),
  // DATE: se pasa como texto 'YYYY-MM-DD' (formato culture-independent) para
  // evitar desfases de zona horaria al convertir a Date.
  fecha: () => sql.NVarChar(10),
  observaciones: () => sql.NVarChar(sql.MAX),
  datos_tecnicos: () => sql.NVarChar(sql.MAX),
  datos_tecnicos_version: () => sql.Int(),
};

const PEDIDO_INSERTABLE = Object.keys(PEDIDO_COLUMN_TYPES);

// El driver devuelve las columnas DATE como objetos Date. La UI espera
// "YYYY-MM-DD" (se muestra en tablas y se enlaza a <input type="date">),
// que es como llegaba antes desde PostgREST. Normalizamos cada fila de pedido.
function normalizePedido<T extends Record<string, unknown>>(row: T): T {
  const normalized: Record<string, unknown> = { ...row };
  if (normalized.impresion_digital === undefined) {
    normalized.impresion_digital = false;
  }
  if (row.fecha instanceof Date) {
    normalized.fecha = row.fecha.toISOString().slice(0, 10);
  }
  if (typeof row.datos_tecnicos === "string") {
    try {
      normalized.datos_tecnicos = JSON.parse(row.datos_tecnicos);
    } catch {
      normalized.datos_tecnicos = null;
    }
  }
  return normalized as T;
}

// Reconstruye las relaciones embebidas (cliente/familia/tecnico) que antes
// resolvía PostgREST, a partir de las columnas aplanadas del JOIN.
function mapPedidoConRelaciones(
  row: Record<string, unknown>,
): PedidoConRelaciones {
  const {
    cliente_nombre,
    familia_nombre,
    tecnico_nombre,
    ...pedido
  } = row;
  const p = normalizePedido(pedido) as unknown as Pedido;
  return {
    ...p,
    cliente: p.cliente_id
      ? { id: p.cliente_id, nombre: (cliente_nombre as string) ?? "" }
      : null,
    familia: p.familia_id
      ? { id: p.familia_id, nombre: (familia_nombre as string) ?? "" }
      : null,
    tecnico: p.tecnico_id
      ? { id: p.tecnico_id, nombre: (tecnico_nombre as string) ?? "" }
      : null,
  };
}

const PEDIDO_FROM_JOIN = `
  FROM ${SCHEMA}.pedidos p
  LEFT JOIN ${SCHEMA}.clientes c ON c.id = p.cliente_id
  LEFT JOIN ${SCHEMA}.familias f ON f.id = p.familia_id
  LEFT JOIN ${SCHEMA}.tecnicos t ON t.id = p.tecnico_id`;

const PEDIDO_SELECT_JOIN = `
  SELECT p.*,
         c.nombre AS cliente_nombre,
         f.nombre AS familia_nombre,
         t.nombre AS tecnico_nombre
  ${PEDIDO_FROM_JOIN}`;

const PEDIDO_SORT_COLUMNS: Record<PedidoOrdenCampo, string> = {
  aguas: "p.aguas",
  cliente: "c.nombre",
  fecha: "p.fecha",
  numero_pedido: "p.numero_pedido",
  radio: "p.radio",
  tipo: "p.tipo",
};

export const dbServer = {
  // ----------------------------- CLIENTES -----------------------------
  async getClientes(soloActivos = false): Promise<Cliente[]> {
    const pool = await getPool();
    const filtro = soloActivos ? "WHERE activo = 1" : "";
    const res = await pool
      .request()
      .query(`SELECT * FROM ${SCHEMA}.clientes ${filtro} ORDER BY nombre ASC`);
    return res.recordset as Cliente[];
  },

  async getClienteByNormalizado(
    nombreNormalizado: string,
  ): Promise<Cliente | null> {
    const pool = await getPool();
    const res = await pool
      .request()
      .input("norm", sql.NVarChar(255), nombreNormalizado)
      .query(
        `SELECT TOP 1 * FROM ${SCHEMA}.clientes WHERE nombre_normalizado = @norm`,
      );
    return (res.recordset[0] as Cliente) ?? null;
  },

  async createCliente(nombre: string): Promise<Cliente> {
    const pool = await getPool();
    const res = await pool
      .request()
      .input("nombre", sql.NVarChar(255), nombre.trim())
      .input("norm", sql.NVarChar(255), normalizarNombre(nombre))
      .query(
        `INSERT INTO ${SCHEMA}.clientes (nombre, nombre_normalizado, activo)
         OUTPUT INSERTED.*
         VALUES (@nombre, @norm, 1)`,
      );
    return res.recordset[0] as Cliente;
  },

  // Crea el cliente o devuelve el existente con el mismo nombre normalizado.
  async getOrCreateCliente(nombre: string): Promise<Cliente> {
    const existente = await this.getClienteByNormalizado(
      normalizarNombre(nombre),
    );
    if (existente) return existente;
    return this.createCliente(nombre);
  },

  async updateCliente(
    id: string,
    nombre: string,
    activo: boolean,
  ): Promise<Cliente> {
    const pool = await getPool();
    const res = await pool
      .request()
      .input("id", sql.UniqueIdentifier, id)
      .input("nombre", sql.NVarChar(255), nombre.trim())
      .input("norm", sql.NVarChar(255), normalizarNombre(nombre))
      .input("activo", sql.Bit, activo)
      .query(
        `UPDATE ${SCHEMA}.clientes
         SET nombre = @nombre, nombre_normalizado = @norm, activo = @activo,
             updated_at = SYSDATETIMEOFFSET()
         OUTPUT INSERTED.*
         WHERE id = @id`,
      );
    return res.recordset[0] as Cliente;
  },

  // ----------------------------- TECNICOS -----------------------------
  async getTecnicos(soloActivos = false): Promise<Tecnico[]> {
    const pool = await getPool();
    const filtro = soloActivos ? "WHERE activo = 1" : "";
    const res = await pool
      .request()
      .query(`SELECT * FROM ${SCHEMA}.tecnicos ${filtro} ORDER BY nombre ASC`);
    return res.recordset as Tecnico[];
  },

  async createTecnico(nombre: string): Promise<Tecnico> {
    const pool = await getPool();
    const res = await pool
      .request()
      .input("nombre", sql.NVarChar(255), nombre.trim())
      .query(
        `INSERT INTO ${SCHEMA}.tecnicos (nombre, activo)
         OUTPUT INSERTED.*
         VALUES (@nombre, 1)`,
      );
    return res.recordset[0] as Tecnico;
  },

  async updateTecnico(
    id: string,
    nombre: string,
    activo: boolean,
  ): Promise<Tecnico> {
    const pool = await getPool();
    const res = await pool
      .request()
      .input("id", sql.UniqueIdentifier, id)
      .input("nombre", sql.NVarChar(255), nombre.trim())
      .input("activo", sql.Bit, activo)
      .query(
        `UPDATE ${SCHEMA}.tecnicos
         SET nombre = @nombre, activo = @activo, updated_at = SYSDATETIMEOFFSET()
         OUTPUT INSERTED.*
         WHERE id = @id`,
      );
    return res.recordset[0] as Tecnico;
  },

  // ----------------------------- FAMILIAS -----------------------------
  async getFamilias(): Promise<Familia[]> {
    const pool = await getPool();
    const res = await pool
      .request()
      .query(
        `SELECT * FROM ${SCHEMA}.familias WHERE activo = 1 ORDER BY nombre ASC`,
      );
    return res.recordset as Familia[];
  },

  // --------------------------- TIPOS PUERTA ---------------------------
  async getTiposPuerta(soloActivos = true): Promise<TipoPuerta[]> {
    const pool = await getPool();
    const filtro = soloActivos ? "WHERE activo = 1" : "";
    const res = await pool
      .request()
      .query(
        `SELECT * FROM ${SCHEMA}.tipos_puerta ${filtro} ORDER BY nombre ASC`,
      );
    return res.recordset as TipoPuerta[];
  },

  async createTipoPuerta(nombre: string): Promise<TipoPuerta> {
    const pool = await getPool();
    const res = await pool
      .request()
      .input("nombre", sql.NVarChar(100), nombre.trim())
      .query(
        `INSERT INTO ${SCHEMA}.tipos_puerta (nombre, activo)
         OUTPUT INSERTED.*
         VALUES (@nombre, 1)`,
      );
    return res.recordset[0] as TipoPuerta;
  },

  // -------------------------- TIPOS REMOLQUE --------------------------
  async getTiposRemolque(soloActivos = true): Promise<TipoRemolque[]> {
    const pool = await getPool();
    const filtro = soloActivos ? "WHERE activo = 1" : "";
    try {
      const res = await pool
        .request()
        .query(
          `SELECT * FROM ${SCHEMA}.tipos_remolque ${filtro} ORDER BY nombre ASC`,
        );
      return res.recordset as TipoRemolque[];
    } catch (e) {
      if (esTablaTiposRemolqueNoCreada(e)) return tiposRemolqueFallback();
      throw e;
    }
  },

  async getCatalogos() {
    const [clientes, familias, tecnicos, tiposPuerta, tiposRemolque] = await Promise.all([
      this.getClientes(true),
      this.getFamilias(),
      this.getTecnicos(true),
      this.getTiposPuerta(true),
      this.getTiposRemolque(true),
    ]);
    return { clientes, familias, tecnicos, tiposPuerta, tiposRemolque };
  },

  async createTipoRemolque(nombre: string): Promise<TipoRemolque> {
    const pool = await getPool();
    const res = await pool
      .request()
      .input("nombre", sql.NVarChar(100), nombre.trim())
      .query(
        `INSERT INTO ${SCHEMA}.tipos_remolque (nombre, activo)
         OUTPUT INSERTED.*
         VALUES (@nombre, 1)`,
      );
    return res.recordset[0] as TipoRemolque;
  },

  // ----------------------------- PEDIDOS ------------------------------
  async getPedidosPage(query: PedidoPageQuery = {}): Promise<PedidoPage> {
    const pool = await getPool();
    const pageSize = Math.min(100, Math.max(10, Math.trunc(query.pageSize ?? 50)));
    const page = Math.max(1, Math.trunc(query.page ?? 1));
    const offset = (page - 1) * pageSize;
    const sortBy = query.sortBy && PEDIDO_SORT_COLUMNS[query.sortBy]
      ? query.sortBy
      : "fecha";
    const sortColumn = PEDIDO_SORT_COLUMNS[sortBy];
    const sortDirection = query.sortDirection === "asc" ? "ASC" : "DESC";
    const filters: string[] = [];

    if (query.familiaId) filters.push("p.familia_id = @familiaId");
    else if (query.familiaNombre) filters.push("f.nombre = @familiaNombre");

    const search = query.search?.trim();
    if (search) {
      filters.push(`LOWER(CONCAT(
        p.numero_pedido, N' ', c.nombre, N' ', p.tipo, N' ',
        CONVERT(NVARCHAR(50), p.largo), N' ',
        CONVERT(NVARCHAR(50), p.ancho), N' ',
        CONVERT(NVARCHAR(50), p.alto), N' ',
        p.recogida_delante, N' ', p.recogida_atras
      )) LIKE @search`);
    }

    const where = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";
    const bind = (request: ReturnType<typeof pool.request>) => {
      if (query.familiaId) request.input("familiaId", sql.UniqueIdentifier, query.familiaId);
      else if (query.familiaNombre) request.input("familiaNombre", sql.NVarChar(100), query.familiaNombre);
      if (search) request.input("search", sql.NVarChar(400), `%${search.toLocaleLowerCase("es-ES")}%`);
      return request;
    };

    const countPromise = bind(pool.request()).query(
      `SELECT COUNT_BIG(1) AS total ${PEDIDO_FROM_JOIN} ${where}`,
    );
    const itemsPromise = bind(pool.request())
      .input("offset", sql.Int, offset)
      .input("pageSize", sql.Int, pageSize)
      .query(`${PEDIDO_SELECT_JOIN}
        ${where}
        ORDER BY CASE WHEN ${sortColumn} IS NULL THEN 1 ELSE 0 END,
                 ${sortColumn} ${sortDirection}, p.created_at DESC
        OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`);

    const [countResult, itemsResult] = await Promise.all([countPromise, itemsPromise]);
    const total = Number(countResult.recordset[0]?.total ?? 0);
    return {
      items: itemsResult.recordset.map(mapPedidoConRelaciones),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  },

  async getPedidos(): Promise<PedidoConRelaciones[]> {
    const pool = await getPool();
    const res = await pool
      .request()
      .query(`${PEDIDO_SELECT_JOIN} ORDER BY p.created_at DESC`);
    return res.recordset.map(mapPedidoConRelaciones);
  },

  // IDs de clientes que tienen al menos un pedido en esa familia.
  async getClienteIdsDeFamilia(familiaId: string): Promise<string[]> {
    const pool = await getPool();
    const res = await pool
      .request()
      .input("familia", sql.UniqueIdentifier, familiaId)
      .query(
        `SELECT DISTINCT cliente_id FROM ${SCHEMA}.pedidos WHERE familia_id = @familia`,
      );
    return res.recordset.map((r: { cliente_id: string }) => r.cliente_id);
  },

  // Pedidos de un cliente y familia concretos (para búsqueda y parecidos).
  async getPedidosPorClienteFamilia(
    clienteId: string,
    familiaId: string,
  ): Promise<Pedido[]> {
    const pool = await getPool();
    const res = await pool
      .request()
      .input("cliente", sql.UniqueIdentifier, clienteId)
      .input("familia", sql.UniqueIdentifier, familiaId)
      .query(
        `SELECT * FROM ${SCHEMA}.pedidos
         WHERE cliente_id = @cliente AND familia_id = @familia
         ORDER BY created_at DESC`,
      );
    return res.recordset.map(normalizePedido) as Pedido[];
  },

  // Todos los pedidos de una familia (búsqueda sin cliente seleccionado).
  async getPedidosPorFamilia(
    familiaId: string,
  ): Promise<PedidoConRelaciones[]> {
    const pool = await getPool();
    const res = await pool
      .request()
      .input("familia", sql.UniqueIdentifier, familiaId)
      .query(
        `${PEDIDO_SELECT_JOIN} WHERE p.familia_id = @familia ORDER BY p.created_at DESC`,
      );
    return res.recordset.map(mapPedidoConRelaciones);
  },

  async getPedidoByNumero(numero: string): Promise<Pedido | null> {
    const pool = await getPool();
    const res = await pool
      .request()
      .input("numero", sql.NVarChar(50), numero)
      .query(
        `SELECT TOP 1 * FROM ${SCHEMA}.pedidos WHERE numero_pedido = @numero`,
      );
    const row = res.recordset[0];
    return row ? (normalizePedido(row) as Pedido) : null;
  },

  async createPedido(pedido: PedidoInput): Promise<Pedido> {
    const pool = await getPool();
    const request = pool.request();
    const cols: string[] = [];

    for (const col of PEDIDO_INSERTABLE) {
      const value = (pedido as Record<string, unknown>)[col];
      if (value === undefined) continue;
      cols.push(col);
      request.input(
        col,
        PEDIDO_COLUMN_TYPES[col](),
        col === "datos_tecnicos" && value != null ? JSON.stringify(value) : value ?? null,
      );
    }

    const columnList = cols.join(", ");
    const valueList = cols.map((c) => `@${c}`).join(", ");
    const res = await request.query(
      `INSERT INTO ${SCHEMA}.pedidos (${columnList})
       OUTPUT INSERTED.*
       VALUES (${valueList})`,
    );
    return normalizePedido(res.recordset[0]) as Pedido;
  },

  async updatePedido(
    id: string,
    pedido: Partial<PedidoInput>,
  ): Promise<Pedido> {
    const pool = await getPool();
    const request = pool.request();
    request.input("id", sql.UniqueIdentifier, id);
    const sets: string[] = [];

    for (const col of PEDIDO_INSERTABLE) {
      const value = (pedido as Record<string, unknown>)[col];
      if (value === undefined) continue;
      sets.push(`${col} = @${col}`);
      request.input(
        col,
        PEDIDO_COLUMN_TYPES[col](),
        col === "datos_tecnicos" && value != null ? JSON.stringify(value) : value ?? null,
      );
    }
    sets.push("updated_at = SYSDATETIMEOFFSET()");

    const res = await request.query(
      `UPDATE ${SCHEMA}.pedidos
       SET ${sets.join(", ")}
       OUTPUT INSERTED.*
       WHERE id = @id`,
    );
    return normalizePedido(res.recordset[0]) as Pedido;
  },

  async deletePedido(id: string): Promise<void> {
    const pool = await getPool();
    await pool
      .request()
      .input("id", sql.UniqueIdentifier, id)
      .query(`DELETE FROM ${SCHEMA}.pedidos WHERE id = @id`);
  },
};

export type DbServer = typeof dbServer;
