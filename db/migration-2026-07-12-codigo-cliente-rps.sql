IF COL_LENGTH('historico.clientes', 'codigo_cliente') IS NULL
BEGIN
    ALTER TABLE historico.clientes ADD codigo_cliente NVARCHAR(50) NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_clientes_codigo_cliente' AND object_id = OBJECT_ID('historico.clientes'))
BEGIN
    CREATE UNIQUE INDEX UX_clientes_codigo_cliente
        ON historico.clientes(codigo_cliente)
        WHERE codigo_cliente IS NOT NULL;
END
GO
