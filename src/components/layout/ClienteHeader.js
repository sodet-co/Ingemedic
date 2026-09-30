'use client'
import { useState } from 'react'
import Image from 'next/image'
import { LogOut, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { iniciales } from './RepartidorHeader'

// Barra superior del portal de clientes: logo, nombre del cliente y salir.
export default function ClienteHeader({ nombre }) {
  const [saliendo, setSaliendo] = useState(false)

  async function salir() {
    setSaliendo(true)
    // Sin bitácora: bitacora.usuario_id apunta a `usuarios` y el cliente no está ahí
    await createClient().auth.signOut()
    window.location.href = '/login?cliente=1'
  }

  return (
    <header className="h-14 md:h-16 px-4 md:px-7 bg-white border-b border-slate-200 flex items-center justify-between gap-3 sticky top-0 z-30">
      <Image src="/images/logo.png" alt="Ingemedic" width={1600} height={573} priority className="h-8 md:h-9 w-auto" />
      <div className="flex items-center gap-2 md:gap-3 min-w-0">
        <div className="hidden sm:block text-right min-w-0">
          <div className="text-[13px] font-semibold text-slate-700 truncate max-w-[260px]">{nombre}</div>
          <div className="text-[11.5px] text-slate-500">Portal de clientes</div>
        </div>
        <div aria-hidden className="w-9 h-9 rounded-full bg-[#1B3A6B] text-white text-[13px] font-bold flex items-center justify-center flex-shrink-0">
          {iniciales(nombre)}
        </div>
        <button type="button" onClick={salir} disabled={saliendo}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[9px] border border-slate-200 text-[13px] font-medium text-slate-600 hover:border-slate-300 hover:text-slate-800 disabled:opacity-70">
          {saliendo ? <Loader2 size={15} className="animate-spin" /> : <LogOut size={15} />}
          <span className="hidden sm:inline">Salir</span>
        </button>
      </div>
    </header>
  )
}
