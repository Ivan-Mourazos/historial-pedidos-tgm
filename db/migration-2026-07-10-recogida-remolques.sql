-- Tipo de recogida delantera y trasera para remolques de lona.
-- Ejecutar una vez sobre SQL Server antes de desplegar esta versión.

IF COL_LENGTH('historico.pedidos', 'recogida_delante') IS NULL
BEGIN
    ALTER TABLE historico.pedidos ADD recogida_delante NVARCHAR(100) NULL;
END
GO

IF COL_LENGTH('historico.pedidos', 'recogida_atras') IS NULL
BEGIN
    ALTER TABLE historico.pedidos ADD recogida_atras NVARCHAR(100) NULL;
END
GO
