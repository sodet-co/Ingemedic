'use client'
import { registrarBitacora } from '@/lib/bitacora'
import { useState, useMemo, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import {
  Package, CheckCircle2, Clock, Truck, X, Search,
  MapPin, Phone, FileText, User, AlertTriangle,
  ArrowUpRight, ArrowDownLeft, Filter, Calendar
} from 'lucide-react'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import LimpiarFiltros from '@/components/ui/LimpiarFiltros'
import BuzonNovedades from '@/components/layout/BuzonNovedades'
import { formatear, soloDia } from '@/lib/fechas'
import FirmaPad from '@/components/entregas/FirmaPad'
import { crearEntrega, finalizarEntrega } from '@/lib/entregas'

const TL_STEPS = ['Programada', 'En ruta', 'Entregada']

// ── CRONÓMETRO ──────────────────────────────────────────────
function calcDuracion(inicio, fin) {
  const ms = (fin ? new Date(fin) : new Date()) - new Date(inicio)
  const h  = Math.floor(ms / 3600000)
  const m  = Math.floor((ms % 3600000) / 60000)
  const s  = Math.floor((ms % 60000) / 1000)
  return `${h ? h + 'h ' : ''}${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`
}

function Cronometro({ inicio, fin, completada }) {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (completada || fin) return
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [completada, fin])
  const dur = calcDuracion(inicio, fin || null)
  return (
    <span className={`inline-flex items-center gap-1.5 text-[12px] font-mono font-semibold px-2.5 py-1 rounded-[7px] ${
      completada || fin
        ? 'bg-[#ECFDF5] text-[#0F7B55]'
        : 'bg-[#FFFBEB] text-[#B45309]'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${completada || fin ? 'bg-[#0F7B55]' : 'bg-[#F59E0B] animate-pulse'}`} />
      ⏱ {dur}
    </span>
  )
}

function TimelineHorizontal({ estadoNombre, inicio, fin, horaProg, alerta }) {
  // Cuando está Completada, TODOS los pasos deben verse como terminados (no solo hasta el penúltimo)
  const idx = estadoNombre === 'Completada' ? TL_STEPS.length : estadoNombre === 'En progreso' ? 1 : 0
  const horas = [
    horaProg || '—',
    formatear(inicio, { day: undefined, month: undefined, year: undefined, hour: '2-digit', minute: '2-digit' }),
    formatear(fin,    { day: undefined, month: undefined, year: undefined, hour: '2-digit', minute: '2-digit' }),
  ]
  return (
    <div className="flex items-start gap-0">
      {TL_STEPS.map((paso, i) => {
        const st = i < idx ? 'done' : i === idx ? 'current' : 'pending'
        const isAlerta = alerta && i === idx
        return (
          <div key={paso} className="flex-1 flex flex-col items-center relative">
            {i > 0 && (
              <div className={`absolute top-[11px] right-1/2 w-full h-0.5 ${
                st === 'done' ? 'bg-[#25A9E0]' : isAlerta ? 'bg-[#D81B43]' : 'bg-slate-200'
              }`} />
            )}
            <div className={`w-6 h-6 rounded-full z-10 flex items-center justify-center flex-shrink-0 border-2 transition-all ${
              st === 'done'    ? 'bg-[#25A9E0] border-[#25A9E0]' :
              isAlerta         ? 'bg-[#D81B43] border-[#D81B43] animate-pulse' :
              st === 'current' ? 'bg-white border-[#25A9E0] shadow-[0_0_0_3px_rgba(37,169,224,0.18)]' :
              'bg-white border-slate-200'
            }`}>
              {st === 'done' && <CheckCircle2 size={11} className="text-white" />}
              {st === 'current' && !isAlerta && <div className="w-2 h-2 bg-[#25A9E0] rounded-full" />}
              {isAlerta && <AlertTriangle size={10} className="text-white" />}
            </div>
            <div className={`text-[9px] font-semibold mt-1 text-center leading-tight ${
              st === 'done' ? 'text-[#25A9E0]' : isAlerta ? 'text-[#D81B43]' : st === 'current' ? 'text-slate-700 font-bold' : 'text-slate-400'
            }`}>{paso}</div>
            <div className="text-[9px] text-slate-400 mt-0.5 text-center">{horas[i]}</div>
          </div>
        )
      })}
    </div>
  )
}

function nombreEquipo(eq) {
  return eq?.tipo_equipo?.atributos?.nombre || eq?.tipo_equipo?.nombre || '—'
}

function estaRetrasada(item) {
  if (!item.fecha_inicio || item.estado?.nombre === 'Completada') return false
  return (new Date() - new Date(item.fecha_inicio)) / 3600000 > 4
}

