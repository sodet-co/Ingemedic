'use client'
import { useEffect } from 'react'
import { X } from 'lucide-react'

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

// Encabezado estándar de una ventana de detalle: ícono o inicial, título,
// subtítulo, acciones y cerrar. Blanco en todos los módulos (antes Entregas lo
// tenía rojo y Mantenimientos azul).
export function EncabezadoDetalle({ icono, titulo, subtitulo, etiqueta, acciones, onCerrar }) {
  return (
    <div className="px-5 md:px-6 py-4 border-b border-slate-200 flex items-start gap-3 flex-shrink-0">
      {icono && <div className="w-10 h-10 rounded-full bg-[#D81B43]/10 text-[#D81B43] flex items-center justify-center text-[15px] font-bold flex-shrink-0">{icono}</div>}
      <div className="min-w-0 flex-1">
        {etiqueta && <div className="text-[11px] text-slate-400 truncate">{etiqueta}</div>}
        <div className="text-[16px] font-bold text-slate-800 leading-tight truncate">{titulo}</div>
        {subtitulo && <div className="text-[12.5px] text-slate-400 mt-0.5 truncate">{subtitulo}</div>}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {acciones}
        <button type="button" onClick={onCerrar} aria-label="Cerrar" title="Cerrar (Esc)"
          className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100">
          <X size={17} />
        </button>
      </div>
    </div>
  )
}
