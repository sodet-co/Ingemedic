import { metadatosPagina } from '@/lib/sitio'

// La página es 'use client' y no puede exportar metadata; va aquí.
export const metadata = metadatosPagina({
  titulo: 'Nosotros: oxígeno medicinal certificado por el INVIMA',
  descripcion:
    'Ingemedic de Colombia S.A.S.: más de 13 años en equipos biomédicos y oxígeno medicinal en Valledupar. Certificados por el INVIMA en Buenas Prácticas de Manufactura, con ingenieros biomédicos y soporte técnico de lunes a sábado.',
  ruta: '/quienes-somos',
})

export default function Layout({ children }) {
  return children
}
