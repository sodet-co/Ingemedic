'use client'
import { useMemo, useState } from 'react'
import { RefreshCw, ChevronRight } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import VistaActa from '@/components/actas/VistaActa'
import { contextoDeActa } from '@/lib/actas/firmar'
import { NOMBRES, propiosDe } from '@/lib/actas/nombres'
import { renovarActa, variablesDeFecha, variablesDelActa } from '@/lib/actas/renovar'
import { hoyBogota } from '@/lib/fechas'
import { ui } from '@/lib/ui'

// Renovar un acta firmada (plantilla Renovable): la misma acta con fecha nueva y la
// misma firma. Se elige la fecha y, si hace falta, se corrige cualquier otro dato;
// a la derecha se ve cómo queda. lib/actas/renovar.js la guarda.
const NOMBRE_DE = Object.fromEntries(Object.values(NOMBRES).flatMap(g => Object.entries(g)))
// La fecha se elige arriba; las X del tipo de documento salen del documento
const NO_EDITABLES = new Set(['fecha', 'dia', 'mes', 'anio', 'doc_cc', 'doc_ti', 'doc_rc', 'doc_ce'])

export default function RenovarActa({ acta, ordenId, supabase, onCerrar, onHecho }) {
  const [fecha, setFecha] = useState(hoyBogota())
  const [cambios, setCambios] = useState({})
  const [verDatos, setVerDatos] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)

  const propios = useMemo(() => propiosDe(acta.bloques), [acta.bloques])
  const vars = useMemo(() => acta.datos?.variables || {}, [acta.datos])
  const editables = useMemo(() => variablesDelActa(acta.bloques).filter(v => !NO_EDITABLES.has(v)), [acta.bloques])
  // El acta tal como quedará
  const nueva = useMemo(() => ({
    ...acta, datos: { ...acta.datos, variables: { ...vars, ...variablesDeFecha(fecha), ...cambios } },
  }), [acta, vars, fecha, cambios])

  async function guardar() {
    if (!fecha) { setError('Elige la fecha de la renovación'); return }
    setGuardando(true); setError(null)
    const res = await renovarActa(supabase, { acta, ordenId, fecha, cambios })
    setGuardando(false)
    if (res.error) { setError('No se guardó: ' + res.error.message); return }
    onHecho()
  }

  return (
    <Modal onCerrar={onCerrar} bloqueado={guardando} tamano="xl" z="z-[70]" icono={<RefreshCw size={16} />}
      titulo="Renovar acta" subtitulo={acta.nombre}
      pie={<>
        <button onClick={onCerrar} disabled={guardando} className={ui.btnSecundario}>Cancelar</button>
        <button onClick={guardar} disabled={guardando || !fecha} className={ui.btnPrimario}>{guardando ? 'Guardando…' : 'Renovar'}</button>
      </>}>
      <div className="lg:grid lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] lg:gap-6">
        <div className="space-y-4 mb-5 lg:mb-0">
          <div>
            <label className={ui.label}>Fecha de la renovación</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={ui.input} />
            <p className={ui.ayudaCampo}>Se mantiene la firma del acta original.</p>
          </div>
          {editables.length > 0 && (
            <div>
              <button type="button" onClick={() => setVerDatos(v => !v)} aria-expanded={verDatos}
                className="w-full flex items-center justify-between py-1 text-[12.5px] font-semibold text-[#1B3A6B]">
                Corregir otros datos <ChevronRight size={14} className={`transition-transform ${verDatos ? 'rotate-90' : ''}`} />
              </button>
              {verDatos && (
                <div className="mt-2 space-y-3">
                  {editables.map(v => (
                    <div key={v}>
                      <label className="block text-[12px] font-semibold text-slate-600 mb-1">{NOMBRE_DE[v] || propios[v] || v.replace(/_/g, ' ')}</label>
                      <input value={cambios[v] ?? vars[v] ?? ''} onChange={e => setCambios(c => ({ ...c, [v]: e.target.value }))} className={ui.input} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {error && <div className="text-[12.5px] font-medium text-[#D81B43]">{error}</div>}
        </div>
        <div className="bg-slate-100 rounded-xl p-3">
          <VistaActa bloques={nueva.bloques} ctx={contextoDeActa(nueva)} />
        </div>
      </div>
    </Modal>
  )
}
