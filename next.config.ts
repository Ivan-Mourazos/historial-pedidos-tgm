import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // mssql/tedious usan requires dinámicos y deben cargarse en runtime con Node,
  // no empaquetarse. Si se bundlean, se rompe la identidad de los tipos
  // (sql.UniqueIdentifier -> "parameter.type.validate is not a function").
  serverExternalPackages: ["mssql"],
};

export default nextConfig;
