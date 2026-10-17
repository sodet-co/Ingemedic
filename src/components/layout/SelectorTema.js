'use client'
import { useEffect, useState } from 'react'
import { Sun, Moon, MonitorSmartphone, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { guardarTemaUsuario, leerTema } from '@/lib/tema'
import { useUsuarioActual } from '@/lib/usuario-context'

const OPCIONES = [
  { id: 'claro', label: 'Claro', sub: 'Fondo blanco, como siempre', Icono: Sun, muestra: ['#F8FAFC', '#FFFFFF', '#E2E8F0'] },
  { id: 'oscuro', label: 'Oscuro', sub: 'Descansa la vista de noche', Icono: Moon, muestra: ['#0B1220', '#131D2F', '#2A3850'] },
  { id: 'sistema', label: 'Automático', sub: 'Igual que el celular o el computador', Icono: MonitorSmartphone, muestra: ['#F8FAFC', '#131D2F', '#E2E8F0'] },
]

// Elección del tema del panel. Queda en el perfil del usuario, así lo sigue en
// cualquier computador o celular. `usuarioId` solo hace falta donde no hay
// UsuarioProvider (vista del repartidor).
export default function SelectorTema({ usuarioId, onCambio }) {
  const { usuario } = useUsuarioActual()
  const idUsuario = usuarioId || usuario?.id
  const [tema, setTema] = useState('claro')
  useEffect(() => { const t = setTimeout(() => setTema(leerTema()), 0); return () => clearTimeout(t) }, [])

  async function elegir(nuevo) {
    setTema(nuevo)
    const { error } = await guardarTemaUsuario(createClient(), idUsuario, nuevo)
    onCambio?.(nuevo, error)
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {OPCIONES.map(({ id, label, sub, Icono, muestra }) => (
        <button key={id} type="button" onClick={() => elegir(id)}
          className={`text-left p-4 rounded-[12px] border-2 transition-all ${tema === id ? 'border-[#D81B43] bg-[#D81B43]/5' : 'border-slate-200 hover:border-slate-300'}`}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5 text-[13px] font-bold text-slate-700"><Icono size={15} /> {label}</div>
            {tema === id && <CheckCircle2 size={16} className="text-[#D81B43]" />}
          </div>
          <div className="text-[12px] text-slate-500 mb-3">{sub}</div>
          {/* Mini vista con colores fijos (no cambian con el tema) */}
          <div className="rounded-[8px] p-2 flex gap-1.5 h-[38px]" style={{ background: muestra[0], border: `1px solid ${muestra[2]}` }}>
            <div className="w-6 rounded-[4px]" style={{ background: muestra[1] }} />
            <div className="flex-1 rounded-[4px]" style={{ background: muestra[1] }} />
          </div>
        </button>
      ))}
    </div>
  )
}
