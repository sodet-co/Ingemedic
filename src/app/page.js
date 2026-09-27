import LandingPage from './LandingPage'
import { FAQS } from '@/components/landing/faqs'
import { SITIO_URL, EMPRESA, metadatosPagina } from '@/lib/sitio'

// Página estática (se regenera en cada deploy). Antes consultaba
// configuracion_empresa con el cliente de servidor, que lee cookies y volvía la
// página dinámica: sin caché, ~3 s por visita. Los datos del negocio ahora
// salen de src/lib/sitio.js.

export const metadata = metadatosPagina({
  titulo: 'Alquiler de equipos biomédicos y oxígeno en Valledupar | Ingemedic',
  tituloAbsoluto: true,
  descripcion:
    'Alquiler de concentradores de oxígeno, CPAP/BiPAP y aspiradores, y oxígeno medicinal domiciliario en Valledupar y todo el Cesar. Certificados por INVIMA. Servicio técnico 24/7.',
  ruta: '/',
})

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'MedicalBusiness',
      '@id': `${SITIO_URL}/#empresa`,
      name: EMPRESA.nombre,
      alternateName: 'Ingemedic',
      description: EMPRESA.descripcion,
      url: SITIO_URL,
      logo: `${SITIO_URL}/images/logo.png`,
      image: `${SITIO_URL}/opengraph-image.jpg`,
      telephone: EMPRESA.telefonos[0],
      email: EMPRESA.email,
      address: {
        '@type': 'PostalAddress',
        streetAddress: EMPRESA.direccion.calle,
        addressLocality: EMPRESA.direccion.ciudad,
        addressRegion: EMPRESA.direccion.region,
        addressCountry: EMPRESA.direccion.pais,
      },
      areaServed: [
        { '@type': 'City', name: 'Valledupar' },
        { '@type': 'AdministrativeArea', name: 'Cesar' },
      ],
      openingHoursSpecification: EMPRESA.horario.map(h => ({
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: h.dias.map(d => `https://schema.org/${d}`),
        opens: h.abre,
        closes: h.cierra,
      })),
      contactPoint: EMPRESA.telefonos.map(t => ({
        '@type': 'ContactPoint', telephone: t, contactType: 'customer service', areaServed: 'CO', availableLanguage: 'es',
      })),
      // sameAs: agregar aquí Facebook/Instagram/Perfil de Google cuando existan
    },
    {
      '@type': 'WebSite',
      '@id': `${SITIO_URL}/#sitio`,
      url: SITIO_URL,
      name: 'Ingemedic de Colombia',
      inLanguage: 'es-CO',
      publisher: { '@id': `${SITIO_URL}/#empresa` },
    },
    {
      '@type': 'FAQPage',
      mainEntity: FAQS.map(f => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
  ],
}

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LandingPage />
    </>
  )
}
