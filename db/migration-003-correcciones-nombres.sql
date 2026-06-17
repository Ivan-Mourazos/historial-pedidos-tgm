-- Migración 003: correcciones de nombres
-- 1. Fusionar J.carbajo → Talleres Carbajo
-- 2. Corregir conectores en mayúscula (Y, De, Del, La, Los, El...)
-- 3. Corregir Toldos Y Cerramientos Gyg → Toldos y Cerramientos GYG
-- 4. Uniformar tipos de puerta semilla a Title Case

-- ── 1. FUSIONAR J.carbajo → Talleres Carbajo ────────────────────────────────
-- Reasignar pedidos de J.carbajo al id de Talleres Carbajo
UPDATE historico.pedidos
SET cliente_id = (SELECT id FROM historico.clientes WHERE nombre_normalizado = 'talleres carbajo'),
    updated_at = now()
WHERE cliente_id = (SELECT id FROM historico.clientes WHERE nombre_normalizado = 'j.carbajo');

-- Eliminar el cliente duplicado
DELETE FROM historico.clientes WHERE nombre_normalizado = 'j.carbajo';

-- ── 2. CONECTORES EN MINÚSCULA ───────────────────────────────────────────────
-- Aplica lowercase a: y, de, del, la, las, los, el, en, a
-- Se usa REGEXP_REPLACE para reemplazar palabras enteras en mayúscula

UPDATE historico.clientes SET nombre = regexp_replace(nombre, '\mY\M',   'y',   'g'), updated_at = now() WHERE nombre ~ '\mY\M';
UPDATE historico.clientes SET nombre = regexp_replace(nombre, '\mDe\M',  'de',  'g'), updated_at = now() WHERE nombre ~ '\mDe\M';
UPDATE historico.clientes SET nombre = regexp_replace(nombre, '\mDel\M', 'del', 'g'), updated_at = now() WHERE nombre ~ '\mDel\M';
UPDATE historico.clientes SET nombre = regexp_replace(nombre, '\mLa\M',  'la',  'g'), updated_at = now() WHERE nombre ~ '\mLa\M';
UPDATE historico.clientes SET nombre = regexp_replace(nombre, '\mLas\M', 'las', 'g'), updated_at = now() WHERE nombre ~ '\mLas\M';
UPDATE historico.clientes SET nombre = regexp_replace(nombre, '\mLos\M', 'los', 'g'), updated_at = now() WHERE nombre ~ '\mLos\M';
UPDATE historico.clientes SET nombre = regexp_replace(nombre, '\mEl\M',  'el',  'g'), updated_at = now() WHERE nombre ~ '\mEl\M';
UPDATE historico.clientes SET nombre = regexp_replace(nombre, '\mEn\M',  'en',  'g'), updated_at = now() WHERE nombre ~ '\mEn\M';

-- ── 3. CORRECCIONES MANUALES ─────────────────────────────────────────────────
UPDATE historico.clientes SET nombre = 'Toldos y Cerramientos GYG', updated_at = now() WHERE nombre_normalizado = 'toldos y cerramientos gyg';
UPDATE historico.clientes SET nombre = 'Vifer y Diego',             updated_at = now() WHERE nombre_normalizado = 'vifer y diego';
UPDATE historico.clientes SET nombre = 'Hijos de Pedro Lopez',      updated_at = now() WHERE nombre_normalizado = 'hijos de pedro lopez';
UPDATE historico.clientes SET nombre = 'Iberica de Remolques',      updated_at = now() WHERE nombre_normalizado = 'iberica de remolques';
UPDATE historico.clientes SET nombre = 'Lacteos Terra de Melide',   updated_at = now() WHERE nombre_normalizado = 'lacteos terra de melide';
UPDATE historico.clientes SET nombre = 'Hnos. Sanchez - La Fuente', updated_at = now() WHERE nombre_normalizado = 'hnos. sanchez - la fuente';

-- ── 4. TIPOS DE PUERTA — Title Case uniforme ─────────────────────────────────
UPDATE historico.tipos_puerta SET nombre = 'Puerta Abatible',      updated_at = now() WHERE lower(nombre) = 'puerta abatible';
UPDATE historico.tipos_puerta SET nombre = 'Puerta Basculante',    updated_at = now() WHERE lower(nombre) = 'puerta basculante';
UPDATE historico.tipos_puerta SET nombre = 'Puerta Corredera',     updated_at = now() WHERE lower(nombre) = 'puerta corredera';
UPDATE historico.tipos_puerta SET nombre = 'Puerta De Dos Hojas',  updated_at = now() WHERE lower(nombre) = 'puerta de dos hojas';

-- Actualizar también la columna tipo en pedidos para los tipos semilla
UPDATE historico.pedidos SET tipo = 'Puerta Abatible',     updated_at = now() WHERE lower(tipo) = 'puerta abatible';
UPDATE historico.pedidos SET tipo = 'Puerta Basculante',   updated_at = now() WHERE lower(tipo) = 'puerta basculante';
UPDATE historico.pedidos SET tipo = 'Puerta Corredera',    updated_at = now() WHERE lower(tipo) = 'puerta corredera';
UPDATE historico.pedidos SET tipo = 'Puerta De Dos Hojas', updated_at = now() WHERE lower(tipo) = 'puerta de dos hojas';
