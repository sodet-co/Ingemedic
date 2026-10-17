'use client'
import { ChevronLeft } from 'lucide-react'
import BuzonNovedades from '@/components/layout/BuzonNovedades'
import Ayuda from './Ayuda'

// Encabezado de cada módulo del panel. Mismo alto, padding, título y orden de
// botones en todos: título y subtítulo a la izquierda; a la derecha las
// acciones del módulo, la ayuda (?) y el buzón de novedades.
//  - volver: muestra la flecha para subir de nivel (Inventario: tipo → categoría)
//  - migas: reemplaza el subtítulo por una ruta clicable [{ label, onClick }]
export default function EncabezadoModulo({ titulo, subtitulo, migas, acciones, ayuda, volver }) {
  return (
    // En celular va sin fondo (debajo ya está la barra blanca de la app); en PC, franja blanca.
    <div className="h-14 md:h-16 md:bg-white md:border-b md:border-slate-200 flex items-center gap-3 px-4 md:px-7 flex-shrink-0">
      {volver && (
        <button type="button" onClick={volver} aria-label="Volver"
          className="w-9 h-9 -ml-2 flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 flex-shrink-0">
          <ChevronLeft size={20} />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <div className="text-[17px] md:text-[18px] font-bold text-slate-800 leading-tight truncate">{titulo}</div>
        {migas?.length ? (
          <div className="flex items-center gap-1 text-[12px] text-slate-400 mt-0.5 min-w-0">
            {migas.map((m, i) => (
              <span key={i} className="flex items-center gap-1 min-w-0">
                {i > 0 && <span className="text-slate-300">/</span>}
                {m.onClick
                  ? <button type="button" onClick={m.onClick} className="hover:text-slate-700 truncate">{m.label}</button>
                  : <span className="text-slate-600 font-medium truncate">{m.label}</span>}
              </span>
            ))}
          </div>
        ) : subtitulo ? (
          <div className="text-[12px] text-slate-400 mt-0.5 truncate">{subtitulo}</div>
        ) : null}
      </div>
      <div className="flex items-center gap-1.5 md:gap-2 flex-shrink-0">
        {acciones}
        {ayuda && <Ayuda modulo={ayuda} />}
        <BuzonNovedades />
      </div>
    </div>
  )
}
