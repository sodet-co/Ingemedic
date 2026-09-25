'use client'
import { useState, useEffect } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { REGLAS_ATENCION, contarRegla } from '@/lib/atencion'

const DISMISS_KEY = 'banner_atencion_oculto'

// Franja fija que atraviesa TODOS los módulos del admin, dashboard
// incluido — se monta una sola vez en layout.js, no en cada XxxClient. Es
// solo aviso + link ("tienes N préstamos por atender, ve a Préstamos");
// las acciones reales viven en el pop-up de atención del dashboard
// (PanelAtencion), que se abre aparte una vez por sesión — con eso ya no
// es redundante que la franja también viva ahí. Se puede cerrar con la
// x; el cierre dura lo que dure la sesión (se vuelve a mostrar en el
// próximo login — ver sessionStorage.removeItem en login/page.js) para
// que no quede escondida para siempre por accidente.
export default function BannerAtencion() {
  const supabase = createClient()
  const [conteos, setConteos] = useState(null) // null = aún no cargó
  const [oculto, setOculto] = useState(true) // arranca oculto en SSR/primer render, se decide tras montar

  async function cargar() {
    const porRegla = await Promise.all(REGLAS_ATENCION.map(async regla => ({
      id: regla.id, severidad: regla.severidad, count: await contarRegla(supabase, regla),
    })))
    setConteos(porRegla)
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOculto(sessionStorage.getItem(DISMISS_KEY) === '1')
    cargar()

    const canal = supabase
      .channel('banner-atencion-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ordenes_servicio' }, cargar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'atencion_pospuestas' }, cargar)
      .subscribe()

    return () => supabase.removeChannel(canal)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function cerrar() {
    sessionStorage.setItem(DISMISS_KEY, '1')
    setOculto(true)
  }

  if (oculto || !conteos) return null
  const vencidos = conteos.find(c => c.id === 'prestamos_vencidos')?.count || 0
  const porVencer = conteos.find(c => c.id === 'prestamos_por_vencer')?.count || 0
  if (vencidos === 0 && porVencer === 0) return null

  const critico = vencidos > 0
  const partes = []
  if (vencidos > 0) partes.push(`${vencidos} préstamo${vencidos !== 1 ? 's' : ''} vencido${vencidos !== 1 ? 's' : ''}`)
  if (porVencer > 0) partes.push(`${porVencer} por vencer`)
  const reglaDestino = critico ? 'prestamos_vencidos' : 'prestamos_por_vencer'

  return (
    <div className={`flex items-center gap-3 px-4 md:px-6 py-2 text-[12.5px] font-medium flex-shrink-0 ${
      critico ? 'bg-[#FEF2F2] text-[#D81B43] border-b border-[#D81B43]/20' : 'bg-[#FFFBEB] text-[#B45309] border-b border-[#F59E0B]/30'
    }`}>
      <AlertTriangle size={14} className="flex-shrink-0" />
      <span className="flex-1 min-w-0 truncate">Tienes {partes.join(' y ')} — requieren atención.</span>
      {/* Navegación completa (no router.push): si ya está en Préstamos, un
          push a la misma ruta con otro query no remonta el componente y el
          filtro (que se lee al montar) no se aplicaría. */}
      <button onClick={() => { window.location.href = `/admin/ordenes?atencion=${reglaDestino}` }}
        className={`flex-shrink-0 text-[12px] font-bold px-3 py-1 rounded-full ${critico ? 'bg-[#D81B43] text-white hover:bg-[#B0172F]' : 'bg-[#B45309] text-white hover:bg-[#92400E]'}`}>
        Ver
      </button>
      <button onClick={cerrar} className="flex-shrink-0 hover:opacity-70" title="Cerrar por ahora">
        <X size={14} />
      </button>
    </div>
  )
}
