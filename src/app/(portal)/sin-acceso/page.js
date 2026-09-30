'use client'
import { createClient } from '@/lib/supabase'

export default function SinAccesoPage() {
  async function cerrarSesion() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] px-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm max-w-[380px] w-full p-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#D81B43" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
          </svg>
        </div>
        <h1 className="text-[17px] font-bold text-slate-800 mb-2">Sin acceso a ningún módulo</h1>
        <p className="text-[13.5px] text-slate-500 mb-6">
          Tu rol no tiene ningún módulo habilitado todavía. Contacta a un administrador
          para que te asigne acceso desde Configuración → Roles y permisos.
        </p>
        <button onClick={cerrarSesion}
          className="w-full py-2.5 bg-[#D81B43] text-white rounded-[9px] text-[13px] font-semibold hover:bg-[#B0172F] transition-colors">
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}
