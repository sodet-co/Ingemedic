'use client'
import { registrarBitacora } from '@/lib/bitacora'
import { useState, useMemo, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import {
  Package, CheckCircle2, Clock, Truck, X, Search,
  MapPin, Phone, FileText, User, AlertTriangle,
  ArrowUpRight, ArrowDownLeft, Filter, Calendar, Lock, Loader2
} from 'lucide-react'
import LimpiarFiltros from '@/components/ui/LimpiarFiltros'
import EncabezadoModulo from '@/components/ui/EncabezadoModulo'
import Modal from '@/components/ui/Modal'
import { ui } from '@/lib/ui'
import { formatear, soloDia, hoyBogota } from '@/lib/fechas'
import FirmaActas from '@/components/actas/FirmaActas'
import { capturarHTML } from '@/lib/capturar'
import ActasPrestamo from '@/components/actas/ActasPrestamo'
import VentanaDetalle, { Columnas, EncabezadoDetalle } from '@/components/ui/VentanaDetalle'
import EntregaEnCurso, { RutaAnimada } from '@/components/entregas/EntregaEnCurso'
import DescargarActas from '@/components/actas/DescargarActas'
import { crearEntrega, finalizarEntrega } from '@/lib/entregas'
import { completarAccion, iniciarAccion, accionDeEntrega, equiposDelActa, NOMBRE_ACCION, nombreVisita } from '@/lib/accionesPrestamo'
import { useUsuarioActual } from '@/lib/usuario-context'

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
                st === 'done' ? 'bg-[#2EB5D4]' : isAlerta ? 'bg-[#D81B43]' : 'bg-slate-200'
              }`} />
            )}
            <div className={`w-6 h-6 rounded-full z-10 flex items-center justify-center flex-shrink-0 border-2 transition-all ${
              st === 'done'    ? 'bg-[#2EB5D4] border-[#2EB5D4]' :
              isAlerta         ? 'bg-[#D81B43] border-[#D81B43] animate-pulse' :
              st === 'current' ? 'bg-white border-[#2EB5D4] shadow-[0_0_0_3px_rgba(37,169,224,0.18)]' :
              'bg-white border-slate-200'
            }`}>
              {st === 'done' && <CheckCircle2 size={11} className="text-white" />}
              {st === 'current' && !isAlerta && <div className="w-2 h-2 bg-[#2EB5D4] rounded-full" />}
              {isAlerta && <AlertTriangle size={10} className="text-white" />}
            </div>
            <div className={`text-[9px] font-semibold mt-1 text-center leading-tight ${
              st === 'done' ? 'text-[#2EB5D4]' : isAlerta ? 'text-[#D81B43]' : st === 'current' ? 'text-slate-700 font-bold' : 'text-slate-400'
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

// Recogida, recarga o cambio (lib/accionesPrestamo.js); 'entrega' es la del préstamo
const esAccion = e => !!e?.tipo && e.tipo !== 'entrega'
// Equipos de una acción, con la forma de orden_equipos para pintarlos igual
const equiposDeAccion = e => e.tipo === 'cambio'
  ? (e.datos?.cambios || []).map(c => ({ id: c.orden_equipo_id, equipo: c.entra, sale: c.sale }))
  : (e.datos?.equipos || []).map(x => ({ id: x.orden_equipo_id, equipo: x.equipo }))

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
  const [verCompletadas, setVerCompletadas] = useState('hoy') // 'hoy' | 'todas' (columna Completadas)
  const [modalExito, setModalExito]       = useState(null)
  const [modalOrden, setModalOrden]       = useState(null)
  const [modalRegistro, setModalRegistro]       = useState(null) // entrega que se está firmando (FirmaActas)
  const [saving, setSaving]                     = useState(false)
  const [toast, setToast]                       = useState(null)

  function cerrarRegistro() { setModalRegistro(null) }

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
    pendientes:  ordenes.length + entregas.filter(e => esAccion(e) && e.modo !== 'oficina' && e.estado?.nombre === 'No iniciada').length,
    enRuta:      entregas.filter(e => e.estado?.nombre === 'En progreso').length,
    completadas: entregas.filter(e => e.estado?.nombre === 'Completada').length,
  }), [entregas, ordenes])

  // Órdenes sin entrega activa
  const ordenesConEntrega = useMemo(() => new Set(entregas.filter(e => !esAccion(e)).map(e => e.orden_id)), [entregas])

  // Tablero: Por iniciar → En ruta → Completadas. Antes eran dos pestañas
  // (Activas / Historial) con todo mezclado por repartidor; ahora el flujo se ve
  // de izquierda a derecha y lo completado de otros días queda en "Historial"
  // dentro de su misma columna.
  const carriles = useMemo(() => {
    const hoy = hoyBogota()
    const pasa = item => {
      const codigo  = item._tipo === 'pendiente' ? item.codigo : item.orden?.codigo
      const fecha   = soloDia(item.fecha_creacion)
      return (!search || [codigo, item.codigo, item.cliente?.nombre, item.orden?.paciente?.nombre, item.paciente?.nombre, item._repartidor].some(v => v?.toLowerCase().includes(search.toLowerCase())))
        && (!filtroRep || item._repartidor === filtroRep)
        && (!filtroFecha || fecha === filtroFecha || soloDia(item.fecha_completada) === filtroFecha)
        && (!filtroCliente || item.cliente?.nombre?.toLowerCase().includes(filtroCliente.toLowerCase()))
    }
    const conRep = (x, tipo) => ({ ...x, _tipo: tipo, _repartidor: x.repartidor?.nombre || 'Sin asignar' })
    // Las acciones hechas en oficina no pasan por el tablero
    const visibles = entregas.filter(e => e.modo !== 'oficina')
    const porIniciar = [
      ...ordenes.filter(o => !ordenesConEntrega.has(o.id)).map(o => conRep(o, 'pendiente')),
      ...visibles.filter(e => esAccion(e) && e.estado?.nombre === 'No iniciada').map(e => conRep(e, 'accion')),
    ].filter(pasa)
      .sort((a, b) => new Date(a.fecha_entrega || a.fecha_programada || 0) - new Date(b.fecha_entrega || b.fecha_programada || 0))
    const enRuta = visibles.filter(e => e.estado?.nombre === 'En progreso').map(e => conRep(e, 'entrega')).filter(pasa)
      .sort((a, b) => new Date(a.fecha_inicio || 0) - new Date(b.fecha_inicio || 0))
    const completadasTodas = visibles.filter(e => e.estado?.nombre === 'Completada').map(e => conRep(e, 'entrega')).filter(pasa)
      .sort((a, b) => new Date(b.fecha_completada || 0) - new Date(a.fecha_completada || 0))
    const completadasHoy = completadasTodas.filter(e => soloDia(e.fecha_completada) === hoy)
    return { porIniciar, enRuta, completadasHoy, completadasTodas }
  }, [ordenes, entregas, ordenesConEntrega, search, filtroRep, filtroFecha, filtroCliente])

  // ── INICIAR ENTREGA ──────────────────────────────────────
  // Iniciar es cosa del repartidor (lo hace desde su vista, EntregasRepartidorClient).
  // En esta vista de administración solo SuperAdmin puede hacerlo; el resto ve
  // la orden pero no la arranca.
  const { esSuperAdmin } = useUsuarioActual()
  const puedeIniciar = esSuperAdmin
  async function iniciarEntrega(orden) {
    if (!puedeIniciar) { showToast('Solo el repartidor puede iniciar la entrega', 'error'); return }
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

  // Recogida, recarga o cambio programado: arranca sin tocar el préstamo
  async function iniciarAccionLista(item) {
    if (!puedeIniciar) { showToast('Solo el repartidor puede iniciarla', 'error'); return }
    setSaving(true)
    const { data, error } = await iniciarAccion(supabase, item)
    setSaving(false)
    if (error) { showToast('Error: ' + error.message, 'error'); return }
    const actualizada = { ...item, ...data, estado: { nombre: 'En progreso' } }
    setEntregas(prev => prev.map(e => e.id === item.id ? actualizada : e))
    setDrawer(actualizada)
    showToast(`${nombreVisita(item)} iniciada`)
  }

  // ── REGISTRAR ENTREGA: paso de firma de actas (components/actas/FirmaActas.js) ──
  function abrirRegistro(entrega) {
    setModalRegistro(entrega)
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
      if (drawer?.id === entrega.id) setDrawer(prev => ({ ...prev, ...cambios }))
      setModalExito({
        titulo: nombreVisita(entrega), codigo: entrega.codigo, ordenCodigo: entrega.orden?.codigo,
        cliente: entrega.orden?.cliente?.nombre || entrega.cliente?.nombre, equipos: equiposDeAccion(entrega),
        recibidoPor, duracion: cambios.duracion_minutos, fecha: cambios.fecha_completada,
      })
      return null
    }
    const { error, erroresFirma, cambios } = await finalizarEntrega(supabase, {
      entrega, recibidoPor, firma, observaciones, estadosEquipo,
    })
    if (error) return error
    registrarBitacora({ modulo: 'entregas', accion: 'cerrar', entidad: 'entrega', entidad_id: entrega.id, detalle: { codigo: entrega.codigo, tipo: entrega.tipo, recibido_por: recibidoPor } })
    if (erroresFirma > 0) {
      showToast(`Entrega completada, pero ${erroresFirma} firma(s) no se guardaron — revisa permisos de la tabla orden_plantillas`, 'error')
    }

    skipSyncUntil.current = Date.now() + 2500 // protege el estado local por 2.5s tras completar
    setEntregas(prev => prev.map(e => e.id === entrega.id ? { ...e, ...cambios } : e))
    if (drawer?.id === entrega.id) setDrawer(prev => ({ ...prev, ...cambios }))
    setModalExito({
      codigo: entrega.codigo,
      ordenCodigo: entrega.orden?.codigo,
      cliente: entrega.orden?.cliente?.nombre || entrega.cliente?.nombre,
      equipos: entrega.orden?.equipos || [],
      recibidoPor,
      duracion: cambios.duracion_minutos,
      fecha: cambios.fecha_completada,
    })
    return null
  }

  // Acta en PDF: las actas firmadas del préstamo (DescargarActas: juntas o por
  // separado); las entregas de antes de las actas por cliente siguen saliendo con
  // el formato viejo (generarActaEntregaPDF)
  async function actasDeEntrega(entrega) {
    // Una recogida, recarga o cambio: solo sus actas; la entrega: las del préstamo
    let q = supabase.from('actas').select('id, nombre, bloques, datos, firma_recibe, firma_entrega')
    q = esAccion(entrega) ? q.eq('entrega_id', entrega.id) : q.eq('orden_id', entrega.orden?.id || entrega.orden_id).eq('accion', 'prestamo')
    const { data, error } = await q.order('fecha_firma')
    if (error) throw error
    return data || []
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
        equipos:orden_equipos(id, fecha_devolucion, equipo:equipos(id, codigo, tipo_equipo:tipos_equipo(id, nombre, atributos))),
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
          // lib/capturar.js: iframe aparte y texto dibujado por el navegador
          const canvas = await capturarHTML(html, { ancho: 750 })

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


  const hayFiltros = filtroEstado || filtroRep || filtroFecha || filtroCliente

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <EncabezadoModulo titulo="Entregas" subtitulo="Rutas del día · en tiempo real" ayuda="entregas"
        acciones={ordenes.length > 0 && (
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-[#F59E0B]/30 rounded-full">
            <span className="w-2 h-2 rounded-full bg-[#F59E0B] animate-pulse" />
            <span className="text-[12px] font-semibold text-[#B45309]">{ordenes.length} por iniciar</span>
          </div>
        )} />

      <div className="flex-1 overflow-hidden flex flex-col p-3 md:p-6 gap-4">
        {/* Buscador + filtros */}
        <div className="flex items-center gap-3 flex-shrink-0 flex-wrap">
          <div className="relative flex-1 md:max-w-[300px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por código, cliente..."
              className="w-full pl-9 pr-4 h-[38px] border border-slate-200 rounded-[9px] text-[13px] text-slate-800 bg-white outline-none focus:border-[#D81B43] focus:ring-2 focus:ring-[#D81B43]/10 placeholder:text-slate-400" />
          </div>

          <button onClick={() => setShowFiltros(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 border rounded-[9px] text-[12.5px] font-medium transition-all ${
              hayFiltros ? 'border-[#D81B43] text-[#D81B43] bg-[#D81B43]/5' : 'border-slate-200 text-slate-500 hover:border-slate-300'
            }`}>
            <Filter size={13} /> Filtros {hayFiltros && '•'}
          </button>

          <LimpiarFiltros activo={!!(hayFiltros || search)}
            onLimpiar={() => { setSearch(''); setFiltroRep(''); setFiltroFecha(''); setFiltroCliente('') }} />
        </div>

        {/* Panel filtros */}
        {showFiltros && (
          <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 flex-shrink-0 shadow-sm">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.07em] text-slate-400 mb-1.5">Repartidor</label>
              <select value={filtroRep} onChange={e => setFiltroRep(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-[8px] text-[13px] outline-none focus:border-[#D81B43] bg-white">
                <option value="">Todos</option>
                {repartidores.map(r => <option key={r} value={r}>{r}</option>)}
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

        {/* Tablero: Por iniciar → En ruta → Completadas */}
        <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-5">
          {[
            { id: 'porIniciar', titulo: 'Por iniciar', items: carriles.porIniciar, color: '#64748B', vacio: 'Nada programado por iniciar' },
            { id: 'enRuta', titulo: 'En ruta', items: carriles.enRuta, color: '#0E86A0', vacio: 'Nadie en ruta ahora' },
            { id: 'completadas', titulo: 'Completadas', items: verCompletadas === 'hoy' ? carriles.completadasHoy : carriles.completadasTodas, color: '#0F7B55',
              vacio: verCompletadas === 'hoy' ? 'Aún no se completa ninguna hoy' : 'Sin entregas completadas' },
          ].map(col => (
            <section key={col.id} className="flex flex-col min-h-0 lg:bg-slate-100/60 lg:rounded-2xl lg:p-3">
              <div className="flex items-center gap-2 mb-2.5 px-1 flex-shrink-0">
                <span className="w-2 h-2 rounded-full" style={{ background: col.color }} />
                <span className="text-[13px] font-bold text-slate-700">{col.titulo}</span>
                <span className="text-[12px] font-bold tabular-nums px-1.5 rounded-full bg-white text-slate-500 border border-slate-200">{col.items.length}</span>
                {col.id === 'completadas' && (
                  <div className="ml-auto flex bg-white border border-slate-200 rounded-[8px] p-0.5">
                    {[['hoy', 'Hoy'], ['todas', `Historial (${carriles.completadasTodas.length})`]].map(([v, l]) => (
                      <button key={v} onClick={() => setVerCompletadas(v)}
                        className={`px-2.5 py-1 rounded-[6px] text-[11.5px] font-semibold ${verCompletadas === v ? 'bg-[#0F7B55] text-white' : 'text-slate-500'}`}>{l}</button>
                    ))}
                  </div>
                )}
              </div>
              <div className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto space-y-2.5 lg:pr-1">
                {col.items.length === 0 && (
                  <div className="text-center py-8 text-[12.5px] text-slate-400 border border-dashed border-slate-200 rounded-xl bg-white/60">{col.vacio}</div>
                )}
                {col.items.map(item => {
                  const esPendiente = item._tipo === 'pendiente'
                  const accionPendiente = item._tipo === 'accion'
                  const codigo = esPendiente ? item.codigo : (item.orden?.codigo || item.codigo)
                  const paciente = esPendiente ? item.paciente : item.orden?.paciente
                  const nEquipos = esAccion(item) ? equiposDeAccion(item).length : (esPendiente ? item.equipos : item.orden?.equipos)?.filter(oe => !oe.fecha_devolucion).length || 0
                  const retrasada = !esPendiente && estaRetrasada(item)
                  const programada = esPendiente ? item.fecha_entrega : esAccion(item) ? item.fecha_programada : item.orden?.fecha_entrega
                  return (
                    <div key={item.id} onClick={() => esPendiente ? setModalOrden(item) : setDrawer(item)}
                      className={`bg-white rounded-xl border shadow-sm p-3.5 cursor-pointer transition-all hover:shadow-md ${retrasada ? 'border-[#D81B43]/50' : 'border-slate-200 hover:border-slate-300'}`}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="font-mono text-[11.5px] font-bold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">{codigo}</span>
                        {esAccion(item) && <span className="text-[10.5px] font-bold text-[#6D28D9]">{nombreVisita(item)}</span>}
                        <span className="ml-auto text-[11px] text-slate-400 truncate">{item._repartidor}</span>
                      </div>
                      <div className="text-[13.5px] font-semibold text-slate-800 truncate">{paciente?.nombre || item.cliente?.nombre}</div>
                      <div className="text-[12px] text-slate-400 truncate">
                        {[paciente && item.cliente?.nombre, `${nEquipos} equipo${nEquipos !== 1 ? 's' : ''}`, paciente?.direccion].filter(Boolean).join(' · ')}
                      </div>
                      {(esPendiente || accionPendiente) && (
                        <div className="flex items-center justify-between gap-2 mt-2.5">
                          <span className="text-[11.5px] text-slate-500 flex items-center gap-1"><Clock size={11} /> {programada ? formatear(programada, { hour: '2-digit', minute: '2-digit' }) : 'Sin hora'}</span>
                          {puedeIniciar && accionPendiente ? (
                            <button onClick={e => { e.stopPropagation(); iniciarAccionLista(item) }} disabled={saving}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#D81B43] text-white text-[12px] font-semibold rounded-[8px] hover:bg-[#B0172F] disabled:opacity-50">
                              <Truck size={12} /> Iniciar
                            </button>
                          ) : puedeIniciar ? (
                            <button onClick={e => { e.stopPropagation(); setModalOrden(item) }}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#D81B43] text-white text-[12px] font-semibold rounded-[8px] hover:bg-[#B0172F]">
                              <Truck size={12} /> Ver y empezar
                            </button>
                          ) : (
                            <span className="text-[11.5px] text-slate-400">Espera al repartidor</span>
                          )}
                        </div>
                      )}
                      {item.estado?.nombre === 'En progreso' && (
                        <div className="mt-2.5">
                          <RutaAnimada inicio={item.fecha_inicio} compacto />
                          {retrasada && <div className="mt-1 text-[11px] font-bold text-[#D81B43] flex items-center gap-1"><AlertTriangle size={11} /> Retraso detectado</div>}
                        </div>
                      )}
                      {item.estado?.nombre === 'Completada' && (
                        <div className="mt-2 flex items-center justify-between gap-2 text-[11.5px]">
                          <span className="text-[#0F7B55] font-medium flex items-center gap-1 truncate"><CheckCircle2 size={11} /> {item.recibido_por || 'Entregada'}</span>
                          <span className="text-slate-400 flex-shrink-0">{formatear(item.fecha_completada, { hour: '2-digit', minute: '2-digit' })}{item.duracion_minutos != null && ` · ${item.duracion_minutos} min`}</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      </div>

      {/* ── DETALLE DE LA ORDEN (antes de iniciar) ── */}
      {modalOrden && (
        <Modal onCerrar={() => setModalOrden(null)} titulo={<span className="font-mono">{modalOrden.codigo}</span>} subtitulo="Préstamo a domicilio por iniciar"
          icono={<Truck size={17} />} sinPadding
          pie={<>
                <button onClick={() => setModalOrden(null)} className={ui.btnSecundario}>{puedeIniciar ? 'Cancelar' : 'Cerrar'}</button>
                {puedeIniciar ? (
                  <button onClick={() => iniciarEntrega(modalOrden)} disabled={saving}
                    className={ui.btnPrimario}>
                    <Truck size={14} /> {saving ? 'Iniciando...' : 'Iniciar entrega'}
                  </button>
                ) : (
                  <div className="mr-auto order-first flex items-center gap-2 text-[12px] text-slate-500">
                    <Lock size={13} className="flex-shrink-0" /> La inicia el repartidor.
                  </div>
                )}
          </>}>
              <div className="divide-y divide-slate-100">
                <div className="p-5">
                  <div className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-slate-400 mb-3">Cliente</div>
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
                  <div className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-slate-400 mb-3">
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
                    <div className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-slate-400 mb-3">
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
                    <div className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-slate-400 mb-2">Observaciones</div>
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
        </Modal>
      )}

      {/* ── DETALLE ENTREGA (ventana ancha; en celular, hoja desde abajo) ── */}
      {drawer && (
        <VentanaDetalle onCerrar={() => setDrawer(null)} z="z-30">
            <EncabezadoDetalle icono={<Truck size={18} />} etiqueta={`${esAccion(drawer) ? nombreVisita(drawer) : 'Entrega'} · ${drawer.orden?.codigo || ''}`}
              titulo={<span className="font-mono">{drawer.codigo}</span>} subtitulo={drawer.cliente?.nombre}
              onCerrar={() => setDrawer(null)}
              acciones={drawer.estado?.nombre === 'Completada' && (
                <DescargarActas cargar={() => actasDeEntrega(drawer)} nombre={`Actas_${drawer.orden?.codigo || drawer.codigo}`}
                  onSinActas={() => generarActaEntregaPDF(drawer)} onListo={() => showToast('PDF generado')} onError={msg => showToast(msg, 'error')}
                  className={`${ui.btnSecundario} max-sm:hidden`}>
                  {ocupado => <>{ocupado ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />} Acta PDF</>}
                </DescargarActas>
              )} />

            <Columnas izquierda={<>
              {drawer.estado?.nombre === 'En progreso' && (
                <div className="p-5"><EntregaEnCurso entrega={drawer} onRegistrar={() => abrirRegistro(drawer)} /></div>
              )}
              {/* Timeline + cronómetro */}
              {drawer.estado?.nombre !== 'En progreso' && <div className="p-5">
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
                    <CheckCircle2 size={14} /> Registrar {esAccion(drawer) ? nombreVisita(drawer).toLowerCase() : 'entrega'}
                  </button>
                )}
              </div>}

              {/* Datos */}
              <div className="p-5">
                <div className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-slate-400 mb-3">Detalles</div>
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
                <div className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-slate-400 mb-3">
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

            </>} derecha={<>
              {/* Actas firmadas del préstamo (lib/actas) */}
              {drawer.orden?.id && (
                <div className="p-5">
                  <div className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-slate-400 mb-3">Actas</div>
                  <ActasPrestamo key={drawer.id} ordenId={drawer.orden.id} ordenCodigo={drawer.orden.codigo} onToast={showToast} />
                </div>
              )}

              {/* Documentos con estado de firma */}
              <div className="p-5">
                <div className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-slate-400 mb-3">
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
            </>} />
        </VentanaDetalle>
      )}

      {/* ── FIRMA DE ACTAS — completa la entrega ── */}
      {modalRegistro && (
        <FirmaActas ordenId={modalRegistro.orden?.id || modalRegistro.orden_id} entregaId={modalRegistro.id}
          titulo={`Registrar ${esAccion(modalRegistro) ? nombreVisita(modalRegistro).toLowerCase() : 'entrega'} · ${modalRegistro.codigo}`}
          {...(esAccion(modalRegistro) ? {
            accion: accionDeEntrega(modalRegistro), plantillaIds: modalRegistro.datos?.plantillas || [],
            ...equiposDelActa(accionDeEntrega(modalRegistro), modalRegistro.datos),
            datosIniciales: { ...(modalRegistro.datos?.datos_acta || {}), motivo: modalRegistro.datos?.motivo },
          } : {})}
          alFirmar={completarEntrega}
          onCancelar={cerrarRegistro}
          onHecho={() => { cerrarRegistro(); router.refresh() }} />
      )}

      {/* ── MODAL ÉXITO — entrega completada ── */}
      {modalExito && (
        <>
          <div className="fixed inset-0 bg-black/50 z-[80] backdrop-blur-sm" onClick={() => setModalExito(null)} />
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-[520px] shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="px-6 pt-8 pb-6 text-center bg-gradient-to-b from-[#ECFDF5] to-white">
                <div className="w-16 h-16 rounded-full bg-[#0F7B55] flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[#0F7B55]/20">
                  <CheckCircle2 size={32} className="text-white" />
                </div>
                <div className="text-[17px] font-bold text-slate-800">{modalExito.titulo || 'Entrega'} completada</div>
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
                  <span className="text-slate-400">Equipos</span>
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

    </div>
  )
}