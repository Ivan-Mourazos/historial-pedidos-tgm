-- =============================================================
-- Histórico de pedidos TGM — DDL de referencia para SQL Server
-- Schema: historico
-- Equivalencias respecto al DDL de PostgreSQL:
--   uuid + gen_random_uuid()  ->  UNIQUEIDENTIFIER DEFAULT NEWID()
--   numeric(10,2)             ->  DECIMAL(10,2)
--   boolean                   ->  BIT
--   timestamptz + now()       ->  DATETIME2 DEFAULT SYSUTCDATETIME()
--   text                      ->  NVARCHAR(...)
-- La normalización de nombres se hace en la aplicación (igual que en Postgres).
-- =============================================================

IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'historico')
    EXEC('CREATE SCHEMA historico');
GO

CREATE TABLE historico.clientes (
    id                 UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
    nombre             NVARCHAR(200) NOT NULL,
    nombre_normalizado NVARCHAR(200) NOT NULL,
    activo             BIT NOT NULL DEFAULT 1,
    created_at         DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at         DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT pk_clientes PRIMARY KEY (id),
    CONSTRAINT uq_clientes_nombre_normalizado UNIQUE (nombre_normalizado)
);
GO

CREATE TABLE historico.tecnicos (
    id         UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
    nombre     NVARCHAR(200) NOT NULL,
    activo     BIT NOT NULL DEFAULT 1,
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT pk_tecnicos PRIMARY KEY (id)
);
GO

CREATE TABLE historico.familias (
    id         UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
    nombre     NVARCHAR(100) NOT NULL,
    activo     BIT NOT NULL DEFAULT 1,
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT pk_familias PRIMARY KEY (id),
    CONSTRAINT uq_familias_nombre UNIQUE (nombre)
);
GO

CREATE TABLE historico.tipos_puerta (
    id         UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
    nombre     NVARCHAR(100) NOT NULL,
    activo     BIT NOT NULL DEFAULT 1,
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT pk_tipos_puerta PRIMARY KEY (id),
    CONSTRAINT uq_tipos_puerta_nombre UNIQUE (nombre)
);
GO

CREATE TABLE historico.pedidos (
    id            UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
    numero_pedido NVARCHAR(50) NOT NULL,
    cliente_id    UNIQUEIDENTIFIER NOT NULL,
    familia_id    UNIQUEIDENTIFIER NOT NULL,
    tipo          NVARCHAR(100) NULL,
    largo         DECIMAL(10,2) NULL,
    ancho         DECIMAL(10,2) NULL,
    alto          DECIMAL(10,2) NULL,
    aguas         DECIMAL(10,2) NULL,
    radio         DECIMAL(10,2) NULL,
    fecha         DATE NULL,
    tecnico_id    UNIQUEIDENTIFIER NULL,
    observaciones NVARCHAR(MAX) NULL,
    created_at    DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at    DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT pk_pedidos PRIMARY KEY (id),
    CONSTRAINT uq_pedidos_numero UNIQUE (numero_pedido),
    CONSTRAINT fk_pedidos_cliente FOREIGN KEY (cliente_id) REFERENCES historico.clientes(id),
    CONSTRAINT fk_pedidos_familia FOREIGN KEY (familia_id) REFERENCES historico.familias(id),
    CONSTRAINT fk_pedidos_tecnico FOREIGN KEY (tecnico_id) REFERENCES historico.tecnicos(id)
);
GO

CREATE INDEX ix_pedidos_cliente ON historico.pedidos (cliente_id);
CREATE INDEX ix_pedidos_familia ON historico.pedidos (familia_id);
CREATE INDEX ix_pedidos_numero  ON historico.pedidos (numero_pedido);
CREATE INDEX ix_pedidos_match_remolques ON historico.pedidos (cliente_id, familia_id, largo, ancho, alto, aguas, radio);
CREATE INDEX ix_pedidos_match_puertas   ON historico.pedidos (cliente_id, familia_id, tipo, ancho, alto);
GO
