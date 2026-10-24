'use client'
import { registrarBitacora } from '@/lib/bitacora'
import { useState, useMemo, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { paraGuardar, paraInput, formatear, formatearSoloFecha, hoyBogota, sumarDias } from '@/lib/fechas'
import { estaVencida, diasParaVencer } from '@/lib/vigencia'
import { IconoTipo } from '@/components/inventario/IconoTipo'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import LimpiarFiltros from '@/components/ui/LimpiarFiltros'
import ModalDevolucion from '@/components/entregas/ModalDevolucion'
import Paginador from '@/components/ui/Paginador'
import { devolverEquipo as devolverEquipoLib, cambiarEquipo as cambiarEquipoLib, cerrarEquiposAbiertos } from '@/lib/prestamos'
import ModalCambioEquipo from '@/components/prestamos/ModalCambioEquipo'
import EncabezadoModulo from '@/components/ui/EncabezadoModulo'
import VentanaDetalle, { EncabezadoDetalle } from '@/components/ui/VentanaDetalle'
import { ui } from '@/lib/ui'
import ActasPrestamo from '@/components/actas/ActasPrestamo'
import AvatarCliente from '@/components/clientes/AvatarCliente'
import ControlVigencia from '@/components/prestamos/ControlVigencia'
import NuevoPrestamo from '@/components/prestamos/NuevoPrestamo'
import AccionPrestamo from '@/components/prestamos/AccionPrestamo'
import HistorialPrestamo from '@/components/prestamos/HistorialPrestamo'
import { seRecarga } from '@/lib/actas/acciones'
import { cancelarAccion, proximaRecarga, NOMBRE_ACCION, accionDeEntrega } from '@/lib/accionesPrestamo'
import { useOrdenable } from '@/hooks/useOrdenable'
import { usePaginacion } from '@/hooks/usePaginacion'
import {
  Plus, X, Search, FileText, CheckCircle2, AlertTriangle, Clock, User, Edit3, Truck, ChevronRight, Ban, ArrowLeftRight, Undo2, RefreshCw
} from 'lucide-react'

const E = {
  Borrador:   'c0b30011-e902-437d-ab1b-b33f753a04d7',
  Programada: '9430f8fe-008f-494e-ada5-3c667799b26c',
  EnReparto:  'e87fa300-a4c7-4225-b618-faf162ccf7ef',
  Entregada:  'acafaf48-918e-4681-bf31-3111c218bcc9',
  Finalizada: '45383dd9-7f9a-426d-830e-d093f105bef9',
}

const FLUJO = ['Borrador', 'Programada', 'En reparto', 'Entregada', 'Finalizada']

const ESTADO_STYLES = {
  'Borrador':   { bg: '#F1F5F9', color: '#64748B', dot: '#94A3B8' },
  'Programada': { bg: '#EFF6FF', color: '#1D4ED8', dot: '#3B82F6' },
  'En reparto': { bg: '#FFFBEB', color: '#B45309', dot: '#F59E0B' },
  'Entregada':  { bg: '#E8F7FB', color: '#0E86A0', dot: '#2EB5D4' },
  'Finalizada': { bg: '#ECFDF5', color: '#0F7B55', dot: '#0F7B55' },
  'Cancelada':  { bg: '#F1F5F9', color: '#94A3B8', dot: '#94A3B8' },
}

const BUCKETS = {
  en_curso: ['Borrador', 'Programada', 'En reparto', 'Entregada'],
  historial:['Finalizada', 'Cancelada'],
}

// Transiciones que puede hacer el ADMIN desde el drawer
// En reparto → Entregada lo hace el repartidor desde Entregas
const TRANSICIONES_ADMIN = {
  'Borrador':  { id: E.Programada, nombre: 'Programada', requiereRepartidor: true },
  'Entregada': { id: E.Finalizada, nombre: 'Finalizada',  requiereRepartidor: false },
}

function estaRetrasada(orden) {
  if (!orden.fecha_entrega) return false
  if (orden.estado?.nombre !== 'Programada') return false
  return new Date(orden.fecha_entrega) < new Date()
}

function estaIncompleta(orden) {
  return orden.estado?.nombre === 'Borrador' &&
    (!orden.repartidor_id || !orden.fecha_entrega)
}

const inputCls = ui.input
const nombreTipoEq = t => t?.atributos?.nombre || t?.nombre || null

// Una orden solo se marca "Vencida" mientras sigue en curso — una vez Finalizada
// o Cancelada la vigencia ya no significa nada (el préstamo terminó).
function ordenVencidaVisible(orden) {
  if (!orden) return false
  if (['Finalizada', 'Cancelada'].includes(orden.estado?.nombre)) return false
  return estaVencida(orden)
}

function EstadoBadge({ orden, retrasada }) {
  const nombre = orden?.estado?.nombre || 'Borrador'
  const incompleta = estaIncompleta(orden || {})
  const vencida = ordenVencidaVisible(orden)
  const s = ESTADO_STYLES[nombre] || ESTADO_STYLES['Borrador']

  if (retrasada) return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#FEF2F2] text-[#D81B43]">
      <AlertTriangle size={10} /> Retrasada
    </span>
  )
  if (incompleta) return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-500 border border-dashed border-slate-300">
      <AlertTriangle size={10} className="text-[#B45309]" /> Sin programar
    </span>
  )
  if (vencida) return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#FFFBEB] text-[#B45309]">
      <Clock size={10} /> Vencida
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold"
      style={{ background: s.bg, color: s.color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.dot }} />
      {nombre}
    </span>
  )
}

