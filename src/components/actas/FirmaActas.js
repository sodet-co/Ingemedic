'use client'
import { useEffect, useMemo, useState } from 'react'
import { X, Plus, Trash2, Loader2, FileText, ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { cargarParaFirma, guardarActas } from '@/lib/actas/firmar'
import { construirContexto } from '@/lib/actas/contexto'
import VistaActa from '@/components/actas/VistaActa'
import FirmaPad from '@/components/entregas/FirmaPad'

const inputCls = 'w-full px-3 py-2.5 border border-slate-200 rounded-[9px] text-[16px] md:text-[13.5px] text-slate-800 outline-none focus:border-[#D81B43] bg-white placeholder:text-slate-400'
const labelCls = 'block text-[11px] font-bold uppercase tracking-[0.07em] text-slate-500 mb-1.5'
const TIPOS_DOC = ['CC', 'TI', 'RC', 'CE', 'PA']

// Paso único de firma de un préstamo, igual para entrega a domicilio
// (Entregas y vista del repartidor) y préstamo en oficina (al crearlo):
//   0       datos: quién recibe, datos del paciente que piden los formatos,
//           insumos entregados y quién entrega
//   1..N    revisión de cada formato ya lleno
//   N+1     firma de quien recibe y de quien entrega
// Al confirmar corre `alFirmar` (p. ej. completar la entrega; si devuelve un
// error no se guarda nada) y luego guarda una fila de `actas` por formato.
export default function FirmaActas({ ordenId, entregaId = null, titulo = 'Firmar acta de entrega', alFirmar, onCancelar, onHecho }) {
  const supabase = useMemo(() => createClient(), [])
  const [base, setBase] = useState(null)
  const [error, setError] = useState(null)
  const [paso, setPaso] = useState(0)
  const [guardando, setGuardando] = useState(false)
  const [recibe, setRecibe] = useState({ esPaciente: false, nombre: '', documento: '', parentesco: '', telefono: '', correo: '' })
  const [pac, setPac] = useState({})
  const [diagnostico, setDiagnostico] = useState('')
  const [ciudad, setCiudad] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [insumos, setInsumos] = useState([])
  const [entrega, setEntrega] = useState({ nombre: '', cargo: '', tipo_documento: 'CC', documento: '' })
  // Quien entrega es quien tiene la sesión: con el perfil completo solo firma.
  // Si le faltan datos se le piden aquí y quedan guardados en su perfil.
  const [editarEntrega, setEditarEntrega] = useState(false)
  const [firmas, setFirmas] = useState({ recibe: null, entrega: null })

  useEffect(() => {
    let cancelado = false
    cargarParaFirma(supabase, ordenId)
      .then(b => {
        if (cancelado) return
        const p = b.orden.paciente || {}
        setBase(b)
        setPac({ tipo_documento: p.tipo_documento || 'CC', cedula: p.cedula || '', barrio: p.barrio || '', eps: p.eps || '', fecha_nacimiento: p.fecha_nacimiento || '' })
        setDiagnostico(b.orden.diagnostico || '')
        setCiudad(p.ciudad || '')
        setRecibe(r => ({ ...r, esPaciente: !!p.nombre, telefono: p.telefono || '', correo: p.correo || '' }))
        setEntrega({ nombre: b.usuario.nombre || '', cargo: b.usuario.cargo || '', tipo_documento: b.usuario.tipo_documento || 'CC', documento: b.usuario.cedula || '' })
        setEditarEntrega(!(b.usuario.nombre && b.usuario.cargo && b.usuario.cedula))
      })
      .catch(e => { if (!cancelado) setError(e.message || 'No se pudo cargar el préstamo') })
    return () => { cancelado = true }
  }, [supabase, ordenId])

  const paciente = base?.orden.paciente
  const datosRecibe = useMemo(() => recibe.esPaciente && paciente
    ? { ...recibe, nombre: paciente.nombre, documento: pac.cedula, parentesco: '' }
    : recibe, [recibe, paciente, pac.cedula])

  // Contexto con lo que se lleva escrito: la revisión muestra el acta tal cual quedará
  const ctx = useMemo(() => base && construirContexto({
    empresa: base.empresa,
    orden: { ...base.orden, diagnostico, paciente: paciente ? { ...paciente, ...pac, ciudad } : null },
    equipos: base.equipos,
    datos: { ciudad, observaciones, recibe: datosRecibe, entrega, insumos: insumos.filter(i => i.descripcion.trim()) },
    firmas,
  }), [base, paciente, pac, diagnostico, ciudad, observaciones, datosRecibe, entrega, insumos, firmas])

  const plantillas = base?.plantillas || []
  const pasoFirma = plantillas.length + 1
  const docActual = paso >= 1 && paso <= plantillas.length ? plantillas[paso - 1] : null

  function validarDatos() {
    if (!datosRecibe.nombre?.trim()) return 'Escribe el nombre de quien recibe'
    if (!datosRecibe.documento?.trim()) return 'Escribe el documento de quien recibe'
    if (!entrega.nombre.trim()) return 'Escribe el nombre de quien entrega'
    if (!entrega.documento.trim()) return 'Escribe el documento de quien entrega'
    if (!plantillas.length) return 'Este préstamo no tiene formatos asignados'
    return null
  }

  function siguiente() {
    if (paso === 0) {
      const msg = validarDatos()
      if (msg) { setError(msg); return }
    }
    setError(null)
    setPaso(p => p + 1)
  }

  async function confirmar() {
    if (!firmas.recibe) { setError('Falta la firma de quien recibe'); return }
    if (!firmas.entrega) { setError('Falta la firma de quien entrega'); return }
    setGuardando(true); setError(null)

    // Lo que se completó del paciente y el diagnóstico queda guardado para la próxima vez
    if (paciente?.id) {
      const cambios = Object.fromEntries(Object.entries({ ...pac, ciudad }).filter(([k, v]) => (v || null) !== (paciente[k] || null)).map(([k, v]) => [k, v || null]))
      if (Object.keys(cambios).length) {
        const { error: errPac } = await supabase.from('pacientes').update(cambios).eq('id', paciente.id)
        if (errPac) {
          setError(errPac.code === '23505' ? 'Esa cédula ya está registrada en otro paciente' : 'No se guardaron los datos del paciente: ' + errPac.message)
          setGuardando(false); return
        }
      }
    }
    if ((diagnostico || null) !== (base.orden.diagnostico || null)) {
      await supabase.from('ordenes_servicio').update({ diagnostico: diagnostico || null }).eq('id', ordenId)
    }

    // Lo que faltaba en el perfil de quien entrega queda guardado (no se pisa lo que ya tenía)
    const u = base.usuario
    if (u.id) {
      const faltaba = {}
      if (entrega.cargo.trim() && !u.cargo) faltaba.cargo = entrega.cargo.trim()
      if (entrega.documento.trim() && !u.cedula) Object.assign(faltaba, { cedula: entrega.documento.trim(), tipo_documento: entrega.tipo_documento })
      if (Object.keys(faltaba).length) await supabase.from('usuarios').update(faltaba).eq('id', u.id)
    }

    const resumen = { recibidoPor: datosRecibe.nombre.trim(), firma: firmas.recibe, observaciones }
    if (alFirmar) {
      const err = await alFirmar(resumen)
      if (err) { setError(err.message || String(err)); setGuardando(false); return }
    }
    const { data, error: errActas } = await guardarActas(supabase, { ordenId, entregaId, plantillas, ctx, firmas })
    if (errActas) { setError('No se guardaron las actas: ' + errActas.message); setGuardando(false); return }
    onHecho({ ...resumen, actas: data })
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[60]" onClick={guardando ? undefined : onCancelar} />
      <div className="fixed inset-x-0 bottom-0 h-[92vh] rounded-t-2xl md:inset-y-6 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:h-auto md:w-[880px] md:rounded-2xl bg-white z-[60] flex flex-col shadow-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b flex items-center gap-3 flex-shrink-0">
          {paso > 0 && (
            <button onClick={() => { setError(null); setPaso(p => p - 1) }} disabled={guardando}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"><ChevronLeft size={18} /></button>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-bold text-slate-800 truncate">{titulo}</div>
            <div className="text-[12px] text-slate-400 truncate">
              {base ? `${base.orden.codigo} · ${base.orden.cliente?.nombre || ''}` : 'Cargando…'}
            </div>
            {base && (
              <div className="flex items-center gap-1 mt-1.5" aria-label={`Paso ${paso + 1} de ${pasoFirma + 1}`}>
                {Array.from({ length: pasoFirma + 1 }, (_, i) => (
                  <span key={i} className={`h-1 rounded-full transition-all ${i === paso ? 'w-5 bg-[#D81B43]' : i < paso ? 'w-2.5 bg-[#D81B43]/50' : 'w-2.5 bg-slate-200'}`} />
                ))}
                <span className="ml-1.5 text-[11px] text-slate-400">Paso {paso + 1} de {pasoFirma + 1}</span>
              </div>
            )}
          </div>
          <button onClick={onCancelar} disabled={guardando} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {!base && !error && <div className="flex items-center gap-2 p-6 text-[13px] text-slate-400"><Loader2 size={14} className="animate-spin" /> Cargando préstamo y formatos…</div>}

          {base && paso === 0 && (
            <div className="p-5 md:p-6 space-y-6">
              <section>
                <div className="text-[13px] font-bold text-slate-700 mb-3">Quién recibe</div>
                {paciente && (
                  <label className="flex items-center gap-2 mb-3 cursor-pointer text-[13.5px] text-slate-700">
                    <input type="checkbox" checked={recibe.esPaciente} onChange={e => setRecibe(r => ({ ...r, esPaciente: e.target.checked }))} />
                    Recibe el mismo paciente ({paciente.nombre})
                  </label>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {!recibe.esPaciente && <>
                    <div><label className={labelCls}>Nombre <span className="text-[#D81B43]">*</span></label>
                      <input value={recibe.nombre} onChange={e => setRecibe(r => ({ ...r, nombre: e.target.value }))} className={inputCls} /></div>
                    <div><label className={labelCls}>Documento <span className="text-[#D81B43]">*</span></label>
                      <input value={recibe.documento} inputMode="numeric" onChange={e => setRecibe(r => ({ ...r, documento: e.target.value }))} className={inputCls} /></div>
                    <div><label className={labelCls}>Parentesco con el paciente</label>
                      <input value={recibe.parentesco} placeholder="Hijo, esposa, cuidador…" onChange={e => setRecibe(r => ({ ...r, parentesco: e.target.value }))} className={inputCls} /></div>
                  </>}
                  <div><label className={labelCls}>Teléfono</label>
                    <input value={recibe.telefono} inputMode="tel" onChange={e => setRecibe(r => ({ ...r, telefono: e.target.value }))} className={inputCls} /></div>
                  <div><label className={labelCls}>Correo</label>
                    <input value={recibe.correo} type="email" onChange={e => setRecibe(r => ({ ...r, correo: e.target.value }))} className={inputCls} /></div>
                </div>
              </section>

              {paciente && (
                <section>
                  <div className="text-[13px] font-bold text-slate-700 mb-1">Datos del paciente para los formatos</div>
                  <div className="text-[12px] text-slate-400 mb-3">Lo que completes aquí queda guardado en el paciente.</div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div><label className={labelCls}>Tipo de documento</label>
                      <select value={pac.tipo_documento} onChange={e => setPac(p => ({ ...p, tipo_documento: e.target.value }))} className={inputCls}>
                        {TIPOS_DOC.map(t => <option key={t} value={t}>{t}</option>)}
                      </select></div>
                    <div><label className={labelCls}>Número</label>
                      <input value={pac.cedula} inputMode="numeric" onChange={e => setPac(p => ({ ...p, cedula: e.target.value.replace(/[^0-9]/g, '') }))} className={inputCls} /></div>
                    <div><label className={labelCls}>Fecha de nacimiento</label>
                      <input type="date" value={pac.fecha_nacimiento} onChange={e => setPac(p => ({ ...p, fecha_nacimiento: e.target.value }))} className={inputCls} /></div>
                    <div><label className={labelCls}>EPS</label>
                      <input value={pac.eps} onChange={e => setPac(p => ({ ...p, eps: e.target.value }))} className={inputCls} /></div>
                    <div><label className={labelCls}>Barrio</label>
                      <input value={pac.barrio} onChange={e => setPac(p => ({ ...p, barrio: e.target.value }))} className={inputCls} /></div>
                    <div><label className={labelCls}>Ciudad de la entrega</label>
                      <input value={ciudad} onChange={e => setCiudad(e.target.value)} className={inputCls} /></div>
                    <div className="sm:col-span-3"><label className={labelCls}>Diagnóstico (Dx)</label>
                      <input value={diagnostico} onChange={e => setDiagnostico(e.target.value)} className={inputCls} /></div>
                  </div>
                </section>
              )}

              <section>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[13px] font-bold text-slate-700">Insumos entregados</div>
                  <button type="button" onClick={() => setInsumos(l => [...l, { descripcion: '', cantidad: 1, lote: '', invima: '' }])}
                    className="flex items-center gap-1 text-[12.5px] font-semibold text-[#1B3A6B] hover:underline"><Plus size={13} /> Agregar insumo</button>
                </div>
                {insumos.length === 0 && <div className="text-[12.5px] text-slate-400">Sin insumos (máscaras, mangueras, cánulas…).</div>}
                <div className="space-y-2">
                  {insumos.map((it, i) => {
                    const set = (k, v) => setInsumos(l => l.map((x, j) => j === i ? { ...x, [k]: v } : x))
                    return (
                      <div key={i} className="grid grid-cols-[64px_1fr_1fr_28px] sm:grid-cols-[1fr_64px_1fr_1fr_28px] gap-2 items-center bg-slate-50 rounded-[9px] p-2">
                        <input value={it.descripcion} placeholder="Insumo" aria-label="Insumo" onChange={e => set('descripcion', e.target.value)} className={`${inputCls} col-span-4 sm:col-span-1`} />
                        <input value={it.cantidad} type="number" min="1" placeholder="Cant." aria-label="Cantidad" title="Cantidad" onChange={e => set('cantidad', e.target.value)} className={inputCls} />
                        <input value={it.lote} placeholder="Lote" aria-label="Lote" onChange={e => set('lote', e.target.value)} className={inputCls} />
                        <input value={it.invima} placeholder="Reg. INVIMA" aria-label="Registro INVIMA" onChange={e => set('invima', e.target.value)} className={inputCls} />
                        <button type="button" onClick={() => setInsumos(l => l.filter((_, j) => j !== i))} className="text-slate-400 hover:text-[#D81B43] justify-self-center" title="Quitar insumo" aria-label="Quitar insumo"><Trash2 size={15} /></button>
                      </div>
                    )
                  })}
                </div>
              </section>

              <section>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[13px] font-bold text-slate-700">Quién entrega</div>
                  {!editarEntrega && (
                    <button type="button" onClick={() => setEditarEntrega(true)} className="text-[12.5px] font-semibold text-[#1B3A6B] hover:underline">Cambiar</button>
                  )}
                </div>
                {!editarEntrega ? (
                  <div className="flex items-center gap-3 px-3.5 py-3 bg-slate-50 border border-slate-200 rounded-[10px]">
                    <div className="w-9 h-9 rounded-full bg-[#1B3A6B] text-white flex items-center justify-center text-[13px] font-bold flex-shrink-0">{entrega.nombre.charAt(0)}</div>
                    <div className="min-w-0">
                      <div className="text-[13.5px] font-semibold text-slate-800 truncate">{entrega.nombre}</div>
                      <div className="text-[12px] text-slate-500 truncate">{entrega.cargo} · {entrega.tipo_documento} {entrega.documento}</div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_88px_1fr] gap-3">
                      <div><label className={labelCls}>Nombre <span className="text-[#D81B43]">*</span></label>
                        <input value={entrega.nombre} onChange={e => setEntrega(x => ({ ...x, nombre: e.target.value }))} className={inputCls} /></div>
                      <div><label className={labelCls}>Cargo</label>
                        <input value={entrega.cargo} placeholder="Biomédico, auxiliar…" onChange={e => setEntrega(x => ({ ...x, cargo: e.target.value }))} className={inputCls} /></div>
                      <div><label className={labelCls}>Tipo</label>
                        <select value={entrega.tipo_documento} onChange={e => setEntrega(x => ({ ...x, tipo_documento: e.target.value }))} className={inputCls}>
                          {['CC', 'CE', 'PA', 'TI'].map(t => <option key={t} value={t}>{t}</option>)}
                        </select></div>
                      <div><label className={labelCls}>Documento <span className="text-[#D81B43]">*</span></label>
                        <input value={entrega.documento} inputMode="numeric" onChange={e => setEntrega(x => ({ ...x, documento: e.target.value.replace(/[^0-9]/g, '') }))} className={inputCls} /></div>
                    </div>
                    {base.usuario.id && !(base.usuario.cargo && base.usuario.cedula) && (
                      <div className="text-[11.5px] text-slate-400 mt-2">Lo que falte en tu perfil queda guardado para las próximas entregas.</div>
                    )}
                  </>
                )}
              </section>

              <section>
                <label className={labelCls}>Observaciones (estado del equipo al entregar)</label>
                <textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} rows={2}
                  className={`${inputCls} resize-none`} placeholder="Ej.: equipo en óptimas condiciones, se capacita en su manejo." />
              </section>

              <section className="flex flex-wrap gap-2">
                {plantillas.map(p => (
                  <span key={p.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-medium bg-slate-100 text-slate-600">
                    <FileText size={12} /> {p.nombre}
                  </span>
                ))}
              </section>
            </div>
          )}

          {base && docActual && (
            <div className="bg-slate-100 p-3 md:p-6">
              <div className="text-[12.5px] text-slate-500 mb-3">Documento {paso} de {plantillas.length}: <b className="text-slate-700">{docActual.nombre}</b> · revisa los datos; la firma se recoge al final, una sola vez.</div>
              <VistaActa bloques={docActual.bloques} ctx={ctx} />
            </div>
          )}

          {base && paso === pasoFirma && (
            <div className="p-5 md:p-6 space-y-5">
              <div className="text-[12.5px] text-slate-500">Las firmas se aplican a {plantillas.length === 1 ? 'el documento' : `los ${plantillas.length} documentos`}.</div>
              <div>
                <div className="text-[13px] font-bold text-slate-700 mb-2">Firma de quien recibe · <span className="font-medium">{datosRecibe.nombre}</span></div>
                <div className="h-[180px]"><FirmaPad onFirma={f => setFirmas(x => ({ ...x, recibe: f }))} onLimpiar={() => setFirmas(x => ({ ...x, recibe: null }))} /></div>
              </div>
              <div>
                <div className="text-[13px] font-bold text-slate-700 mb-2">Firma de quien entrega · <span className="font-medium">{entrega.nombre}</span></div>
                <div className="h-[180px]"><FirmaPad onFirma={f => setFirmas(x => ({ ...x, entrega: f }))} onLimpiar={() => setFirmas(x => ({ ...x, entrega: null }))} /></div>
              </div>
            </div>
          )}

          {error && <div className="mx-5 my-3 px-3 py-2.5 bg-red-50 border border-red-200 rounded-[8px] text-[12.5px] text-red-700">{error}</div>}
        </div>

        {base && (
          <div className="px-5 py-3.5 border-t border-slate-200 flex justify-end gap-2 flex-shrink-0"
            style={{ paddingBottom: 'max(14px, env(safe-area-inset-bottom, 14px))' }}>
            <button onClick={onCancelar} disabled={guardando} className="px-4 py-2.5 border border-slate-200 rounded-[9px] text-[13px] font-medium text-slate-600 hover:border-slate-300">Cancelar</button>
            {paso < pasoFirma
              ? <button onClick={siguiente} className="px-5 py-2.5 bg-[#1B3A6B] text-white rounded-[9px] text-[13px] font-semibold hover:bg-[#152d55]">Siguiente →</button>
              : <button onClick={confirmar} disabled={guardando || !firmas.recibe || !firmas.entrega}
                  className="px-5 py-2.5 bg-[#D81B43] text-white rounded-[9px] text-[13px] font-semibold hover:bg-[#B0172F] disabled:opacity-50">
                  {guardando ? 'Guardando…' : '✓ Confirmar y firmar'}
                </button>}
          </div>
        )}
      </div>
    </>
  )
}
