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
  async redirects() {
    return [
      { source: '/catalogo', destination: '/portafolio', permanent: true },
      { source: '/servicios', destination: '/portafolio', permanent: true },
    ]
  },
};

export default nextConfig;