export default function EntregasClient({ entregasIniciales, ordenesEnReparto, estados, estadosEquipo, empresa }) {
  const router   = useRouter()
  const supabase = createClient()

  const [entregas, setEntregas]           = useState(entregasIniciales)
  // Evita que un refresh disparado por Realtime (que puede llegar con datos de
  // un instante intermedio, o ser un evento atrasado) sobreescriba una
  // actualización local que ACABAMOS de hacer nosotros mismos.
  const skipSyncUntil = useRef(0)
  const [ordenes, setOrdenes]             = useState(ordenesEnReparto)

  // Mantener el estado local sincronizado cuando el servidor manda datos frescos
  // (esto se dispara después de router.refresh(), incluido el que llega por realtime)
  useEffect(() => {
    const t = setTimeout(() => {
      if (Date.now() < skipSyncUntil.current) {
        return
      }
      setEntregas(entregasIniciales)
    }, 0)
    return () => clearTimeout(t)
  }, [entregasIniciales])
  useEffect(() => {
    const t = setTimeout(() => {
      if (Date.now() < skipSyncUntil.current) return
      setOrdenes(ordenesEnReparto)
    }, 0)
    return () => clearTimeout(t)
  }, [ordenesEnReparto])

  // ── SINCRONIZACIÓN EN TIEMPO REAL ─────────────────────────
  // Sin esto, un dispositivo no se entera de cambios hechos en otro
  // (ej. otro repartidor completó una entrega) hasta recargar la página.
  useEffect(() => {
    let debounceTimer = null
    function refrescarConDebounce(origen) {
      clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        if (Date.now() < skipSyncUntil.current) {
          return
        }
        router.refresh()
      }, 500)
    }

    const canal = supabase
      .channel('entregas-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'entregas' }, () => refrescarConDebounce('entregas'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ordenes_servicio' }, () => refrescarConDebounce('ordenes_servicio'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orden_plantillas' }, () => refrescarConDebounce('orden_plantillas'))
      .subscribe()

    return () => { clearTimeout(debounceTimer); supabase.removeChannel(canal) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [search, setSearch]               = useState('')
  const [filtroEstado, setFiltroEstado]   = useState('')
  const [filtroRep, setFiltroRep]         = useState('')
  const [filtroFecha, setFiltroFecha]     = useState('')
  const [filtroCliente, setFiltroCliente] = useState('')
  const [showFiltros, setShowFiltros]     = useState(false)
  const [drawer, setDrawer]               = useState(null)
  const [tab, setTab]                     = useState('activas') // 'activas' | 'historial'
  const [modalExito, setModalExito]       = useState(null)
  const [modalOrden, setModalOrden]       = useState(null)
  const [modalRegistro, setModalRegistro]       = useState(null)
  const [paso, setPaso]                         = useState(0) // 0=nombre, 1..n=docs
  const [saving, setSaving]                     = useState(false)
  const [toast, setToast]                       = useState(null)
  const [regForm, setRegForm]                   = useState({ recibido_por: '', observaciones: '', firmas: {} })
  const [formDirty, setFormDirty]               = useState(false)
  const [confirmarSalirRegistro, setConfirmarSalirRegistro] = useState(false)

  function cerrarRegistro() { setModalRegistro(null); setFormDirty(false) }
  function intentarCerrarRegistro() { if (formDirty) setConfirmarSalirRegistro(true); else cerrarRegistro() }

  function showToast(msg, tipo = 'success') {
    setToast({ msg, tipo })
    setTimeout(() => setToast(null), 3200)
  }

  // Repartidores únicos para filtro
  const repartidores = useMemo(() => {
    const set = new Set()
    ordenes.forEach(o => o.repartidor?.nombre && set.add(o.repartidor.nombre))
    entregas.forEach(e => e.repartidor?.nombre && set.add(e.repartidor.nombre))
    return [...set].sort()
  }, [ordenes, entregas])

  const stats = useMemo(() => ({
    totalHoy:    ordenes.length + entregas.filter(e => e.estado?.nombre === 'En progreso').length,
    pendientes:  ordenes.length,
    enRuta:      entregas.filter(e => e.estado?.nombre === 'En progreso').length,
    completadas: entregas.filter(e => e.estado?.nombre === 'Completada').length,
  }), [entregas, ordenes])

  // Órdenes sin entrega activa
  const ordenesConEntrega = useMemo(() => new Set(entregas.map(e => e.orden_id)), [entregas])

  const porRepartidor = useMemo(() => {
    const todos = [
      ...ordenes.filter(o => !ordenesConEntrega.has(o.id)).map(o => ({
        _tipo: 'pendiente',
        _repartidor: o.repartidor?.nombre || 'Sin asignar',
        _rid: o.repartidor?.id || 'none',
        ...o
      })),
      ...entregas.map(e => ({
        _tipo: 'entrega',
        _repartidor: e.repartidor?.nombre || 'Sin asignar',
        _rid: e.repartidor?.id || 'none',
        ...e
      })),
    ].filter(item => {
      const codigo   = item._tipo === 'pendiente' ? item.codigo : item.orden?.codigo
      const cliente  = item._tipo === 'pendiente' ? item.cliente?.nombre : item.cliente?.nombre
      const estadoN  = item._tipo === 'pendiente' ? 'No iniciada' : item.estado?.nombre
      const fecha    = soloDia(item.fecha_creacion)

      // Filtro por pestaña: Activas = todo lo que no está Completada/Cancelada; Historial = esas dos
      const esFinal = estadoN === 'Completada' || estadoN === 'Cancelada'
      const mTab = tab === 'historial' ? esFinal : !esFinal

      const mq  = !search || [codigo, cliente, item._repartidor].some(v => v?.toLowerCase().includes(search.toLowerCase()))
      const me  = !filtroEstado  || estadoN === filtroEstado
      const mr  = !filtroRep     || item._repartidor === filtroRep
      const mf  = !filtroFecha   || fecha === filtroFecha
      const mc  = !filtroCliente || cliente?.toLowerCase().includes(filtroCliente.toLowerCase())
      return mTab && mq && me && mr && mf && mc
    })

    // Ordenar: En progreso primero, pendiente, completada
    const orden = { 'En progreso': 0, 'No iniciada': 1, 'Completada': 2 }
    todos.sort((a, b) => {
      const ea = a._tipo === 'pendiente' ? 'No iniciada' : a.estado?.nombre
      const eb = b._tipo === 'pendiente' ? 'No iniciada' : b.estado?.nombre
      return (orden[ea] ?? 1) - (orden[eb] ?? 1)
    })

    const grupos = {}
    todos.forEach(item => {
      const key = item._rid
      if (!grupos[key]) grupos[key] = { nombre: item._repartidor, items: [] }
      grupos[key].items.push(item)
    })
    return Object.values(grupos)
  }, [ordenes, entregas, ordenesConEntrega, search, filtroEstado, filtroRep, filtroFecha, filtroCliente, tab])

  // ── INICIAR ENTREGA ──────────────────────────────────────
  async function iniciarEntrega(orden) {
    setSaving(true)
    const { data, error } = await crearEntrega(supabase, orden)
    if (error) { showToast('Error: ' + error.message, 'error'); setSaving(false); return }
    registrarBitacora({ modulo: 'entregas', accion: 'avanzar', entidad: 'entrega', entidad_id: data.id, detalle: { estado: 'iniciada', codigo: orden.codigo } })
    setOrdenes(prev => prev.filter(o => o.id !== orden.id))
    setEntregas(prev => [data, ...prev])
    setSaving(false)
    setModalOrden(null)
    showToast('Entrega iniciada — en ruta 🚚')
    setDrawer(data)
  }

  // ── ABRIR MODAL FIRMA ────────────────────────────────────
  function abrirRegistro(entrega) {
    setModalRegistro(entrega)
    setPaso(0)
    setRegForm({ recibido_por: entrega.recibido_por || '', observaciones: '', firmas: {} })
    setFormDirty(false)
  }

  // ── COMPLETAR ENTREGA ────────────────────────────────────
  async function completarEntrega() {
    if (!regForm.recibido_por?.trim()) { showToast('Ingresa quién recibe', 'error'); return }
    const firmaUnica = regForm.firmas.general || null
    if (!firmaUnica) { showToast('Falta capturar la firma', 'error'); return }
    setSaving(true)

    const recibidoPor = regForm.recibido_por.trim()
    const { error, erroresFirma, cambios } = await finalizarEntrega(supabase, {
      entrega: modalRegistro, recibidoPor, firma: firmaUnica, observaciones: regForm.observaciones, estadosEquipo,
    })
    if (error) { showToast('Error: ' + error.message, 'error'); setSaving(false); return }
    registrarBitacora({ modulo: 'entregas', accion: 'cerrar', entidad: 'entrega', entidad_id: modalRegistro.id, detalle: { codigo: modalRegistro.codigo, tipo: modalRegistro.tipo, recibido_por: recibidoPor } })
    if (erroresFirma > 0) {
      showToast(`Entrega completada, pero ${erroresFirma} firma(s) no se guardaron — revisa permisos de la tabla orden_plantillas`, 'error')
    }

    skipSyncUntil.current = Date.now() + 2500 // protege el estado local por 2.5s tras completar
    setEntregas(prev => prev.map(e => e.id === modalRegistro.id ? { ...e, ...cambios } : e))
    if (drawer?.id === modalRegistro.id) setDrawer(prev => ({ ...prev, ...cambios }))
    setSaving(false)

    // Guardar detalles para el modal de éxito antes de cerrar el wizard
    setModalExito({
      codigo: modalRegistro.codigo,
      ordenCodigo: modalRegistro.orden?.codigo,
      cliente: modalRegistro.orden?.cliente?.nombre || modalRegistro.cliente?.nombre,
      equipos: modalRegistro.orden?.equipos || [],
      recibidoPor,
      duracion: cambios.duracion_minutos,
      fecha: cambios.fecha_completada,
    })
    cerrarRegistro()
    router.refresh()
  }

  // ── GENERAR PDF ACTA DE ENTREGA (con firmas) ─────────────
  async function generarActaEntregaPDF(entrega) {
    // Traer datos frescos incluyendo firmas actualizadas y contenido de plantillas
    const { data: entFresh } = await supabase.from('entregas').select(`
      *,
      detalle_entrega(equipo_id, observaciones_equipo),
      orden:ordenes_servicio(
        id, codigo, fecha_vigencia, observaciones,
        cliente:clientes(id, nombre, tipo_persona, nit_cc, direccion, telefono),
        equipos:orden_equipos(id, equipo:equipos(id, codigo, tipo_equipo:tipos_equipo(id, nombre, atributos))),
        plantillas:orden_plantillas(id, firmado, firmado_por, firma_iniciales, fecha_firma, plantilla:plantillas_orden(id, nombre, contenido))
      ),
      cliente:clientes(id, nombre),
      repartidor:usuarios!entregas_repartidor_id_fkey(id, nombre)
    `).eq('id', entrega.id).single()

    const e = entFresh || entrega
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
    const LOGO_URL = `${SUPABASE_URL}/storage/v1/object/public/logos/logo-ingemedic.png`

    const { default: jsPDF } = await import('jspdf')
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const W = 210, M = 15, CW = W - M * 2
    const HEADER_H = 28
    let logoEndX = M

    try {
      const res  = await fetch(LOGO_URL)
      const blob = await res.blob()
      const b64  = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob) })
      const dims = await new Promise(r => { const img = new window.Image(); img.onload = () => r({ w: img.naturalWidth, h: img.naturalHeight }); img.src = b64 })
      const ratio = HEADER_H / dims.h
      doc.addImage(b64, 'PNG', M + 2, M, dims.w * ratio, HEADER_H)
      logoEndX = M + dims.w * ratio + 6
    } catch { logoEndX = M + 4 }

    doc.setFillColor(216, 27, 67)
    doc.rect(logoEndX, M, W - M - logoEndX, HEADER_H, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(10.5); doc.setFont('helvetica', 'bold')
    doc.text('ACTA DE ENTREGA DE EQUIPOS', logoEndX + 3, M + 9)
    doc.setFontSize(8.5); doc.setFont('helvetica', 'normal')
    doc.text(`N\u00b0 ${e.codigo} · OS: ${e.orden?.codigo || '—'}`, logoEndX + 3, M + 16)
    doc.text(`Fecha: ${formatear(e.fecha_completada)}`, W - M - 2, M + 16, { align: 'right' })
    doc.text(e.tipo === 'retiro' ? 'Retiro' : 'Entrega', logoEndX + 3, M + 23)

    let y = M + HEADER_H + 7

    function seccion(titulo, campos, startY) {
      doc.setFillColor(240, 240, 240)
      doc.rect(M, startY, CW, 6, 'F')
      doc.setTextColor(30, 30, 30); doc.setFontSize(8.5); doc.setFont('helvetica', 'bold')
      doc.text(titulo, M + 2, startY + 4)
      let cy = startY + 9
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5)
      campos.forEach(([label, value]) => {
        doc.setTextColor(100, 100, 100); doc.text(label + ':', M + 2, cy)
        doc.setTextColor(30, 30, 30); doc.text(String(value || '—'), M + 40, cy)
        cy += 5.5
      })
      return cy + 2
    }

    y = seccion('DATOS DEL CLIENTE', [
      ['Cliente',   e.orden?.cliente?.nombre || e.cliente?.nombre],
      ['NIT/CC',    e.orden?.cliente?.nit_cc],
      ['Dirección', e.orden?.cliente?.direccion],
      ['Teléfono',  e.orden?.cliente?.telefono],
    ], y)

    y = seccion('DATOS DE LA ENTREGA', [
      ['Código',       e.codigo],
      ['Repartidor',   e.repartidor?.nombre],
      ['Recibido por', e.recibido_por],
      ['Inicio',       formatear(e.fecha_inicio,     { hour: '2-digit', minute: '2-digit', second: '2-digit' })],
      ['Completada',   formatear(e.fecha_completada, { hour: '2-digit', minute: '2-digit', second: '2-digit' })],
      ['Duración',     e.duracion_minutos ? `${e.duracion_minutos} min` : '—'],
    ], y)

    // Equipos entregados
    const equipos = e.orden?.equipos || []
    if (equipos.length > 0) {
      doc.setFillColor(240, 240, 240)
      doc.rect(M, y, CW, 6, 'F')
      doc.setTextColor(30, 30, 30); doc.setFontSize(8.5); doc.setFont('helvetica', 'bold')
      doc.text(`EQUIPOS ${e.tipo === 'retiro' ? 'RETIRADOS' : 'ENTREGADOS'} (${equipos.length})`, M + 2, y + 4)
      y += 10
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5)
      const detalleEntrega = e.detalle_entrega || []
      equipos.forEach(oe => {
        if (y > 250) { doc.addPage(); y = M }
        const nombre = oe.equipo?.tipo_equipo?.atributos?.nombre || oe.equipo?.tipo_equipo?.nombre || '—'
        const detalle = detalleEntrega.find(d => d.equipo_id === oe.equipo?.id)
        doc.setTextColor(30, 30, 30)
        doc.text(`• ${nombre}`, M + 2, y)
        doc.setTextColor(120, 120, 120)
        doc.text(`Código: ${oe.equipo?.codigo || '—'}`, M + 8, y + 4.5)
        if (detalle?.observaciones_equipo) {
          doc.setTextColor(100, 100, 100)
          const obsLines = doc.splitTextToSize(`Obs: ${detalle.observaciones_equipo}`, CW - 14)
          doc.text(obsLines, M + 8, y + 9)
          y += obsLines.length * 3.8 + 7
        } else {
          y += 10
        }
      })
      y += 2
    }

    if (e.observaciones) {
      y = seccion('OBSERVACIONES', [], y)
      doc.setTextColor(30, 30, 30); doc.setFontSize(8)
      const lines = doc.splitTextToSize(e.observaciones, CW - 4)
      doc.text(lines, M + 2, y)
      y += lines.length * 4.5 + 4
    }

    const docsDeLaOrden = e.orden?.plantillas || []

    // ── CLÁUSULA DE CERTIFICACIÓN — lugar fijo, siempre antes de las firmas ──
    const clausula = empresa?.clausula_certificacion?.trim() ||
      'El firmante certifica y confirma haber leído los documentos anexos dispuestos previo a la firma de los mismos, por lo cual acepta los términos allí contenidos y confirma la entrega de los equipos relacionados en los estados indicados.'

    if (y > 220) { doc.addPage(); y = M }
    doc.setFillColor(255, 251, 235)
    const clausulaLines = doc.splitTextToSize(clausula, CW - 6)
    const clausulaH = clausulaLines.length * 4.2 + 8
    doc.rect(M, y, CW, clausulaH, 'F')
    doc.setDrawColor(245, 158, 11)
    doc.rect(M, y, CW, clausulaH)
    doc.setTextColor(180, 83, 9); doc.setFontSize(7.5); doc.setFont('helvetica', 'bold')
    doc.text('CERTIFICACIÓN', M + 3, y + 5)
    doc.setTextColor(70, 60, 40); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5)
    doc.text(clausulaLines, M + 3, y + 10)
    y += clausulaH + 6

    // Documentos firmados
    const docsFirmados = docsDeLaOrden.filter(p => p.firmado && p.firma_iniciales)
    if (docsFirmados.length > 0 || e.firma_iniciales) {
      if (y > 200) { doc.addPage(); y = M }
      doc.setFillColor(240, 240, 240)
      doc.rect(M, y, CW, 6, 'F')
      doc.setTextColor(30, 30, 30); doc.setFontSize(8.5); doc.setFont('helvetica', 'bold')
      doc.text('FIRMAS', M + 2, y + 4)
      y += 10

      for (const dp of docsFirmados) {
        if (y > 230) { doc.addPage(); y = M }
        doc.setTextColor(30, 30, 30); doc.setFontSize(8.5); doc.setFont('helvetica', 'bold')
        doc.text(dp.plantilla?.nombre || 'Documento', M + 2, y)
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(100, 100, 100)
        doc.text(`Firmado por: ${dp.firmado_por || '—'} · ${dp.fecha_firma ? formatear(dp.fecha_firma, { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''}`, M + 2, y + 4.5)
        try {
          doc.addImage(dp.firma_iniciales, 'PNG', M + 2, y + 7, 55, 20)
        } catch (imgErr) { console.error('Error insertando firma en PDF:', imgErr, dp.plantilla?.nombre) }
        doc.setDrawColor(200, 200, 200)
        doc.line(M + 2, y + 28, M + 60, y + 28)
        y += 34
      }

      // Firma general de recepción (si no está en docs)
      if (e.firma_iniciales && docsFirmados.length === 0) {
        if (y > 230) { doc.addPage(); y = M }
        doc.setTextColor(30, 30, 30); doc.setFontSize(8.5); doc.setFont('helvetica', 'bold')
        doc.text('Firma de recepción', M + 2, y)
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(100, 100, 100)
        doc.text(`Recibido por: ${e.recibido_por || '—'}`, M + 2, y + 4.5)
        try {
          doc.addImage(e.firma_iniciales, 'PNG', M + 2, y + 7, 55, 20)
        } catch {}
        doc.setDrawColor(200, 200, 200)
        doc.line(M + 2, y + 28, M + 60, y + 28)
        y += 34
      }
    }

    // ── ANEXOS — cada plantilla seleccionada se agrega como páginas adicionales ──
    if (docsDeLaOrden.length > 0) {
      const primerEquipo = equipos[0]?.equipo
      const variables = {
        empresa_logo: empresa?.logo_url || '',
        empresa_dir:  empresa?.dir || '',
        empresa_tel:  empresa?.tel || '',
        empresa_email: empresa?.email || '',
        empresa_web:  empresa?.web || '',
        orden_codigo: e.orden?.codigo || '',
        orden_fecha:  e.fecha_completada ? formatear(e.fecha_completada) : '',
        cliente_nombre: e.orden?.cliente?.nombre || '',
        equipo_nombre: primerEquipo?.tipo_equipo?.atributos?.nombre || primerEquipo?.tipo_equipo?.nombre || '',
        equipo_codigo: primerEquipo?.codigo || '',
      }

      for (let i = 0; i < docsDeLaOrden.length; i++) {
        const dp = docsDeLaOrden[i]
        let html = dp.plantilla?.contenido || ''
        if (!html.trim()) continue
        for (const [k, v] of Object.entries(variables)) html = html.replaceAll(`{{${k}}}`, v)

        // Portada del anexo
        doc.addPage()
        doc.setFillColor(27, 58, 107)
        doc.rect(0, 0, W, 30, 'F')
        doc.setTextColor(255, 255, 255); doc.setFontSize(13); doc.setFont('helvetica', 'bold')
        doc.text(`ANEXO ${i + 1}`, M, 18)
        doc.setFontSize(9.5); doc.setFont('helvetica', 'normal')
        doc.text(dp.plantilla?.nombre || 'Documento', M, 25)

        // Renderizar el HTML de la plantilla dentro de un iframe (con <body> real,
        // para que las reglas CSS "body {...}" de la plantilla sí se apliquen) y
        // capturarlo con html2canvas → doc.addImage(). NUNCA usar doc.html() aquí:
        // ese plugin corrompe el stream de contenido de páginas ya dibujadas
        // (confirmado: Chrome/PDFium se niega a renderizar el PDF resultante,
        // aunque la extracción de texto siga funcionando porque el texto en sí
        // no se borra, solo queda el stream inconsistente).
        try {
          const { default: html2canvas } = await import('html2canvas')
          const ANCHO_RENDER = 750

          const iframe = document.createElement('iframe')
          iframe.style.position = 'fixed'
          iframe.style.left = '-9999px'
          iframe.style.top = '0'
          iframe.style.width = `${ANCHO_RENDER}px`
          iframe.style.height = '1px'
          iframe.style.border = 'none'
          document.body.appendChild(iframe)

          const idoc = iframe.contentDocument
          idoc.open()
          idoc.write(html.trim().startsWith('<!DOCTYPE') || html.trim().startsWith('<html')
            ? html
            : `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`)
          idoc.close()

          await new Promise(r => setTimeout(r, 150))

          const alturaReal = Math.max(idoc.body.scrollHeight, idoc.documentElement.scrollHeight)
          iframe.style.height = `${alturaReal}px`

          const canvas = await html2canvas(idoc.body, {
            width: ANCHO_RENDER,
            windowWidth: ANCHO_RENDER,
            height: alturaReal,
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
          })
          document.body.removeChild(iframe)

          const imgData = canvas.toDataURL('image/png')
          const imgHmm = (canvas.height * CW) / canvas.width

          if (imgHmm <= 261 - 36) {
            doc.addImage(imgData, 'PNG', M, 36, CW, imgHmm)
          } else {
            const PAGE_H_MM = 261 - 36
            const pxPerMm = canvas.width / CW
            let renderedPx = 0
            let firstSlice = true
            while (renderedPx < canvas.height) {
              const disponibleMm = firstSlice ? PAGE_H_MM : (297 - 30)
              const sliceHeightPx = Math.min(disponibleMm * pxPerMm, canvas.height - renderedPx)

              const sliceCanvas = document.createElement('canvas')
              sliceCanvas.width = canvas.width
              sliceCanvas.height = sliceHeightPx
              sliceCanvas.getContext('2d').drawImage(
                canvas, 0, renderedPx, canvas.width, sliceHeightPx,
                0, 0, canvas.width, sliceHeightPx
              )
              const sliceData = sliceCanvas.toDataURL('image/png')
              const sliceHmm = (sliceHeightPx * CW) / canvas.width

              if (!firstSlice) doc.addPage()
              doc.addImage(sliceData, 'PNG', M, firstSlice ? 36 : 15, CW, sliceHmm)

              renderedPx += sliceHeightPx
              firstSlice = false
            }
          }
        } catch (htmlErr) {
          console.error('Error renderizando anexo en PDF:', htmlErr, dp.plantilla?.nombre)
          doc.setTextColor(150, 150, 150); doc.setFontSize(9)
          doc.text('No fue posible renderizar este documento.', M, 45)
        }
      }
    }

    // Fecha y hora de generación — esquina inferior derecha de la página 1, para poder
    // verificar cuándo se generó este PDF específico ante cualquier duda de versión/caché.
    doc.setPage(1)
    doc.setFontSize(6.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(180, 180, 180)
    const generadoEl = formatear(new Date().toISOString(), { month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    doc.text(`Generado: ${generadoEl}`, W - M, 290, { align: 'right' })

    doc.save(`Acta_Entrega_${e.codigo}.pdf`)
    showToast('PDF generado')
  }

  // Si el drawer está abierto y esa entrega se actualiza (ej. otro dispositivo la completó),
  // refrescamos su contenido para que el cronómetro se detenga y se vea el estado real
  useEffect(() => {
    if (!drawer) return
    const actualizado = entregas.find(e => e.id === drawer.id)
    if (actualizado && JSON.stringify(actualizado) !== JSON.stringify(drawer)) {
      const t = setTimeout(() => setDrawer(actualizado), 0)
      return () => clearTimeout(t)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entregas])

  const plantillasOrden = modalRegistro?.orden?.plantillas || []
  // Estructura: [0] info recibido_por -> [1..N] previsualización de cada documento -> [N+1] firma única final
  const totalPasos    = plantillasOrden.length + 2
  const esPasoPreview  = paso > 0 && paso <= plantillasOrden.length
  const esPasoFirma    = paso === totalPasos - 1
  const docActual      = esPasoPreview ? plantillasOrden[paso - 1] : null

  const hayFiltros = filtroEstado || filtroRep || filtroFecha || filtroCliente

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Topbar */}
      <div className="h-14 md:h-16 md:bg-white md:border-b md:border-slate-200 flex items-center px-4 md:px-7 flex-shrink-0">
        <div>
          <div className="text-[18px] font-bold text-slate-800">Entregas</div>
          <div className="text-[12px] text-slate-400 mt-0.5">Rutas del día · En tiempo real</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <BuzonNovedades />
          {ordenes.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[#FFFBEB] border border-[#F59E0B]/30 rounded-full">
              <span className="w-2 h-2 rounded-full bg-[#F59E0B] animate-pulse" />
              <span className="text-[12px] font-semibold text-[#B45309]">{ordenes.length} pendiente{ordenes.length !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col p-3 md:p-6 pb-28 md:pb-6 gap-4">
        {/* Stats — en móvil, chips compactos con scroll horizontal (siguen filtrando); en desktop, cards */}
        <div className="flex-shrink-0">
          {/* Móvil: chips */}
          <div className="flex md:hidden gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {[
              { label: 'Total hoy',   value: stats.totalHoy,    color: '#1E293B', f: '' },
              { label: 'Programadas', value: stats.pendientes,  color: '#64748B', f: 'No iniciada' },
              { label: 'En ruta',     value: stats.enRuta,      color: '#B45309', f: 'En progreso' },
              { label: 'Completadas', value: stats.completadas, color: '#0F7B55', f: 'Completada'  },
            ].map(s => (
              <button key={s.label}
                onClick={() => setFiltroEstado(prev => prev === s.f ? '' : s.f)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full border text-[12px] font-medium whitespace-nowrap transition-all ${filtroEstado === s.f && s.f ? 'border-[#D81B43] bg-[#D81B43]/5' : 'border-slate-200 bg-white'}`}>
                <span className="font-extrabold tabular-nums" style={{ color: s.color }}>{s.value}</span>
                <span className="text-slate-500">{s.label}</span>
              </button>
            ))}
          </div>

          {/* Desktop: cards (igual que antes) */}
          <div className="hidden md:grid md:grid-cols-4 gap-3">
            {[
              { label: 'Total hoy',   value: stats.totalHoy,    color: '#1E293B', f: '' },
              { label: 'Programadas', value: stats.pendientes,  color: '#64748B', f: 'No iniciada' },
              { label: 'En ruta',     value: stats.enRuta,      color: '#B45309', f: 'En progreso' },
              { label: 'Completadas', value: stats.completadas, color: '#0F7B55', f: 'Completada'  },
            ].map(s => (
              <div key={s.label}
                onClick={() => setFiltroEstado(prev => prev === s.f ? '' : s.f)}
                className={`bg-white rounded-xl border p-4 shadow-sm cursor-pointer transition-all hover:shadow-md ${filtroEstado === s.f && s.f ? 'border-[#D81B43]' : 'border-slate-200'}`}>
                <div className="text-2xl font-extrabold tabular-nums" style={{ color: s.color }}>{s.value}</div>
                <div className="text-[11.5px] text-slate-400 mt-1">{s.label}</div>
              </div>
            ))}
        </div>
        </div>

        {/* Pestañas: Activas / Historial */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-[10px] w-fit flex-shrink-0">
          {[
            { id: 'activas',   label: 'Activas' },
            { id: 'historial', label: 'Historial' },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-1.5 rounded-[8px] text-[12.5px] font-semibold transition-all ${
                tab === t.id ? 'bg-white text-[#D81B43] shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}>
              {t.label}
              {t.id === 'historial' && stats.completadas > 0 && (
                <span className="ml-1.5 text-[10.5px] text-slate-400">({stats.completadas})</span>
              )}
            </button>
          ))}
        </div>

        {/* Buscador + filtros */}
        <div className="flex items-center gap-3 flex-shrink-0 flex-wrap">
          <div className="relative flex-1 md:max-w-[300px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por código, cliente..."
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-[9px] text-[13px] outline-none focus:border-[#D81B43] bg-white" />
          </div>

          <button onClick={() => setShowFiltros(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 border rounded-[9px] text-[12.5px] font-medium transition-all ${
              hayFiltros ? 'border-[#D81B43] text-[#D81B43] bg-[#D81B43]/5' : 'border-slate-200 text-slate-500 hover:border-slate-300'
            }`}>
            <Filter size={13} /> Filtros {hayFiltros && '•'}
          </button>

          <LimpiarFiltros activo={!!(hayFiltros || search)}
            onLimpiar={() => { setSearch(''); setFiltroEstado(''); setFiltroRep(''); setFiltroFecha(''); setFiltroCliente('') }} />
        </div>

        {/* Panel filtros */}
        {showFiltros && (
          <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-3 flex-shrink-0 shadow-sm">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.07em] text-slate-400 mb-1.5">Repartidor</label>
              <select value={filtroRep} onChange={e => setFiltroRep(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-[8px] text-[13px] outline-none focus:border-[#D81B43] bg-white">
                <option value="">Todos</option>
                {repartidores.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.07em] text-slate-400 mb-1.5">Estado</label>
              <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-[8px] text-[13px] outline-none focus:border-[#D81B43] bg-white">
                <option value="">Todos</option>
                <option value="No iniciada">Programada</option>
                <option value="En progreso">En ruta</option>
                <option value="Completada">Completada</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.07em] text-slate-400 mb-1.5">Fecha</label>
              <input type="date" value={filtroFecha} onChange={e => setFiltroFecha(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-[8px] text-[13px] outline-none focus:border-[#D81B43] bg-white" />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.07em] text-slate-400 mb-1.5">Cliente</label>
              <input value={filtroCliente} onChange={e => setFiltroCliente(e.target.value)}
                placeholder="Nombre cliente..."
                className="w-full px-3 py-2 border border-slate-200 rounded-[8px] text-[13px] outline-none focus:border-[#D81B43] bg-white placeholder:text-slate-400" />
            </div>
          </div>
        )}

        {/* Lista agrupada */}
        <div className="flex-1 overflow-y-auto space-y-5">
          {porRepartidor.length === 0 && (
            <div className="text-center py-16 text-slate-400">
              <Truck className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <div className="font-semibold mb-1">Sin entregas</div>
              <div className="text-[13px]">Las órdenes en reparto aparecerán aquí</div>
            </div>
          )}

          {porRepartidor.map(grupo => {
            const enRuta      = grupo.items.filter(i => i.estado?.nombre === 'En progreso').length
            const completadas = grupo.items.filter(i => i.estado?.nombre === 'Completada').length
            return (
              <div key={grupo.nombre}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-full bg-[#D81B43]/10 flex items-center justify-center text-[12px] font-bold text-[#D81B43] flex-shrink-0">
                    {grupo.nombre.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-[13px] font-bold text-slate-700">{grupo.nombre}</span>
                  <span className="text-[11px] text-slate-400">{grupo.items.length} asignación{grupo.items.length !== 1 ? 'es' : ''}</span>
                  {enRuta > 0 && <span className="text-[11px] font-semibold text-[#25A9E0]">🚚 {enRuta} en ruta</span>}
                  {completadas > 0 && <span className="text-[11px] font-semibold text-[#0F7B55]">✅ {completadas} completada{completadas !== 1 ? 's' : ''}</span>}
                  <div className="flex-1 h-px bg-slate-200 ml-1" />
                </div>

                <div className="space-y-2 ml-2">
                  {grupo.items.map(item => {
                    const esPendiente = item._tipo === 'pendiente'
                    const codigo      = esPendiente ? item.codigo : (item.orden?.codigo || item.codigo)
                    const cliente     = esPendiente ? item.cliente : item.cliente
                    const nEquipos    = esPendiente ? (item.equipos?.length || 0) : (item.orden?.equipos?.length || 0)
                    const estadoN     = esPendiente ? 'No iniciada' : item.estado?.nombre
                    const retrasada   = !esPendiente && estaRetrasada(item)
                    const esRetiro    = item.tipo === 'retiro'
                    const tieneInicio = !esPendiente && item.fecha_inicio

                    return (
                      <div key={item.id}
                        onClick={() => esPendiente ? setModalOrden(item) : setDrawer(item)}
                        className={`bg-white rounded-xl shadow-sm p-4 cursor-pointer transition-all hover:shadow-md ${
                          retrasada
                            ? 'border-l-4 border-l-[#D81B43] border border-t-slate-200 border-r-slate-200 border-b-slate-200'
                            : 'border border-slate-200 hover:border-slate-300'
                        }`}>

                        {/* Fila superior */}
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold ${
                            esRetiro ? 'bg-[#F5F3FF] text-[#6D28D9]' : 'bg-[#E8F7FB] text-[#0E86A0]'
                          }`}>
                            {esRetiro ? <ArrowDownLeft size={10} /> : <ArrowUpRight size={10} />}
                            {esRetiro ? 'Retiro' : 'Entrega'}
                          </span>
                          <span className="font-mono text-[12px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">{codigo}</span>
                          {/* Identificador OS */}
                          {!esPendiente && item.orden?.codigo && item.orden.codigo !== codigo && (
                            <span className="text-[11px] text-slate-400 font-mono">OS: {item.orden.codigo}</span>
                          )}
                          {tieneInicio && (
                            <Cronometro inicio={item.fecha_inicio} fin={item.fecha_completada} completada={estadoN === 'Completada'} />
                          )}
                          {retrasada && (
                            <span className="flex items-center gap-1 text-[11px] font-bold text-[#D81B43] ml-auto">
                              <AlertTriangle size={11} /> ¡Retraso detectado!
                            </span>
                          )}
                        </div>

                        {/* Cliente + equipo */}
                        <div className="mb-3">
                          <div className="text-[13.5px] font-semibold text-slate-700">{cliente?.nombre}</div>
                          <div className="text-[12px] text-slate-400 mt-0.5 flex items-center gap-3 flex-wrap">
                            <span>{nEquipos} equipo{nEquipos !== 1 ? 's' : ''}</span>
                            {(esPendiente ? item.fecha_vigencia : item.orden?.fecha_vigencia) && (
                              <span className="flex items-center gap-1"><Clock size={10} /> Vigencia: {esPendiente ? item.fecha_vigencia : item.orden?.fecha_vigencia}</span>
                            )}
                          </div>
                          {estadoN === 'Completada' && item.recibido_por && (
                            <div className="mt-1 text-[12px] text-[#0F7B55] flex items-center gap-1 font-medium">
                              <CheckCircle2 size={11} /> Recibido por <strong>{item.recibido_por}</strong>
                            </div>
                          )}
                        </div>

                        {/* Timeline */}
                        <TimelineHorizontal
                          estadoNombre={estadoN}
                          inicio={item.fecha_inicio}
                          fin={item.fecha_completada}
                          alerta={retrasada}
                        />

                        {/* Acciones */}
                        <div className="mt-3 flex justify-end gap-2" onClick={e => e.stopPropagation()}>
                          {esPendiente && (
                            <button onClick={() => setModalOrden(item)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#D81B43] text-white text-[12px] font-semibold rounded-[7px] hover:bg-[#B0172F]">
                              <Truck size={12} /> Ver y empezar
                            </button>
                          )}
                          {!esPendiente && estadoN !== 'Completada' && (
                            <button onClick={() => abrirRegistro(item)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0F7B55] text-white text-[12px] font-semibold rounded-[7px] hover:bg-[#0a5c3f]">
                              <CheckCircle2 size={12} /> Registrar entrega
                            </button>
                          )}
                          {estadoN === 'Completada' && (
                            <button onClick={() => setDrawer(item)}
                              className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-500 text-[12px] font-medium rounded-[7px] hover:border-slate-300">
                              Ver detalle
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── MODAL DETALLE ORDEN (antes de iniciar) ── */}
      {modalOrden && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm" onClick={() => setModalOrden(null)} />
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
            <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-[520px] max-h-[92dvh] md:max-h-[calc(100dvh-2rem)] flex flex-col shadow-2xl overflow-hidden"
              onClick={e => e.stopPropagation()}>
              <div className="px-6 py-4 border-b flex items-center justify-between flex-shrink-0 bg-[#D81B43]">
                <div>
                  <div className="text-[11px] text-white/60">Orden de servicio</div>
                  <div className="text-[15px] font-bold text-white font-mono">{modalOrden.codigo}</div>
                </div>
                <button onClick={() => setModalOrden(null)} className="text-white/60 hover:text-white w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20">
                  <X size={16} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 pb-[calc(var(--mobile-nav-space,0px)+16px)] md:pb-0">
                <div className="p-5">
                  <div className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-3">Cliente</div>
                  <div className="space-y-2">
                    {[
                      { icon: <User size={12} />,   label: 'Nombre',    value: modalOrden.cliente?.nombre },
                      { icon: <Phone size={12} />,  label: 'Teléfono',  value: modalOrden.cliente?.telefono },
                      { icon: <MapPin size={12} />, label: 'Dirección', value: modalOrden.cliente?.direccion },
                    ].filter(f => f.value).map(f => (
                      <div key={f.label} className="flex justify-between text-[12.5px]">
                        <span className="text-slate-400 flex items-center gap-1">{f.icon}{f.label}</span>
                        <span className="font-medium text-slate-700 text-right ml-4 max-w-[260px]">{f.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="p-5">
                  <div className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-3">
                    Equipos a entregar ({modalOrden.equipos?.length || 0})
                  </div>
                  <div className="space-y-2">
                    {(modalOrden.equipos || []).map(oe => (
                      <div key={oe.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-[9px] border border-slate-200">
                        <Package size={13} className="text-slate-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-semibold text-slate-700 truncate">{nombreEquipo(oe.equipo)}</div>
                          <div className="text-[11px] font-mono text-slate-400">{oe.equipo?.codigo}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {(modalOrden.plantillas?.length || 0) > 0 && (
                  <div className="p-5">
                    <div className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-3">
                      Documentos a firmar ({modalOrden.plantillas.length})
                    </div>
                    <div className="space-y-2">
                      {modalOrden.plantillas.map(op => (
                        <div key={op.id} className="flex items-center gap-3 p-3 border border-slate-200 rounded-[9px]">
                          <FileText size={13} className="text-slate-400 flex-shrink-0" />
                          <span className="text-[13px] font-medium text-slate-700">{op.plantilla?.nombre || '—'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {modalOrden.observaciones && (
                  <div className="p-5">
                    <div className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-2">Observaciones</div>
                    <div className="text-[13px] text-slate-600 italic">{modalOrden.observaciones}</div>
                  </div>
                )}
                {modalOrden.fecha_vigencia && (
                  <div className="p-5">
                    <div className="flex items-center gap-2 text-[12.5px] text-[#0E86A0] bg-[#E8F7FB] px-3 py-2.5 rounded-[9px]">
                      <Clock size={13} /> Vigencia hasta el <span className="font-bold">{modalOrden.fecha_vigencia}</span>
                    </div>
                  </div>
                )}
              </div>
              <div className="px-6 py-4 border-t border-slate-200 flex gap-2 flex-shrink-0 bg-white">
                <button onClick={() => setModalOrden(null)} className="flex-1 py-2.5 border border-slate-200 rounded-[9px] text-[13px] font-medium text-slate-600 hover:border-slate-300">Cancelar</button>
                <button onClick={() => iniciarEntrega(modalOrden)} disabled={saving}
                  className="flex-1 py-2.5 bg-[#D81B43] text-white rounded-[9px] text-[13px] font-semibold hover:bg-[#B0172F] disabled:opacity-50 flex items-center justify-center gap-2">
                  <Truck size={14} /> {saving ? 'Iniciando...' : 'Iniciar entrega'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── DRAWER DETALLE ENTREGA ── */}
      {drawer && (
        <>
          <div className="fixed inset-0 bg-black/30 z-20 backdrop-blur-sm" onClick={() => setDrawer(null)} />
          <div className="fixed inset-x-0 bottom-0 h-[92vh] rounded-t-2xl md:rounded-none md:inset-x-auto md:top-0 md:right-0 md:bottom-0 md:h-full md:w-[480px] bg-white z-30 flex flex-col shadow-2xl">
            <div className="px-6 py-4 border-b flex items-start justify-between flex-shrink-0 bg-[#D81B43]">
              <div>
                <div className="text-[11px] text-white/60">Entrega · OS: {drawer.orden?.codigo}</div>
                <div className="text-[15px] font-bold text-white font-mono">{drawer.codigo}</div>
                <div className="text-[12px] text-white/60 mt-0.5">{drawer.cliente?.nombre}</div>
              </div>
              <div className="flex items-center gap-2">
                {drawer.estado?.nombre === 'Completada' && (
                  <button onClick={() => generarActaEntregaPDF(drawer)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 text-white text-[12px] font-semibold rounded-[7px] hover:bg-white/30">
                    <FileText size={13} /> Acta PDF
                  </button>
                )}
                <button onClick={() => setDrawer(null)} className="text-white/60 hover:text-white w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20">
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 pb-[calc(var(--mobile-nav-space,0px)+16px)] md:pb-0">
              {/* Timeline + cronómetro */}
              <div className="p-5">
                <TimelineHorizontal
                  estadoNombre={drawer.estado?.nombre || 'No iniciada'}
                  inicio={drawer.fecha_inicio}
                  fin={drawer.fecha_completada}
                  alerta={estaRetrasada(drawer)}
                />
                {drawer.fecha_inicio && (
                  <div className="mt-3">
                    <Cronometro inicio={drawer.fecha_inicio} fin={drawer.fecha_completada} completada={drawer.estado?.nombre === 'Completada'} />
                  </div>
                )}
                {drawer.estado?.nombre !== 'Completada' && (
                  <button onClick={() => { abrirRegistro(drawer); }}
                    className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 bg-[#0F7B55] text-white text-[13px] font-semibold rounded-[9px] hover:bg-[#0a5c3f]">
                    <CheckCircle2 size={14} /> Registrar entrega
                  </button>
                )}
              </div>

              {/* Datos */}
              <div className="p-5">
                <div className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-3">Detalles</div>
                <div className="space-y-2">
                  {[
                    { icon: <User size={12} />,   label: 'Cliente',      value: drawer.cliente?.nombre },
                    { icon: <Phone size={12} />,  label: 'Teléfono',     value: drawer.orden?.cliente?.telefono },
                    { icon: <MapPin size={12} />, label: 'Dirección',    value: drawer.orden?.cliente?.direccion },
                    { icon: <Truck size={12} />,  label: 'Repartidor',   value: drawer.repartidor?.nombre },
                    { icon: <User size={12} />,   label: 'Recibido por', value: drawer.recibido_por },
                    { icon: <Clock size={12} />,  label: 'Vigencia',     value: drawer.orden?.fecha_vigencia },
                  ].filter(f => f.value).map(f => (
                    <div key={f.label} className="flex justify-between text-[12.5px]">
                      <span className="text-slate-400 flex items-center gap-1">{f.icon}{f.label}</span>
                      <span className="font-medium text-slate-700 text-right ml-4 max-w-[240px]">{f.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Equipos */}
              <div className="p-5">
                <div className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-3">
                  Equipos ({drawer.orden?.equipos?.length || 0})
                </div>
                <div className="space-y-2">
                  {(drawer.orden?.equipos || []).map(oe => (
                    <div key={oe.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-[9px] border border-slate-200">
                      <Package size={13} className="text-slate-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold text-slate-700 truncate">{nombreEquipo(oe.equipo)}</div>
                        <div className="text-[11px] font-mono text-slate-400">{oe.equipo?.codigo}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Documentos con estado de firma */}
              <div className="p-5">
                <div className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-3">
                  Documentos ({drawer.orden?.plantillas?.length || 0})
                </div>
                <div className="space-y-2">
                  {(drawer.orden?.plantillas || []).map(op => (
                    <div key={op.id} className="p-3 border border-slate-200 rounded-[9px]">
                      <div className="flex items-center gap-3">
                        <FileText size={13} className="text-slate-400 flex-shrink-0" />
                        <div className="flex-1 text-[13px] font-medium text-slate-700">{op.plantilla?.nombre || '—'}</div>
                        <span className={`text-[11px] font-semibold ${op.firmado ? 'text-[#0F7B55]' : 'text-slate-400'}`}>
                          {op.firmado ? '✓ Firmado' : 'Pendiente'}
                        </span>
                      </div>
                      {/* Vista previa firma */}
                      {op.firma_iniciales && (
                        <div className="mt-2 border border-slate-100 rounded-[7px] overflow-hidden bg-slate-50">
                          <img src={op.firma_iniciales} alt="Firma" className="w-full h-[60px] object-contain" />
                        </div>
                      )}
                    </div>
                  ))}
                  {/* Firma de recepción general */}
                  {drawer.firma_iniciales && (
                    <div className="p-3 border border-[#0F7B55]/20 bg-[#ECFDF5] rounded-[9px]">
                      <div className="text-[11px] font-bold text-[#0F7B55] mb-2">Firma de recepción</div>
                      <img src={drawer.firma_iniciales} alt="Firma recepción" className="w-full h-[70px] object-contain bg-white rounded-[6px] border border-[#0F7B55]/10" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── MODAL WIZARD FIRMA ── */}
      {modalRegistro && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm" onClick={() => !esPasoFirma && intentarCerrarRegistro()} />
          <div className={`fixed z-50 flex ${esPasoFirma ? 'inset-0 md:items-center md:justify-center md:p-4' : 'inset-0 items-center justify-center p-4'}`}>
            <div className={`bg-white flex flex-col shadow-2xl overflow-hidden transition-all ${
              esPasoFirma
                ? 'w-full h-full rounded-none md:w-full md:max-w-[560px] md:h-auto md:max-h-[calc(100vh-2rem)] md:rounded-2xl'
                : 'rounded-2xl w-full max-w-[560px] max-h-[calc(100vh-2rem)]'
            }`}
              onClick={e => e.stopPropagation()}>

              {/* Header */}
              <div className="px-6 py-4 border-b flex items-center gap-3 flex-shrink-0 bg-[#D81B43]">
                <div className="flex-1">
                  <div className="text-[11px] text-white/60">Paso {paso + 1} de {totalPasos}</div>
                  <div className="text-[15px] font-bold text-white">
                    {paso === 0 ? '✍️ Registrar recepción'
                      : esPasoFirma ? '✒️ Firma de recepción'
                      : `Documento: ${docActual?.plantilla?.nombre}`}
                  </div>
                </div>
                <div className="flex gap-1.5">
                  {Array.from({ length: totalPasos }).map((_, i) => (
                    <div key={i} className={`h-2 rounded-full transition-all ${
                      i === paso ? 'w-6 bg-white' : i < paso ? 'w-2 bg-white/60' : 'w-2 bg-white/25'
                    }`} />
                  ))}
                </div>
                {!esPasoFirma && (
                  <button onClick={() => intentarCerrarRegistro()} className="text-white/60 hover:text-white w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20">
                    <X size={16} />
                  </button>
                )}
              </div>

              <div className={`flex-1 overflow-y-auto px-6 py-5 ${esPasoFirma ? 'flex flex-col' : ''}`} onChange={() => setFormDirty(true)}>
                {/* PASO 0 — Nombre receptor */}
                {paso === 0 && (
                  <div className="space-y-4">
                    <div className="bg-slate-50 rounded-[10px] p-4 border border-slate-200">
                      <div className="text-[12px] font-bold text-slate-500 mb-1">Orden: {modalRegistro.orden?.codigo}</div>
                      <div className="text-[13px] font-semibold text-slate-700">{modalRegistro.orden?.cliente?.nombre || modalRegistro.cliente?.nombre}</div>
                      <div className="text-[12px] text-slate-400 mt-0.5">
                        {modalRegistro.orden?.equipos?.length || 0} equipo{(modalRegistro.orden?.equipos?.length || 0) !== 1 ? 's' : ''}
                        {plantillasOrden.length > 0 && ` · ${plantillasOrden.length} documento${plantillasOrden.length !== 1 ? 's' : ''} a firmar`}
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-[0.07em] text-slate-500 mb-1.5">
                        Nombre de quien recibe <span className="text-[#D81B43]">*</span>
                      </label>
                      <input value={regForm.recibido_por}
                        onChange={e => setRegForm(f => ({ ...f, recibido_por: e.target.value }))}
                        placeholder="Nombre completo"
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-[9px] text-[13.5px] outline-none focus:border-[#D81B43] bg-white placeholder:text-slate-400" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-[0.07em] text-slate-500 mb-1.5">Observaciones</label>
                      <textarea value={regForm.observaciones}
                        onChange={e => setRegForm(f => ({ ...f, observaciones: e.target.value }))}
                        placeholder="Notas de la entrega..." rows={3}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-[9px] text-[13.5px] outline-none focus:border-[#D81B43] resize-none placeholder:text-slate-400" />
                    </div>
                  </div>
                )}

                {/* PASOS DE PREVISUALIZACIÓN — solo ver el documento, sin firmar todavía */}
                {esPasoPreview && docActual && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-[12px] text-slate-500 bg-slate-50 px-3 py-2 rounded-[8px] border border-slate-200">
                      <User size={12} /> Firmante: <span className="font-semibold text-slate-700">{regForm.recibido_por}</span>
                    </div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.07em] text-slate-500">Vista previa del documento</div>
                    <div className="border border-slate-200 rounded-[9px] overflow-hidden bg-slate-50 h-[320px] flex items-center justify-center">
                      <div className="text-center text-slate-400">
                        <FileText size={36} className="mx-auto mb-2 opacity-30" />
                        <div className="text-[13.5px] font-medium">{docActual?.plantilla?.nombre}</div>
                        <div className="text-[11px] mt-1">Vista previa disponible en Fase 2</div>
                      </div>
                    </div>
                    <div className="text-[12px] text-slate-400 text-center">
                      Documento {paso} de {plantillasOrden.length} · La firma se recoge al final, una sola vez
                    </div>
                  </div>
                )}

                {/* PASO FINAL — firma única a pantalla completa en móvil */}
                {esPasoFirma && (
                  <div className="flex-1 flex flex-col">
                    <div className="flex items-center gap-2 text-[12px] text-slate-500 bg-slate-50 px-3 py-2 rounded-[8px] border border-slate-200 mb-3 flex-shrink-0">
                      <User size={12} /> Firmante: <span className="font-semibold text-slate-700">{regForm.recibido_por}</span>
                      {plantillasOrden.length > 0 && (
                        <span className="ml-auto text-[11px] text-slate-400">Aplica a {plantillasOrden.length} documento{plantillasOrden.length !== 1 ? 's' : ''}</span>
                      )}
                    </div>
                    <label className="block text-[11px] font-bold uppercase tracking-[0.07em] text-slate-500 mb-2 flex-shrink-0">
                      Firma a mano alzada
                    </label>
                    <div className="flex-1 flex flex-col min-h-0">
                      <FirmaPad
                        fullscreen
                        onFirma={d => setRegForm(f => ({ ...f, firmas: { ...f.firmas, general: d } }))}
                        onLimpiar={() => setRegForm(f => { const nf = { ...f.firmas }; delete nf.general; return { ...f, firmas: nf } })}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="px-6 py-4 border-t border-slate-200 flex justify-between flex-shrink-0 bg-white">
                <button onClick={() => paso > 0 ? setPaso(p => p - 1) : intentarCerrarRegistro()}
                  className="px-4 py-2.5 border border-slate-200 rounded-[9px] text-[13px] font-medium text-slate-600 hover:border-slate-300">
                  {paso === 0 ? 'Cancelar' : '← Anterior'}
                </button>
                <button
                  onClick={() => {
                    if (!regForm.recibido_por?.trim()) { showToast('Ingresa quién recibe', 'error'); return }
                    if (paso < totalPasos - 1) setPaso(p => p + 1)
                    else completarEntrega()
                  }}
                  disabled={saving || (esPasoFirma && !regForm.firmas.general)}
                  className="px-5 py-2.5 bg-[#0F7B55] text-white rounded-[9px] text-[13px] font-semibold hover:bg-[#0a5c3f] disabled:opacity-50">
                  {saving ? 'Guardando...' : paso < totalPasos - 1 ? 'Continuar →' : '✓ Completar entrega'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── MODAL ÉXITO — entrega completada ── */}
      {modalExito && (
        <>
          <div className="fixed inset-0 bg-black/50 z-[80] backdrop-blur-sm" onClick={() => setModalExito(null)} />
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-[420px] shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="px-6 pt-8 pb-6 text-center bg-gradient-to-b from-[#ECFDF5] to-white">
                <div className="w-16 h-16 rounded-full bg-[#0F7B55] flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[#0F7B55]/20">
                  <CheckCircle2 size={32} className="text-white" />
                </div>
                <div className="text-[17px] font-bold text-slate-800">Entrega completada exitosamente</div>
                <div className="text-[12.5px] text-slate-400 mt-1 font-mono">{modalExito.codigo} · OS: {modalExito.ordenCodigo}</div>
              </div>

              <div className="px-6 py-5 space-y-3 border-t border-slate-100">
                <div className="flex justify-between text-[13px]">
                  <span className="text-slate-400">Cliente</span>
                  <span className="font-semibold text-slate-700">{modalExito.cliente}</span>
                </div>
                <div className="flex justify-between text-[13px]">
                  <span className="text-slate-400">Recibido por</span>
                  <span className="font-semibold text-slate-700">{modalExito.recibidoPor}</span>
                </div>
                <div className="flex justify-between text-[13px]">
                  <span className="text-slate-400">Duración</span>
                  <span className="font-semibold text-slate-700">{modalExito.duracion} min</span>
                </div>
                <div className="flex justify-between text-[13px]">
                  <span className="text-slate-400">Equipos entregados</span>
                  <span className="font-semibold text-slate-700">{modalExito.equipos.length}</span>
                </div>
                {modalExito.equipos.length > 0 && (
                  <div className="pt-2 space-y-1.5">
                    {modalExito.equipos.map(oe => (
                      <div key={oe.id} className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-[8px] text-[12px] text-slate-600">
                        <Package size={12} className="text-slate-400 flex-shrink-0" />
                        <span className="truncate">{nombreEquipo(oe.equipo)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Fase 2 — envío por correo (deshabilitado por ahora) */}
              <div className="px-6 pb-5">
                <button disabled
                  className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-slate-200 text-slate-350 text-[12.5px] font-medium rounded-[9px] cursor-not-allowed opacity-60">
                  ✉️ Enviar soporte por correo <span className="text-[10.5px]">(próximamente)</span>
                </button>
              </div>

              <div className="px-6 pb-6">
                <button onClick={() => setModalExito(null)}
                  className="w-full py-2.5 bg-[#0F7B55] text-white rounded-[9px] text-[13.5px] font-semibold hover:bg-[#0a5c3f] transition-colors">
                  Listo
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {toast && (
        <div className={`fixed bottom-28 md:bottom-6 right-4 md:right-6 left-4 md:left-auto text-center md:text-left z-[70] px-4 py-3 rounded-[10px] text-[13px] font-medium text-white shadow-lg ${toast.tipo === 'error' ? 'bg-red-500' : 'bg-[#0F7B55]'}`}>
          {toast.msg}
        </div>
      )}

      <ConfirmDialog
        abierto={confirmarSalirRegistro}
        titulo="¿Descartar cambios?"
        mensaje="Tienes cambios sin guardar. ¿Deseas salir sin guardar?"
        textoConfirmar="Sí, salir"
        textoCancelar="Seguir editando"
        tipo="default"
        onConfirmar={() => { setConfirmarSalirRegistro(false); cerrarRegistro() }}
        onCancelar={() => setConfirmarSalirRegistro(false)}
      />
    </div>
  )
}