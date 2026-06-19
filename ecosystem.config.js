// Configuración de PM2 para servir la app en producción.
// Arranca el servidor de Next.js (next start) sobre el build de .next.
//
//   pnpm install && pnpm build      # generar el build una vez
//   pm2 start ecosystem.config.js   # levantar con PM2
//
// Las credenciales de SQL Server se leen de .env.local (Next las carga en
// runtime). No se ponen aquí para no commitearlas.
module.exports = {
  apps: [
    {
      name: "historial-pedidos",
      // Llamamos al binario de Next directamente (no a pnpm) para que PM2
      // gestione un único proceso de Node.
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
      },
    },
  ],
};
