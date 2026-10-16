'use client'
import { useEffect } from 'react'

// Ventana de detalle (entrega, hoja de vida de un equipo, mantenimiento…).
// Reemplaza los paneles laterales derechos de ~480px, que en PC amontonaban la
// información en un tercio de la pantalla: en md+ es una ventana centrada y
// ancha; en celular sigue siendo la hoja que sube desde abajo.
//
// El contenido lo arma cada módulo: un encabezado y un cuerpo. Para usar el
// ancho, el cuerpo suele ir en <Columnas izquierda={…} derecha={…} />.
export default function VentanaDetalle({ onCerrar, children, ancho = 1080, z = 'z-50' }) {
  useEffect(() => {
    const onEsc = e => { if (e.key === 'Escape') onCerrar() }
    window.addEventListener('keydown', onEsc)
    return () => window.removeEventListener('keydown', onEsc)
  }, [onCerrar])

  return (
    <div className={`fixed inset-0 ${z} flex items-end md:items-center justify-center md:p-6`} role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={onCerrar} />
      <div className="relative w-full h-[92vh] md:h-auto md:max-h-[calc(100vh-3rem)] rounded-t-2xl md:rounded-2xl bg-white flex flex-col shadow-2xl overflow-hidden"
        style={{ maxWidth: `min(${ancho}px, 100%)` }}>
        {children}
      </div>
    </div>
  )
}

// Cuerpo en dos columnas desde lg; en pantallas angostas, una debajo de la otra.
// Cada columna recibe secciones separadas por línea, igual que los paneles de antes.
export function Columnas({ izquierda, derecha, className = '' }) {
  return (
    // pb: en celular la barra de navegación inferior puede quedar encima del final
    <div className={`flex-1 min-h-0 overflow-y-auto pb-[var(--mobile-nav-space,0px)] md:pb-0 lg:grid lg:grid-cols-2 lg:divide-x lg:divide-slate-100 ${className}`}>
      <div className="divide-y divide-slate-100 min-w-0">{izquierda}</div>
      <div className="divide-y divide-slate-100 min-w-0 border-t border-slate-100 lg:border-t-0">{derecha}</div>
    </div>
  )
}
