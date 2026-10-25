'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { registrarBitacora } from '@/lib/bitacora'
import { formatear, soloDia, hoyBogota, sumarDias } from '@/lib/fechas'
import { crearEntrega, finalizarEntrega } from '@/lib/entregas'
import { completarAccion, iniciarAccion, accionDeEntrega, equiposDelActa, NOMBRE_ACCION, nombreVisita } from '@/lib/accionesPrestamo'
import FirmaActas from '@/components/actas/FirmaActas'
import Ayuda from '@/components/ui/Ayuda'
import EntregaEnCurso, { RutaAnimada } from '@/components/entregas/EntregaEnCurso'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { descargarActasPDF } from '@/lib/actas/pdf'
import { ui } from '@/lib/ui'
import {
  Package, MapPin, Clock, CheckCircle2, Truck, Phone, Navigation, StickyNote, ChevronLeft, Download, Loader2,
} from 'lucide-react'

// Recogida, recarga o cambio (lib/accionesPrestamo.js); 'entrega' es la del préstamo
const esAccion = e => !!e?.tipo && e.tipo !== 'entrega'
const equiposDeAccion = e => e.tipo === 'cambio'
  ? (e.datos?.cambios || []).map(c => ({ id: c.orden_equipo_id, equipo: c.entra, sale: c.sale }))
  : (e.datos?.equipos || []).map(x => ({ id: x.orden_equipo_id, equipo: x.equipo }))

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
  const [modalRegistro, setModalRegistro] = useState(null) // entrega que se está firmando (FirmaActas)
  // Entrega en curso abierta a pantalla completa (se abre sola al iniciar)
  const [enCursoId, setEnCursoId] = useState(null)

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
    const pendientes = [
      ...ordenes.map(o => ({ key: `orden-${o.id}`, _tipo: 'pendiente', orden: o, fechaHora: o.fecha_entrega })),
      // Recogidas, recargas y cambios programados
      ...entregas.filter(e => esAccion(e) && e.estado?.nombre === 'No iniciada')
        .map(e => ({ key: `entrega-${e.id}`, _tipo: 'pendiente', entrega: e, orden: e.orden, fechaHora: e.fecha_programada })),
    ]
    const enCamino = entregas
      .filter(e => e.estado?.nombre === 'En progreso')
      .map(e => ({ key: `entrega-${e.id}`, _tipo: 'en_progreso', entrega: e, orden: e.orden, fechaHora: (esAccion(e) ? e.fecha_programada : e.orden?.fecha_entrega) || e.fecha_inicio }))
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
    // Recogida, recarga o cambio: ya tiene su fila; solo arranca
    if (orden._entrega) {
      const e = orden._entrega
      const { data, error } = await iniciarAccion(supabase, e)
      setSaving(false)
      if (error) { showToast('Error: ' + error.message, 'error'); return }
      registrarBitacora({ modulo: 'entregas', accion: 'avanzar', entidad: nombreVisita(e).toLowerCase(), entidad_id: e.id, detalle: { estado: 'iniciada', codigo: e.orden?.codigo } })
      setEntregas(prev => prev.map(x => x.id === e.id ? { ...x, ...data, estado: { nombre: 'En progreso' } } : x))
      setEnCursoId(e.id)
      showToast(`${nombreVisita(e)} iniciada — vas en camino`)
      return
    }
    const { data, error } = await crearEntrega(supabase, orden)
    if (error) { showToast('Error: ' + error.message, 'error'); setSaving(false); return }
    registrarBitacora({ modulo: 'entregas', accion: 'avanzar', entidad: 'entrega', entidad_id: data.id, detalle: { estado: 'iniciada', codigo: orden.codigo } })
    skipSyncUntil.current = Date.now() + 2500
    setOrdenes(prev => prev.filter(o => o.id !== orden.id))
    setEntregas(prev => [data, ...prev])
    setSaving(false)
    setEnCursoId(data.id)
    showToast('Entrega iniciada — vas en camino')
  }

  function abrirCompletar(entrega) {
    setModalRegistro(entrega)
  }

  // PDF con las actas firmadas en una entrega (las de esa entrega; si es de antes
  // de guardar la entrega en el acta, las del préstamo)
  const [descargando, setDescargando] = useState(null)
  // Pantalla de éxito al cerrar una entrega: tiempo, quién recibió y el acta
  const [exito, setExito] = useState(null)
  async function descargarActas(item) {
    setDescargando(item.key)
    try {
      const campos = 'id, nombre, fecha_firma, bloques, datos, firma_recibe, firma_entrega'
      let { data } = await supabase.from('actas').select(campos).eq('entrega_id', item.entrega.id).order('fecha_firma')
      if (!data?.length && item.orden?.id && !esAccion(item.entrega)) ({ data } = await supabase.from('actas').select(campos).eq('orden_id', item.orden.id).eq('accion', 'prestamo').order('fecha_firma'))
      if (!data?.length) { showToast('Esta entrega no tiene actas firmadas', 'error'); return }
      await descargarActasPDF(data, `Acta_${item.orden?.codigo || 'entrega'}.pdf`)
    } catch (e) {
      showToast('No se pudo generar el PDF: ' + (e.message || e), 'error')
    } finally {
      setDescargando(null)
    }
  }

  // Lo corre FirmaActas antes de guardar las actas: si falla, no se guarda nada
  async function completarEntrega({ recibidoPor, firma, observaciones, datosActa }) {
    const entrega = modalRegistro
    if (esAccion(entrega)) {
      const { error, cambios } = await completarAccion(supabase, { entrega, orden: entrega.orden, recibidoPor, firma, observaciones, datos: { datos_acta: datosActa } })
      if (error) return error
      registrarBitacora({ modulo: 'entregas', accion: 'cerrar', entidad: nombreVisita(entrega).toLowerCase(), entidad_id: entrega.id, detalle: { codigo: entrega.codigo, recibido_por: recibidoPor } })
      skipSyncUntil.current = Date.now() + 2500
      setEntregas(prev => prev.map(e => e.id === entrega.id ? { ...e, ...cambios } : e))
      return null
    }
    const { error, erroresFirma, cambios } = await finalizarEntrega(supabase, {
      entrega, recibidoPor, firma, observaciones, estadosEquipo,
    })
    if (error) return error
    registrarBitacora({ modulo: 'entregas', accion: 'cerrar', entidad: 'entrega', entidad_id: entrega.id, detalle: { codigo: entrega.codigo, recibido_por: recibidoPor } })
    skipSyncUntil.current = Date.now() + 2500 // protege el estado local por 2.5s tras completar
    setEntregas(prev => prev.map(e => e.id === entrega.id ? { ...e, ...cambios } : e))
    if (erroresFirma > 0) showToast(`Entrega completada, pero ${erroresFirma} firma(s) no se guardaron`, 'error')
    return null
  }

  const primerNombre = (nombreRepartidor || '').trim().split(/\s+/)[0]
  // "viernes, 25 de septiembre" → "Viernes, 25 de septiembre" (solo la primera letra;
  // la clase `capitalize` ponía "De" y "Septiembre" en mayúscula)
  const fechaHoyTexto = new Date().toLocaleDateString('es-CO', { timeZone: 'America/Bogota', weekday: 'long', day: 'numeric', month: 'long' })
  const fechaHoyLarga = fechaHoyTexto.charAt(0).toUpperCase() + fechaHoyTexto.slice(1)

  return (
    <div className="min-h-full bg-[#F8FAFC]">
      {/* Saludo */}
      <div className="px-4 pt-4">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-[20px] font-bold text-slate-800 leading-tight">Hola{primerNombre ? `, ${primerNombre}` : ''} 👋</div>
            <div className="text-[13px] text-slate-400">{fechaHoyLarga}</div>
          </div>
          <Ayuda modulo="repartidor" />
        </div>

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
                    onIniciar={setPorIniciar} onAbrir={e => setEnCursoId(e.id)} />
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
                    <button onClick={() => descargarActas(item)} disabled={!!descargando} className={ui.btnChico} aria-label="Descargar actas en PDF">
                      {descargando === item.key ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} PDF
                    </button>
                  </div>
                )
              })}
            </div>
          )
        )}
      </div>

      {exito && (
        <EntregaExitosa exito={exito} descargando={descargando === 'exito'}
          onDescargar={() => descargarActas(exito.item)} onCerrar={() => setExito(null)} />
      )}

      {/* Confirmar antes de iniciar (evita toques accidentales) */}
      <ConfirmDialog
        abierto={!!porIniciar}
        titulo={porIniciar?._entrega ? `¿Iniciar esta ${nombreVisita(porIniciar._entrega).toLowerCase()}?` : '¿Iniciar esta entrega?'}
        mensaje={porIniciar ? `${porIniciar.paciente?.nombre || porIniciar.cliente?.nombre} — quedará marcada "En camino".` : ''}
        textoConfirmar="Sí, iniciar"
        onConfirmar={handleIniciar}
        onCancelar={() => setPorIniciar(null)}
      />

      {/* Completar entrega: datos, revisión de los formatos y firmas (FirmaActas) */}
      {modalRegistro && (
        <FirmaActas ordenId={modalRegistro.orden?.id || modalRegistro.orden_id} entregaId={modalRegistro.id}
          titulo={esAccion(modalRegistro) ? `Completar ${nombreVisita(modalRegistro).toLowerCase()}` : 'Completar entrega'}
          {...(esAccion(modalRegistro) ? {
            accion: accionDeEntrega(modalRegistro), plantillaIds: modalRegistro.datos?.plantillas || [],
            ...equiposDelActa(accionDeEntrega(modalRegistro), modalRegistro.datos),
            datosIniciales: { ...(modalRegistro.datos?.datos_acta || {}), motivo: modalRegistro.datos?.motivo },
          } : {})}
          alFirmar={completarEntrega}
          onCancelar={() => setModalRegistro(null)}
          onHecho={resumen => {
            setExito({
              item: { key: 'exito', entrega: modalRegistro, orden: modalRegistro.orden },
              recibidoPor: resumen?.recibidoPor, inicio: modalRegistro.fecha_inicio, fin: new Date().toISOString(),
            })
            setModalRegistro(null); setEnCursoId(null); router.refresh()
          }} />
      )}

      {/* Entrega en curso a pantalla completa */}
      {(() => {
        const e = enCursoId && entregas.find(x => x.id === enCursoId && x.estado?.nombre === 'En progreso')
        if (!e) return null
        return (
          <div className="fixed inset-0 z-50 bg-[#F8FAFC] flex flex-col">
            <div className="flex items-center gap-2 px-3 h-14 bg-white border-b border-slate-200 flex-shrink-0" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
              <button onClick={() => setEnCursoId(null)} className="w-10 h-10 flex items-center justify-center text-slate-500 -ml-1" aria-label="Volver a mis entregas">
                <ChevronLeft size={22} />
              </button>
              <div className="min-w-0">
                <div className="text-[15px] font-bold text-slate-800 truncate">{nombreVisita(e)} en curso</div>
                <div className="text-[12px] text-slate-400 font-mono truncate">{e.orden?.codigo} · {e.codigo}</div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
              <div className="max-w-[560px] mx-auto">
                <EntregaEnCurso entrega={e} onRegistrar={() => abrirCompletar(e)} />
              </div>
            </div>
          </div>
        )
      })()}

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

