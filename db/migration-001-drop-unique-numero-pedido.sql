-- Migración 001: eliminar restricción UNIQUE en numero_pedido
-- Motivo: un mismo número de pedido puede tener varios ítems (diferentes medidas).
-- La unicidad se gestiona como advertencia en la app, no como restricción de BD.

ALTER TABLE historico.pedidos DROP CONSTRAINT IF EXISTS uq_pedidos_numero;
