import { metadatosPagina } from '@/lib/sitio'

// La página es 'use client' y no puede exportar metadata; va aquí.
export const metadata = metadatosPagina({
  titulo: 'Contacto y cotizaciones en Valledupar',
  descripcion:
    'Cotiza el alquiler de equipos biomédicos u oxígeno medicinal. Calle 14C # 20-14, La Popa, Valledupar. WhatsApp 310 3861480. Lunes a viernes y sábados en la mañana.',
  ruta: '/contacto',
})

export default function Layout({ children }) {
  return children
}
