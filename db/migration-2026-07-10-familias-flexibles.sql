-- Campos técnicos flexibles y soporte para histórico paginado.
-- Ejecutar una vez sobre SQL Server antes de registrar nuevas familias.

IF COL_LENGTH('historico.pedidos', 'datos_tecnicos') IS NULL
BEGIN
    ALTER TABLE historico.pedidos ADD datos_tecnicos NVARCHAR(MAX) NULL;
END
GO

IF COL_LENGTH('historico.pedidos', 'datos_tecnicos_version') IS NULL
BEGIN
    ALTER TABLE historico.pedidos ADD datos_tecnicos_version INT NOT NULL
        CONSTRAINT DF_pedidos_datos_tecnicos_version DEFAULT 1;
END
GO

-- SQL Server 2014 no incluye ISJSON. El contenido se serializa y valida en la
-- aplicación antes de guardarlo, por lo que esta columna permanece NVARCHAR(MAX)
-- sin una restricción JSON en la base de datos.

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_pedidos_familia_fecha'
      AND object_id = OBJECT_ID('historico.pedidos')
)
BEGIN
    CREATE INDEX IX_pedidos_familia_fecha
        ON historico.pedidos (familia_id, fecha DESC, created_at DESC);
END
GO
