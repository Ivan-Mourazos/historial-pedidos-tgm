-- Migración 002: unificar capitalización de clientes y tipos de puerta
-- Aplica Title Case a todos los nombres de cliente e initcap a tipos de puerta.
-- Los nombre_normalizado NO se tocan (son minúsculas intencionadamente).

-- ── CLIENTES ────────────────────────────────────────────────────────────────
-- initcap convierte "hijos de pedro lopez" → "Hijos De Pedro Lopez"
-- Casos especiales (acrónimos) se corrigen manualmente al final.

UPDATE historico.clientes SET nombre = initcap(nombre), updated_at = now()
WHERE nombre != initcap(nombre);

-- Correcciones manuales para acrónimos que initcap no trata bien
UPDATE historico.clientes SET nombre = 'NL Digital',  updated_at = now() WHERE nombre_normalizado = 'nl digital';
UPDATE historico.clientes SET nombre = 'ODL',         updated_at = now() WHERE nombre_normalizado = 'odl';
UPDATE historico.clientes SET nombre = 'J Carballo',  updated_at = now() WHERE nombre_normalizado = 'j carballo';
UPDATE historico.clientes SET nombre = 'T. Casal',    updated_at = now() WHERE nombre_normalizado = 't. casal';

-- ── TIPOS DE PUERTA ──────────────────────────────────────────────────────────
-- Unifica a formato "Nombre" (primera letra mayúscula, resto minúsculas)

UPDATE historico.tipos_puerta SET nombre = 'Apilable',      updated_at = now() WHERE lower(nombre) = 'apilable';
UPDATE historico.tipos_puerta SET nombre = 'Enrollable',    updated_at = now() WHERE lower(nombre) = 'enrollable';
UPDATE historico.tipos_puerta SET nombre = 'Plegable',      updated_at = now() WHERE lower(nombre) = 'plegable';
UPDATE historico.tipos_puerta SET nombre = 'Autoreparable', updated_at = now() WHERE lower(nombre) = 'autoreparable';

-- Los pedidos que referencian el tipo por texto también necesitan actualizarse
-- (la columna tipo en pedidos guarda el texto, no un ID)
UPDATE historico.pedidos SET tipo = 'Apilable',      updated_at = now() WHERE lower(tipo) = 'apilable';
UPDATE historico.pedidos SET tipo = 'Enrollable',    updated_at = now() WHERE lower(tipo) = 'enrollable';
UPDATE historico.pedidos SET tipo = 'Plegable',      updated_at = now() WHERE lower(tipo) = 'plegable';
UPDATE historico.pedidos SET tipo = 'Autoreparable', updated_at = now() WHERE lower(tipo) = 'autoreparable';
