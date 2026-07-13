-- ============================================================
-- Crear schema para aislar las tablas de la aplicación
IF NOT EXISTS (SELECT 1
FROM sys.schemas
WHERE name = 'historico')
    EXEC('CREATE SCHEMA historico');
GO

-- ── CLIENTES ─────────────────────────────────────────────────
CREATE TABLE historico.clientes
(
    id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
    nombre NVARCHAR(255) NOT NULL,
    nombre_normalizado NVARCHAR(255) NOT NULL,
    codigo_cliente NVARCHAR(50) NULL,
    -- nombre en minúsculas sin espacios extra
    activo BIT NOT NULL DEFAULT 1,
    created_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    updated_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT PK_clientes PRIMARY KEY (id),
    CONSTRAINT UQ_clientes_normalizado UNIQUE (nombre_normalizado)
);
CREATE UNIQUE INDEX UX_clientes_codigo_cliente ON historico.clientes(codigo_cliente) WHERE codigo_cliente IS NOT NULL;
GO

-- ── TECNICOS ─────────────────────────────────────────────────
CREATE TABLE historico.tecnicos
(
    id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
    nombre NVARCHAR(255) NOT NULL,
    activo BIT NOT NULL DEFAULT 1,
    created_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    updated_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT PK_tecnicos PRIMARY KEY (id)
);
GO

-- ── FAMILIAS (REMOLQUES / PUERTAS) ───────────────────────────
CREATE TABLE historico.familias
(
    id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
    nombre NVARCHAR(100) NOT NULL,
    activo BIT NOT NULL DEFAULT 1,
    CONSTRAINT PK_familias PRIMARY KEY (id)
);
GO

-- ── TIPOS DE PUERTA ──────────────────────────────────────────
CREATE TABLE historico.tipos_puerta
(
    id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
    nombre NVARCHAR(100) NOT NULL,
    activo BIT NOT NULL DEFAULT 1,
    CONSTRAINT PK_tipos_puerta PRIMARY KEY (id)
);
GO

-- ── TIPOS DE REMOLQUE ────────────────────────────────────────
CREATE TABLE historico.tipos_remolque
(
    id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
    nombre NVARCHAR(100) NOT NULL,
    activo BIT NOT NULL DEFAULT 1,
    CONSTRAINT PK_tipos_remolque PRIMARY KEY (id)
);
GO

-- ── PEDIDOS ──────────────────────────────────────────────────
CREATE TABLE historico.pedidos
(
    id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
    numero_pedido NVARCHAR(50) NOT NULL,
    cliente_id UNIQUEIDENTIFIER NOT NULL,
    familia_id UNIQUEIDENTIFIER NOT NULL,
    tecnico_id UNIQUEIDENTIFIER NULL,
    -- Medidas remolques (en cm)
    largo DECIMAL(10, 2) NULL,
    ancho DECIMAL(10, 2) NULL,
    alto DECIMAL(10, 2) NULL,
    aguas DECIMAL(10, 2) NULL,
    radio DECIMAL(10, 2) NULL,
    recogida_delante NVARCHAR(100) NULL,
    recogida_atras NVARCHAR(100) NULL,
    -- Medidas puertas
    tipo NVARCHAR(100) NULL,
    impresion_digital BIT NOT NULL DEFAULT 0,
    -- General
    fecha DATE NULL,
    observaciones NVARCHAR(MAX) NULL,
    -- Estado del planteo. Solo los REALIZADOS participan en las coincidencias.
    estado_planteo NVARCHAR(20) NOT NULL DEFAULT 'REALIZADO',
    estado_planteo_manual BIT NOT NULL DEFAULT 0,
    rps_numero_linea INT NULL,
    rps_planteo_progreso DECIMAL(5, 2) NULL,
    -- Campos propios de futuras familias. JSON versionado para poder evolucionar
    -- cada definición sin añadir columnas por cada familia.
    datos_tecnicos NVARCHAR(MAX) NULL,
    datos_tecnicos_version INT NOT NULL DEFAULT 1,
    created_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    updated_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT PK_pedidos         PRIMARY KEY (id),
    CONSTRAINT FK_pedidos_cliente FOREIGN KEY (cliente_id) REFERENCES historico.clientes(id),
    CONSTRAINT FK_pedidos_familia FOREIGN KEY (familia_id) REFERENCES historico.familias(id),
    CONSTRAINT FK_pedidos_tecnico FOREIGN KEY (tecnico_id) REFERENCES historico.tecnicos(id),
    CONSTRAINT CK_pedidos_estado_planteo CHECK (estado_planteo IN ('PENDIENTE', 'REALIZADO'))
);
GO

CREATE INDEX IX_pedidos_numero         ON historico.pedidos (numero_pedido);
CREATE INDEX IX_pedidos_cliente_familia ON historico.pedidos (cliente_id, familia_id);
CREATE INDEX IX_pedidos_created        ON historico.pedidos (created_at DESC);
CREATE INDEX IX_pedidos_familia_fecha  ON historico.pedidos (familia_id, fecha DESC, created_at DESC);
CREATE INDEX IX_pedidos_familia_estado_fecha ON historico.pedidos (familia_id, estado_planteo, fecha DESC, created_at DESC);
CREATE INDEX IX_pedidos_rps_linea ON historico.pedidos (numero_pedido, rps_numero_linea) WHERE rps_numero_linea IS NOT NULL;
GO

-- ── DATOS INICIALES ──────────────────────────────────────────
INSERT INTO historico.familias
    (nombre)
VALUES
    ('REMOLQUES'),
    ('PUERTAS');

INSERT INTO historico.tipos_puerta
    (nombre)
VALUES
    ('Puerta Abatible'),
    ('Puerta Basculante'),
    ('Puerta Corredera'),
    ('Puerta De Dos Hojas'),
    ('Apilable'),
    ('Enrollable');
GO

INSERT INTO historico.tipos_remolque
    (nombre)
VALUES
    ('Baquetón'),
    ('Ganado'),
    ('Lona alta');
GO

-- ── PERMISOS PARA LA APLICACIÓN ──────────────────────────────
-- Opción A — Autenticación Windows / Active Directory (recomendada)
--   IT crea un usuario de dominio para el servidor web (ej. TGM\srv_historico)
--   y le da permisos de lectura/escritura sobre el schema:
--
-- CREATE USER [TGM\srv_historico] FOR LOGIN [TGM\srv_historico];
-- GRANT SELECT, INSERT, UPDATE, DELETE ON SCHEMA::historico TO [TGM\srv_historico];
--
-- Opción B — Login SQL Server (si no se usa AD)
--
-- CREATE LOGIN historico_app WITH PASSWORD = 'CambiarPorContraseñaSegura!';
-- CREATE USER  historico_app FOR LOGIN historico_app;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON SCHEMA::historico TO historico_app;
GO
