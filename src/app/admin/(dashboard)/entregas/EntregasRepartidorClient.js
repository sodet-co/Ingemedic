'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { registrarBitacora } from '@/lib/bitacora'
import { formatear, soloDia, hoyBogota, sumarDias } from '@/lib/fechas'
import { crearEntrega, finalizarEntrega } from '@/lib/entregas'
import FirmaPad from '@/components/entregas/FirmaPad'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import {
  Package, MapPin, Clock, User, CheckCircle2, Truck, Phone, X, Navigation, FileText, StickyNote, ChevronLeft,
} from 'lucide-react'

function nombreEquipo(eq) {
  return eq?.tipo_equipo?.atributos?.nombre || eq?.tipo_equipo?.nombre || '—'
}

// Datos de destino: si hay paciente, el equipo va a su casa; si no, al cliente.
function destino(orden) {
  const p = orden?.paciente
  const c = orden?.cliente
  const direccion = p?.direccion || c?.direccion || ''
  const ciudad    = (p?.direccion ? p?.ciudad : c?.municipio?.nombre) || ''
  return {
    direccion,
    ciudad,
    telefono: p?.telefono || c?.telefono || '',
    mapsUrl: direccion
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([direccion, ciudad, 'Colombia'].filter(Boolean).join(', '))}`
      : null,
  }
}

const hora = iso => formatear(iso, { day: undefined, month: undefined, year: undefined, hour: '2-digit', minute: '2-digit' })
const fechaCorta = iso => formatear(iso, { weekday: 'short', day: 'numeric', month: 'short', year: undefined })

// Vista de Entregas del rol Repartidor — mobile-first. Reutiliza la lógica de
// negocio de lib/entregas.js (crearEntrega, finalizarEntrega) y FirmaPad; solo
// cambia la presentación respecto a la vista de admin (EntregasClient.js).
export default function EntregasRepartidorClient({ nombreRepartidor = '', entregasIniciales, ordenesAsignadas, estadosEquipo }) {
  const router = useRouter()
  const supabase = createClient()

  const [entregas, setEntregas] = useState(entregasIniciales)
  // Evita que un refresh disparado por Realtime (que puede llegar con datos de
  // un instante intermedio) sobreescriba una actualización local recién hecha —
  // mismo patrón que EntregasClient.js.
  const skipSyncUntil = useRef(0)
  const [ordenes, setOrdenes]   = useState(ordenesAsignadas)
  const [saving, setSaving]     = useState(false)
  const [toast, setToast]       = useState(null)
  const [tab, setTab]           = useState('activas') // 'activas' | 'completadas'
  const [porIniciar, setPorIniciar] = useState(null)   // orden a confirmar antes de iniciar
  const [modalRegistro, setModalRegistro] = useState(null)
  const [paso, setPaso]         = useState(0)          // 0 = datos de recepción, 1 = firma
  const [regForm, setRegForm]   = useState({ recibido_por: '', observaciones: '', firmas: {} })

  useEffect(() => {
    const t = setTimeout(() => {
      if (Date.now() < skipSyncUntil.current) return
      setEntregas(entregasIniciales)
    }, 0)
    return () => clearTimeout(t)
  }, [entregasIniciales])
  useEffect(() => {
    const t = setTimeout(() => {
      if (Date.now() < skipSyncUntil.current) return
      setOrdenes(ordenesAsignadas)
    }, 0)
    return () => clearTimeout(t)
  }, [ordenesAsignadas])

  useEffect(() => {
    let debounceTimer = null
    function refrescarConDebounce() {
      clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        if (Date.now() < skipSyncUntil.current) return
        router.refresh()
      }, 500)
    }
    const canal = supabase
      .channel('entregas-repartidor-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'entregas' }, refrescarConDebounce)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ordenes_servicio' }, refrescarConDebounce)
      .subscribe()
    return () => { clearTimeout(debounceTimer); supabase.removeChannel(canal) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function showToast(msg, tipo = 'success') {
    setToast({ msg, tipo })
    setTimeout(() => setToast(null), 3200)
  }

  const hoy    = hoyBogota()
  const manana = sumarDias(hoy, 1)
  const ayer   = sumarDias(hoy, -1)

  const { grupos, completadas } = useMemo(() => {
    const pendientes = ordenes.map(o => ({
      key: `orden-${o.id}`, _tipo: 'pendiente', orden: o, fechaHora: o.fecha_entrega,
    }))
    const enCamino = entregas
      .filter(e => e.estado?.nombre === 'En progreso')
      .map(e => ({ key: `entrega-${e.id}`, _tipo: 'en_progreso', entrega: e, orden: e.orden, fechaHora: e.orden?.fecha_entrega || e.fecha_inicio }))
    const completas = entregas
      .filter(e => e.estado?.nombre === 'Completada')
      .map(e => ({ key: `entrega-${e.id}`, _tipo: 'completada', entrega: e, orden: e.orden, fechaHora: e.fecha_completada }))
      .sort((a, b) => new Date(b.fechaHora || 0) - new Date(a.fechaHora || 0))

    const porFecha = (a, b) => new Date(a.fechaHora || 0) - new Date(b.fechaHora || 0)
    const dia = it => soloDia(it.fechaHora)
    const sinFecha  = pendientes.filter(it => !it.fechaHora)
    const conFecha  = pendientes.filter(it => it.fechaHora).sort(porFecha)

    const grupos = [
      { id: 'camino',    titulo: 'En camino', items: enCamino.sort(porFecha), tono: 'text-[#0E86A0]' },
      { id: 'atrasadas', titulo: 'Atrasadas', items: conFecha.filter(it => dia(it) < hoy), tono: 'text-[#D81B43]' },
      { id: 'hoy',       titulo: 'Hoy',       items: conFecha.filter(it => dia(it) === hoy) },
      { id: 'manana',    titulo: 'Mañana',    items: conFecha.filter(it => dia(it) === manana) },
      { id: 'proximas',  titulo: 'Próximas',  items: conFecha.filter(it => dia(it) > manana) },
      { id: 'sinfecha',  titulo: 'Sin fecha programada', items: sinFecha },
    ].filter(g => g.items.length)

    return { grupos, completadas: completas }
  }, [ordenes, entregas, hoy, manana])

  const totalActivas = grupos.reduce((n, g) => n + g.items.length, 0)

  async function handleIniciar() {
    const orden = porIniciar
    setPorIniciar(null)
    setSaving(true)
    const { data, error } = await crearEntrega(supabase, orden)
    if (error) { showToast('Error: ' + error.message, 'error'); setSaving(false); return }
    registrarBitacora({ modulo: 'entregas', accion: 'avanzar', entidad: 'entrega', entidad_id: data.id, detalle: { estado: 'iniciada', codigo: orden.codigo } })
    skipSyncUntil.current = Date.now() + 2500
    setOrdenes(prev => prev.filter(o => o.id !== orden.id))
    setEntregas(prev => [data, ...prev])
    setSaving(false)
    showToast('Entrega iniciada — vas en camino')
  }

  function abrirCompletar(entrega) {
    setModalRegistro(entrega)
    setPaso(0)
    setRegForm({ recibido_por: entrega.recibido_por || '', observaciones: '', firmas: {} })
  }

  function avanzarAFirma() {
    if (!regForm.recibido_por?.trim()) { showToast('Escribe el nombre de quien recibe', 'error'); return }
    setPaso(1)
  }

  async function handleCompletar() {
    const firma = regForm.firmas.general || null
    if (!firma) { showToast('Falta la firma de quien recibe', 'error'); return }
    setSaving(true)

    const recibidoPor = regForm.recibido_por.trim()
    const { error, erroresFirma, cambios } = await finalizarEntrega(supabase, {
      entrega: modalRegistro, recibidoPor, firma, observaciones: regForm.observaciones, estadosEquipo,
    })
    if (error) { showToast('Error: ' + error.message, 'error'); setSaving(false); return }
    registrarBitacora({ modulo: 'entregas', accion: 'cerrar', entidad: 'entrega', entidad_id: modalRegistro.id, detalle: { codigo: modalRegistro.codigo, recibido_por: recibidoPor } })

    skipSyncUntil.current = Date.now() + 2500 // protege el estado local por 2.5s tras completar
    setEntregas(prev => prev.map(e => e.id === modalRegistro.id ? { ...e, ...cambios } : e))
    setSaving(false)
    setModalRegistro(null)
    showToast(erroresFirma > 0
      ? `Entrega completada, pero ${erroresFirma} firma(s) no se guardaron`
      : '¡Entrega completada!', erroresFirma > 0 ? 'error' : 'success')
    router.refresh()
  }

  const primerNombre = (nombreRepartidor || '').trim().split(/\s+/)[0]
  // "viernes, 25 de septiembre" → "Viernes, 25 de septiembre" (solo la primera letra;
  // la clase `capitalize` ponía "De" y "Septiembre" en mayúscula)
  const fechaHoyTexto = new Date().toLocaleDateString('es-CO', { timeZone: 'America/Bogota', weekday: 'long', day: 'numeric', month: 'long' })
  const fechaHoyLarga = fechaHoyTexto.charAt(0).toUpperCase() + fechaHoyTexto.slice(1)

  const ordenModal     = modalRegistro?.orden
  const equiposModal   = ordenModal?.equipos || []
  const docsModal      = ordenModal?.plantillas || []

  return (
    <div className="min-h-full bg-[#F8FAFC]">
      {/* Saludo */}
      <div className="px-4 pt-4">
        <div className="text-[20px] font-bold text-slate-800 leading-tight">Hola{primerNombre ? `, ${primerNombre}` : ''} 👋</div>
        <div className="text-[13px] text-slate-400">{fechaHoyLarga}</div>

        <div className="flex bg-slate-200/60 rounded-[10px] p-1 gap-1 mt-4">
          {[['activas', `Pendientes (${totalActivas})`], ['completadas', `Completadas (${completadas.length})`]].map(([v, l]) => (
            <button key={v} onClick={() => setTab(v)}
              className={`flex-1 py-2.5 rounded-[8px] text-[13px] font-semibold transition-all ${
                tab === v ? 'bg-white text-[#1B3A6B] shadow-sm' : 'text-slate-500'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-3 pb-8">
        {tab === 'activas' && (
          grupos.length === 0 ? (
            <Vacio titulo="No tienes entregas pendientes" sub="Cuando te asignen una, aparecerá aquí." />
          ) : grupos.map(g => (
            <div key={g.id} className="mb-5">
              <div className={`text-[12px] font-bold uppercase tracking-[0.08em] mb-2 ${g.tono || 'text-slate-400'}`}>
                {g.titulo} · {g.items.length}
              </div>
              <div className="space-y-3">
                {g.items.map(item => (
                  <TarjetaEntrega key={item.key} item={item} saving={saving} hoy={hoy} manana={manana}
                    onIniciar={setPorIniciar} onCompletar={abrirCompletar} />
                ))}
              </div>
            </div>
          ))
        )}

        {tab === 'completadas' && (
          completadas.length === 0 ? (
            <Vacio titulo="Aún no has completado entregas" sub="Aquí verás tu historial." />
          ) : (
            <div className="space-y-2">
              {completadas.map(item => {
                const d = soloDia(item.fechaHora)
                const cuando = d === hoy ? `Hoy · ${hora(item.fechaHora)}` : d === ayer ? `Ayer · ${hora(item.fechaHora)}` : `${fechaCorta(item.fechaHora)} · ${hora(item.fechaHora)}`
                return (
                  <div key={item.key} className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#ECFDF5] text-[#0F7B55] flex items-center justify-center flex-shrink-0"><CheckCircle2 size={18} /></div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[14px] font-semibold text-slate-800 truncate">{item.orden?.paciente?.nombre || item.orden?.cliente?.nombre || 'Entrega'}</div>
                      <div className="text-[12px] text-slate-400">
                        {cuando} · <span className="font-mono">{item.orden?.codigo}</span>
                      </div>
                      {item.entrega?.recibido_por && (
                        <div className="text-[12px] text-slate-500 truncate">Recibió: {item.entrega.recibido_por}</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        )}
      </div>

      {/* Confirmar antes de iniciar (evita toques accidentales) */}
      <ConfirmDialog
        abierto={!!porIniciar}
        titulo="¿Iniciar esta entrega?"
        mensaje={porIniciar ? `${porIniciar.paciente?.nombre || porIniciar.cliente?.nombre} — quedará marcada "En camino".` : ''}
        textoConfirmar="Sí, iniciar"
        onConfirmar={handleIniciar}
        onCancelar={() => setPorIniciar(null)}
      />

      {/* Completar entrega — 2 pasos: datos de recepción → firma */}
      {modalRegistro && (
        <>
          <div className="fixed inset-0 bg-black/50 z-[60]" onClick={() => !saving && setModalRegistro(null)} />
          <div className="fixed inset-x-0 bottom-0 z-[60] bg-white rounded-t-2xl shadow-2xl h-[94dvh] flex flex-col">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2 flex-shrink-0">
              {paso === 1 ? (
                <button onClick={() => setPaso(0)} className="w-9 h-9 flex items-center justify-center text-slate-500 -ml-1" aria-label="Atrás">
                  <ChevronLeft size={22} />
                </button>
              ) : <div className="w-2" />}
              <div className="flex-1 min-w-0">
                <div className="text-[16px] font-bold text-slate-800">{paso === 0 ? 'Completar entrega' : 'Firma de quien recibe'}</div>
                <div className="text-[12px] text-slate-400">Paso {paso + 1} de 2 · {ordenModal?.codigo}</div>
              </div>
              <button onClick={() => setModalRegistro(null)} disabled={saving} className="w-9 h-9 flex items-center justify-center text-slate-400" aria-label="Cerrar">
                <X size={20} />
              </button>
            </div>

            <div className={`flex-1 overflow-y-auto p-4 ${paso === 1 ? 'flex flex-col' : 'space-y-4'}`}>
              {paso === 0 && (
                <>
                  <div className="bg-slate-50 rounded-xl border border-slate-200 p-3.5">
                    <div className="text-[14px] font-semibold text-slate-800">{ordenModal?.paciente?.nombre || ordenModal?.cliente?.nombre}</div>
                    {ordenModal?.paciente && <div className="text-[12px] text-slate-500">Cliente: {ordenModal?.cliente?.nombre}</div>}
                    <div className="text-[11px] font-bold uppercase tracking-[0.07em] text-slate-400 mt-3 mb-1.5">
                      Equipos a entregar ({equiposModal.length})
                    </div>
                    <div className="space-y-1">
                      {equiposModal.map(oe => (
                        <div key={oe.id} className="flex items-center gap-2 text-[13px] text-slate-700">
                          <Package size={14} className="text-slate-400 flex-shrink-0" />
                          <span className="truncate">{nombreEquipo(oe.equipo)}</span>
                          <span className="ml-auto font-mono text-[12px] font-semibold text-slate-500 flex-shrink-0">{oe.equipo?.codigo}</span>
                        </div>
                      ))}
                    </div>
                    {docsModal.length > 0 && (
                      <div className="flex items-center gap-1.5 text-[12px] text-slate-500 mt-3 pt-3 border-t border-slate-200">
                        <FileText size={13} /> La firma aplica a {docsModal.length} documento{docsModal.length !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">Nombre de quien recibe <span className="text-[#D81B43]">*</span></label>
                    <input value={regForm.recibido_por} onChange={e => setRegForm(f => ({ ...f, recibido_por: e.target.value }))}
                      placeholder="Nombre completo" autoComplete="off"
                      className="w-full px-3.5 py-3 border border-slate-200 rounded-[10px] text-[15px] outline-none focus:border-[#1B3A6B]" />
                  </div>
                  <div>
                    <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">Observaciones <span className="text-slate-400 font-normal">(opcional)</span></label>
                    <textarea value={regForm.observaciones} onChange={e => setRegForm(f => ({ ...f, observaciones: e.target.value }))}
                      rows={3} placeholder="Ej. el equipo quedó instalado en la habitación"
                      className="w-full px-3.5 py-3 border border-slate-200 rounded-[10px] text-[15px] outline-none focus:border-[#1B3A6B] resize-none" />
                  </div>
                </>
              )}

              {paso === 1 && (
                <>
                  <div className="text-[13px] text-slate-500 mb-3 flex-shrink-0">
                    Firma: <span className="font-semibold text-slate-800">{regForm.recibido_por}</span>
                    <div className="text-[12px] text-slate-400 mt-0.5">Pásale el celular para que firme con el dedo.</div>
                  </div>
                  <FirmaPad
                    fullscreen
                    onFirma={dataUrl => setRegForm(f => ({ ...f, firmas: { general: dataUrl } }))}
                    onLimpiar={() => setRegForm(f => ({ ...f, firmas: {} }))}
                  />
                </>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 flex-shrink-0" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
              {paso === 0 ? (
                <button onClick={avanzarAFirma}
                  className="w-full py-4 bg-[#1B3A6B] text-white rounded-[12px] text-[16px] font-bold">
                  Continuar a la firma
                </button>
              ) : (
                <button onClick={handleCompletar} disabled={saving || !regForm.firmas.general}
                  className="w-full py-4 bg-[#0F7B55] text-white rounded-[12px] text-[16px] font-bold disabled:bg-slate-200 disabled:text-slate-400">
                  {saving ? 'Guardando...' : '✓ Confirmar entrega'}
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {toast && (
        <div className={`fixed bottom-24 left-4 right-4 z-[70] px-4 py-3 rounded-[12px] text-[14px] font-medium text-white shadow-lg text-center ${toast.tipo === 'error' ? 'bg-red-500' : 'bg-[#0F7B55]'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}

function Vacio({ titulo, sub }) {
  return (
    <div className="text-center py-16 text-slate-400">
      <Truck className="w-14 h-14 mx-auto mb-3 opacity-20" />
      <div className="font-semibold text-[15px] text-slate-500 mb-1">{titulo}</div>
      <div className="text-[13px]">{sub}</div>
    </div>
  )
}

function TarjetaEntrega({ item, saving, hoy, manana, onIniciar, onCompletar }) {
  const orden      = item.orden
  const cliente    = orden?.cliente?.nombre || 'Cliente desconocido'
  const paciente   = orden?.paciente?.nombre || null
  const { direccion, ciudad, telefono, mapsUrl } = destino(orden)
  const equipos    = orden?.equipos || []
  const enProgreso = item._tipo === 'en_progreso'
  const nota       = (orden?.observaciones || '').trim()

  const d = soloDia(item.fechaHora)
  const cuando = !item.fechaHora ? 'Sin hora programada'
    : d === hoy ? `Hoy · ${hora(item.fechaHora)}`
    : d === manana ? `Mañana · ${hora(item.fechaHora)}`
    : `${fechaCorta(item.fechaHora)} · ${hora(item.fechaHora)}`
  const atrasada = !enProgreso && item.fechaHora && d < hoy

  return (
    <article className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${enProgreso ? 'border-[#2EB5D4]/60' : atrasada ? 'border-[#D81B43]/40' : 'border-slate-200'}`}>
      <div className="p-4">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className={`flex items-center gap-1.5 text-[13px] font-semibold ${atrasada ? 'text-[#D81B43]' : 'text-slate-500'}`}>
            <Clock size={14} /> {cuando}
          </div>
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold flex-shrink-0 ${
            enProgreso ? 'bg-[#E8F7FB] text-[#0E86A0]' : atrasada ? 'bg-red-50 text-[#D81B43]' : 'bg-[#FFFBEB] text-[#B45309]'
          }`}>
            <Truck size={11} /> {enProgreso ? 'En camino' : atrasada ? 'Atrasada' : 'Por iniciar'}
          </span>
        </div>

        {/* Quién recibe: paciente si hay, si no el cliente */}
        <div className="text-[17px] font-bold text-slate-800 leading-tight">{paciente || cliente}</div>
        {paciente && <div className="text-[12.5px] text-slate-500 mt-0.5">Cliente: {cliente}</div>}

        <div className="flex items-start gap-1.5 text-[14px] text-slate-600 mt-2.5">
          <MapPin size={15} className="text-[#D81B43] flex-shrink-0 mt-0.5" />
          <span>{direccion || 'Sin dirección registrada'}{ciudad ? <span className="text-slate-400"> · {ciudad}</span> : null}</span>
        </div>

        {equipos.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {equipos.map(oe => (
              <span key={oe.id} className="inline-flex items-center gap-1 text-[12px] bg-slate-100 text-slate-600 px-2 py-1 rounded-md max-w-full">
                <Package size={12} className="flex-shrink-0" />
                <span className="truncate">{nombreEquipo(oe.equipo)}</span>
                <span className="font-mono font-semibold text-slate-500 flex-shrink-0">{oe.equipo?.codigo}</span>
              </span>
            ))}
          </div>
        )}

        {nota && (
          <div className="flex items-start gap-1.5 text-[12.5px] text-[#92400E] bg-[#FFFBEB] border border-[#F59E0B]/30 rounded-lg px-2.5 py-2 mt-3">
            <StickyNote size={13} className="flex-shrink-0 mt-0.5" /> <span>{nota}</span>
          </div>
        )}

        <div className="text-[11px] font-mono text-slate-400 mt-3">{orden?.codigo}</div>
      </div>

      {/* Acciones: llamar y cómo llegar arriba, acción principal abajo a todo el ancho */}
      <div className="grid grid-cols-2 border-t border-slate-100">
        {telefono ? (
          <a href={`tel:${telefono.replace(/\s+/g, '')}`} className="py-3 flex items-center justify-center gap-1.5 text-[14px] font-semibold text-[#1B3A6B] border-r border-slate-100 active:bg-slate-50">
            <Phone size={16} /> Llamar
          </a>
        ) : (
          <span className="py-3 flex items-center justify-center gap-1.5 text-[13px] text-slate-300 border-r border-slate-100"><Phone size={16} /> Sin teléfono</span>
        )}
        {mapsUrl ? (
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="py-3 flex items-center justify-center gap-1.5 text-[14px] font-semibold text-[#1B3A6B] active:bg-slate-50">
            <Navigation size={16} /> Cómo llegar
          </a>
        ) : (
          <span className="py-3 flex items-center justify-center gap-1.5 text-[13px] text-slate-300"><Navigation size={16} /> Sin dirección</span>
        )}
      </div>
      <div className="px-4 pb-4">
        <button
          onClick={() => enProgreso ? onCompletar(item.entrega) : onIniciar(orden)}
          disabled={saving}
          className={`w-full py-3.5 rounded-[12px] text-[15px] font-bold text-white disabled:opacity-50 ${
            enProgreso ? 'bg-[#0F7B55] active:bg-[#0c6444]' : 'bg-[#D81B43] active:bg-[#B0172F]'}`}>
          {enProgreso ? 'Completar entrega' : 'Iniciar entrega'}
        </button>
      </div>
    </article>
  )
}
