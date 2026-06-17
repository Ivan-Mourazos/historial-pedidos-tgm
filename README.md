# Histórico de pedidos TGM

Web interna para **registrar pedidos realizados** y **buscar si ya existe un pedido anterior exactamente igual**, para reutilizar su número de pedido al localizar el archivo DWG/ZWCAD.

> El número de pedido (ej. `AR2600000`) identifica el archivo (`AR2600000.dwg`).
> La web **no** importa Excel, **no** gestiona rutas ni abre/modifica archivos DWG.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS 4
- Supabase (PostgreSQL) vía PostgREST, **schema dedicado `historico`**

## Puesta en marcha de la base de datos (una sola vez)

1. Abre el **SQL Editor** de Supabase (proyecto `thwtfrwjmivugxvwtore`, el mismo que usa la app de remolques).
2. Ejecuta el contenido de [`db/schema.postgres.sql`](db/schema.postgres.sql).
   Crea el schema `historico`, las tablas, índices, permisos y los datos iniciales
   (familias `REMOLQUES` y `PUERTAS`, y tipos de puerta).
3. **Importante:** ve a **Project Settings → API → Exposed schemas** y añade `historico`
   a la lista. Sin este paso la API REST devolverá 404/406.

> Referencia de migración futura a SQL Server: [`db/schema.sqlserver.sql`](db/schema.sqlserver.sql).

## Desarrollo

```bash
pnpm install
pnpm dev
```

App en http://localhost:3000

La conexión usa por defecto los mismos datos que la app de remolques (incrustados en
[`src/lib/db/client.ts`](src/lib/db/client.ts)). Se pueden sobreescribir con un `.env`
(ver [`.env.example`](.env.example)).

## Estructura

```
src/
  app/
    page.tsx          Buscador (pantalla principal)
    nuevo/            Registro de nuevo pedido (con avisos de duplicado)
    historico/        Listado con filtros y edición
    clientes/         Gestión de clientes
    tecnicos/         Gestión de técnicos
  components/         Shell, formularios por familia, modal de edición, UI
  lib/
    db/               Cliente PostgREST + servicio de datos
    matching.ts       Coincidencia exacta y pedidos parecidos
    normalize.ts      Normalización de clientes y medidas (coma decimal)
    pedido-numero.ts  Validación del número de pedido
db/                   DDL PostgreSQL y SQL Server
```

## Reglas de negocio clave

- **Coincidencia exacta REMOLQUES:** cliente + largo + ancho + altura + aguas + radio
  (un valor vacío en aguas/radio solo coincide con vacío).
- **Coincidencia exacta PUERTAS:** cliente + tipo + ancho + alto.
- Solo se marca "Ya existe un pedido igual" cuando **todos** los campos requeridos están
  completos y coinciden. Si faltan datos → "Faltan datos para comprobar coincidencia exacta".
- **Pedidos parecidos** (mismo cliente y familia, medidas ±1 cm) se muestran solo como ayuda.
- Comparación de medidas con el valor exacto guardado (DECIMAL con 2 decimales).
- Clientes anti-duplicados por nombre normalizado (trim + minúsculas + espacios colapsados).
- El número de pedido es único; se avisa si el formato no encaja con `^[A-Z]{2}[0-9]{2}[0-9]+$`.
