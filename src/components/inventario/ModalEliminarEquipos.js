'use client'
import { useEffect, useState } from 'react'
import { AlertTriangle, Loader2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { revisarEliminacion, eliminarEquipos } from '@/lib/equipos'

// Confirmación para eliminar uno o varios equipos (una unidad, un tipo o una
// categoría completa). Antes de dejar confirmar revisa qué se lleva por delante:
//  - préstamos en curso → avisa que se cerrarán solos con el motivo;
//  - mantenimientos abiertos → no deja seguir.
// El botón se habilita tras una espera (5 s con préstamos, 3 s sin ellos) para
// que no se confirme de un clic sin leer.
//
// cargarEquipos(supabase) → [{ id, codigo }] · despues(supabase) → error | null
// (lo que el llamador haga tras eliminar los equipos, ej. desactivar el tipo)
export default function ModalEliminarEquipos({ abierto, ...props }) {
  // Se monta al abrir y se desmonta al cerrar: cada apertura arranca limpia
  return abierto ? <Contenido {...props} /> : null
}

function Contenido({ titulo, descripcion, cargarEquipos, despues, onCancelar, onHecho }) {
  const [revision, setRevision] = useState(null) // null = cargando
  const [motivo, setMotivo] = useState('')
  const [espera, setEspera] = useState(0)
  const [eliminando, setEliminando] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelado = false
    const supabase = createClient()
    ;(async () => {
      try {
        const equipos = await cargarEquipos(supabase)
        const r = await revisarEliminacion(supabase, equipos.map(e => e.id))
        if (cancelado) return
        setRevision({ equipos, ...r })
        setEspera(r.prestamos.length ? 5 : 3)
      } catch (e) {
        if (!cancelado) setError(e.message || 'No se pudo revisar el equipo')
      }
    })()
    return () => { cancelado = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (espera <= 0) return
    const t = setTimeout(() => setEspera(s => s - 1), 1000)
    return () => clearTimeout(t)
  }, [espera])

  const bloqueado = revision?.mantenimientos.length > 0
  const puedeConfirmar = revision && !bloqueado && espera <= 0 && motivo.trim() && !eliminando

  async function confirmar() {
    if (!puedeConfirmar) return
    setEliminando(true); setError(null)
    const supabase = createClient()
    const res = await eliminarEquipos({ supabase, equipoIds: revision.equipos.map(e => e.id), motivo })
    if (res.error) { setError(res.error.message); setEliminando(false); return }
    if (despues) {
      const err = await despues(supabase)
      if (err) { setError(err.message); setEliminando(false); return }
    }
    onHecho({ ...res, equipos: revision.equipos, motivo: motivo.trim() })
  }

  const nEquipos = revision?.equipos.length || 0

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-[60]" onClick={eliminando ? undefined : onCancelar} />
      <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center p-0 md:p-4 pointer-events-none">
        <div className="pointer-events-auto bg-white rounded-t-2xl md:rounded-2xl w-full max-w-[480px] max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
          <div className="px-6 py-4 border-b flex items-center justify-between flex-shrink-0">
            <h3 className="text-[15px] font-bold text-slate-800">{titulo}</h3>
            <button onClick={onCancelar} disabled={eliminando} className="text-slate-400 hover:text-slate-600 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100"><X size={16} /></button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            {descripcion && <p className="text-[13px] text-slate-600">{descripcion}</p>}

            {!revision && !error && (
              <div className="flex items-center gap-2 text-[13px] text-slate-400"><Loader2 size={14} className="animate-spin" /> Revisando préstamos y mantenimientos…</div>
            )}

            {revision && (
              <>
                <div className="text-[12.5px] text-slate-500">
                  {nEquipos === 0
                    ? 'No tiene equipos registrados.'
                    : <>Se {nEquipos === 1 ? 'eliminará 1 equipo' : `eliminarán ${nEquipos} equipos`}. Su historial se conserva y {nEquipos === 1 ? 'su código queda libre' : 'sus códigos quedan libres'} para reutilizarse.</>}
                </div>

                {bloqueado && (
                  <div className="px-3 py-2.5 bg-red-50 border border-red-200 rounded-[8px] text-[12.5px] text-red-700">
                    <div className="font-bold mb-1">Hay mantenimientos abiertos</div>
                    {revision.mantenimientos.map(m => <div key={m.codigo}>{m.codigo} · equipo {m.equipo?.codigo || '—'}</div>)}
                    <div className="mt-1">Ciérralos desde Mantenimientos antes de eliminar.</div>
                  </div>
                )}

                {!bloqueado && revision.prestamos.length > 0 && (
                  <div className="px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-[8px] text-[12.5px] text-amber-800">
                    <div className="flex items-center gap-1.5 font-bold mb-1.5">
                      <AlertTriangle size={14} className="text-amber-500 flex-shrink-0" />
                      {revision.prestamos.length === 1 ? 'Hay 1 préstamo en curso' : `Hay ${revision.prestamos.length} préstamos en curso`}
                    </div>
                    <div className="space-y-1 max-h-[160px] overflow-y-auto">
                      {revision.prestamos.map(p => (
                        <div key={p.id}>
                          <span className="font-semibold">{p.orden.codigo}</span> · {p.equipo?.codigo || '—'} · {p.orden.cliente?.nombre || 'Sin cliente'}
                          {p.orden.paciente?.nombre ? ` · ${p.orden.paciente.nombre}` : ''} <span className="text-amber-600">({p.orden.estado?.nombre})</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2">
                      Al eliminar, el equipo se dará por devuelto hoy con el motivo «Equipo eliminado del inventario». El préstamo que se quede sin equipos se finaliza (o se cancela, si aún no se había entregado).
                    </div>
                  </div>
                )}

                {!bloqueado && (
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-[0.07em] text-slate-500 mb-1.5">Motivo <span className="text-[#D81B43]">*</span></label>
                    <textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={2}
                      placeholder="Ej.: registro de prueba, equipo dado de baja…"
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-[9px] text-[13.5px] text-slate-800 outline-none focus:border-[#D81B43] resize-none placeholder:text-slate-400" />
                  </div>
                )}
              </>
            )}

            {error && <div className="px-3 py-2.5 bg-red-50 border border-red-200 rounded-[8px] text-[12.5px] text-red-700">{error}</div>}
          </div>

          <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2 flex-shrink-0"
            style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom, 16px))' }}>
            <button onClick={onCancelar} disabled={eliminando} className="px-4 py-2.5 border border-slate-200 rounded-[9px] text-[13px] font-medium text-slate-600 hover:border-slate-300">Cancelar</button>
            {!bloqueado && (
              <button onClick={confirmar} disabled={!puedeConfirmar}
                className="min-w-[150px] px-5 py-2.5 bg-[#D81B43] text-white rounded-[9px] text-[13px] font-semibold hover:bg-[#B0172F] disabled:opacity-50 disabled:cursor-not-allowed tabular-nums">
                {eliminando ? 'Eliminando…'
                  : !revision ? 'Eliminar'
                  : espera > 0 ? `Eliminar (${espera})`
                  : 'Eliminar'}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
