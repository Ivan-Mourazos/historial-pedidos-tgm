import "server-only";
import sql from "mssql";

let poolPromise: Promise<sql.ConnectionPool> | null = null;

export function getRpsPool(): Promise<sql.ConnectionPool> {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool({
      server: process.env.RPS_SQLSERVER_HOST!,
      port: Number(process.env.RPS_SQLSERVER_PORT ?? 1433),
      database: process.env.RPS_SQLSERVER_DATABASE!,
      user: process.env.RPS_SQLSERVER_USER!,
      password: process.env.RPS_SQLSERVER_PASSWORD!,
      options: {
        encrypt: process.env.RPS_SQLSERVER_ENCRYPT === "true",
        trustServerCertificate: process.env.RPS_SQLSERVER_TRUST_SERVER_CERT !== "false",
        readOnlyIntent: true,
      },
      pool: { min: 0, max: 5, idleTimeoutMillis: 30_000 },
      requestTimeout: 15_000,
    }).connect().catch((error) => {
      poolPromise = null;
      throw error;
    });
  }
  return poolPromise;
}
