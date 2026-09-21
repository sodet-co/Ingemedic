'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { registrarBitacora } from '@/lib/bitacora'
import { formatear } from '@/lib/fechas'
import { crearEntrega, finalizarEntrega } from '@/lib/entregas'
import FirmaPad from '@/components/entregas/FirmaPad'
import {
  Package, MapPin, Clock, User, CheckCircle2, Truck, Phone, X,
} from 'lucide-react'

function nombreEquipo(eq) {
  return eq?.tipo_equipo?.atributos?.nombre || eq?.tipo_equipo?.nombre || '—'
}

// Vista de Entregas dedicada al rol Repartidor — mobile-first, una tarjeta grande
// por entrega, sin los filtros/tabla/gestión completa que tiene la vista de admin
// (EntregasClient.js). Reutiliza la misma lógica de negocio (crearEntrega,
// finalizarEntrega, FirmaPad) desde los módulos compartidos — solo cambia el
// contenedor visual.
export default function EntregasRepartidorClient({ entregasIniciales, ordenesAsignadas, estadosEquipo }) {
  const router = useRouter()
  const supabase = createClient()

  const [entregas, setEntregas] = useState(entregasIniciales)
  // Evita que un refresh disparado por Realtime (que puede llegar con datos de
  // un instante intermedio, o ser un evento atrasado) sobreescriba una
  // actualización local que ACABAMOS de hacer nosotros mismos — mismo patrón
  // que EntregasClient.js. Sin esto, el router.refresh() manual de
  // handleCompletar y el que dispara Realtime (que escucha 'entregas' Y
  // 'ordenes_servicio', ambas tocadas por finalizarEntrega) chocan casi al
  // mismo tiempo.
  const skipSyncUntil = useRef(0)
  const [ordenes, setOrdenes]   = useState(ordenesAsignadas)
  const [saving, setSaving]     = useState(false)
  const [toast, setToast]       = useState(null)
  const [tab, setTab]           = useState('activas') // 'activas' | 'completadas'
  const [modalRegistro, setModalRegistro] = useState(null)
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

  const { activas, completadas } = useMemo(() => {
    const pendientes = ordenes.map(o => ({
      key: `orden-${o.id}`, _tipo: 'pendiente', orden: o,
      fechaHora: o.fecha_entrega,
    }))
    const enProgreso = entregas
      .filter(e => e.estado?.nombre === 'En progreso')
      .map(e => ({
        key: `entrega-${e.id}`, _tipo: 'en_progreso', entrega: e, orden: e.orden,
        fechaHora: e.orden?.fecha_entrega || e.fecha_inicio,
      }))
    const completas = entregas
      .filter(e => e.estado?.nombre === 'Completada')
      .map(e => ({
        key: `entrega-${e.id}`, _tipo: 'completada', entrega: e, orden: e.orden,
        fechaHora: e.fecha_completada,
      }))

    return {
      activas: [...pendientes, ...enProgreso].sort((a, b) => new Date(a.fechaHora || 0) - new Date(b.fechaHora || 0)),
      completadas: completas.sort((a, b) => new Date(b.fechaHora || 0) - new Date(a.fechaHora || 0)),
    }
  }, [ordenes, entregas])

  async function handleIniciar(orden) {
    setSaving(true)
    const { data, error } = await crearEntrega(supabase, orden)
    if (error) { showToast('Error: ' + error.message, 'error'); setSaving(false); return }
    registrarBitacora({ modulo: 'entregas', accion: 'avanzar', entidad: 'entrega', entidad_id: data.id, detalle: { estado: 'iniciada', codigo: orden.codigo } })
    setOrdenes(prev => prev.filter(o => o.id !== orden.id))
    setEntregas(prev => [data, ...prev])
    setSaving(false)
    showToast('Entrega iniciada — en ruta 🚚')
  }

  function abrirCompletar(entrega) {
    setModalRegistro(entrega)
    setRegForm({ recibido_por: entrega.recibido_por || '', observaciones: '', firmas: {} })
  }

  async function handleCompletar() {
    if (!regForm.recibido_por?.trim()) { showToast('Ingresa quién recibe', 'error'); return }
    const firma = regForm.firmas.general || null
    if (!firma) { showToast('Falta capturar la firma', 'error'); return }
    setSaving(true)

    const recibidoPor = regForm.recibido_por.trim()
    const { error, erroresFirma, cambios } = await finalizarEntrega(supabase, {
      entrega: modalRegistro, recibidoPor, firma, observaciones: regForm.observaciones, estadosEquipo,
    })
    if (error) { showToast('Error: ' + error.message, 'error'); setSaving(false); return }
    registrarBitacora({ modulo: 'entregas', accion: 'cerrar', entidad: 'entrega', entidad_id: modalRegistro.id, detalle: { codigo: modalRegistro.codigo, recibido_por: recibidoPor } })
    if (erroresFirma > 0) {
      showToast(`Entrega completada, pero ${erroresFirma} firma(s) no se guardaron`, 'error')
    }

    skipSyncUntil.current = Date.now() + 2500 // protege el estado local por 2.5s tras completar
    setEntregas(prev => prev.map(e => e.id === modalRegistro.id ? { ...e, ...cambios } : e))
    setSaving(false)
    setModalRegistro(null)
    showToast('¡Entrega completada!')
    router.refresh()
  }

  const listaActual = tab === 'activas' ? activas : completadas

  return (
    <div className="flex flex-col h-full bg-[#F8FAFC]">
      <div className="px-4 pt-4 pb-2 flex-shrink-0">
        <div className="text-[17px] font-bold text-slate-800">Mis entregas</div>
        <div className="flex bg-slate-100 rounded-[9px] p-1 gap-1 mt-3">
          {[['activas', `Activas (${activas.length})`], ['completadas', `Completadas (${completadas.length})`]].map(([v, l]) => (
            <button key={v} onClick={() => setTab(v)}
              className={`flex-1 py-2 rounded-[7px] text-[12.5px] font-semibold transition-all ${
                tab === v ? 'bg-white text-[#1B3A6B] shadow-sm' : 'text-slate-500'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-3">
        {listaActual.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <Truck className="w-14 h-14 mx-auto mb-3 opacity-20" />
            <div className="font-semibold text-[14px] mb-1">
              {tab === 'activas' ? 'Sin entregas asignadas' : 'Sin entregas completadas aún'}
            </div>
            <div className="text-[12.5px]">
              {tab === 'activas' ? 'Las nuevas entregas aparecerán aquí' : 'Aquí verás tu historial'}
            </div>
          </div>
        ) : listaActual.map(item => (
          <TarjetaEntrega key={item.key} item={item} saving={saving}
            onIniciar={handleIniciar} onCompletar={abrirCompletar} />
        ))}
      </div>

      {/* Modal completar entrega — firma + quién recibe */}
      {modalRegistro && (
        <>
          <div className="fixed inset-0 bg-black/50 z-[60]" onClick={() => setModalRegistro(null)} />
          <div className="fixed inset-x-0 bottom-0 z-[60] bg-white rounded-t-2xl shadow-2xl max-h-[92vh] flex flex-col">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
              <div className="text-[15px] font-bold text-slate-800">Completar entrega</div>
              <button onClick={() => setModalRegistro(null)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-[0.07em] text-slate-500 mb-1.5">Recibido por <span className="text-[#D81B43]">*</span></label>
                <input value={regForm.recibido_por} onChange={e => setRegForm(f => ({ ...f, recibido_por: e.target.value }))}
                  placeholder="Nombre de quién recibe"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-[9px] text-[14px] outline-none focus:border-[#D81B43]" />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-[0.07em] text-slate-500 mb-1.5">Observaciones</label>
                <textarea value={regForm.observaciones} onChange={e => setRegForm(f => ({ ...f, observaciones: e.target.value }))}
                  rows={2} placeholder="Opcional"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-[9px] text-[14px] outline-none focus:border-[#D81B43] resize-none" />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-[0.07em] text-slate-500 mb-1.5">Firma <span className="text-[#D81B43]">*</span></label>
                <FirmaPad
                  onFirma={dataUrl => setRegForm(f => ({ ...f, firmas: { general: dataUrl } }))}
                  onLimpiar={() => setRegForm(f => ({ ...f, firmas: {} }))}
                />
              </div>
            </div>
            <div className="p-5 border-t border-slate-100 flex-shrink-0">
              <button onClick={handleCompletar} disabled={saving}
                className="w-full py-3.5 bg-[#0F7B55] text-white rounded-[10px] text-[15px] font-bold hover:bg-[#0c6444] disabled:opacity-50">
                {saving ? 'Guardando...' : '✓ Confirmar entrega'}
              </button>
            </div>
          </div>
        </>
      )}

      {toast && (
        <div className={`fixed bottom-6 left-4 right-4 z-[70] px-4 py-3 rounded-[10px] text-[13px] font-medium text-white shadow-lg text-center ${toast.tipo === 'error' ? 'bg-red-500' : 'bg-[#0F7B55]'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}

function TarjetaEntrega({ item, saving, onIniciar, onCompletar }) {
  const orden      = item.orden
  const cliente     = orden?.cliente?.nombre || 'Cliente desconocido'
  const paciente    = orden?.paciente?.nombre || null
  const direccion   = orden?.paciente?.direccion || orden?.cliente?.direccion || 'Sin dirección registrada'
  const telefono    = orden?.paciente?.telefono || orden?.cliente?.telefono
  const equipos     = orden?.equipos || []
  const enProgreso  = item._tipo === 'en_progreso'
  const completada  = item._tipo === 'completada'

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-1.5 text-[12px] font-bold text-slate-400">
          <Clock size={13} />
          {item.fechaHora ? formatear(item.fechaHora, { hour: '2-digit', minute: '2-digit' }) : 'Sin hora programada'}
        </div>
        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold flex-shrink-0 ${
          completada ? 'bg-[#ECFDF5] text-[#0F7B55]' : enProgreso ? 'bg-[#E8F7FB] text-[#0E86A0]' : 'bg-[#FFFBEB] text-[#B45309]'
        }`}>
          {completada ? <CheckCircle2 size={11} /> : <Truck size={11} />}
          {completada ? 'Completada' : enProgreso ? 'En camino' : 'Por iniciar'}
        </span>
      </div>

      <div className="text-[16px] font-bold text-slate-800 leading-tight">{cliente}</div>
      {paciente && (
        <div className="flex items-center gap-1.5 text-[13px] text-slate-500 mt-1">
          <User size={13} className="text-slate-400 flex-shrink-0" /> {paciente}
        </div>
      )}
      <div className="flex items-start gap-1.5 text-[13px] text-slate-500 mt-1">
        <MapPin size={13} className="text-slate-400 flex-shrink-0 mt-0.5" /> {direccion}
      </div>
      {telefono && (
        <div className="flex items-center gap-1.5 text-[13px] text-slate-500 mt-1">
          <Phone size={13} className="text-slate-400 flex-shrink-0" /> {telefono}
        </div>
      )}

      {equipos.length > 0 && (
        <div className="flex items-center gap-1.5 text-[12px] text-slate-400 mt-2 pt-2 border-t border-slate-100">
          <Package size={13} className="flex-shrink-0" />
          {equipos.map(oe => nombreEquipo(oe.equipo)).join(', ')}
        </div>
      )}

      {!completada && (
        <button
          onClick={() => item._tipo === 'pendiente' ? onIniciar(orden) : onCompletar(item.entrega)}
          disabled={saving}
          className={`w-full mt-3 py-3 rounded-[10px] text-[14px] font-bold text-white disabled:opacity-50 ${
            enProgreso ? 'bg-[#0F7B55] hover:bg-[#0c6444]' : 'bg-[#D81B43] hover:bg-[#B0172F]'}`}>
          {enProgreso ? 'Completar entrega' : 'Iniciar entrega'}
        </button>
      )}
    </div>
  )
}
