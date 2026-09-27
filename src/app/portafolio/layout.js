import { metadatosPagina } from '@/lib/sitio'

// La página es 'use client' y no puede exportar metadata; va aquí.
export const metadata = metadatosPagina({
  titulo: 'Portafolio: concentradores de oxígeno, CPAP y aspiradores',
  descripcion:
    'Alquiler y venta de concentradores de oxígeno Respironics y portátiles, CPAP/BiPAP y aspiradores de secreciones en Valledupar y el Cesar. Instalación en casa y soporte técnico.',
  ruta: '/portafolio',
})

export default function Layout({ children }) {
  return children
}
