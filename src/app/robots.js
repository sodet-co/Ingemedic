import { SITIO_URL } from '@/lib/sitio'

// /admin NO se bloquea aquí a propósito: lleva <meta robots noindex>
// (src/app/admin/layout.js), y Google solo lo ve si puede rastrear la página.
// Bloquearlo en robots.txt dejaría el login indexado si ya lo estaba.
export default function robots() {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/'] },
    sitemap: `${SITIO_URL}/sitemap.xml`,
    host: SITIO_URL,
  }
}
