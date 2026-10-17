'use client'
import { useEffect } from 'react'
import { aplicarTema, leerTema, CLAVE_TEMA, TEMAS } from '@/lib/tema'

// Mantiene el tema del panel al día: si está en "Automático", sigue los cambios
// del sistema (p. ej. el celular que pasa a oscuro de noche) sin recargar.
export default function TemaPanel({ temaUsuario }) {
  useEffect(() => {
    // Navegación entre páginas sin recargar: el script del layout no vuelve a correr
    if (TEMAS.includes(temaUsuario)) { try { localStorage.setItem(CLAVE_TEMA, temaUsuario) } catch {} }
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const alCambiarSistema = () => { if (leerTema() === 'sistema') aplicarTema('sistema') }
    aplicarTema(leerTema())
    mq.addEventListener('change', alCambiarSistema)
    return () => {
      mq.removeEventListener('change', alCambiarSistema)
      // Fuera del panel (sitio público en localhost) no queda la clase puesta
      document.documentElement.classList.remove('tema-oscuro')
    }
  }, [temaUsuario])
  return null
}
