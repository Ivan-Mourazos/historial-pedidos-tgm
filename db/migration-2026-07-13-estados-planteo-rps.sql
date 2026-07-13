-- Estado del planteo y relación estable con cada línea de RPS.
-- Ejecutar una vez sobre HIST_PEDIDOS antes de desplegar esta versión.

IF COL_LENGTH('historico.pedidos', 'estado_planteo') IS NULL
BEGIN
    ALTER TABLE historico.pedidos ADD estado_planteo NVARCHAR(20) NOT NULL
        CONSTRAINT DF_pedidos_estado_planteo DEFAULT 'REALIZADO';
END
GO

IF COL_LENGTH('historico.pedidos', 'estado_planteo_manual') IS NULL
BEGIN
    ALTER TABLE historico.pedidos ADD estado_planteo_manual BIT NOT NULL
        CONSTRAINT DF_pedidos_estado_planteo_manual DEFAULT 0;
END
GO

IF COL_LENGTH('historico.pedidos', 'rps_numero_linea') IS NULL
BEGIN
    ALTER TABLE historico.pedidos ADD rps_numero_linea INT NULL;
END
GO

IF COL_LENGTH('historico.pedidos', 'rps_planteo_progreso') IS NULL
BEGIN
    ALTER TABLE historico.pedidos ADD rps_planteo_progreso DECIMAL(5, 2) NULL;
END
GO

IF OBJECT_ID('historico.CK_pedidos_estado_planteo', 'C') IS NULL
BEGIN
    ALTER TABLE historico.pedidos WITH CHECK
        ADD CONSTRAINT CK_pedidos_estado_planteo
        CHECK (estado_planteo IN ('PENDIENTE', 'REALIZADO'));
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_pedidos_familia_estado_fecha'
      AND object_id = OBJECT_ID('historico.pedidos')
)
BEGIN
    CREATE INDEX IX_pedidos_familia_estado_fecha
        ON historico.pedidos (familia_id, estado_planteo, fecha DESC, created_at DESC);
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_pedidos_rps_linea'
      AND object_id = OBJECT_ID('historico.pedidos')
)
BEGIN
    CREATE INDEX IX_pedidos_rps_linea
        ON historico.pedidos (numero_pedido, rps_numero_linea)
        WHERE rps_numero_linea IS NOT NULL;
END
GO
