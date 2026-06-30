-- Migración para instalaciones existentes de Histórico de pedidos TGM.
-- Ejecutar una vez sobre SQL Server.

IF COL_LENGTH('historico.pedidos', 'impresion_digital') IS NULL
BEGIN
    ALTER TABLE historico.pedidos
        ADD impresion_digital BIT NOT NULL
            CONSTRAINT DF_pedidos_impresion_digital DEFAULT 0;
END
GO

IF OBJECT_ID('historico.tipos_remolque', 'U') IS NULL
BEGIN
    CREATE TABLE historico.tipos_remolque
    (
        id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
        nombre NVARCHAR(100) NOT NULL,
        activo BIT NOT NULL DEFAULT 1,
        CONSTRAINT PK_tipos_remolque PRIMARY KEY (id)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM historico.tipos_remolque WHERE nombre = N'Baquetón')
    INSERT INTO historico.tipos_remolque (nombre) VALUES (N'Baquetón');

IF NOT EXISTS (SELECT 1 FROM historico.tipos_remolque WHERE nombre = N'Ganado')
    INSERT INTO historico.tipos_remolque (nombre) VALUES (N'Ganado');

IF NOT EXISTS (SELECT 1 FROM historico.tipos_remolque WHERE nombre = N'Lona alta')
    INSERT INTO historico.tipos_remolque (nombre) VALUES (N'Lona alta');
GO
