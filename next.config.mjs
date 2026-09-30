/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'olxkbdomwvdrcjhwppec.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  // /catalogo y /servicios eran copias de /portafolio: para Google era
  // contenido duplicado. Se redirigen (301/308) para no romper enlaces viejos.
  // /servicios solo en el dominio público: en el portal (y en localhost) es el
  // módulo "Servicios prestados" del panel. Estas redirecciones corren antes
  // que el middleware, por eso la condición de dominio va aquí.
  async redirects() {
    return [
      { source: '/catalogo', destination: '/portafolio', permanent: true },
      {
        source: '/servicios',
        has: [{ type: 'host', value: '(www\\.)?ingemedic\\.com\\.co' }],
        destination: '/portafolio',
        permanent: true,
      },
    ]
  },
};

export default nextConfig;
