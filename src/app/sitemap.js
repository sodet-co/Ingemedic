import { SITIO_URL, PAGINAS_PUBLICAS } from '@/lib/sitio'

export default function sitemap() {
  return PAGINAS_PUBLICAS.map(p => ({
    url: `${SITIO_URL}${p.ruta === '/' ? '' : p.ruta}`,
    lastModified: new Date(),
    changeFrequency: p.frecuencia,
    priority: p.prioridad,
  }))
}
