/**
 * Importación de pedidos históricos desde Excel a Supabase (schema historico).
 *
 * Uso:
 *   node scripts/import-excel.mjs "ruta/al/archivo.xlsx"
 *
 * Hojas esperadas:
 *   REMOLQUES  →  Nº Pedido | Cliente | Largo | Ancho | Altura | aguas | radio
 *   PUERTAS    →  Nº Pedido | Cliente | Tipo  | Ancho | Alto
 *
 * El script:
 *   - Crea clientes y tipos de puerta si no existen.
 *   - Inserta pedidos; si ya existe (mismo numero_pedido + mismas medidas) lo omite.
 *   - Muestra un resumen al final.
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

// ─── Configuración ──────────────────────────────────────────────────────────

const SUPABASE_URL = 'https://thwtfrwjmivugxvwtore.supabase.co';
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRod3RmcndqbWl2dWd4dnd0b3JlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2ODE3ODMsImV4cCI6MjA5MzI1Nzc4M30.oRhvGsK9nU9iGlNJvWWnWoXd16wtxDIySD4m-L_rM3M';
const SCHEMA = 'historico';

const HEADERS = {
  apikey: ANON_KEY,
  Authorization: `Bearer ${ANON_KEY}`,
  'Accept-Profile': SCHEMA,
  'Content-Profile': SCHEMA,
  'Content-Type': 'application/json',
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function normalizar(nombre) {
  return String(nombre).trim().toLowerCase().replace(/\s+/g, ' ');
}

function parseMedida(val) {
  if (val === null || val === undefined || val === '') return null;
  const n = Number(String(val).replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

async function req(endpoint, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: { ...HEADERS, ...(options.headers ?? {}) },
  });
  if (res.status === 204) return null;
  const body = await res.json();
  if (!res.ok) throw new Error(`[${res.status}] ${endpoint}: ${JSON.stringify(body)}`);
  return body;
}

// ─── Caché de entidades ─────────────────────────────────────────────────────

const cacheClientes = new Map(); // nombre_normalizado → id
const cacheFamilias = new Map(); // nombre → id
const cacheTipos    = new Map(); // nombre_normalizado → id

async function cargarCatalogos() {
  const [clientes, familias, tipos] = await Promise.all([
    req('clientes?select=id,nombre_normalizado'),
    req('familias?select=id,nombre'),
    req('tipos_puerta?select=id,nombre'),
  ]);
  for (const c of clientes) cacheClientes.set(c.nombre_normalizado, c.id);
  for (const f of familias)  cacheFamilias.set(f.nombre.toUpperCase(), f.id);
  for (const t of tipos)     cacheTipos.set(normalizar(t.nombre), t.id);
}

async function getOrCreateCliente(nombre) {
  const norm = normalizar(nombre);
  if (cacheClientes.has(norm)) return cacheClientes.get(norm);
  const [nuevo] = await req('clientes', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ nombre: String(nombre).trim(), nombre_normalizado: norm, activo: true }),
  });
  cacheClientes.set(norm, nuevo.id);
  console.log(`  + Cliente creado: ${nombre}`);
  return nuevo.id;
}

async function getOrCreateTipoPuerta(nombre) {
  const norm = normalizar(nombre);
  if (cacheTipos.has(norm)) return cacheTipos.get(norm);
  const [nuevo] = await req('tipos_puerta', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ nombre: String(nombre).trim(), activo: true }),
  });
  cacheTipos.set(norm, nuevo.id);
  console.log(`  + Tipo de puerta creado: ${nombre}`);
  return nuevo.id;
}

async function insertarPedido(pedido) {
  return req('pedidos', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(pedido),
  });
}

// ─── Procesado de hojas ─────────────────────────────────────────────────────

async function procesarRemolques(filas, familiaId) {
  let insertados = 0, omitidos = 0, errores = 0;

  for (const fila of filas) {
    const numero = String(fila['Nº Pedido'] ?? '').trim().toUpperCase();
    const clienteNombre = String(fila['Cliente'] ?? '').trim();
    if (!numero || !clienteNombre) { omitidos++; continue; }

    try {
      const cliente_id = await getOrCreateCliente(clienteNombre);
      await insertarPedido({
        numero_pedido: numero,
        cliente_id,
        familia_id: familiaId,
        largo: parseMedida(fila['Largo']),
        ancho: parseMedida(fila['Ancho']),
        alto: parseMedida(fila['Altura']),
        aguas: parseMedida(fila['aguas']),
        radio: parseMedida(fila['radio']),
        tipo: null,
      });
      insertados++;
    } catch (e) {
      console.error(`  ✗ REMOLQUE ${numero}: ${e.message}`);
      errores++;
    }
  }

  return { insertados, omitidos, errores };
}

async function procesarPuertas(filas, familiaId) {
  let insertados = 0, omitidos = 0, errores = 0;

  for (const fila of filas) {
    const numero = String(fila['Nº Pedido'] ?? '').trim().toUpperCase();
    const clienteNombre = String(fila['Cliente'] ?? '').trim();
    const tipoNombre = String(fila['Tipo'] ?? '').trim();
    if (!numero || !clienteNombre) { omitidos++; continue; }

    try {
      const cliente_id = await getOrCreateCliente(clienteNombre);
      // tipo puede estar vacío en alguna fila
      const tipo = tipoNombre || null;
      if (tipo) await getOrCreateTipoPuerta(tipo);

      await insertarPedido({
        numero_pedido: numero,
        cliente_id,
        familia_id: familiaId,
        tipo,
        ancho: parseMedida(fila['Ancho']),
        alto: parseMedida(fila['Alto']),
        largo: null,
        aguas: null,
        radio: null,
      });
      insertados++;
    } catch (e) {
      console.error(`  ✗ PUERTA ${numero}: ${e.message}`);
      errores++;
    }
  }

  return { insertados, omitidos, errores };
}

// ─── Main ───────────────────────────────────────────────────────────────────

const archivoExcel = process.argv[2];
if (!archivoExcel) {
  console.error('Uso: node scripts/import-excel.mjs "ruta/al/archivo.xlsx"');
  process.exit(1);
}

console.log(`\nLeyendo: ${archivoExcel}`);
const workbook = XLSX.readFile(archivoExcel);

console.log('Cargando catálogos desde Supabase…');
await cargarCatalogos();

const familiaRemolquesId = cacheFamilias.get('REMOLQUES');
const familiaPuertasId   = cacheFamilias.get('PUERTAS');

if (!familiaRemolquesId || !familiaPuertasId) {
  console.error('ERROR: No se encontraron las familias REMOLQUES y/o PUERTAS en la BD.');
  console.error('Asegúrate de haber ejecutado el DDL (schema.postgres.sql) primero.');
  process.exit(1);
}

// Hoja REMOLQUES
let resRemolques = { insertados: 0, omitidos: 0, errores: 0 };
if (workbook.SheetNames.includes('REMOLQUES')) {
  console.log('\nProcesando hoja REMOLQUES…');
  const filas = XLSX.utils.sheet_to_json(workbook.Sheets['REMOLQUES']);
  resRemolques = await procesarRemolques(filas, familiaRemolquesId);
} else {
  console.warn('  Hoja REMOLQUES no encontrada, se omite.');
}

// Hoja PUERTAS
let resPuertas = { insertados: 0, omitidos: 0, errores: 0 };
if (workbook.SheetNames.includes('PUERTAS')) {
  console.log('\nProcesando hoja PUERTAS…');
  const filas = XLSX.utils.sheet_to_json(workbook.Sheets['PUERTAS']);
  resPuertas = await procesarPuertas(filas, familiaPuertasId);
} else {
  console.warn('  Hoja PUERTAS no encontrada, se omite.');
}

// Resumen
console.log('\n─── Resumen ───────────────────────────────────');
console.log(`REMOLQUES  →  ${resRemolques.insertados} insertados, ${resRemolques.omitidos} omitidos, ${resRemolques.errores} errores`);
console.log(`PUERTAS    →  ${resPuertas.insertados} insertados, ${resPuertas.omitidos} omitidos, ${resPuertas.errores} errores`);
console.log('───────────────────────────────────────────────\n');
