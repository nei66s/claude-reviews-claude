import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sem rewrites globais: rotas internas do Next (`/api/*`) não devem ser
  // redirecionadas por variáveis de ambiente (incluindo `NEXT_PUBLIC_*`).
};

export default nextConfig;
