'use client'
import { useState } from 'react'
import { Lock, LogOut, Loader2, Mail, Phone } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { EMPRESA } from '@/lib/sitio'

// Pantalla que ve el cliente cuando un SuperAdmin bloqueó el portal
// (Configuración → Portal de clientes).
export default function PortalBloqueado({ nombre }) {
  const [saliendo, setSaliendo] = useState(false)

  async function salir() {
    setSaliendo(true)
    await createClient().auth.signOut()
    window.location.href = '/login?cliente=1'
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-[440px] bg-white border border-[#E3E9F1] rounded-[24px] overflow-hidden shadow-[0_10px_40px_-12px_rgba(27,58,107,0.18)]">
        <div className="bg-[#1B3A6B] px-6 pt-8 pb-7 text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
            <Lock size={28} className="text-white" />
          </div>
          <h1 className="m-0 mt-4 text-[22px] font-extrabold text-white leading-tight">Módulo bloqueado temporalmente</h1>
          <p className="m-0 mt-2 text-[14px] text-[#B9C8E0]">
            {nombre ? <>Hola, {nombre}. </> : null}El portal de clientes no está disponible en este momento.
          </p>
        </div>
        <div className="p-6 flex flex-col gap-4">
          <p className="m-0 text-[14px] text-[#334259] leading-relaxed">
            Tus datos están seguros; solo se pausó el acceso. Si necesitas información de tus equipos, comunícate con Ingemedic:
          </p>
          <div className="flex flex-col gap-2">
            <a href={`mailto:${EMPRESA.email}`} className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl bg-[#F4F6FA] text-[14px] font-semibold text-[#1B3A6B] hover:bg-[#E8EEF7]">
              <Mail size={16} /> {EMPRESA.email}
            </a>
            <a href={`tel:${EMPRESA.telefonos[0].replace(/\s/g, '')}`} className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl bg-[#F4F6FA] text-[14px] font-semibold text-[#1B3A6B] hover:bg-[#E8EEF7]">
              <Phone size={16} /> {EMPRESA.telefonos[0]}
            </a>
          </div>
          <button type="button" onClick={salir} disabled={saliendo}
            className="mt-1 h-11 rounded-xl border border-[#DCE3ED] flex items-center justify-center gap-2 text-[14px] font-bold text-[#334259] hover:bg-[#F4F6FA] disabled:opacity-70">
            {saliendo ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />} Salir
          </button>
        </div>
      </div>
    </div>
  )
}