function TimelineBar({ estadoNombre }) {
  const idx = FLUJO.indexOf(estadoNombre)
  return (
    <div className="flex items-center gap-0.5">
      {FLUJO.map((_, i) => (
        <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${
          i < idx ? 'bg-[#D81B43]' : i === idx ? 'bg-[#D81B43] opacity-40' : 'bg-slate-200'
        }`} />
      ))}
    </div>
  )
}

function nombreEquipo(eq) {
  return eq?.tipo_equipo?.atributos?.nombre || eq?.tipo_equipo?.nombre || '—'
}

export default function OrdenesClient({
  ordenesIniciales, clientes, pacientes, estados, estadosEquipo, plantillas, equipos, usuarios, tipos, categorias, tiposEquipo, estadosEntrega
}) {
  const router   = useRouter()
  const supabase = createClient()

  const [ordenes, setOrdenes]           = useState(ordenesIniciales)
  const [pacientesLocal, setPacientesLocal] = useState(pacientes)

  // Sincronizar con datos frescos del servidor tras router.refresh()
  useEffect(() => {
    const t = setTimeout(() => setOrdenes(ordenesIniciales), 0)
    return () => clearTimeout(t)
  }, [ordenesIniciales])

  useEffect(() => {
    const t = setTimeout(() => setPacientesLocal(pacientes), 0)
    return () => clearTimeout(t)
  }, [pacientes])

  // ── SINCRONIZACIÓN EN TIEMPO REAL ─────────────────────────
  // Refleja cambios hechos desde Entregas (iniciar/completar) sin recargar
  useEffect(() => {
    const canal = supabase
      .channel('ordenes-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ordenes_servicio' }, () => {
        router.refresh()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'entregas' }, () => {
        router.refresh()
      })
      .subscribe()

    return () => { supabase.removeChannel(canal) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [search, setSearch]                           = useState('')
  const [tabPrincipal, setTabPrincipal]               = useState('en_curso')
  const [filtroEstadoDetalle, setFiltroEstadoDetalle] = useState('')
  const [filtroCliente, setFiltroCliente]             = useState('')
  const [filtroMarca, setFiltroMarca]                 = useState('')
  const [filtroCategoria, setFiltroCategoria]         = useState('')
  const [filtroPaciente, setFiltroPaciente]           = useState('')
  // Filtro que llega desde el Panel de Atención / Buzón del dashboard
  // (?atencion=prestamos_vencidos|prestamos_por_vencer). Arranca vacío
  // SIEMPRE (server y cliente deben renderizar lo mismo en el primer
  // pase) y se aplica recién en el efecto de montaje, leyendo el URL a
  // mano (no con useSearchParams, para no forzar un Suspense boundary
  // nuevo en esta página) — leerlo antes, en un useState perezoso, hace
  // que el primer render del cliente no coincida con el del servidor
  // (que nunca ve window) y React descarta el HTML del SSR con un error
  // de hidratación.
  const [filtroAtencion, setFiltroAtencion] = useState('')
  useEffect(() => {
    // Adopta el valor del URL una sola vez al montar — no "sincroniza" nada
    // en curso, así que no aplica el patrón de suscripción que pide la
    // regla del proyecto; deshabilitada a propósito, igual que otros
    // efectos de una sola vez en este archivo.
    const params = new URLSearchParams(window.location.search)
    const desdeUrl = params.get('atencion') || ''
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (desdeUrl) setFiltroAtencion(desdeUrl)
  }, [])
  const [drawer, setDrawer]             = useState(null)
  const [editRepartidor, setEditRepartidor] = useState(false)
  const [nuevoRepartidor, setNuevoRepartidor] = useState('')
  const [editFecha, setEditFecha] = useState(false)
  const [nuevaFecha, setNuevaFecha] = useState('')
  const [editVigencia, setEditVigencia] = useState(false)
  const [nuevaVigencia, setNuevaVigencia] = useState(null)

  // Si el drawer está abierto y esa orden cambió (ej. entrega completada desde otro dispositivo), refrescar su vista
  useEffect(() => {
    if (!drawer) return
    const actualizada = ordenes.find(o => o.id === drawer.id)
    if (actualizada && JSON.stringify(actualizada) !== JSON.stringify(drawer)) {
      const t = setTimeout(() => setDrawer(actualizada), 0)
      return () => clearTimeout(t)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ordenes])

  // ESC cierra el detalle abierto — mismo patrón que Clientes/Pacientes
  useEffect(() => {
    if (!drawer) return
    const onEsc = e => { if (e.key === 'Escape') setDrawer(null) }
    window.addEventListener('keydown', onEsc)
    return () => window.removeEventListener('keydown', onEsc)
  }, [drawer])

  const [vista, setVista]                   = useState('lista') // 'lista' | 'nuevo' | 'accion'
  // Recoger, recargar o cambiar con acta (components/prestamos/AccionPrestamo.js)
  const [accionActiva, setAccionActiva]     = useState(null) // { orden, accion, preseleccion, volver }
  const [editRecarga, setEditRecarga]       = useState(false)
  const [nuevaFrecuencia, setNuevaFrecuencia] = useState('')

  // Desde Clientes o el panel de atención (?abrir=<préstamo>&accion=devolucion&equipos=<oe,oe>&volver=<url>):
  // abre el préstamo y, si viene, su acción. Se lee una sola vez al montar.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const abrir = params.get('abrir')
    const orden = abrir && ordenesIniciales.find(o => o.id === abrir)
    if (!orden) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDrawer(orden)
    const accion = params.get('accion')
    if (['devolucion', 'recarga', 'cambio'].includes(accion) && orden.estado?.nombre === 'Entregada') {
      setAccionActiva({ orden, accion, preseleccion: (params.get('equipos') || '').split(',').filter(Boolean), volver: params.get('volver') })
      setVista('accion')
    }
    window.history.replaceState(null, '', window.location.pathname)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [toast, setToast]                   = useState(null)
  const [modalConfirm, setModalConfirm]     = useState(null)
  const [modalDevolucion, setModalDevolucion] = useState(null) // { ordenEquipoId, equipoId } o null
  const [modalCambio, setModalCambio]         = useState(null) // fila de orden_equipos a cambiar, o null
  const [guardandoCambio, setGuardandoCambio] = useState(false)
  const [formDevolucion, setFormDevolucion]   = useState({ fecha: '', observaciones: '' })
  const [modalCancelar, setModalCancelar]     = useState(false)

  function showToast(msg, tipo = 'success') {
    setToast({ msg, tipo })
    setTimeout(() => setToast(null), 3200)
  }

  const stats = useMemo(() => ({
    total:      ordenes.length,
    borrador:   ordenes.filter(o => o.estado?.nombre === 'Borrador').length,
    programada: ordenes.filter(o => o.estado?.nombre === 'Programada').length,
    enReparto:  ordenes.filter(o => o.estado?.nombre === 'En reparto').length,
    entregada:  ordenes.filter(o => o.estado?.nombre === 'Entregada').length,
    finalizada: ordenes.filter(o => o.estado?.nombre === 'Finalizada').length,
  }), [ordenes])

  const bucketCounts = useMemo(() => ({
    todos:    stats.total,
    en_curso: stats.borrador + stats.programada + stats.enReparto + stats.entregada,
    historial: stats.finalizada,
  }), [stats])

  // Reset filtros detalle al cambiar de pestaña
  useEffect(() => {
    let cancelled = false
    const t = setTimeout(() => {
      if (!cancelled) { setFiltroEstadoDetalle(''); setFiltroCliente(''); setFiltroMarca(''); setFiltroCategoria('') }
    }, 0)
    return () => { cancelled = true; clearTimeout(t) }
  }, [tabPrincipal])

  // Órdenes de la pestaña activa (para calcular opciones de selects)
  const ordenesPorTab = useMemo(() => {
    if (tabPrincipal === 'todos') return ordenes
    const bucket = BUCKETS[tabPrincipal] || []
    return ordenes.filter(o => bucket.includes(o.estado?.nombre))
  }, [ordenes, tabPrincipal])

  const opcionesEstado     = useMemo(() => [...new Set(ordenesPorTab.map(o => o.estado?.nombre).filter(Boolean))].sort(), [ordenesPorTab])
  const opcionesCliente    = useMemo(() => {
    const activos = new Set(clientes.map(c => c.nombre))
    return [...new Set(ordenesPorTab.map(o => o.cliente?.nombre).filter(n => n && activos.has(n)))].sort()
  }, [ordenesPorTab, clientes])
  const opcionesCategoria  = useMemo(() => [...new Set(ordenesPorTab.flatMap(o => (o.equipos || []).map(oe => oe.equipo?.tipo_equipo?.categoria?.nombre).filter(Boolean)))].sort(), [ordenesPorTab])
  // El tipo se elige dentro de una categoría: así la lista no es eterna
  const opcionesMarca      = useMemo(() => !filtroCategoria ? [] : [...new Set(ordenesPorTab.flatMap(o => (o.equipos || [])
    .filter(oe => oe.equipo?.tipo_equipo?.categoria?.nombre === filtroCategoria)
    .map(oe => nombreTipoEq(oe.equipo?.tipo_equipo)).filter(Boolean)))].sort(), [ordenesPorTab, filtroCategoria])
  const opcionesPaciente   = useMemo(() => [...new Set(ordenesPorTab.map(o => o.paciente?.nombre).filter(Boolean))].sort(), [ordenesPorTab])

  const ordenesFiltradas = useMemo(() => {
    return ordenes.filter(o => {
      if (tabPrincipal !== 'todos') {
        const bucket = BUCKETS[tabPrincipal] || []
        if (!bucket.includes(o.estado?.nombre)) return false
      }
      if (search) {
        const q = search.toLowerCase()
        // También por cédula/NIT y por el código o serial de un equipo del préstamo
        // (quien llama dice "soy fulano" o "el cilindro RL975")
        const pasa = [o.codigo, o.cliente?.nombre, o.cliente?.nit_cc, o.paciente?.nombre, o.paciente?.cedula, o.repartidor?.nombre,
          ...(o.equipos || []).flatMap(oe => [oe.equipo?.codigo, oe.equipo?.atributos?.serie, oe.equipo?.atributos?.codigo_inventario])]
          .some(v => v != null && String(v).toLowerCase().includes(q))
        if (!pasa) return false
      }
      if (filtroEstadoDetalle && o.estado?.nombre !== filtroEstadoDetalle) return false
      if (filtroCliente      && o.cliente?.nombre !== filtroCliente)        return false
      if (filtroMarca) {
        const tiene = (o.equipos || []).some(oe => nombreTipoEq(oe.equipo?.tipo_equipo) === filtroMarca)
        if (!tiene) return false
      }
      if (filtroCategoria) {
        const tiene = (o.equipos || []).some(oe => oe.equipo?.tipo_equipo?.categoria?.nombre === filtroCategoria)
        if (!tiene) return false
      }
      if (filtroPaciente && !o.paciente?.nombre?.toLowerCase().includes(filtroPaciente.toLowerCase())) return false
      if (filtroAtencion === 'prestamos_vencidos' && !estaVencida(o)) return false
      if (filtroAtencion === 'recargas_pendientes') {
        const proxima = proximaRecarga(o)
        if (!proxima || proxima.slice(0, 10) > sumarDias(hoyBogota(), 1)) return false
      }
      if (filtroAtencion === 'prestamos_por_vencer') {
        const dias = diasParaVencer(o)
        if (estaVencida(o) || dias === null || dias > 7) return false
      }
      return true
    })
  }, [ordenes, search, tabPrincipal, filtroEstadoDetalle, filtroCliente, filtroMarca, filtroCategoria, filtroPaciente, filtroAtencion])

  const { itemsOrdenados: ordenesOrdenadas, config: configOrdenes, solicitarOrden: solicitarOrdenOrdenes } = useOrdenable(ordenesFiltradas)
  const paginacionOrdenes = usePaginacion(ordenesOrdenadas, 20)
  const ordenesPagina = paginacionOrdenes.itemsPagina

  // ── ABRIR DRAWER ────────────────────────────────────────
  // En celular la lista se oculta (display:none) al abrir un préstamo y el
  // navegador la devuelve arriba del todo al volver. Se guarda dónde estaba.
  const listaScrollRef = useRef(null)
  const listaScrollTop = useRef(0)
  useEffect(() => {
    if (!drawer && listaScrollRef.current) listaScrollRef.current.scrollTop = listaScrollTop.current
  }, [drawer])

  function abrirDrawer(orden) {
    if (!drawer && listaScrollRef.current) listaScrollTop.current = listaScrollRef.current.scrollTop
    setDrawer(orden)
    setEditRepartidor(false)
    setNuevoRepartidor(orden.repartidor_id || '')
    setEditFecha(false)
    setNuevaFecha(orden.fecha_entrega ? paraInput(orden.fecha_entrega) : '')
    setModalDevolucion(null)
  }

  // ── AVANZAR ESTADO ──────────────────────────────────────
  async function avanzarEstado(orden, transicion) {
    if (transicion.requiereRepartidor && !orden.repartidor_id) {
      showToast('Asigna un repartidor primero', 'error')
      return
    }
    const { error } = await supabase.from('ordenes_servicio')
      .update({ estado_id: transicion.id }).eq('id', orden.id)
    if (error) { showToast('Error: ' + error.message, 'error'); return }

    // Al finalizar, los equipos que seguían en el préstamo se marcan devueltos y
    // vuelven a "Disponible" (los que están en mantenimiento siguen así)
    let errorLiberar = null
    if (transicion.nombre === 'Finalizada') {
      ;({ error: errorLiberar } = await cerrarEquiposAbiertos({ supabase, ordenId: orden.id, nota: 'Préstamo finalizado' }))
      // Lo que quedó programado (recogidas, recargas, cambios) ya no aplica; en
      // un cambio esto libera el equipo nuevo que estaba reservado
      for (const v of (orden.visitas || []).filter(v => v.tipo !== 'entrega' && !['Completada', 'Cancelada'].includes(v.estado?.nombre))) {
        const { error } = await cancelarAccion(supabase, v)
        if (error && !errorLiberar) errorLiberar = error
      }
    }

    const nuevoEstado = { id: transicion.id, nombre: transicion.nombre }
    setOrdenes(prev => prev.map(o => o.id === orden.id ? { ...o, estado: nuevoEstado } : o))
    setDrawer(prev => ({ ...prev, estado: nuevoEstado }))
    setModalConfirm(null)
    if (errorLiberar) showToast('La orden se finalizó, pero no se pudo liberar algún equipo: ' + errorLiberar.message, 'error')
    else showToast(transicion.nombre === 'Finalizada' ? 'Orden finalizada — equipos liberados' : `Orden → ${transicion.nombre}`)
    router.refresh()
  }

  // ── GUARDAR FECHA ENTREGA ────────────────────────────────
  async function guardarFecha() {
    if (!nuevaFecha) { showToast('Selecciona fecha y hora', 'error'); return }
    const fechaISO = paraGuardar(nuevaFecha)
    const { data, error } = await supabase.from('ordenes_servicio')
      .update({ fecha_entrega: fechaISO })
      .eq('id', drawer.id)
      .select('estado_id, estado:estados_orden(id, nombre)')
      .single()
    if (error) { showToast('Error: ' + error.message, 'error'); return }
    const nuevoEstado = data?.estado || drawer.estado
    const updOrden = { ...drawer, fecha_entrega: fechaISO, estado: nuevoEstado }
    setOrdenes(prev => prev.map(o => o.id === drawer.id ? updOrden : o))
    setDrawer(updOrden)
    setEditFecha(false)
    showToast(nuevoEstado?.nombre === 'Programada' ? '✓ Fecha guardada — orden programada' : 'Fecha guardada')
  }

  // ── GUARDAR VIGENCIA ─────────────────────────────────────
  // nuevaVigencia es null (préstamo indefinido) o una fecha YYYY-MM-DD — nunca
  // se guarda una duración, solo la fecha final (ver ControlVigencia).
  async function guardarVigencia() {
    const { error } = await supabase.from('ordenes_servicio')
      .update({ fecha_vigencia: nuevaVigencia })
      .eq('id', drawer.id)
    if (error) { showToast('Error: ' + error.message, 'error'); return }
    const updOrden = { ...drawer, fecha_vigencia: nuevaVigencia }
    setOrdenes(prev => prev.map(o => o.id === drawer.id ? updOrden : o))
    setDrawer(updOrden)
    setEditVigencia(false)
    registrarBitacora({ modulo: 'ordenes', accion: 'editar', entidad: 'préstamo', entidad_id: drawer.id, detalle: { fecha_vigencia: nuevaVigencia } })
    showToast(nuevaVigencia ? 'Vigencia actualizada' : 'Préstamo marcado como indefinido')
  }

  // ── REASIGNAR REPARTIDOR ─────────────────────────────────
  async function guardarRepartidor() {
    if (!nuevoRepartidor) { showToast('Selecciona un repartidor', 'error'); return }
    const { data, error } = await supabase.from('ordenes_servicio')
      .update({ repartidor_id: nuevoRepartidor })
      .eq('id', drawer.id)
      .select('estado_id, estado:estados_orden(id, nombre)')
      .single()
    if (error) { showToast('Error: ' + error.message, 'error'); return }
    const rep = usuarios.find(u => u.id === nuevoRepartidor)
    // El trigger puede haber cambiado el estado a Programada
    const nuevoEstado = data?.estado || drawer.estado
    const updOrden = { ...drawer, repartidor_id: nuevoRepartidor, repartidor: rep || drawer.repartidor, estado: nuevoEstado }
    setOrdenes(prev => prev.map(o => o.id === drawer.id ? updOrden : o))
    setDrawer(updOrden)
    setEditRepartidor(false)
    showToast(nuevoEstado?.nombre === 'Programada' ? '✓ Repartidor asignado — orden programada' : 'Repartidor asignado')
  }

  // ── NUEVO PRÉSTAMO (components/prestamos/NuevoPrestamo.js) ──
  function iniciarNuevoPrestamo() { setVista('nuevo') }

  // Uso por cliente: los más frecuentes salen como accesos rápidos en el asistente
  const usoClientes = useMemo(() => {
    const m = {}
    ordenes.forEach(o => { if (o.cliente_id) m[o.cliente_id] = (m[o.cliente_id] || 0) + 1 })
    return m
  }, [ordenes])

  // Equipos que se pueden poner en un préstamo (los usa el modal de cambio de equipo)
  const equiposDisponibles = useMemo(() => equipos.filter(eq => eq.estado?.nombre === 'Disponible'), [equipos])

  function prestamoCreado({ codigo, domicilio }) {
    // En oficina no se recoge firma (el paciente no está ahí): los formatos quedan
    // relacionados al préstamo y se descargan desde su detalle
    showToast(domicilio ? `${codigo} creado — pendiente de entrega` : `${codigo} registrado y activo`)
    setVista('lista')
    router.refresh()
  }

  // ── RECOGER / RECARGAR / CAMBIAR CON ACTA ────────────────
  function iniciarAccion(accion, preseleccion = []) {
    setAccionActiva({ orden: drawer, accion, preseleccion })
    setVista('accion')
  }
  function accionLista({ mensaje, error }) {
    const volver = accionActiva?.volver
    setAccionActiva(null)
    setVista('lista')
    if (volver) { window.location.assign(volver); return }
    showToast(mensaje, error ? 'error' : 'success')
    router.refresh()
  }
  async function cancelarVisita(v) {
    const { error } = await cancelarAccion(supabase, v)
    if (error) { showToast('Error: ' + error.message, 'error'); return }
    registrarBitacora({ modulo: 'ordenes', accion: 'cancelar', entidad: NOMBRE_ACCION[accionDeEntrega(v)].toLowerCase(), entidad_id: v.id, detalle: { codigo: drawer?.codigo } })
    showToast(`${NOMBRE_ACCION[accionDeEntrega(v)]} cancelada`)
    router.refresh()
  }
  async function guardarFrecuencia() {
    const dias = nuevaFrecuencia ? parseInt(nuevaFrecuencia, 10) : null
    if (nuevaFrecuencia && !(dias > 0)) { showToast('Escribe cada cuántos días', 'error'); return }
    const { error } = await supabase.from('ordenes_servicio').update({ recarga_cada_dias: dias }).eq('id', drawer.id)
    if (error) { showToast('Error: ' + error.message, 'error'); return }
    const upd = { ...drawer, recarga_cada_dias: dias }
    setOrdenes(prev => prev.map(o => o.id === drawer.id ? upd : o))
    setDrawer(upd)
    setEditRecarga(false)
    registrarBitacora({ modulo: 'ordenes', accion: 'editar', entidad: 'préstamo', entidad_id: drawer.id, detalle: { codigo: drawer.codigo, recarga_cada_dias: dias } })
    showToast(dias ? `Recarga cada ${dias} días` : 'Sin recarga periódica')
  }

  function abrirModalDevolucion(oe) {
    setModalDevolucion({ ordenEquipoId: oe.id, equipoId: oe.equipo_id || oe.equipo?.id })
    setFormDevolucion({ fecha: hoyBogota(), observaciones: '' })
  }

  async function devolverEquipo(ordenEquipoId, equipoId, fechaDevolucion, observaciones) {
    const { error, todosDevueltos } = await devolverEquipoLib({
      supabase, ordenEquipoId, equipoId, ordenId: drawer.id, fechaDevolucion, observaciones,
    })
    if (error) { showToast('Error: ' + error.message, 'error'); return }

    showToast(todosDevueltos ? 'Todos los equipos devueltos — préstamo finalizado' : 'Equipo devuelto')
    setModalDevolucion(null)
    router.refresh()
  }

  // ── CAMBIAR EQUIPO ───────────────────────────────────────
  // Reemplaza un equipo del préstamo por otro del mismo tipo (ver lib/prestamos.js)
  async function cambiarEquipo({ equipoNuevo, fecha, motivo }) {
    if (guardandoCambio || !modalCambio) return
    setGuardandoCambio(true)
    const oe = modalCambio
    const { error, entregada } = await cambiarEquipoLib({
      supabase, orden: drawer, ordenEquipoId: oe.id, equipoAnteriorId: oe.equipo_id || oe.equipo?.id,
      equipoNuevo, fecha, motivo,
    })
    setGuardandoCambio(false)
    if (error) { showToast('Error: ' + error.message, 'error'); return }

    registrarBitacora({
      modulo: 'ordenes', accion: 'editar', entidad: 'préstamo', entidad_id: drawer.id,
      detalle: { codigo: drawer.codigo, cambio_equipo: { sale: oe.equipo?.codigo, entra: equipoNuevo.codigo }, motivo: motivo || null, con_historial: entregada },
    })
    showToast(`Equipo cambiado: ${oe.equipo?.codigo} → ${equipoNuevo.codigo}`)
    setModalCambio(null)
    router.refresh() // el drawer abierto se actualiza solo con los datos nuevos
  }

  // ── CANCELAR ORDEN ───────────────────────────────────────
  // No borra ninguna fila (ordenes_servicio, orden_equipos, entregas) — el registro
  // queda completo con estado "Cancelada", solo se libera el equipo físico.
  async function cancelarOrden() {
    const estadoCancelada = estados.find(e => e.nombre === 'Cancelada')
    if (!estadoCancelada) {
      showToast('No se encontró el estado "Cancelada" en estados_orden', 'error'); return
    }

    const { error } = await supabase.from('ordenes_servicio')
      .update({ estado_id: estadoCancelada.id })
      .eq('id', drawer.id)
    if (error) { showToast('Error: ' + error.message, 'error'); return }

    // Si hay una entrega asociada sin completar, se cancela también
    const estadoEntregaCancelada  = (estadosEntrega || []).find(e => e.nombre === 'Cancelada')
    const estadoEntregaCompletada = (estadosEntrega || []).find(e => e.nombre === 'Completada')
    if (estadoEntregaCancelada) {
      let q = supabase.from('entregas').update({ estado_id: estadoEntregaCancelada.id }).eq('orden_id', drawer.id)
      if (estadoEntregaCompletada) q = q.neq('estado_id', estadoEntregaCompletada.id)
      await q
    }

    // Cierra y libera los equipos que aún no se hayan devuelto
    // (los que están en mantenimiento siguen así — ver lib/mantenimientos.js)
    const { error: errLiberar } = await cerrarEquiposAbiertos({ supabase, ordenId: drawer.id, nota: 'Préstamo cancelado' })

    registrarBitacora({ modulo: 'ordenes', accion: 'cancelar', entidad: 'préstamo', entidad_id: drawer.id, detalle: { codigo: drawer.codigo } })

    const nuevoEstado = { id: estadoCancelada.id, nombre: 'Cancelada' }
    setOrdenes(prev => prev.map(o => o.id === drawer.id ? { ...o, estado: nuevoEstado } : o))
    setDrawer(prev => ({ ...prev, estado: nuevoEstado }))
    setModalCancelar(false)
    if (errLiberar) showToast('El préstamo se canceló, pero no se pudo liberar algún equipo: ' + errLiberar.message, 'error')
    else showToast('Préstamo cancelado — equipo liberado')
    router.refresh()
  }

  // ── DRAWER: info de la orden ─────────────────────────────
  const drawerEstado    = drawer?.estado?.nombre || 'Borrador'
  const drawerRetrasada = drawer ? estaRetrasada(drawer) : false
  const drawerVencida   = drawer ? estaVencida(drawer) : false
  const drawerIncompleta = drawer ? estaIncompleta(drawer) : false
  // Admin solo puede finalizar (Entregada → Finalizada)
  // Borrador → Programada es automático vía trigger al asignar repartidor + fecha
  const transicion      = drawer && drawerEstado === 'Entregada'
    ? { id: E.Finalizada, nombre: 'Finalizada', requiereRepartidor: false }
    : null
  const puedeEdRep      = drawer && ['Borrador', 'Programada'].includes(drawerEstado)
  // Solo cuentan los que siguen en el préstamo: un equipo cambiado deja su fila
  // vieja como devuelta y no debe volver "múltiple" un préstamo de un solo equipo
  const equiposDrawer   = (drawer?.equipos || []).filter(oe => !oe.fecha_devolucion)
  const esUnicoEquipo   = equiposDrawer.length === 1
  const puedeFinalizarUnico = esUnicoEquipo && !['Finalizada', 'Cancelada'].includes(drawerEstado)
  const puedeCambiarEquipo  = drawer && !['Finalizada', 'Cancelada'].includes(drawerEstado)
  const puedeCancelarOrden = drawer && !['Finalizada', 'Cancelada'].includes(drawerEstado)
  // Con el préstamo ya entregado, recoger, recargar y cambiar van con acta
  const conActa = drawerEstado === 'Entregada'
  const recargables = equiposDrawer.filter(oe => seRecarga(oe.equipo?.tipo_equipo))
  const visitasPendientes = (drawer?.visitas || []).filter(v => v.tipo !== 'entrega' && !['Completada', 'Cancelada'].includes(v.estado?.nombre))
  const proxima = drawer ? proximaRecarga(drawer) : null

  return (
    <div className="flex flex-col h-full overflow-hidden">

      <EncabezadoModulo titulo="Préstamos" subtitulo="Equipos prestados a clientes y pacientes" ayuda="prestamos"
        acciones={vista === 'lista' && (
          <button onClick={iniciarNuevoPrestamo} className={`${ui.btnPrimario} max-md:hidden`}>
            <Plus size={14} strokeWidth={2.5} /> Nuevo préstamo
          </button>
        )} />

      {/* FAB móvil */}
      {vista === 'lista' && (
        <button onClick={iniciarNuevoPrestamo}
          className="fixed bottom-[calc(var(--mobile-nav-space,0px)+16px)] right-4 z-30 md:hidden shadow-lg rounded-full w-14 h-14 bg-[#D81B43] text-white flex items-center justify-center">
          <Plus size={22} strokeWidth={2.5} />
        </button>
      )}

      <div className="flex-1 overflow-hidden flex flex-col">
      {vista === 'lista' && (
        <div className="flex-1 overflow-hidden flex flex-col p-3 md:p-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">

          {/* FRANJA 1 — Filtros, SIEMPRE fija, nunca cambia con la selección */}
          <div className="p-3 md:p-6 pb-3 md:pb-4 flex-shrink-0 border-b border-slate-200">
            <div className="flex flex-col gap-2 md:gap-3">
              {/* Fila 1 — búsqueda, pestañas y conteo ("Nuevo préstamo" está en el encabezado) */}
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
                <div className="relative w-full md:w-[340px] md:flex-shrink-0">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar por paciente, cédula, cliente, código o serial…"
                    className="w-full pl-9 pr-4 h-[38px] border border-slate-200 rounded-[9px] text-[13px] text-slate-800 bg-white outline-none focus:border-[#D81B43] focus:ring-2 focus:ring-[#D81B43]/10 placeholder:text-slate-400" />
                </div>
                <div className="flex items-center gap-2 md:gap-3 md:flex-1 min-w-0">
                  <div className="flex items-center gap-2 overflow-x-auto flex-1 min-w-0">
                    {[
                      { key: 'todos',    label: 'Todos'    },
                      { key: 'en_curso', label: 'En curso' },
                      { key: 'historial',label: 'Historial'},
                    ].map(t => (
                      <button key={t.key} onClick={() => setTabPrincipal(t.key)}
                        className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-all whitespace-nowrap ${
                          tabPrincipal === t.key
                            ? 'bg-[#D81B43] text-white'
                            : 'bg-white border border-slate-200 text-slate-500 hover:border-[#D81B43] hover:text-[#D81B43]'
                        }`}>
                        {t.label}
                        <span className="ml-1 text-[10.5px] opacity-70">({bucketCounts[t.key]})</span>
                      </button>
                    ))}
                  </div>
                  <LimpiarFiltros
                    activo={!!(search || filtroEstadoDetalle || filtroCliente || filtroMarca || filtroCategoria || filtroPaciente || filtroAtencion)}
                    onLimpiar={() => { setSearch(''); setFiltroEstadoDetalle(''); setFiltroCliente(''); setFiltroMarca(''); setFiltroCategoria(''); setFiltroPaciente(''); setFiltroAtencion('') }} />
                  {(
                    <div className="hidden md:block text-[12px] text-slate-400 flex-shrink-0 ml-auto">
                      {ordenesFiltradas.length} préstamo{ordenesFiltradas.length !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              </div>

              {/* Fila 2 — filtros: categoría antes que tipo (el tipo depende de ella) */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  <select value={filtroEstadoDetalle} onChange={e => setFiltroEstadoDetalle(e.target.value)} className="w-full px-3 border border-slate-200 rounded-[9px] text-[12.5px] text-slate-700 outline-none focus:border-[#D81B43] bg-white h-[38px] disabled:bg-slate-50 disabled:text-slate-400">
                    <option value="">Estado</option>
                    {opcionesEstado.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                  <select value={filtroCliente} onChange={e => setFiltroCliente(e.target.value)} className="w-full px-3 border border-slate-200 rounded-[9px] text-[12.5px] text-slate-700 outline-none focus:border-[#D81B43] bg-white h-[38px] disabled:bg-slate-50 disabled:text-slate-400">
                    <option value="">Cliente</option>
                    {opcionesCliente.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <div className="relative">
                    <input value={filtroPaciente} onChange={e => setFiltroPaciente(e.target.value)} list="filtro-pacientes"
                      placeholder="Paciente" className="w-full px-3 border border-slate-200 rounded-[9px] text-[12.5px] text-slate-700 outline-none focus:border-[#D81B43] bg-white h-[38px] disabled:bg-slate-50 disabled:text-slate-400 placeholder:text-slate-700" />
                    <datalist id="filtro-pacientes">{opcionesPaciente.map(p => <option key={p} value={p} />)}</datalist>
                  </div>
                  <select value={filtroCategoria} onChange={e => { setFiltroCategoria(e.target.value); setFiltroMarca('') }} className="w-full px-3 border border-slate-200 rounded-[9px] text-[12.5px] text-slate-700 outline-none focus:border-[#D81B43] bg-white h-[38px] disabled:bg-slate-50 disabled:text-slate-400">
                    <option value="">Categoría</option>
                    {opcionesCategoria.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select value={filtroMarca} onChange={e => setFiltroMarca(e.target.value)} disabled={!filtroCategoria}
                    title={filtroCategoria ? undefined : 'Elige primero la categoría'} className="w-full px-3 border border-slate-200 rounded-[9px] text-[12.5px] text-slate-700 outline-none focus:border-[#D81B43] bg-white h-[38px] disabled:bg-slate-50 disabled:text-slate-400">
                    <option value="">{filtroCategoria ? 'Tipo de equipo' : 'Tipo (elige categoría)'}</option>
                    {opcionesMarca.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>

                {filtroAtencion && (
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1.5 bg-[#FFFBEB] border border-[#F59E0B]/40 text-[#B45309] text-[12px] font-medium px-3 py-1.5 rounded-full">
                      Filtro: {{ prestamos_vencidos: 'préstamos vencidos', prestamos_por_vencer: 'préstamos por vencer', recargas_pendientes: 'recargas por hacer' }[filtroAtencion] || filtroAtencion}
                      <button type="button" onClick={() => setFiltroAtencion('')} className="hover:text-[#7C2D12]">
                        <X size={12} />
                      </button>
                    </span>
                  </div>
                )}
              </div>
            </div>

          {/* FRANJA 2 — lista (el detalle se abre en ventana) */}
          <div className="flex flex-1 overflow-hidden flex-col md:flex-row">

            {/* Columna lista */}
            <div className="flex flex-col overflow-hidden w-full">

              {/* Lista/tabla — un solo contenedor de scroll; adentro cambia cómo se pinta cada fila según el ancho disponible */}
              <div ref={listaScrollRef} className="flex-1 overflow-y-auto px-3 md:px-6 pt-3 md:pt-6 pb-20 md:pb-6">
              {ordenesFiltradas.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <div className="font-semibold mb-1">
                      {search || filtroEstadoDetalle || filtroCliente || filtroMarca || filtroCategoria || filtroPaciente ? 'Sin resultados' : (
                        tabPrincipal === 'todos'    ? 'Sin préstamos registrados' :
                        tabPrincipal === 'en_curso' ? 'Sin préstamos en curso' :
                        'Sin préstamos en historial'
                      )}
                    </div>
                    <div className="text-[13px]">
                      {search || filtroEstadoDetalle || filtroCliente || filtroMarca || filtroCategoria || filtroPaciente ? 'Intenta con otros filtros' :
                       tabPrincipal === 'todos'    ? 'Usa "Nuevo préstamo" para registrar uno' :
                       tabPrincipal === 'en_curso' ? 'Usa "Nuevo préstamo" para registrar uno' :
                       'Los préstamos finalizados aparecerán aquí'}
                    </div>
                  </div>
              ) : (
                <>
                  {/* Cards móvil */}
                  <div className="md:hidden space-y-2">
                    {ordenesPagina.map(o => {
                      const retrasada  = estaRetrasada(o)
                      const incompleta = estaIncompleta(o)
                      return (
                        <div key={o.id} onClick={() => abrirDrawer(o)}
                          className={`bg-white rounded-xl border shadow-sm p-4 cursor-pointer active:bg-slate-50 transition-colors ${
                            retrasada  ? 'border-l-4 border-l-[#D81B43] border-slate-200' :
                            incompleta ? 'border-l-4 border-l-[#B45309] border-slate-200' : 'border-slate-200'
                          }`}>
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div>
                              <span className="font-mono text-[12.5px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                                {o.codigo || '—'}
                              </span>
                              <div className="text-[13px] font-semibold text-slate-700 mt-1 truncate max-w-[200px]">
                                {o.cliente?.nombre || '—'}
                              </div>
                            </div>
                            <EstadoBadge orden={o} retrasada={retrasada} />
                          </div>
                          <div className="flex items-center justify-between text-[11.5px] text-slate-400">
                            <span>{o.repartidor?.nombre || <span className="text-[#B45309]">Sin repartidor</span>}</span>
                            {o.fecha_entrega && (
                              <span className={retrasada ? 'text-[#D81B43] font-semibold' : ''}>
                                {formatear(o.fecha_entrega, { month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Tabla desktop */}
                  <div className="hidden md:block">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b-2 border-slate-100">
                          {[
                            { label: 'Cliente', clave: 'cliente', accessor: o => o.cliente?.nombre || '' },
                            { label: 'Paciente', clave: 'paciente', accessor: o => o.paciente?.nombre || '' },
                            { label: 'Equipo', clave: null },
                            { label: 'Estado', clave: 'estado', accessor: o => o.estado?.nombre || '' },
                            { label: 'Dirección', clave: null },
                            { label: 'Fecha entrega', clave: 'fecha_entrega', accessor: o => o.fecha_entrega ? new Date(o.fecha_entrega).getTime() : null },
                            { label: 'Docs', clave: null },
                            { label: '', clave: null },
                          ].map(col => (
                            <th key={col.label || 'acciones'}
                              onClick={col.clave ? () => solicitarOrdenOrdenes(col.clave, col.accessor) : undefined}
                              className={`px-4 py-3 text-left text-[10.5px] font-bold uppercase tracking-[0.07em] text-slate-400 bg-slate-50 whitespace-nowrap ${col.clave ? 'cursor-pointer select-none hover:bg-slate-100 transition-colors' : ''}`}>
                              <div className="flex items-center gap-1">
                                {col.label}
                                {configOrdenes?.clave === col.clave && (
                                  <span className="text-[10px]">{configOrdenes.direccion === 'asc' ? '▲' : '▼'}</span>
                                )}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {ordenesPagina.map(o => {
                          const nEquipos   = o.equipos?.length || 0
                          const retrasada  = estaRetrasada(o)
                          const incompleta = estaIncompleta(o)
                          return (
                            <tr key={o.id} onClick={() => abrirDrawer(o)}
                              className={`border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer ${
                                retrasada  ? 'border-l-4 border-l-[#D81B43]' :
                                incompleta ? 'border-l-4 border-l-[#B45309] opacity-70' : ''
                              }`}>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2.5">
                                  <AvatarCliente cliente={o.cliente} tamano={32} />
                                  <div>
                                    <div className="text-[13px] font-semibold text-slate-700">{o.cliente?.nombre || '—'}</div>
                                    <div className="text-[11px] font-mono text-slate-400">{o.codigo || '—'}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                {o.paciente?.nombre
                                  ? <span className="text-[12.5px] font-semibold text-slate-700 leading-snug">{o.paciente.nombre}</span>
                                  : <span className="text-slate-300 text-[12.5px]">—</span>}
                              </td>
                              <td className="px-4 py-3">
                                {nEquipos === 0 ? <span className="text-slate-300 text-[12.5px]">—</span> :
                                 nEquipos === 1 ? (
                                   <div>
                                     <div className="text-[12.5px] font-semibold text-slate-700 leading-tight">{nombreEquipo(o.equipos[0]?.equipo)}</div>
                                     <div className="text-[11px] text-slate-400 mt-0.5">
                                       {[o.equipos[0]?.equipo?.tipo_equipo?.nombre, o.equipos[0]?.equipo?.codigo].filter(Boolean).join(' · ')}
                                     </div>
                                   </div>
                                 ) : (
                                   <div>
                                     <div className="text-[12.5px] font-semibold text-slate-700 leading-tight">{nEquipos} equipos</div>
                                     <div className="text-[11px] text-slate-400 mt-0.5 truncate max-w-[160px]">
                                       {o.equipos.map(oe => nombreEquipo(oe.equipo)).join(', ')}
                                     </div>
                                   </div>
                                 )}
                              </td>
                              <td className="px-4 py-3">
                                <EstadoBadge orden={o} retrasada={retrasada} />
                              </td>
                              <td className="px-4 py-3 text-[12.5px]">
                                {o.paciente?.direccion
                                  ? <span className="text-slate-500 leading-snug">{o.paciente.direccion}</span>
                                  : <span className="text-slate-300">—</span>}
                              </td>
                              <td className="px-4 py-3">
                                {o.fecha_entrega
                                  ? <span className={`text-[12px] font-mono ${retrasada ? 'text-[#D81B43] font-bold' : 'text-slate-400'}`}>
                                      {formatear(o.fecha_entrega, { month: '2-digit' })}
                                    </span>
                                  : <span className="text-[#B45309] text-[11.5px]">Sin programar</span>}
                              </td>
                              <td className="px-4 py-3">
                                <span className="flex items-center gap-1 text-[12px] text-slate-400">
                                  <FileText size={12} />{o.plantillas?.length || 0}
                                </span>
                              </td>
                              <td className="px-3 py-3 text-slate-300"><ChevronRight size={14} /></td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                    <Paginador {...paginacionOrdenes} />
                  </div>
                  <div className="md:hidden mt-2">
                    <Paginador {...paginacionOrdenes} />
                  </div>
                </>
              )}
              </div>
            </div>

          {/* Detalle en ventana ancha, igual que Entregas, Inventario y Clientes */}
          {drawer && (
            <VentanaDetalle onCerrar={() => setDrawer(null)} ancho={860}>
            <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <EncabezadoDetalle icono={drawer.cliente?.nombre?.charAt(0)?.toUpperCase() || '?'} imagen={drawer.cliente?.logo_url}
                etiqueta={<span className="font-mono">{drawer.codigo}</span>} titulo={drawer.cliente?.nombre || '—'}
                subtitulo={drawer.paciente?.nombre ? `Paciente: ${drawer.paciente.nombre}` : undefined}
                onCerrar={() => setDrawer(null)} />

              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 pb-4">

                {/* Estado + timeline + acción */}
                <div className="p-5">
                  <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                    <EstadoBadge orden={drawer} retrasada={drawerRetrasada} />
                    <div className="flex items-center gap-2">
                      {conActa && equiposDrawer.length > 0 && (
                        <>
                          <button onClick={() => iniciarAccion('devolucion')}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#D81B43] text-white text-[12px] font-semibold rounded-[7px] hover:bg-[#B0172F]">
                            <Undo2 size={13} /> Recoger
                          </button>
                          {recargables.length > 0 && (
                            <button onClick={() => iniciarAccion('recarga')}
                              className="flex items-center gap-1.5 px-3 py-1.5 border border-[#0E86A0]/40 text-[#0E86A0] text-[12px] font-semibold rounded-[7px] hover:bg-[#E8F7FB]">
                              <RefreshCw size={13} /> Recarga
                            </button>
                          )}
                          <button onClick={() => iniciarAccion('cambio')}
                            className="flex items-center gap-1.5 px-3 py-1.5 border border-[#1B3A6B]/25 text-[#1B3A6B] text-[12px] font-semibold rounded-[7px] hover:bg-[#1B3A6B]/[0.05]">
                            <ArrowLeftRight size={13} /> Cambiar
                          </button>
                        </>
                      )}
                      {puedeFinalizarUnico && !conActa && (
                        <button onClick={() => abrirModalDevolucion(equiposDrawer[0])}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#D81B43] text-white text-[12px] font-semibold rounded-[7px] hover:bg-[#B0172F]">
                          <CheckCircle2 size={13} /> Finalizar préstamo
                        </button>
                      )}
                      {/* Finalizar sin acta: siempre que esté entregado, tenga uno o varios equipos */}
                      {transicion && (
                        <button onClick={() => setModalConfirm({ orden: drawer, transicion })}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#D81B43] text-white text-[12px] font-semibold rounded-[7px] hover:bg-[#B0172F]">
                          <CheckCircle2 size={13} /> Finalizar préstamo
                        </button>
                      )}
                      {drawerEstado === 'En reparto' && (
                        <span className="text-[12px] text-[#B45309] bg-[#FFFBEB] px-3 py-1.5 rounded-[7px] border border-[#F59E0B]/30 font-medium flex items-center gap-1.5">
                          <Truck size={12} /> En ruta con el repartidor
                        </span>
                      )}
                      {puedeCancelarOrden && (
                        <button onClick={() => setModalCancelar(true)}
                          className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-600 text-[12px] font-semibold rounded-[7px] hover:bg-red-50">
                          <Ban size={13} /> Cancelar préstamo
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Aviso orden incompleta */}
                  {drawerIncompleta && (
                    <div className="mb-4 p-3 bg-[#FFFBEB] border border-[#F59E0B]/40 rounded-[9px]">
                      <div className="text-[12.5px] font-semibold text-[#B45309] mb-1 flex items-center gap-1.5">
                        <AlertTriangle size={13} /> Orden sin programar
                      </div>
                      <div className="text-[12px] text-[#B45309]/80 space-y-0.5">
                        {!drawer.repartidor_id && <div>• Falta asignar repartidor</div>}
                        {!drawer.fecha_entrega && <div>• Falta fecha y hora de entrega</div>}
                      </div>
                      <div className="text-[11.5px] text-slate-400 mt-2">
                        Esta orden no aparecerá en Entregas hasta que tenga repartidor y fecha programada.
                      </div>
                    </div>
                  )}

                  {/* Timeline visual */}
                  <div className="flex items-start mt-3">
                    {FLUJO.map((paso, i) => {
                      const idx = FLUJO.indexOf(drawerEstado)
                      const st  = i < idx ? 'done' : i === idx ? 'active' : 'pending'
                      return (
                        <div key={paso} className="flex-1 flex flex-col items-center relative">
                          {i > 0 && (
                            <div className={`absolute top-3 right-1/2 w-full h-0.5 ${st === 'done' || st === 'active' ? 'bg-[#D81B43]' : 'bg-slate-200'}`} />
                          )}
                          <div className={`w-6 h-6 rounded-full z-10 flex items-center justify-center flex-shrink-0 ${
                            st === 'done'   ? 'bg-[#D81B43]' :
                            st === 'active' ? 'bg-white border-2 border-[#D81B43]' :
                            'bg-white border-2 border-slate-200'
                          }`}>
                            {st === 'done'   && <CheckCircle2 size={10} className="text-white" />}
                            {st === 'active' && <div className="w-2 h-2 bg-[#D81B43] rounded-full" />}
                          </div>
                          <div className={`text-[9px] font-semibold mt-1 text-center leading-tight ${
                            st === 'done' || st === 'active' ? 'text-[#D81B43]' : 'text-slate-400'
                          }`}>{paso}</div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Alertas */}
                  {drawerRetrasada && (
                    <div className="mt-4 flex items-center gap-2 text-[12px] text-[#D81B43] bg-[#FEF2F2] px-3 py-2.5 rounded-[8px] border border-[#D81B43]/20">
                      <AlertTriangle size={13} /> Entrega retrasada — la hora programada ya pasó
                    </div>
                  )}
                  {drawerVencida && drawerEstado !== 'Finalizada' && (
                    <div className="mt-3 flex items-center gap-2 text-[12px] text-red-500 bg-red-50 px-3 py-2.5 rounded-[8px] border border-red-200">
                      <Clock size={13} /> Vigencia vencida
                    </div>
                  )}
                </div>

                {/* Repartidor — editable */}
                <div className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-slate-400">Repartidor</div>
                    {puedeEdRep && !editRepartidor && (
                      <button onClick={() => { setEditRepartidor(true); setNuevoRepartidor(drawer.repartidor_id || '') }}
                        className="flex items-center gap-1 text-[11.5px] text-[#D81B43] font-semibold hover:underline">
                        <Edit3 size={11} /> {drawer.repartidor ? 'Cambiar' : 'Asignar'}
                      </button>
                    )}
                  </div>
                  {!editRepartidor ? (
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold flex-shrink-0 ${drawer.repartidor ? 'bg-[#D81B43]/10 text-[#D81B43]' : 'bg-slate-100 text-slate-400'}`}>
                        {drawer.repartidor ? drawer.repartidor.nombre.charAt(0).toUpperCase() : <User size={14} />}
                      </div>
                      <div>
                        <div className="text-[13.5px] font-semibold text-slate-700">{drawer.repartidor?.nombre || 'Sin asignar'}</div>
                        {!drawer.repartidor && drawerEstado === 'Borrador' && (
                          <div className="text-[11px] text-[#B45309]">Requerido para programar</div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <select value={nuevoRepartidor} onChange={e => setNuevoRepartidor(e.target.value)} className={inputCls}>
                        <option value="">Seleccionar...</option>
                        {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                      </select>
                      <div className="flex gap-2">
                        <button onClick={guardarRepartidor}
                          className="flex-1 py-2 bg-[#D81B43] text-white rounded-[8px] text-[12.5px] font-semibold hover:bg-[#B0172F]">
                          Guardar
                        </button>
                        <button onClick={() => setEditRepartidor(false)}
                          className="flex-1 py-2 border border-slate-200 text-slate-500 rounded-[8px] text-[12.5px] hover:border-slate-300">
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Fecha entrega — editable si está en Borrador/Programada */}
                {['Borrador', 'Programada'].includes(drawerEstado) && (
                  <div className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-slate-400">Fecha y hora de entrega</div>
                      {!editFecha && (
                        <button onClick={() => { setEditFecha(true); setNuevaFecha(drawer.fecha_entrega ? paraInput(drawer.fecha_entrega) : '') }}
                          className="flex items-center gap-1 text-[11.5px] text-[#D81B43] font-semibold hover:underline">
                          <Edit3 size={11} /> {drawer.fecha_entrega ? 'Cambiar' : 'Programar'}
                        </button>
                      )}
                    </div>
                    {!editFecha ? (
                      drawer.fecha_entrega
                        ? <div className={`text-[13.5px] font-semibold ${drawerRetrasada ? 'text-[#D81B43]' : 'text-slate-700'}`}>
                            {formatear(drawer.fecha_entrega, { month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        : <div className="text-[12.5px] text-[#B45309] font-medium flex items-center gap-1.5">
                            <AlertTriangle size={12} /> Sin programar
                          </div>
                    ) : (
                      <div className="space-y-2">
                        <input type="datetime-local" value={nuevaFecha}
                          onChange={e => setNuevaFecha(e.target.value)} className={inputCls} />
                        <div className="flex gap-2">
                          <button onClick={guardarFecha}
                            className="flex-1 py-2 bg-[#D81B43] text-white rounded-[8px] text-[12.5px] font-semibold hover:bg-[#B0172F]">
                            Guardar
                          </button>
                          <button onClick={() => setEditFecha(false)}
                            className="flex-1 py-2 border border-slate-200 text-slate-500 rounded-[8px] text-[12.5px] hover:border-slate-300">
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Vigencia — editable mientras el préstamo siga en curso (Finalizada/
                    Cancelada ya terminaron, la vigencia deja de tener sentido) */}
                {!['Finalizada', 'Cancelada'].includes(drawerEstado) && (
                  <div className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-slate-400">Vigencia del préstamo</div>
                      {!editVigencia && (
                        <button onClick={() => { setEditVigencia(true); setNuevaVigencia(drawer.fecha_vigencia || null) }}
                          className="flex items-center gap-1 text-[11.5px] text-[#D81B43] font-semibold hover:underline">
                          <Edit3 size={11} /> {drawer.fecha_vigencia ? 'Cambiar' : 'Definir'}
                        </button>
                      )}
                    </div>
                    {!editVigencia ? (
                      drawer.fecha_vigencia
                        ? <div className={`text-[13.5px] font-semibold ${drawerVencida ? 'text-[#D81B43]' : 'text-slate-700'}`}>
                            {formatearSoloFecha(drawer.fecha_vigencia)}
                          </div>
                        : <div className="text-[12.5px] text-slate-400 font-medium">Indefinido — sin fecha de vencimiento</div>
                    ) : (
                      <div className="space-y-2">
                        <ControlVigencia value={nuevaVigencia} onChange={setNuevaVigencia} />
                        <div className="flex gap-2">
                          <button onClick={guardarVigencia}
                            className="flex-1 py-2 bg-[#D81B43] text-white rounded-[8px] text-[12.5px] font-semibold hover:bg-[#B0172F]">
                            Guardar
                          </button>
                          <button onClick={() => setEditVigencia(false)}
                            className="flex-1 py-2 border border-slate-200 text-slate-500 rounded-[8px] text-[12.5px] hover:border-slate-300">
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Datos generales */}
                <div className="p-5">
                  <div className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-slate-400 mb-3">Detalles</div>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Cliente',        value: drawer.cliente?.nombre },
                      { label: 'Paciente',       value: drawer.paciente?.nombre || '—' },
                      { label: 'Domicilio',      value: drawer.repartidor_id ? 'Sí' : 'No' },
                      { label: 'Recibido por',   value: drawer.recibido_por || '—' },
                      { label: 'Fecha entrega',  value: formatear(drawer.fecha_entrega, { month: '2-digit', hour: '2-digit', minute: '2-digit' }) },
                      { label: 'Vigencia',       value: formatearSoloFecha(drawer.fecha_vigencia) },
                      { label: 'Fecha creación', value: formatear(drawer.fecha_creacion) },
                    ].map(f => (
                      <div key={f.label}>
                        <div className="text-[10px] font-semibold uppercase text-slate-400 mb-1">{f.label}</div>
                        <div className={`text-[13px] font-medium ${
                          f.label === 'Vigencia' && drawerVencida ? 'text-red-500' :
                          f.label === 'Fecha entrega' && drawerRetrasada ? 'text-[#D81B43]' :
                          'text-slate-700'
                        }`}>{f.value}</div>
                      </div>
                    ))}
                    {drawer.observaciones && (
                      <div className="col-span-2">
                        <div className="text-[10px] font-semibold uppercase text-slate-400 mb-1">Observaciones</div>
                        <div className="text-[13px] text-slate-600 italic">{drawer.observaciones}</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Recogidas, recargas y cambios programados a domicilio */}
                {visitasPendientes.length > 0 && (
                  <div className="p-5">
                    <div className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-slate-400 mb-3">Programado ({visitasPendientes.length})</div>
                    <div className="space-y-2">
                      {visitasPendientes.map(v => {
                        const eqs = v.tipo === 'cambio' ? (v.datos?.cambios || []).map(c => `${c.sale?.codigo} → ${c.entra?.codigo}`) : (v.datos?.equipos || []).map(x => x.equipo?.codigo)
                        return (
                          <div key={v.id} className="flex items-start gap-3 p-3 rounded-[10px] border border-[#F59E0B]/30 bg-[#FFFBEB]">
                            <Truck size={15} className="text-[#B45309] flex-shrink-0 mt-0.5" />
                            <div className="min-w-0 flex-1">
                              <div className="text-[13px] font-semibold text-slate-800">{NOMBRE_ACCION[accionDeEntrega(v)]} · {v.estado?.nombre === 'En progreso' ? 'en camino' : 'por iniciar'}</div>
                              <div className="text-[12px] text-slate-500 truncate">{v.repartidor?.nombre || 'Sin repartidor'} · {formatear(v.fecha_programada, { month: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>
                              <div className="text-[11.5px] text-slate-400 font-mono truncate">{eqs.join(' · ')}</div>
                            </div>
                            {v.estado?.nombre !== 'En progreso' && (
                              <button onClick={() => cancelarVisita(v)} className="text-[12px] font-semibold text-red-500 hover:underline flex-shrink-0">Cancelar</button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Recarga periódica: solo si el préstamo tiene equipos que se recargan */}
                {recargables.length > 0 && !['Finalizada', 'Cancelada'].includes(drawerEstado) && (
                  <div className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-slate-400">Recargas</div>
                      {!editRecarga && (
                        <button onClick={() => { setEditRecarga(true); setNuevaFrecuencia(drawer.recarga_cada_dias ? String(drawer.recarga_cada_dias) : '') }}
                          className="flex items-center gap-1 text-[11.5px] text-[#D81B43] font-semibold hover:underline">
                          <Edit3 size={11} /> {drawer.recarga_cada_dias ? 'Cambiar' : 'Definir frecuencia'}
                        </button>
                      )}
                    </div>
                    {!editRecarga ? (
                      <div className="text-[13px] text-slate-700">
                        {drawer.recarga_cada_dias
                          ? <>Cada <b>{drawer.recarga_cada_dias} días</b>{proxima && <> · próxima <b className={new Date(proxima) < new Date() ? 'text-[#D81B43]' : ''}>{formatearSoloFecha(proxima.slice(0, 10))}</b></>}</>
                          : <span className="text-slate-400">A demanda (sin frecuencia)</span>}
                        {drawer.ultima_recarga && <div className="text-[12px] text-slate-400 mt-0.5">Última: {formatear(drawer.ultima_recarga)}</div>}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] text-slate-600">Cada</span>
                          <input type="number" min={1} value={nuevaFrecuencia} onChange={e => setNuevaFrecuencia(e.target.value)} placeholder="15" className={`${inputCls} !w-24`} />
                          <span className="text-[13px] text-slate-600">días</span>
                        </div>
                        <div className="text-[11.5px] text-slate-400">Déjalo vacío para recargas solo a demanda. Cuando toque, aparece en los avisos del inicio.</div>
                        <div className="flex gap-2">
                          <button onClick={guardarFrecuencia} className="flex-1 py-2 bg-[#D81B43] text-white rounded-[8px] text-[12.5px] font-semibold hover:bg-[#B0172F]">Guardar</button>
                          <button onClick={() => setEditRecarga(false)} className="flex-1 py-2 border border-slate-200 text-slate-500 rounded-[8px] text-[12.5px] hover:border-slate-300">Cancelar</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Equipos — en grilla con ícono, mismo estilo que Cliente/Paciente */}
                <div className="p-5">
                  <div className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-slate-400 mb-3">
                    Equipos ({drawer.equipos?.length || 0})
                  </div>
                  {!drawer.equipos?.length
                    ? <div className="text-[13px] text-slate-400">Sin equipos asociados</div>
                    : <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {drawer.equipos.map(oe => {
                          const devuelto = !!oe.fecha_devolucion
                          return (
                            <div key={oe.id} className="border border-slate-200 rounded-[10px] p-3 flex gap-3 items-start">
                              <div className="w-12 h-12 rounded-[9px] bg-slate-50 border border-slate-200 flex items-center justify-center flex-shrink-0">
                                <IconoTipo tipo={oe.equipo?.tipo_equipo} categorias={categorias} size={28} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="text-[13px] font-bold text-slate-800 truncate">{nombreEquipo(oe.equipo)}</div>
                                  {devuelto ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-[#ECFDF5] text-[#0F7B55] flex-shrink-0">
                                      <CheckCircle2 size={9} /> Devuelto
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-[#E8F7FB] text-[#0E86A0] flex-shrink-0">
                                      Activo
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11.5px] text-slate-400 truncate">
                                  {[oe.equipo?.codigo, oe.equipo?.atributos?.serie && `Serie ${oe.equipo.atributos.serie}`].filter(Boolean).join(' · ')}
                                </div>
                                {devuelto && (
                                  <div className="text-[11px] text-slate-400 mt-1.5">
                                    Devuelto el {formatear(oe.fecha_devolucion)}
                                    {oe.observaciones_devolucion && (
                                      <div className="italic mt-0.5">&ldquo;{oe.observaciones_devolucion}&rdquo;</div>
                                    )}
                                  </div>
                                )}
                                {!devuelto && conActa && (
                                  <div className="mt-2.5 flex flex-wrap gap-2">
                                    <button type="button" onClick={() => iniciarAccion('devolucion', [oe.id])}
                                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[8px] border border-[#D81B43]/25 bg-[#D81B43]/[0.05] text-[12px] font-semibold text-[#D81B43] hover:bg-[#D81B43]/10 transition-colors">
                                      <Undo2 size={13} /> Recoger
                                    </button>
                                    {seRecarga(oe.equipo?.tipo_equipo) && (
                                      <button type="button" onClick={() => iniciarAccion('recarga', [oe.id])}
                                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[8px] border border-[#0E86A0]/25 bg-[#E8F7FB] text-[12px] font-semibold text-[#0E86A0] hover:border-[#0E86A0]/45 transition-colors">
                                        <RefreshCw size={13} /> Recargar
                                      </button>
                                    )}
                                    <button type="button" onClick={() => iniciarAccion('cambio', [oe.id])}
                                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[8px] border border-[#1B3A6B]/20 bg-[#1B3A6B]/[0.05] text-[12px] font-semibold text-[#1B3A6B] hover:bg-[#1B3A6B]/10 transition-colors">
                                      <ArrowLeftRight size={13} /> Cambiar
                                    </button>
                                  </div>
                                )}
                                {!devuelto && puedeCambiarEquipo && !conActa && (
                                  <div className="mt-2.5 flex flex-wrap gap-2">
                                    <button type="button" onClick={() => setModalCambio(oe)}
                                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[8px] border border-[#1B3A6B]/20 bg-[#1B3A6B]/[0.05] text-[12px] font-semibold text-[#1B3A6B] hover:bg-[#1B3A6B]/10 hover:border-[#1B3A6B]/35 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2EB5D4]">
                                      <ArrowLeftRight size={13} /> Cambiar equipo
                                    </button>
                                    {!esUnicoEquipo && (
                                      <button type="button" onClick={() => abrirModalDevolucion(oe)}
                                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[8px] border border-[#D81B43]/25 bg-[#D81B43]/[0.05] text-[12px] font-semibold text-[#D81B43] hover:bg-[#D81B43]/10 hover:border-[#D81B43]/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2EB5D4]">
                                        <Undo2 size={13} /> Marcar como devuelto
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                  }
                </div>

                {/* Actas firmadas (lib/actas) */}
                <div className="p-5">
                  <div className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-slate-400 mb-3">Actas</div>
                  <ActasPrestamo key={drawer.id} ordenId={drawer.id} ordenCodigo={drawer.codigo} onToast={showToast} />
                </div>

                {/* Historial: todo lo que le pasó al préstamo, con quién y su acta */}
                <div className="p-5">
                  <div className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-slate-400 mb-3">Historial</div>
                  <HistorialPrestamo key={drawer.id} orden={drawer} />
                </div>
              </div>
            </div>
            </VentanaDetalle>
          )}
          </div>
        </div>
        </div>
      )}

      {vista === 'accion' && accionActiva && (
        <AccionPrestamo key={`${accionActiva.orden.id}-${accionActiva.accion}`}
          orden={accionActiva.orden} accion={accionActiva.accion} preseleccion={accionActiva.preseleccion}
          plantillas={plantillas} disponibles={equiposDisponibles} categorias={categorias} tiposEquipo={tiposEquipo} repartidores={usuarios}
          onSalir={() => { const v = accionActiva.volver; setAccionActiva(null); setVista('lista'); if (v) window.location.assign(v) }}
          onListo={accionLista} />
      )}

      {vista === 'nuevo' && (
        <NuevoPrestamo
          clientes={clientes} pacientes={pacientesLocal} equipos={equipos} categorias={categorias}
          tiposEquipo={tiposEquipo} plantillas={plantillas} repartidores={usuarios} estados={estados}
          estadosEquipo={estadosEquipo || estados} tipos={tipos} usoClientes={usoClientes}
          onSalir={hayDatos => { setVista('lista'); if (hayDatos) showToast('Borrador guardado — lo retomas al crear otro préstamo') }}
          onCreado={prestamoCreado} />
      )}
      </div>


      {/* ── CONFIRMACIÓN CAMBIO DE ESTADO ── */}
      <ConfirmDialog
        abierto={!!modalConfirm}
        titulo={modalConfirm ? (modalConfirm.transicion.nombre === 'Finalizada' ? `Finalizar ${modalConfirm.orden.codigo}` : `Pasar ${modalConfirm.orden.codigo} a ${modalConfirm.transicion.nombre}`) : ''}
        mensaje={modalConfirm?.transicion.nombre === 'Finalizada'
          ? 'Sin acta ni firmas. Los equipos que siguen en el préstamo se marcan como devueltos y quedan disponibles, y se cancela lo que estaba programado.'
          : `${modalConfirm?.orden.estado?.nombre || ''} → ${modalConfirm?.transicion.nombre || ''}`}
        textoConfirmar={modalConfirm ? (modalConfirm.transicion.nombre === 'Finalizada' ? 'Sí, finalizar' : `Sí, ${modalConfirm.transicion.nombre.toLowerCase()}`) : 'Confirmar'}
        onConfirmar={() => avanzarEstado(modalConfirm.orden, modalConfirm.transicion)}
        onCancelar={() => setModalConfirm(null)}
      />

      <ModalDevolucion
        abierto={!!modalDevolucion}
        form={formDevolucion}
        onChangeFecha={v => setFormDevolucion(f => ({ ...f, fecha: v }))}
        onChangeObservaciones={v => setFormDevolucion(f => ({ ...f, observaciones: v }))}
        onConfirmar={() => devolverEquipo(modalDevolucion.ordenEquipoId, modalDevolucion.equipoId, formDevolucion.fecha, formDevolucion.observaciones)}
        onCancelar={() => setModalDevolucion(null)}
      />

      {modalCambio && (
        <ModalCambioEquipo
          equipoActual={modalCambio.equipo}
          disponibles={equiposDisponibles.filter(eq => eq.id !== modalCambio.equipo_id)}
          categorias={categorias}
          tiposEquipo={tiposEquipo}
          entregada={drawerEstado === 'Entregada'}
          guardando={guardandoCambio}
          onConfirmar={cambiarEquipo}
          onCancelar={() => setModalCambio(null)}
        />
      )}

      <ConfirmDialog
        abierto={modalCancelar}
        titulo="¿Cancelar este préstamo?"
        mensaje="La orden quedará marcada como Cancelada y el equipo volverá a estar disponible. El registro no se borra."
        textoConfirmar="Sí, cancelar préstamo"
        textoCancelar="Volver"
        tipo="peligro"
        onConfirmar={cancelarOrden}
        onCancelar={() => setModalCancelar(false)}
      />

      {toast && (
        <div className={`${ui.toast} ${toast.tipo === 'error' ? 'bg-red-500' : 'bg-[#0F7B55]'}`}>
          {toast.msg}
        </div>
      )}

    </div>

  )
}
