-- =============================================================
-- Histórico de pedidos TGM — DDL para Supabase (PostgreSQL)
-- Schema: historico  (DEDICADO solo a esta app, separado de remolques)
--
-- IMPORTANTE (paso manual en Supabase):
--   Tras ejecutar este script, ve a:
--     Project Settings > API > "Exposed schemas"
--   y añade  historico  a la lista (junto a public, tgm...).
--   Sin ese paso, PostgREST devolverá 404/406 al consultar las tablas.
--
-- Diseño deliberadamente compatible con SQL Server:
--   - Sin extensiones ni funciones exclusivas de PostgreSQL en el modelo.
--   - Tipos estándar (numeric -> DECIMAL, timestamptz -> DATETIME2).
--   - La normalización de nombres se hace en la aplicación.
-- =============================================================

create schema if not exists historico;
set search_path to historico;

-- Para gen_random_uuid() (incluida en Supabase por defecto).
-- En SQL Server se sustituye por NEWID() / DEFAULT en la columna.
create extension if not exists pgcrypto;

-- -------------------------------------------------------------
-- CLIENTES
-- -------------------------------------------------------------
create table if not exists historico.clientes (
  id                 uuid primary key default gen_random_uuid(),
  nombre             text not null,
  nombre_normalizado text not null,
  activo             boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint uq_clientes_nombre_normalizado unique (nombre_normalizado)
);

-- -------------------------------------------------------------
-- TECNICOS
-- -------------------------------------------------------------
create table if not exists historico.tecnicos (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  activo     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -------------------------------------------------------------
-- FAMILIAS
-- -------------------------------------------------------------
create table if not exists historico.familias (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  activo     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_familias_nombre unique (nombre)
);

-- -------------------------------------------------------------
-- TIPOS DE PUERTA (catálogo editable, usado por la familia PUERTAS)
-- -------------------------------------------------------------
create table if not exists historico.tipos_puerta (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  activo     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_tipos_puerta_nombre unique (nombre)
);

-- -------------------------------------------------------------
-- TIPOS DE REMOLQUE (catálogo editable, usado por REMOLQUES)
-- -------------------------------------------------------------
create table if not exists historico.tipos_remolque (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  activo     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_tipos_remolque_nombre unique (nombre)
);

-- -------------------------------------------------------------
-- PEDIDOS
-- -------------------------------------------------------------
create table if not exists historico.pedidos (
  id            uuid primary key default gen_random_uuid(),
  numero_pedido text not null,
  cliente_id    uuid not null references historico.clientes(id),
  familia_id    uuid not null references historico.familias(id),
  tipo          text,                 -- usado en PUERTAS
  largo         numeric(10,2),        -- REMOLQUES
  ancho         numeric(10,2),        -- REMOLQUES y PUERTAS
  alto          numeric(10,2),        -- altura (remolques) / alto (puertas)
  alto_delante  numeric(10,2),        -- REMOLQUES con distinta altura delante/detrás
  alto_atras    numeric(10,2),        -- REMOLQUES con distinta altura delante/detrás
  aguas         numeric(10,2),        -- REMOLQUES, opcional (NULL solo coincide con NULL)
  radio         numeric(10,2),        -- REMOLQUES, opcional (NULL solo coincide con NULL)
  impresion_digital boolean not null default false, -- PUERTAS
  fecha         date,
  tecnico_id    uuid references historico.tecnicos(id),
  observaciones text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint uq_pedidos_numero unique (numero_pedido)
);

-- -------------------------------------------------------------
-- ÍNDICES
-- -------------------------------------------------------------
create index if not exists ix_pedidos_cliente   on historico.pedidos (cliente_id);
create index if not exists ix_pedidos_familia   on historico.pedidos (familia_id);
create index if not exists ix_pedidos_numero    on historico.pedidos (numero_pedido);

-- Búsqueda exacta REMOLQUES
create index if not exists ix_pedidos_match_remolques
  on historico.pedidos (cliente_id, familia_id, largo, ancho, alto, aguas, radio);

-- Búsqueda exacta PUERTAS
create index if not exists ix_pedidos_match_puertas
  on historico.pedidos (cliente_id, familia_id, tipo, ancho, alto);

-- =============================================================
-- PERMISOS PostgREST (anon / authenticated)
-- Necesario para que la API REST pueda leer/escribir en el schema nuevo.
-- =============================================================
grant usage on schema historico to anon, authenticated, service_role;
grant all on all tables in schema historico to anon, authenticated, service_role;
alter default privileges in schema historico
  grant all on tables to anon, authenticated, service_role;

-- =============================================================
-- SEEDS
-- =============================================================
insert into historico.familias (nombre)
values ('REMOLQUES'), ('PUERTAS')
on conflict (nombre) do nothing;

insert into historico.tipos_puerta (nombre)
values
  ('Puerta corredera'),
  ('Puerta abatible'),
  ('Puerta de dos hojas'),
  ('Puerta basculante')
on conflict (nombre) do nothing;

insert into historico.tipos_remolque (nombre)
values
  ('Baquetón'),
  ('Ganado'),
  ('Lona alta')
on conflict (nombre) do nothing;
