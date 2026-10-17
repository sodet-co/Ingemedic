'use client'
import { useEffect, useState } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import Modal from './Modal'
import { ui } from '@/lib/ui'

// Confirmación para acciones en lote: el botón se habilita después de unos
// segundos, para que no se confirme por reflejo.
export default function ConfirmarConEspera({ titulo, children, textoConfirmar = 'Confirmar', segundos = 5, peligro = false, onConfirmar, onCancelar, z = 'z-[75]' }) {
  const [faltan, setFaltan] = useState(segundos)
  const [trabajando, setTrabajando] = useState(false)
  useEffect(() => {
    if (faltan <= 0) return
    const t = setTimeout(() => setFaltan(f => f - 1), 1000)
    return () => clearTimeout(t)
  }, [faltan])

  async function confirmar() {
    setTrabajando(true)
    try { await onConfirmar() } finally { setTrabajando(false) }
  }

  return (
    <Modal onCerrar={onCancelar} titulo={titulo} tamano="sm" z={z} bloqueado={trabajando}
      icono={<AlertTriangle size={17} className={peligro ? 'text-[#D81B43]' : 'text-[#B45309]'} />}
      pie={<>
        <button onClick={onCancelar} disabled={trabajando} className={ui.btnSecundario}>Cancelar</button>
        <button onClick={confirmar} disabled={faltan > 0 || trabajando} className={`${ui.btnPrimario} min-w-[150px] tabular-nums`}>
          {trabajando ? <><Loader2 size={14} className="animate-spin" /> Guardando…</> : faltan > 0 ? `${textoConfirmar} (${faltan})` : textoConfirmar}
        </button>
      </>}>
      <div className="text-[13.5px] text-slate-600 leading-relaxed">{children}</div>
    </Modal>
  )
}
