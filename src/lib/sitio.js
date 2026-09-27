// Datos públicos del sitio (SEO, datos estructurados, sitemap).
// Una sola fuente: si cambia el dominio, un teléfono o el horario, se cambia
// aquí. Deben coincidir con lo que muestra /contacto — Google compara
// nombre, dirección y teléfono entre el sitio y el Perfil de Empresa.

// El dominio real es con www: ingemedic.com.co redirige (308) a www.
export const SITIO_URL = 'https://www.ingemedic.com.co'

export const EMPRESA = {
  nombre: 'Ingemedic de Colombia S.A.S.',
  nombreCorto: 'Ingemedic',
  descripcion:
    'Alquiler de equipos biomédicos y suministro de oxígeno medicinal domiciliario en Valledupar y todo el departamento del Cesar, con servicio técnico 24/7.',
  telefonos: ['+57 310 3861480', '+57 310 3636481'],
  email: 'ingemedicsas@hotmail.com',
  direccion: {
    calle: 'Calle 14C # 20-14, Barrio La Popa',
    ciudad: 'Valledupar',
    region: 'Cesar',
    pais: 'CO',
  },
  // Igual que la tarjeta "Horarios de Atención" de /contacto
  horario: [
    { dias: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], abre: '08:00', cierra: '12:00' },
    { dias: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], abre: '14:00', cierra: '18:00' },
    { dias: ['Saturday'], abre: '08:00', cierra: '12:00' },
  ],
  invima: { resolucion: '2026013255', url: 'https://www.invima.gov.co/establecimiento/2345g-ingemedic-de-colombia-sas' },
}

// Metadata completa de una página pública. Next reemplaza (no fusiona)
// openGraph/twitter del layout cuando la página los define, así que aquí van
// completos. La imagen la pone app/opengraph-image.jpg (tiene prioridad).
export function metadatosPagina({ titulo, tituloAbsoluto = false, descripcion, ruta }) {
  const tituloCompleto = tituloAbsoluto ? titulo : `${titulo} | Ingemedic`
  return {
    title: tituloAbsoluto ? { absolute: titulo } : titulo,
    description: descripcion,
    alternates: { canonical: ruta },
    openGraph: {
      title: tituloCompleto,
      description: descripcion,
      url: ruta,
      siteName: 'Ingemedic de Colombia',
      locale: 'es_CO',
      type: 'website',
    },
    twitter: { card: 'summary_large_image', title: tituloCompleto, description: descripcion },
  }
}

// Páginas públicas indexables (sitemap). Las de /admin y /api no van.
export const PAGINAS_PUBLICAS = [
  { ruta: '/', prioridad: 1, frecuencia: 'monthly' },
  { ruta: '/portafolio', prioridad: 0.9, frecuencia: 'monthly' },
  { ruta: '/quienes-somos', prioridad: 0.7, frecuencia: 'yearly' },
  { ruta: '/contacto', prioridad: 0.8, frecuencia: 'yearly' },
]
