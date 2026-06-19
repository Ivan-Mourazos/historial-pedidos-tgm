// Pool de conexión a SQL Server (driver mssql / tedious).
// SOLO debe importarse desde código server-side (API routes). Nunca desde
// componentes cliente: SQL Server no es accesible desde el navegador.
//
// Configuración por variables de entorno (ver .env.example):
//   SQLSERVER_HOST      host o IP del servidor      (ej. 192.168.1.10 o SERVIDOR\SQLEXPRESS)
//   SQLSERVER_PORT      puerto                       (por defecto 1433)
//   SQLSERVER_DATABASE  base de datos                (ej. HIST_PEDIDOS)
//   SQLSERVER_USER      login SQL                    (ej. sa)
//   SQLSERVER_PASSWORD  contraseña
//   SQLSERVER_ENCRYPT             "true"/"false"     (por defecto false en red interna)
//   SQLSERVER_TRUST_SERVER_CERT   "true"/"false"     (por defecto true: certificado autofirmado)

import sql from "mssql";

// El schema dedicado de la app dentro de la base de datos (ver db/schema.sqlserver.sql).
export const SCHEMA = "historico";

function buildConfig(): sql.config {
  const host = process.env.SQLSERVER_HOST;
  const database = process.env.SQLSERVER_DATABASE;
  const user = process.env.SQLSERVER_USER;
  const password = process.env.SQLSERVER_PASSWORD;

  if (!host || !database || !user || !password) {
    throw new Error(
      "Faltan variables de entorno de SQL Server. Define SQLSERVER_HOST, " +
        "SQLSERVER_DATABASE, SQLSERVER_USER y SQLSERVER_PASSWORD (ver .env.example).",
    );
  }

  // Permite formato "SERVIDOR\INSTANCIA". mssql usa server + options.instanceName.
  let server = host;
  let instanceName: string | undefined;
  if (host.includes("\\")) {
    const [srv, inst] = host.split("\\");
    server = srv;
    instanceName = inst;
  }

  return {
    server,
    database,
    user,
    password,
    port: process.env.SQLSERVER_PORT
      ? Number(process.env.SQLSERVER_PORT)
      : 1433,
    options: {
      instanceName,
      encrypt: process.env.SQLSERVER_ENCRYPT === "true",
      // En servidores locales con certificado autofirmado hay que confiar en él.
      trustServerCertificate:
        process.env.SQLSERVER_TRUST_SERVER_CERT !== "false",
      enableArithAbort: true,
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000,
    },
  };
}

// Reutiliza un único pool entre invocaciones (y entre recargas en caliente de
// Next.js en desarrollo) para no abrir una conexión nueva por request.
const globalForPool = globalThis as unknown as {
  _sqlPool?: Promise<sql.ConnectionPool>;
};

export function getPool(): Promise<sql.ConnectionPool> {
  if (!globalForPool._sqlPool) {
    const pool = new sql.ConnectionPool(buildConfig());
    globalForPool._sqlPool = pool.connect().catch((err: unknown) => {
      // Si falla la conexión inicial, descarta el pool para reintentar luego.
      globalForPool._sqlPool = undefined;
      throw err;
    });
  }
  return globalForPool._sqlPool as Promise<sql.ConnectionPool>;
}

export { sql };