// "38 min", "1 h 12 min"
function duracion(desde, hasta) {
  if (!desde || !hasta) return null
  const min = Math.max(1, Math.round((new Date(hasta) - new Date(desde)) / 60000))
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ''}`
}

// Al cerrar una entrega: confirmación grande con el tiempo, quién recibió y el acta a un toque
function EntregaExitosa({ exito, descargando, onDescargar, onCerrar }) {
  const { item, recibidoPor, inicio, fin } = exito
  const nombre = nombreVisita(item.entrega)
  const destino = item.orden?.paciente?.nombre || item.orden?.cliente?.nombre || 'Entrega'
  const tiempo = duracion(inicio, fin)
  const datos = [
    tiempo && [`Tiempo de ${nombre.toLowerCase()}`, tiempo, Clock],
    recibidoPor && ['Recibió', recibidoPor, CheckCircle2],
    ['Hora', new Date(fin).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', hour12: true }), Truck],
  ].filter(Boolean)
  return (
    <div className="fixed inset-0 z-[70] bg-black/50 flex items-end md:items-center justify-center md:p-4" role="dialog" aria-modal="true" aria-label="Entrega completada">
      <div className="w-full md:max-w-[420px] bg-white rounded-t-3xl md:rounded-2xl shadow-2xl px-6 pt-8 pb-6 text-center animate-[aparecer_.25s_ease-out]"
        style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom, 24px))' }}>
        <div className="mx-auto w-20 h-20 rounded-full bg-[#ECFDF5] flex items-center justify-center animate-[pop_.4s_ease-out]">
          <div className="w-14 h-14 rounded-full bg-[#0F7B55] text-white flex items-center justify-center"><CheckCircle2 size={32} strokeWidth={2.5} /></div>
        </div>
        <div className="mt-4 text-[20px] font-bold text-slate-800">¡{nombre} completada!</div>
        <div className="mt-1 text-[14px] text-slate-500 truncate">{destino}</div>
        {item.orden?.codigo && <div className="text-[12px] font-mono text-slate-400">{item.orden.codigo}</div>}

        <div className="mt-5 rounded-2xl bg-slate-50 border border-slate-100 divide-y divide-slate-100 text-left">
          {datos.map(([k, v, Icono]) => (
            <div key={k} className="flex items-center gap-3 px-4 py-3">
              <Icono size={16} className="text-[#0F7B55] flex-shrink-0" />
              <span className="text-[13px] text-slate-500 flex-shrink-0">{k}</span>
              <span className="ml-auto text-[14px] font-semibold text-slate-800 truncate text-right">{v}</span>
            </div>
          ))}
        </div>

        <button onClick={onDescargar} disabled={descargando} className={`${ui.btnPrimario} w-full !h-12 mt-5 !text-[14px]`}>
          {descargando ? <><Loader2 size={16} className="animate-spin" /> Generando acta…</> : <><Download size={16} /> Descargar acta</>}
        </button>
        <button onClick={onCerrar} disabled={descargando} className={`${ui.btnSecundario} w-full !h-11 mt-2`}>Listo</button>
      </div>
      <style>{'@keyframes pop{0%{transform:scale(.5);opacity:0}70%{transform:scale(1.08)}100%{transform:scale(1);opacity:1}}@keyframes aparecer{from{transform:translateY(24px);opacity:0}to{transform:none;opacity:1}}'}</style>
    </div>
  )
}

function TarjetaEntrega({ item, saving, hoy, manana, onIniciar, onAbrir }) {
  const orden      = item.orden
  const cliente    = orden?.cliente?.nombre || 'Cliente desconocido'
  const paciente   = orden?.paciente?.nombre || null
  const { direccion, ciudad, telefono, mapsUrl } = destino(orden)
  const accionE    = item.entrega && esAccion(item.entrega) ? item.entrega : null
  const equipos    = accionE ? equiposDeAccion(accionE) : orden?.equipos || []
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
        {accionE && (
          <div className="inline-flex mb-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#F5F3FF] text-[#6D28D9]">{nombreVisita(accionE)}</div>
        )}

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

        {enProgreso && (
          <div className="mt-3 bg-[#E8F7FB]/50 rounded-xl px-3 py-2"><RutaAnimada inicio={item.entrega?.fecha_inicio} compacto /></div>
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
          onClick={() => enProgreso ? onAbrir(item.entrega) : onIniciar(accionE ? { ...orden, _entrega: accionE } : orden)}
          disabled={saving}
          className={`w-full py-3.5 rounded-[12px] text-[15px] font-bold text-white disabled:opacity-50 ${
            enProgreso ? 'bg-[#0E86A0] active:bg-[#0b6f85]' : 'bg-[#D81B43] active:bg-[#B0172F]'}`}>
          {enProgreso ? `Abrir ${accionE ? nombreVisita(accionE).toLowerCase() : 'entrega'} en curso` : `Iniciar ${accionE ? nombreVisita(accionE).toLowerCase() : 'entrega'}`}
        </button>
      </div>
    </article>
  )
}
