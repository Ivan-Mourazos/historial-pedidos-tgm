-- Alturas distintas delante/detrás para remolques.
-- Ejecutar una vez sobre HIST_PEDIDOS antes de desplegar esta versión.

IF COL_LENGTH('historico.pedidos', 'alto_delante') IS NULL
BEGIN
    ALTER TABLE historico.pedidos ADD alto_delante DECIMAL(10, 2) NULL;
END
GO

IF COL_LENGTH('historico.pedidos', 'alto_atras') IS NULL
BEGIN
    ALTER TABLE historico.pedidos ADD alto_atras DECIMAL(10, 2) NULL;
END
GO

-- Caso confirmado en el Excel: altura 36 cm delante y 46 cm detrás.
UPDATE p
SET p.alto = NULL,
    p.alto_delante = 36,
    p.alto_atras = 46,
    p.updated_at = SYSDATETIMEOFFSET()
FROM historico.pedidos p
INNER JOIN historico.familias f ON f.id = p.familia_id
WHERE f.nombre = 'REMOLQUES'
  AND p.numero_pedido = 'AR2600737'
  AND p.rps_numero_linea = 1;
GO
