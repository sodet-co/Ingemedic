import { metadatosPagina } from '@/lib/sitio'

// La página es 'use client' y no puede exportar metadata; va aquí.
export const metadata = metadatosPagina({
  titulo: 'Quiénes somos: más de 13 años en el Cesar',
  descripcion:
    'Ingemedic de Colombia S.A.S.: más de 13 años en equipos biomédicos y oxígeno medicinal en Valledupar. Certificados por INVIMA, con ingenieros biomédicos y servicio técnico 24/7.',
  ruta: '/quienes-somos',
})

export default function Layout({ children }) {
  return children
}
