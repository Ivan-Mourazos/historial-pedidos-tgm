# Histórico de pedidos TGM

Web interna para **registrar pedidos realizados** y **buscar si ya existe un pedido anterior exactamente igual**, para reutilizar su número de pedido al localizar el archivo DWG/ZWCAD.

> El número de pedido (ej. `AR2600000`) identifica el archivo (`AR2600000.dwg`).
> La web puede abrir el DWG en ZWCAD si se configura la carpeta raíz de pedidos.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS 4
- SQL Server (driver `mssql`), **schema dedicado `historico`** en la base `HIST_PEDIDOS`

El acceso a datos es **server-side**: los componentes llaman a `dbService`, que envía
cada operación al endpoint RPC [`src/app/api/db/route.ts`](src/app/api/db/route.ts), y
este ejecuta la query contra SQL Server con `mssql`. SQL Server no es accesible desde el
navegador, por eso toda la BD vive detrás del servidor.

## Puesta en marcha de la base de datos (una sola vez)

1. Ejecuta [`db/schema.sqlserver.sql`](db/schema.sqlserver.sql) contra la base `HIST_PEDIDOS`
   (desde SSMS o `sqlcmd`). Crea el schema `historico`, las tablas, índices y los datos
   iniciales (familias `REMOLQUES` y `PUERTAS`, y tipos de puerta). **Ejecútalo una sola vez.**
2. Da permisos al login de la app sobre el schema:
   `GRANT SELECT, INSERT, UPDATE, DELETE ON SCHEMA::historico TO <usuario>;`

> El DDL para PostgreSQL/Supabase queda como referencia histórica en
> [`db/schema.postgres.sql`](db/schema.postgres.sql).

## Desarrollo

```bash
pnpm install
pnpm dev
```

App en http://localhost:3000

La conexión a SQL Server se configura con variables de entorno en un `.env.local`
(ver [`.env.example`](.env.example)): host, puerto, base, usuario y contraseña.

Para localizar pedidos con ZWCAD/Excel desde los botones de la web, añade también:

```env
ZWCAD_DWG_ROOTS=/mnt/oftecnica
ZWCAD_CLIENT_ROOTS=\\stinkor\oftecnica
TGM_CLIENT_OPEN_URL_TEMPLATE=tgm-pedidos://open?kind={kind}&path={path}
ZWCAD_EXE=
```

`ZWCAD_DWG_ROOTS` admite varias carpetas separadas por `;`. La app buscará
primero por año (`AR26xxxxx` -> `2026\AR26xxxxx.dwg`,
`AR23xxxxx` -> `2023\AR23xxxxx.dwg`) y, si no aparece ahí, hará una búsqueda
general dentro de esas carpetas.

En el servidor Linux de producción, `ZWCAD_DWG_ROOTS` debe ser la ruta montada
por IT, por ejemplo `/mnt/oftecnica`. Como el programa ZWCAD/Excel está en el
PC Windows del usuario y no en el servidor Linux, configura también
`ZWCAD_CLIENT_ROOTS` con la ruta equivalente de red, por ejemplo
`\\stinkor\oftecnica`. La app convierte entonces
`/mnt/oftecnica/2026/AR2600000.xlsm` en
`\\stinkor\oftecnica\2026\AR2600000.xlsm`.

En Windows local, si `ZWCAD_EXE` queda vacío, Windows abrirá el archivo con la
aplicación asociada a `.dwg`; si no, indica la ruta del ejecutable de ZWCAD. En
Linux no se puede lanzar ZWCAD/Excel en el servidor: Excel se abre en el puesto
con `ms-excel:` apuntando a la ruta de red.

Para abrir CAD y Excel con un clic desde el servidor Linux, configura
`TGM_CLIENT_OPEN_URL_TEMPLATE=tgm-pedidos://open?kind={kind}&path={path}` y
registra el protocolo `tgm-pedidos` en cada PC Windows. El servidor localiza el
archivo y traduce su ruta Linux a la ruta UNC; el PC abre la aplicación local.
El instalador se registra por usuario y no requiere administrador. Copia los
dos archivos `tools/instalar-apertura-tgm.cmd` y
`tools/install-tgm-open-protocol.ps1` a la misma carpeta del PC y haz doble clic
en `instalar-apertura-tgm.cmd`. Así funciona aunque PowerShell se abra en otra
carpeta.

Como alternativa, desde una copia local completa del proyecto:

```powershell
& powershell.exe -ExecutionPolicy Bypass -File "$(Resolve-Path '.\tools\install-tgm-open-protocol.ps1')" -AllowedRoots "\\STINKOR\Oftecnica"
```

Si se quiere forzar un ejecutable concreto de ZWCAD en el PC:

```powershell
& powershell.exe -ExecutionPolicy Bypass -File "$(Resolve-Path '.\tools\install-tgm-open-protocol.ps1')" -AllowedRoots "\\STINKOR\Oftecnica" -ZwcadExe "C:\Program Files\ZWSOFT\ZWCAD 2025\ZWCAD.exe"
```

El handler valida la carpeta y la extensión antes de abrir el archivo. También
registra el protocolo antiguo `zwcad-open` para no romper enlaces existentes.
Si no está instalado, los botones copian la ruta UNC al portapapeles como
respaldo. El log del PC queda en `%LOCALAPPDATA%\TGM-Pedidos\open.log`.

> El protocolo nuevo es el método recomendado. Mientras se instala en todos los
> puestos, la aplicación conserva automáticamente el enlace anterior
> `ms-excel:ofe|u|file://...` como respaldo. Aunque Office solo documenta
> oficialmente HTTP/HTTPS para este esquema, no se retira el flujo que ya
> funciona en los PCs actuales.

En todos los remolques, la web comprobará bajo demanda si existe un Excel en la
misma carpeta del año. Detecta `AR26xxxxx.xlsx` y variantes numeradas como
`AR26xxxxx-1.xlsx` o cualquier archivo que empiece por `AR26xxxxx-`; si hay
varias, muestra un selector para elegir cuál abrir.

## Estructura

```
src/
  app/
    page.tsx          Buscador (pantalla principal)
    nuevo/            Registro de nuevo pedido (con avisos de duplicado)
    historico/        Listado con filtros y edición
    clientes/         Gestión de clientes
    tecnicos/         Gestión de técnicos
    api/db/           Endpoint RPC server-side (ejecuta las queries con mssql)
  components/         Shell, formularios por familia, modal de edición, UI
  lib/
    db/               Conexión SQL Server, servicio server-side y proxy de cliente
    matching.ts       Coincidencia exacta y pedidos parecidos
    normalize.ts      Normalización de clientes y medidas (coma decimal)
    pedido-numero.ts  Validación del número de pedido
db/                   DDL PostgreSQL y SQL Server
```

## Migraciones

En instalaciones existentes, aplica también
[`db/migration-2026-07-10-familias-flexibles.sql`](db/migration-2026-07-10-familias-flexibles.sql).
Añade el JSON versionado para campos propios de futuras familias y el índice
del histórico paginado. Los pedidos actuales no se modifican.

Para almacenar la recogida delantera y trasera de las lonas de remolque, aplica además
[`db/migration-2026-07-10-recogida-remolques.sql`](db/migration-2026-07-10-recogida-remolques.sql).

Para vincular los clientes con su código de RPS, aplica con una cuenta con permisos DDL
[`db/migration-2026-07-12-codigo-cliente-rps.sql`](db/migration-2026-07-12-codigo-cliente-rps.sql).

Para separar pedidos pendientes y realizados por línea de RPS, y excluir los pendientes
de las coincidencias, aplica también
[`db/migration-2026-07-13-estados-planteo-rps.sql`](db/migration-2026-07-13-estados-planteo-rps.sql).
La actualización de RPS usa la tarea `PLANTEAR...`: progreso 100 significa realizado;
las líneas sin esa tarea quedan pendientes en nuevas importaciones y pueden confirmarse
manualmente desde el histórico.

Para registrar remolques cuya altura cambia entre la parte delantera y trasera,
aplica antes de desplegar el código
[`db/migration-2026-07-14-alturas-remolques.sql`](db/migration-2026-07-14-alturas-remolques.sql).
La migración añade ambas alturas y completa AR2600737 como 36 cm delante y
46 cm detrás. Debe ejecutarla una cuenta con permisos DDL.

Las migraciones y la sincronización con RPS son compatibles con SQL Server 2014;
la validación del JSON de campos flexibles se realiza en la aplicación.

## Reglas de negocio clave

- **Coincidencia exacta REMOLQUES:** cliente + largo + ancho + altura única o
  alturas delante/detrás + aguas + radio
  (un valor vacío en aguas/radio solo coincide con vacío).
- **Coincidencia exacta PUERTAS:** cliente + tipo + ancho + alto.
- Solo se marca "Ya existe un pedido igual" cuando **todos** los campos requeridos están
  completos y coinciden. Si faltan datos → "Faltan datos para comprobar coincidencia exacta".
- **Búsqueda parcial exacta:** cada medida seleccionada debe coincidir exactamente y los desplegables solo ofrecen combinaciones existentes entre pedidos realizados.
- Comparación de medidas con el valor exacto guardado (DECIMAL con 2 decimales).
- Clientes anti-duplicados por nombre normalizado (trim + minúsculas + espacios colapsados).
- El número de pedido es único; se avisa si el formato no encaja con `^[A-Z]{2}[0-9]{2}[0-9]+$`.
