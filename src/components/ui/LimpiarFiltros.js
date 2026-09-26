'use client'
import { X } from 'lucide-react'

// Botón "Limpiar filtros" compartido por los módulos con barra de filtros.
// Solo se muestra si hay algún filtro activo (búsqueda incluida), para no
// ocupar espacio en la franja cuando no hace falta. Cada módulo decide qué
// cuenta como "activo" y qué resetea en onLimpiar.
export default function LimpiarFiltros({ activo, onLimpiar, className = '' }) {
  if (!activo) return null
  return (
    <button type="button" onClick={onLimpiar} title="Quitar búsqueda y filtros"
      className={`flex items-center gap-1 px-2.5 h-[34px] rounded-[8px] text-[12px] font-medium text-slate-500 hover:text-[#D81B43] hover:bg-[#D81B43]/5 transition-colors whitespace-nowrap flex-shrink-0 ${className}`}>
      <X size={13} /> Limpiar filtros
    </button>
  )
}
