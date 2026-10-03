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
import { devolverEquipo as devolverEquipoLib, cambiarEquipo as cambiarEquipoLib } from '@/lib/prestamos'
import ModalCambioEquipo from '@/components/prestamos/ModalCambioEquipo'
import { liberarEquipos } from '@/lib/mantenimientos'
import { buscarCedulaDuplicada, mensajeCedulaDuplicada, esErrorCedulaDuplicada, MENSAJE_CEDULA_DUPLICADA } from '@/lib/pacientes'
import BuzonNovedades from '@/components/layout/BuzonNovedades'
import { useOrdenable } from '@/hooks/useOrdenable'
import { usePaginacion } from '@/hooks/usePaginacion'
import {
  Plus, X, Search, FileText, CheckCircle2, Package,
  AlertTriangle, Calendar, Clock, User, Edit3, Truck, ChevronRight, ChevronLeft,
  Building, Layers, Trash2, Check, Ban, ArrowLeftRight, Undo2
} from 'lucide-react'

const E = {
  Borrador:   'c0b30011-e902-437d-ab1b-b33f753a04d7',
  Programada: '9430f8fe-008f-494e-ada5-3c667799b26c',
  EnReparto:  'e87fa300-a4c7-4225-b618-faf162ccf7ef',
  Entregada:  'acafaf48-918e-4681-bf31-3111c218bcc9',
  Finalizada: '45383dd9-7f9a-426d-830e-d093f105bef9',
}

const FLUJO = ['Borrador', 'Programada', 'En reparto', 'Entregada', 'Finalizada']
const FILAS_POR_PAGINA = 10

const ESTADO_STYLES = {
  'Borrador':   { bg: '#F1F5F9', color: '#64748B', dot: '#94A3B8' },
  'Programada': { bg: '#EFF6FF', color: '#1D4ED8', dot: '#3B82F6' },
  'En reparto': { bg: '#FFFBEB', color: '#B45309', dot: '#F59E0B' },
  'Entregada':  { bg: '#E8F7FB', color: '#0E86A0', dot: '#25A9E0' },
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

const inputCls = 'w-full px-3 py-2.5 border border-slate-200 rounded-[9px] text-[13.5px] text-slate-800 outline-none focus:border-[#D81B43] bg-white transition-colors placeholder:text-slate-400'
const labelCls = 'block text-[11px] font-bold uppercase tracking-[0.07em] text-slate-500 mb-1.5'

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

const PRESETS_VIGENCIA = [30, 60, 90]

// Captura de fecha_vigencia — un solo control para el wizard y para editar una
// orden existente. Apagado = préstamo indefinido (fecha_vigencia null, caso de
// las instituciones). Encendido = chips de 30/60/90 días desde hoy, o "Hasta
// fecha" con selector — siempre se guarda solo la fecha final, nunca la
// duración (si luego se extiende, la duración deja de ser verdad).
function ControlVigencia({ value, onChange }) {
  const activo = !!value
  const chipsCalculados = PRESETS_VIGENCIA.map(dias => ({ dias, fecha: sumarDias(hoyBogota(), dias) }))
  const [modo, setModo] = useState(() => {
    const coincideConChip = value && chipsCalculados.some(c => c.fecha === value)
    return value && !coincideConChip ? 'fecha' : 'chip'
  })

  function toggle() {
    if (activo) { onChange(null); return }
    onChange(sumarDias(hoyBogota(), 30)) // al encender, preselecciona 30 días
    setModo('chip')
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className={labelCls + ' mb-0'}>Vigencia del préstamo</span>
        <button type="button" onClick={toggle} aria-pressed={activo}
          className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${activo ? 'bg-[#D81B43]' : 'bg-slate-200'}`}>
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${activo ? 'translate-x-4' : ''}`} />
        </button>
      </div>

      {!activo ? (
        <div className="text-[12.5px] text-slate-400">Préstamo indefinido — sin fecha de vencimiento (uso típico para instituciones).</div>
      ) : (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            {chipsCalculados.map(c => (
              <button type="button" key={c.dias} onClick={() => { onChange(c.fecha); setModo('chip') }}
                className={`px-3 py-1.5 rounded-full text-[12px] font-medium border transition-all ${
                  modo === 'chip' && value === c.fecha
                    ? 'bg-[#D81B43] text-white border-[#D81B43]'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-[#D81B43]'
                }`}>
                {c.dias} días
              </button>
            ))}
            <button type="button" onClick={() => setModo('fecha')}
              className={`px-3 py-1.5 rounded-full text-[12px] font-medium border transition-all ${
                modo === 'fecha' ? 'bg-[#D81B43] text-white border-[#D81B43]' : 'bg-white border-slate-200 text-slate-600 hover:border-[#D81B43]'
              }`}>
              Hasta fecha
            </button>
          </div>
          {modo === 'fecha' && (
            <input type="date" value={value || ''} onChange={e => onChange(e.target.value || null)} className={inputCls} />
          )}
          {value && (
            <div className="text-[11.5px] text-slate-400">Vence el {formatearSoloFecha(value)}</div>
          )}
        </div>
      )}
    </div>
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

function nombreTipo(tipo) {
  return tipo?.nombre || '—'
}

// Buscador de equipo por código, reusado en las vistas de categorías y tipos del
// mini-navegador — deja saltar directo a la unidad sin navegar nivel por nivel.
function BuscadorCodigoMini({ valor, onChange, resultados, onSeleccionar }) {
  return (
    <div className="relative mb-3">
      <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        value={valor}
        onChange={e => onChange(e.target.value)}
        onBlur={() => setTimeout(() => onChange(''), 200)}
        placeholder="Buscar equipo por código..."
        className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-[9px] text-[13px] outline-none focus:border-[#D81B43]" />
      {resultados.length > 0 && (
        <div className="absolute z-20 left-0 top-full mt-1 w-full bg-white border border-slate-200 rounded-[9px] shadow-lg overflow-hidden max-h-[240px] overflow-y-auto">
          {resultados.slice(0, 8).map(eq => (
            <div key={eq.id} onMouseDown={e => { e.preventDefault(); onSeleccionar(eq) }}
              className="px-3 py-2.5 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0 flex items-center gap-2.5">
              <Package size={12} className="text-[#D81B43] flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[12.5px] font-bold text-slate-800 truncate">{nombreEquipo(eq)}</div>
                <div className="text-[11px] font-mono text-slate-400">{eq.codigo}</div>
              </div>
            </div>
          ))}
          {resultados.length > 8 && (
            <div className="px-3 py-2 text-[11px] text-slate-400 bg-slate-50 text-center">
              +{resultados.length - 8} más — escribe más para afinar
            </div>
          )}
        </div>
      )}
      {valor.trim() && resultados.length === 0 && (
        <div className="absolute z-20 left-0 top-full mt-1 w-full bg-white border border-slate-200 rounded-[9px] shadow-lg px-3 py-3 text-[12px] text-slate-400">
          Sin resultados
        </div>
      )}
    </div>
  )
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
    const desdeUrl = new URLSearchParams(window.location.search).get('atencion') || ''
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
  const [pacienteFiltro, setPacienteFiltro] = useState('')

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

  const [vista, setVista]                   = useState('lista') // 'lista' | 'nuevo'
  const [seccion1Completa, setSeccion1Completa] = useState(false)
  const [seccion2Completa, setSeccion2Completa] = useState(false)
  const [miniVista, setMiniVista]           = useState('categorias') // 'categorias' | 'tipos' | 'unidades'
  const [miniCategoria, setMiniCategoria]   = useState(null)
  const [miniTipo, setMiniTipo]             = useState(null)
  const [buscarCodigoMini, setBuscarCodigoMini] = useState('')
  const [filtrosCamposMini, setFiltrosCamposMini] = useState({})
  const [paginaUnidades, setPaginaUnidades] = useState(1)
  const seccion2Ref = useRef(null)
  const seccion3Ref = useRef(null)
  const [saving, setSaving]                 = useState(false)
  const [toast, setToast]                   = useState(null)
  const [modalConfirm, setModalConfirm]     = useState(null)
  const [wForm, setWForm] = useState({
    cliente_id: '', equipos_ids: [], tiene_paciente: false, paciente_id: '',
    pacienteNuevo: { nombre: '', cedula: '', direccion: '', ciudad: '', telefono: '', correo: '' },
    fecha_inicio: '', domicilio: false, repartidor_id: '', observaciones: '',
    fecha_entrega_domicilio: '', fechaInicioDistinta: false, fecha_vigencia: null,
  })
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

  // Un equipo asignado a un préstamo a domicilio pasa a "Reservado" de inmediato al
  // crear la orden (ver crearOrden), así que basta con filtrar por estado — ya no
  // hace falta cruzar contra órdenes pendientes para no ofrecerlo dos veces.
  const equiposParaMini = useMemo(
    () => equipos.filter(eq => eq.estado?.nombre === 'Disponible'),
    [equipos]
  )

  const miniTiposDeCategoria = useMemo(
    () => miniCategoria ? tiposEquipo.filter(t => t.categoria_id === miniCategoria.id) : [],
    [tiposEquipo, miniCategoria]
  )

  // Solo se muestran categorías con al menos un tipo que tenga unidades disponibles,
  // y dentro de una categoría, solo los tipos que sí tienen disponibles.
  const categoriasConDisponibles = useMemo(() =>
    categorias.filter(cat => {
      const idsTipos = tiposEquipo.filter(t => t.categoria_id === cat.id).map(t => t.id)
      return equiposParaMini.some(eq => idsTipos.includes(eq.tipo_equipo_id))
    }),
    [categorias, tiposEquipo, equiposParaMini]
  )

  const miniTiposConDisponibles = useMemo(
    () => miniTiposDeCategoria.filter(tipo => equiposParaMini.some(eq => eq.tipo_equipo_id === tipo.id)),
    [miniTiposDeCategoria, equiposParaMini]
  )

  const miniUnidadesDeTipo = useMemo(
    () => miniTipo ? equiposParaMini.filter(eq => eq.tipo_equipo_id === miniTipo.id) : [],
    [equiposParaMini, miniTipo]
  )

  // Todas las unidades del tipo (sin filtrar por disponibilidad) — solo para el conteo "X de Y"
  const unidadesTotalDelTipo = useMemo(
    () => miniTipo ? equipos.filter(eq => eq.tipo_equipo_id === miniTipo.id) : [],
    [equipos, miniTipo]
  )

  const unidadesFiltradasEnTipo = useMemo(() => {
    let result = miniUnidadesDeTipo
    Object.entries(filtrosCamposMini).forEach(([clave, valor]) => {
      if (valor) result = result.filter(eq => (eq.atributos?.[clave] ?? eq[clave])?.toString().toLowerCase().includes(valor.toLowerCase()))
    })
    return result
  }, [miniUnidadesDeTipo, filtrosCamposMini])

  // Filtros dinámicos de unidad definidos por categoría (igual que en Inventario), sin el de Estado.
  // Si la categoría no tiene campos configurados, mostramos al menos la columna de código.
  const camposUnidadMini = miniCategoria?.atributos_extra?.campos_unidad?.length
    ? miniCategoria.atributos_extra.campos_unidad
    : [{ clave: 'codigo', nombre: 'Código', tipo: 'texto' }]

  const valoresUnicosPorCampoMini = useMemo(() => {
    const result = {}
    for (const campo of camposUnidadMini) {
      result[campo.clave] = [...new Set(
        miniUnidadesDeTipo.map(eq => eq.atributos?.[campo.clave] ?? eq[campo.clave]).filter(v => v != null && v !== '')
      )].sort()
    }
    return result
  }, [miniUnidadesDeTipo, camposUnidadMini])

  const unidadesPaginadas = useMemo(() => {
    const inicio = (paginaUnidades - 1) * FILAS_POR_PAGINA
    return unidadesFiltradasEnTipo.slice(inicio, inicio + FILAS_POR_PAGINA)
  }, [unidadesFiltradasEnTipo, paginaUnidades])

  const totalPaginasUnidades = Math.max(1, Math.ceil(unidadesFiltradasEnTipo.length / FILAS_POR_PAGINA))

  useEffect(() => {
    const t = setTimeout(() => setPaginaUnidades(1), 0)
    return () => clearTimeout(t)
  }, [miniTipo, filtrosCamposMini])

  // Búsqueda de equipo por código, disponible desde las vistas de categorías y tipos —
  // deja saltar directo a la unidad sin tener que navegar nivel por nivel
  const resultadosBusquedaMini = useMemo(() => {
    const q = buscarCodigoMini.trim().toLowerCase()
    if (!q) return []
    let pool = equiposParaMini
    if (miniVista === 'tipos' && miniCategoria) {
      const idsTiposCat = tiposEquipo.filter(t => t.categoria_id === miniCategoria.id).map(t => t.id)
      pool = pool.filter(eq => idsTiposCat.includes(eq.tipo_equipo_id))
    }
    return pool.filter(eq => {
      if (eq.codigo?.toLowerCase().includes(q)) return true
      return Object.values(eq.atributos || {}).some(v => String(v).toLowerCase().includes(q))
    })
  }, [buscarCodigoMini, equiposParaMini, miniVista, miniCategoria, tiposEquipo])

  const pacientesFiltrados = useMemo(() => {
    const q = pacienteFiltro.trim().toLowerCase()
    if (!q) return []
    return pacientesLocal.filter(p => [p.nombre, p.cedula]
      .some(v => v?.toLowerCase().includes(q)))
  }, [pacientesLocal, pacienteFiltro])

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
  const opcionesMarca      = useMemo(() => [...new Set(ordenesPorTab.flatMap(o => (o.equipos || []).map(oe => oe.equipo?.tipo_equipo?.nombre).filter(Boolean)))].sort(), [ordenesPorTab])
  const opcionesCategoria  = useMemo(() => [...new Set(ordenesPorTab.flatMap(o => (o.equipos || []).map(oe => oe.equipo?.tipo_equipo?.categoria?.nombre).filter(Boolean)))].sort(), [ordenesPorTab])

  const ordenesFiltradas = useMemo(() => {
    return ordenes.filter(o => {
      if (tabPrincipal !== 'todos') {
        const bucket = BUCKETS[tabPrincipal] || []
        if (!bucket.includes(o.estado?.nombre)) return false
      }
      if (search) {
        const q = search.toLowerCase()
        const pasa = [o.codigo, o.cliente?.nombre, o.paciente?.nombre, o.repartidor?.nombre]
          .some(v => v?.toLowerCase().includes(q))
        if (!pasa) return false
      }
      if (filtroEstadoDetalle && o.estado?.nombre !== filtroEstadoDetalle) return false
      if (filtroCliente      && o.cliente?.nombre !== filtroCliente)        return false
      if (filtroMarca) {
        const tiene = (o.equipos || []).some(oe => oe.equipo?.tipo_equipo?.nombre === filtroMarca)
        if (!tiene) return false
      }
      if (filtroCategoria) {
        const tiene = (o.equipos || []).some(oe => oe.equipo?.tipo_equipo?.categoria?.nombre === filtroCategoria)
        if (!tiene) return false
      }
      if (filtroAtencion === 'prestamos_vencidos' && !estaVencida(o)) return false
      if (filtroAtencion === 'prestamos_por_vencer') {
        const dias = diasParaVencer(o)
        if (estaVencida(o) || dias === null || dias > 7) return false
      }
      return true
    })
  }, [ordenes, search, tabPrincipal, filtroEstadoDetalle, filtroCliente, filtroMarca, filtroCategoria, filtroAtencion])

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

    // Al finalizar la orden, los equipos vuelven a "Disponible" y se desvinculan del paciente/cliente
    // (los que están en mantenimiento siguen así — ver lib/mantenimientos.js)
    let errorLiberar = null
    if (transicion.nombre === 'Finalizada') {
      const idsEquipos = (orden.equipos || []).map(oe => oe.equipo_id || oe.equipo?.id).filter(Boolean)
      const estadoDisponible = (estadosEquipo || []).find(e => e.nombre === 'Disponible')
      ;({ error: errorLiberar } = await liberarEquipos(supabase, idsEquipos, estadoDisponible?.id))
    }

    const nuevoEstado = { id: transicion.id, nombre: transicion.nombre }
    setOrdenes(prev => prev.map(o => o.id === orden.id ? { ...o, estado: nuevoEstado } : o))
    setDrawer(prev => ({ ...prev, estado: nuevoEstado }))
    setModalConfirm(null)
    if (errorLiberar) showToast('La orden se finalizó, pero no se pudo liberar algún equipo: ' + errorLiberar.message, 'error')
    else showToast(transicion.nombre === 'Finalizada' ? 'Orden finalizada — equipos liberados' : `Orden → ${transicion.nombre}`)
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

  // ── NUEVO PRÉSTAMO (acordeón de página completa) ─────────
  function iniciarNuevoPrestamo() {
    setWForm({
      cliente_id: '', equipos_ids: [], tiene_paciente: false, paciente_id: '',
      pacienteNuevo: { nombre: '', cedula: '', direccion: '', ciudad: '', telefono: '', correo: '' },
      fecha_inicio: '', domicilio: false, repartidor_id: '', observaciones: '',
      fecha_entrega_domicilio: '', fechaInicioDistinta: false, fecha_vigencia: null,
    })
    setPacienteFiltro('')
    setSeccion1Completa(false)
    setSeccion2Completa(false)
    setMiniVista('categorias')
    setMiniCategoria(null)
    setMiniTipo(null)
    setFiltrosCamposMini({})
    setBuscarCodigoMini('')
    setVista('nuevo')
  }

  function cancelarNuevo() {
    setVista('lista')
    setSeccion1Completa(false)
    setSeccion2Completa(false)
  }

  function agregarEquipo(id) {
    setWForm(f => f.equipos_ids.includes(id) ? f : { ...f, equipos_ids: [...f.equipos_ids, id] })
  }

  function quitarEquipo(id) {
    setWForm(f => ({ ...f, equipos_ids: f.equipos_ids.filter(e => e !== id) }))
  }

  function miniIrACategoria(cat) { setMiniCategoria(cat); setMiniVista('tipos'); setBuscarCodigoMini('') }
  function miniIrATipo(tipo) { setMiniTipo(tipo); setMiniVista('unidades'); setFiltrosCamposMini({}); setBuscarCodigoMini('') }
  function miniVolver() {
    if (miniVista === 'unidades') { setMiniVista('tipos'); setMiniTipo(null); setFiltrosCamposMini({}) }
    else if (miniVista === 'tipos') { setMiniVista('categorias'); setMiniCategoria(null); setBuscarCodigoMini('') }
  }

  function irDirectoAUnidad(eq) {
    const tipo = tiposEquipo.find(t => t.id === eq.tipo_equipo_id)
    const cat  = categorias.find(c => c.id === tipo?.categoria_id)
    setMiniCategoria(cat || null)
    setMiniTipo(tipo || null)
    setMiniVista('unidades')
    setFiltrosCamposMini({})
    setBuscarCodigoMini('')
  }

  function volverACategorias() {
    setMiniVista('categorias'); setMiniCategoria(null); setMiniTipo(null)
    setFiltrosCamposMini({}); setBuscarCodigoMini('')
  }

  function avanzarSeccion1() {
    if (!wForm.cliente_id) { showToast('Selecciona un cliente', 'error'); return }
    if (wForm.tiene_paciente && !wForm.pacienteNuevo.nombre.trim()) {
      showToast('El nombre del paciente es obligatorio', 'error'); return
    }
    if (wForm.tiene_paciente && !wForm.pacienteNuevo.direccion.trim()) {
      showToast('La dirección del paciente es obligatoria', 'error'); return
    }
    if (wForm.tiene_paciente) {
      const duplicado = buscarCedulaDuplicada(pacientesLocal, wForm.pacienteNuevo.cedula, wForm.paciente_id || null)
      if (duplicado) { showToast(mensajeCedulaDuplicada(duplicado), 'error'); return }
    }
    setSeccion1Completa(true)
    setTimeout(() => seccion2Ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  function avanzarSeccion2() {
    if (wForm.equipos_ids.length === 0) { showToast('Agrega al menos un equipo', 'error'); return }
    setSeccion2Completa(true)
    setTimeout(() => seccion3Ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  function seleccionarPaciente(paciente) {
    setWForm(f => ({
      ...f,
      paciente_id: paciente.id,
      pacienteNuevo: {
        nombre:    paciente.nombre    || '',
        cedula:    paciente.cedula    || '',
        direccion: paciente.direccion || '',
        ciudad:    paciente.ciudad    || '',
        telefono:  paciente.telefono  || '',
        correo:    paciente.correo    || '',
      },
    }))
    setPacienteFiltro('')
  }

  function limpiarPacienteSeleccionado() {
    setWForm(f => ({ ...f, paciente_id: '', pacienteNuevo: { nombre: '', cedula: '', direccion: '', ciudad: '', telefono: '', correo: '' } }))
  }

  async function crearOrden() {
    if (!wForm.cliente_id) {
      showToast('Selecciona un cliente', 'error'); return
    }
    if (wForm.equipos_ids.length === 0) {
      showToast('Agrega al menos un equipo', 'error'); return
    }
    if (wForm.domicilio) {
      if (!wForm.fecha_entrega_domicilio) { showToast('Ingresa la fecha de entrega del equipo', 'error'); return }
      if (wForm.fechaInicioDistinta && !wForm.fecha_inicio) { showToast('Ingresa la fecha de inicio del préstamo', 'error'); return }
    } else {
      if (!wForm.fecha_inicio) { showToast('Ingresa la fecha de inicio del préstamo', 'error'); return }
    }
    if (wForm.tiene_paciente && !wForm.pacienteNuevo.nombre.trim()) {
      showToast('Completa los datos del paciente o desmarca la casilla', 'error'); return
    }
    if (wForm.tiene_paciente && !wForm.pacienteNuevo.direccion.trim()) {
      showToast('La dirección del paciente es obligatoria', 'error'); return
    }
    if (wForm.tiene_paciente) {
      const duplicado = buscarCedulaDuplicada(pacientesLocal, wForm.pacienteNuevo.cedula, wForm.paciente_id || null)
      if (duplicado) { showToast(mensajeCedulaDuplicada(duplicado), 'error'); return }
    }
    if (wForm.domicilio && !wForm.repartidor_id) {
      showToast('Selecciona un repartidor', 'error'); return
    }
    setSaving(true)

    const tipoOrden = tipos.find(t => {
      const nombre = t.nombre?.toLowerCase() || ''
      return nombre.includes('arrendamiento') || nombre.includes('préstamo') || nombre.includes('prestamo')
    })
    if (!tipoOrden) {
      showToast('No se encontró el tipo de orden de préstamo/arrendamiento', 'error'); setSaving(false); return
    }

    // La lista del wizard se cargó al abrir la página: si entretanto a un equipo
    // le abrieron un mantenimiento o lo prestaron, no se presta.
    const { data: estadosActuales, error: errEstados } = await supabase.from('equipos')
      .select('codigo, estado:estados_equipo(nombre)').in('id', wForm.equipos_ids)
    if (errEstados) { showToast('Error verificando los equipos: ' + errEstados.message, 'error'); setSaving(false); return }
    const noDisponibles = (estadosActuales || []).filter(e => e.estado?.nombre !== 'Disponible')
    if (noDisponibles.length > 0) {
      showToast(`Ya no está disponible: ${noDisponibles.map(e => `${e.codigo} (${e.estado?.nombre})`).join(', ')}`, 'error')
      setSaving(false); router.refresh(); return
    }

    let pacienteId = wForm.tiene_paciente ? wForm.paciente_id : null
    if (wForm.tiene_paciente && pacienteId) {
      // Paciente existente — puede haber sido editado en el formulario, se actualiza
      const { error: errUpdatePac } = await supabase.from('pacientes').update({
        nombre:    wForm.pacienteNuevo.nombre.trim(),
        cedula:    wForm.pacienteNuevo.cedula.trim() || null,
        direccion: wForm.pacienteNuevo.direccion.trim(),
        ciudad:    wForm.pacienteNuevo.ciudad.trim() || null,
        telefono:  wForm.pacienteNuevo.telefono.trim() || null,
        correo:    wForm.pacienteNuevo.correo.trim() || null,
      }).eq('id', pacienteId)
      if (errUpdatePac) {
        showToast(esErrorCedulaDuplicada(errUpdatePac) ? MENSAJE_CEDULA_DUPLICADA : 'Error actualizando paciente: ' + errUpdatePac.message, 'error')
        setSaving(false); return
      }
      setPacientesLocal(prev => prev.map(p => p.id === pacienteId ? {
        ...p,
        nombre: wForm.pacienteNuevo.nombre.trim(),
        cedula: wForm.pacienteNuevo.cedula.trim() || null,
      } : p))
    } else if (wForm.tiene_paciente && !pacienteId) {
      const { data: nuevoPaciente, error: errPac } = await supabase.from('pacientes')
        .insert({
          nombre:    wForm.pacienteNuevo.nombre.trim(),
          cedula:    wForm.pacienteNuevo.cedula.trim() || null,
          direccion: wForm.pacienteNuevo.direccion.trim(),
          ciudad:    wForm.pacienteNuevo.ciudad.trim() || null,
          telefono:  wForm.pacienteNuevo.telefono.trim() || null,
          correo:    wForm.pacienteNuevo.correo.trim() || null,
        }).select('id').single()
      if (errPac) {
        showToast(esErrorCedulaDuplicada(errPac) ? MENSAJE_CEDULA_DUPLICADA : 'Error creando paciente: ' + errPac.message, 'error')
        setSaving(false); return
      }
      pacienteId = nuevoPaciente.id
      setPacientesLocal(prev => [...prev, {
        id: nuevoPaciente.id,
        nombre: wForm.pacienteNuevo.nombre.trim(),
        cedula: wForm.pacienteNuevo.cedula.trim() || null,
        activo: true,
      }])
    }

    const estadoProgramada = estados.find(e => e.nombre === 'Programada')
    const estadoEntregada  = estados.find(e => e.nombre === 'Entregada')
    if (!estadoProgramada || !estadoEntregada) {
      showToast('No se encontraron los estados de orden necesarios (Programada/Entregada) — revisa la tabla estados_orden', 'error')
      setSaving(false); return
    }
    const estadoInicial = wForm.domicilio ? estadoProgramada.id : estadoEntregada.id
    const notaInicio = wForm.domicilio && wForm.fechaInicioDistinta && wForm.fecha_inicio
      ? `[Inicio: ${wForm.fecha_inicio}]${wForm.observaciones ? ' ' + wForm.observaciones : ''}`
      : wForm.observaciones || null

    const { data: orden, error: errOrden } = await supabase.from('ordenes_servicio')
      .insert({
        tipo_orden_id: tipoOrden.id,
        cliente_id:    wForm.cliente_id,
        paciente_id:   pacienteId,
        estado_id:     estadoInicial,
        repartidor_id: wForm.domicilio ? wForm.repartidor_id : null,
        fecha_entrega: paraGuardar(wForm.domicilio ? wForm.fecha_entrega_domicilio : wForm.fecha_inicio),
        observaciones: notaInicio,
        fecha_vigencia: wForm.fecha_vigencia || null,
      }).select('id').single()

    if (errOrden) { showToast('Error: ' + errOrden.message, 'error'); setSaving(false); return }

    for (const equipoId of wForm.equipos_ids) {
      const { error: errEq } = await supabase.from('orden_equipos').insert({
        orden_id: orden.id,
        equipo_id: equipoId,
        fecha_entrega: wForm.domicilio ? null : paraGuardar(wForm.fecha_inicio),
      })
      if (errEq) { showToast('Error vinculando equipo: ' + errEq.message, 'error'); setSaving(false); return }

      if (!wForm.domicilio) {
        const estadoPrestamo = (estadosEquipo || estados).find(e => e.nombre === 'En préstamo')
        if (estadoPrestamo) {
          await supabase.from('equipos').update({
            estado_id:          estadoPrestamo.id,
            paciente_actual_id: pacienteId,
            cliente_actual_id:  wForm.cliente_id,
          }).eq('id', equipoId)
        }
      } else {
        const estadoReservado = (estadosEquipo || estados).find(e => e.nombre === 'Reservado')
        if (estadoReservado) {
          await supabase.from('equipos').update({
            estado_id:          estadoReservado.id,
            paciente_actual_id: pacienteId,
            cliente_actual_id:  wForm.cliente_id,
          }).eq('id', equipoId)
        }
      }
    }

    registrarBitacora({
      modulo: 'ordenes', accion: 'crear', entidad: 'préstamo', entidad_id: orden.id,
      detalle: { cliente_id: wForm.cliente_id, equipos_ids: wForm.equipos_ids, con_domicilio: wForm.domicilio, fecha_vigencia: wForm.fecha_vigencia || null }
    })

    showToast(wForm.domicilio ? 'Préstamo creado — pendiente de entrega' : 'Préstamo registrado y activo')
    setSaving(false)
    setSeccion1Completa(false)
    setSeccion2Completa(false)
    setVista('lista')
    router.refresh()
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

    // Libera los equipos de esta orden que aún no se hayan devuelto
    // (los que están en mantenimiento siguen así — ver lib/mantenimientos.js)
    const estadoDisponible = (estadosEquipo || []).find(e => e.nombre === 'Disponible')
    const idsALiberar = (drawer.equipos || [])
      .filter(oe => !oe.fecha_devolucion)
      .map(oe => oe.equipo_id || oe.equipo?.id)
      .filter(Boolean)
    const { error: errLiberar } = await liberarEquipos(supabase, idsALiberar, estadoDisponible?.id)

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

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Topbar */}
      <div className="h-14 md:h-16 md:bg-white md:border-b md:border-slate-200 flex items-center px-4 md:px-7 flex-shrink-0">
        <div>
          <div className="text-[18px] font-bold text-slate-800">Préstamos</div>
          <div className="text-[12px] text-slate-400 mt-0.5">Gestión de préstamos de equipos biomédicos</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <BuzonNovedades />
        </div>
      </div>

      {/* FAB móvil */}
      {vista === 'lista' && (
        <button onClick={iniciarNuevoPrestamo}
          className="fixed bottom-[calc(var(--mobile-nav-space,0px)+16px)] right-4 z-30 md:hidden shadow-lg rounded-full w-14 h-14 bg-[#D81B43] text-white flex items-center justify-center">
          <Plus size={22} strokeWidth={2.5} />
        </button>
      )}

      <div className="flex-1 overflow-hidden flex flex-col">
      {vista === 'lista' && (
        <div className="flex-1 overflow-hidden flex flex-col p-3 md:p-6 pb-28 md:pb-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">

          {/* FRANJA 1 — Filtros, SIEMPRE fija, nunca cambia con la selección */}
          <div className="p-3 md:p-6 pb-3 md:pb-4 flex-shrink-0 border-b border-slate-200">
            <div className="flex flex-col gap-2 md:gap-3">
              {/* Fila 1 — búsqueda, pestañas, conteo y acción principal */}
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
                <div className="relative w-full md:w-[340px] md:flex-shrink-0">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar por código o cliente..."
                    className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-[9px] text-[13px] outline-none focus:border-[#D81B43] bg-white" />
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
                    activo={!!(search || filtroEstadoDetalle || filtroCliente || filtroMarca || filtroCategoria || filtroAtencion)}
                    onLimpiar={() => { setSearch(''); setFiltroEstadoDetalle(''); setFiltroCliente(''); setFiltroMarca(''); setFiltroCategoria(''); setFiltroAtencion('') }} />
                  {!drawer && (
                    <div className="hidden md:block text-[12px] text-slate-400 flex-shrink-0">
                      {ordenesFiltradas.length} préstamo{ordenesFiltradas.length !== 1 ? 's' : ''}
                    </div>
                  )}
                  <button onClick={iniciarNuevoPrestamo}
                    className="hidden md:flex items-center gap-1.5 px-4 h-[38px] bg-[#D81B43] text-white text-[13px] font-semibold rounded-[9px] hover:bg-[#B0172F] transition-colors flex-shrink-0 whitespace-nowrap">
                    <Plus size={14} strokeWidth={2.5} /> Nuevo préstamo
                  </button>
                </div>
              </div>

              {/* Fila 2 — panel de filtros */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <select value={filtroEstadoDetalle} onChange={e => setFiltroEstadoDetalle(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-[9px] text-[12.5px] text-slate-700 outline-none focus:border-[#D81B43] bg-white h-[38px]">
                    <option value="">Estado</option>
                    {opcionesEstado.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                  <select value={filtroCliente} onChange={e => setFiltroCliente(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-[9px] text-[12.5px] text-slate-700 outline-none focus:border-[#D81B43] bg-white h-[38px]">
                    <option value="">Cliente</option>
                    {opcionesCliente.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select value={filtroMarca} onChange={e => setFiltroMarca(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-[9px] text-[12.5px] text-slate-700 outline-none focus:border-[#D81B43] bg-white h-[38px]">
                    <option value="">Tipo de equipo</option>
                    {opcionesMarca.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-[9px] text-[12.5px] text-slate-700 outline-none focus:border-[#D81B43] bg-white h-[38px]">
                    <option value="">Categoría</option>
                    {opcionesCategoria.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                {filtroAtencion && (
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1.5 bg-[#FFFBEB] border border-[#F59E0B]/40 text-[#B45309] text-[12px] font-medium px-3 py-1.5 rounded-full">
                      Filtro: {filtroAtencion === 'prestamos_vencidos' ? 'préstamos vencidos' : 'préstamos por vencer'}
                      <button type="button" onClick={() => setFiltroAtencion('')} className="hover:text-[#7C2D12]">
                        <X size={12} />
                      </button>
                    </span>
                  </div>
                )}
              </div>
            </div>

          {/* FRANJA 2 — aquí ocurre toda la transición: lista + panel */}
          <div className="flex flex-1 overflow-hidden flex-col md:flex-row">

            {/* Columna lista — SIEMPRE montada; solo cambia de ancho (100% ↔ 380px) según haya o no detalle abierto */}
            <div className={`${drawer ? 'hidden md:flex' : 'flex'} flex-col overflow-hidden transition-all duration-300 w-full ${drawer ? 'md:w-[380px] md:flex-shrink-0 md:border-r md:border-slate-200' : ''}`}>

              {/* Lista/tabla — un solo contenedor de scroll; adentro cambia cómo se pinta cada fila según el ancho disponible */}
              <div ref={listaScrollRef} className="flex-1 overflow-y-auto px-3 md:px-6 pt-3 md:pt-6 pb-28 md:pb-6">
              {ordenesFiltradas.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <div className="font-semibold mb-1">
                      {search || filtroEstadoDetalle || filtroCliente || filtroMarca ? 'Sin resultados' : (
                        tabPrincipal === 'todos'    ? 'Sin préstamos registrados' :
                        tabPrincipal === 'en_curso' ? 'Sin préstamos en curso' :
                        'Sin préstamos en historial'
                      )}
                    </div>
                    <div className="text-[13px]">
                      {search || filtroEstadoDetalle || filtroCliente || filtroMarca ? 'Intenta con otros filtros' :
                       tabPrincipal === 'todos'    ? 'Usa "Nuevo préstamo" para registrar uno' :
                       tabPrincipal === 'en_curso' ? 'Usa "Nuevo préstamo" para registrar uno' :
                       'Los préstamos finalizados aparecerán aquí'}
                    </div>
                  </div>
              ) : drawer ? (
                /* Lista compacta — solo se ve cuando la columna está angosta (detalle abierto).
                   Usa la MISMA página que la tabla (ordenesPagina), no la lista completa:
                   antes, al abrir un préstamo se mostraban todos y se perdía la página. */
                <div className="-mx-3 md:-mx-6">
                  {ordenesPagina.map(o => {
                    const retrasada = estaRetrasada(o)
                    return (
                      <div key={o.id} onClick={() => abrirDrawer(o)}
                        className={`px-4 py-3 border-b border-slate-100 cursor-pointer transition-colors ${drawer?.id === o.id ? 'bg-[#FFF0F3] border-l-[3px] border-l-[#D81B43]' : 'hover:bg-slate-50'}`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[12px] font-bold text-slate-700">{o.codigo || '—'}</span>
                          <EstadoBadge orden={o} retrasada={retrasada} />
                        </div>
                        <div className="text-[12.5px] font-semibold text-slate-700 truncate mt-0.5">{o.cliente?.nombre || '—'}</div>
                      </div>
                    )
                  })}
                  <Paginador {...paginacionOrdenes} compacto />
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
                                  <div className="w-8 h-8 rounded-full bg-[#D81B43]/10 flex items-center justify-center text-[12px] font-bold text-[#D81B43] flex-shrink-0">
                                    {o.cliente?.nombre?.charAt(0)?.toUpperCase() || '?'}
                                  </div>
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

            {/* Panel de detalle — aparece a la derecha sin reemplazar la columna de lista */}
          {drawer && (
            <div className="flex flex-col flex-1 overflow-hidden animate-panel-detalle">
              {/* Header — blanco como Clientes */}
              <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#D81B43]/10 flex items-center justify-center text-[15px] font-bold text-[#D81B43] flex-shrink-0">
                    {drawer.cliente?.nombre?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <div className="text-[15px] font-bold text-slate-800 leading-tight">{drawer.cliente?.nombre || '—'}</div>
                    <div className="font-mono text-[11.5px] text-slate-400 mt-0.5">{drawer.codigo}</div>
                  </div>
                </div>
                <button onClick={() => setDrawer(null)} title="Cerrar (ESC)" className="text-slate-400 hover:text-slate-600 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100">
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 pb-28 md:pb-6">

                {/* Estado + timeline + acción */}
                <div className="p-5">
                  <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                    <EstadoBadge orden={drawer} retrasada={drawerRetrasada} />
                    <div className="flex items-center gap-2">
                      {puedeFinalizarUnico && (
                        <button onClick={() => abrirModalDevolucion(equiposDrawer[0])}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#D81B43] text-white text-[12px] font-semibold rounded-[7px] hover:bg-[#B0172F]">
                          <CheckCircle2 size={13} /> Finalizar préstamo
                        </button>
                      )}
                      {transicion && !esUnicoEquipo && (
                        <button onClick={() => setModalConfirm({ orden: drawer, transicion })}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#D81B43] text-white text-[12px] font-semibold rounded-[7px] hover:bg-[#B0172F]">
                          → {transicion.nombre}
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
                    <div className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-slate-400">Repartidor</div>
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
                      <div className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-slate-400">Fecha y hora de entrega</div>
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
                      <div className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-slate-400">Vigencia del préstamo</div>
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
                  <div className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-3">Detalles</div>
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

                {/* Equipos — en grilla con ícono, mismo estilo que Cliente/Paciente */}
                <div className="p-5">
                  <div className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-3">
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
                                {!devuelto && puedeCambiarEquipo && (
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

                {/* Documentos */}
                <div className="p-5">
                  <div className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-3">
                    Documentos ({drawer.plantillas?.length || 0})
                  </div>
                  {!drawer.plantillas?.length
                    ? <div className="text-[13px] text-slate-400">Sin documentos asignados</div>
                    : <div className="space-y-2">
                        {drawer.plantillas.map(op => (
                          <div key={op.id} className="flex items-center gap-3 p-3 border border-slate-200 rounded-[9px]">
                            <FileText size={14} className="text-slate-400 flex-shrink-0" />
                            <div className="flex-1 text-[13px] font-medium text-slate-700">{op.plantilla?.nombre || '—'}</div>
                            <span className={`text-[11px] font-semibold ${op.firmado ? 'text-[#0F7B55]' : 'text-slate-400'}`}>
                              {op.firmado ? '✓ Firmado' : 'Pendiente'}
                            </span>
                          </div>
                        ))}
                      </div>
                  }
                </div>
              </div>
            </div>
          )}
          </div>
        </div>
        </div>
      )}

      {vista === 'nuevo' && (
        <div className="flex-1 overflow-y-auto p-3 md:p-6 space-y-4">

          {/* SECCIÓN 1 — Cliente */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <div className="text-[13px] font-bold text-slate-700 mb-4">1. Cliente</div>
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Cliente <span className="text-[#D81B43]">*</span></label>
                <select value={wForm.cliente_id} onChange={e => setWForm(f => ({ ...f, cliente_id: e.target.value }))} className={inputCls}>
                  <option value="">Seleccionar cliente...</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={wForm.tiene_paciente}
                    onChange={e => setWForm(f => ({ ...f, tiene_paciente: e.target.checked, paciente_id: e.target.checked ? f.paciente_id : '', pacienteNuevo: e.target.checked ? f.pacienteNuevo : { nombre: '', cedula: '', direccion: '', ciudad: '', telefono: '', correo: '' } }))} />
                  <span className="text-[13.5px] font-medium text-slate-700">¿Tiene paciente asociado?</span>
                </label>

                {wForm.tiene_paciente && (
                  <div className="bg-slate-50 border border-slate-200 rounded-[10px] p-4 space-y-3">
                    {!wForm.paciente_id ? (
                      <>
                        <div className="relative">
                          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input value={pacienteFiltro} onChange={e => setPacienteFiltro(e.target.value)}
                            placeholder="Buscar paciente por nombre o cédula..."
                            className="w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-[9px] text-[13.5px] outline-none focus:border-[#D81B43] bg-white" />
                        </div>
                        {pacientesFiltrados.length > 0 && (
                          <div className="border border-slate-200 rounded-[9px] bg-white shadow-sm max-h-[220px] overflow-y-auto">
                            {pacientesFiltrados.map(p => (
                              <button key={p.id} type="button" onClick={() => seleccionarPaciente(p)}
                                className="w-full text-left px-4 py-3 border-b last:border-b-0 hover:bg-slate-50">
                                <div className="text-[13px] font-semibold text-slate-800 truncate">{p.nombre}</div>
                                <div className="text-[11px] text-slate-500">{p.cedula || 'Sin cédula'}</div>
                              </button>
                            ))}
                          </div>
                        )}
                        <div className="text-[12px] text-slate-400">O completa los datos abajo para crear un paciente nuevo</div>
                      </>
                    ) : (
                      <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-200">
                        <div className="flex items-center gap-1.5 text-[12.5px] text-[#0F7B55] font-semibold">
                          <CheckCircle2 size={14} /> Paciente existente — puedes editar sus datos si hace falta
                        </div>
                        <button type="button" onClick={limpiarPacienteSeleccionado}
                          className="text-[12px] text-slate-500 hover:text-[#D81B43] font-medium flex-shrink-0">Cambiar</button>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>Nombre <span className="text-[#D81B43]">*</span></label>
                        <input value={wForm.pacienteNuevo.nombre} onChange={e => setWForm(f => ({ ...f, pacienteNuevo: { ...f.pacienteNuevo, nombre: e.target.value } }))}
                          type="text" className={inputCls} />
                      </div>
                      <div>
                        <label className={labelCls}>Cédula</label>
                        <input value={wForm.pacienteNuevo.cedula} onChange={e => setWForm(f => ({ ...f, pacienteNuevo: { ...f.pacienteNuevo, cedula: e.target.value.replace(/[^0-9]/g, '') } }))}
                          type="text" inputMode="numeric" className={inputCls} />
                      </div>
                      <div>
                        <label className={labelCls}>Dirección <span className="text-[#D81B43]">*</span></label>
                        <input value={wForm.pacienteNuevo.direccion} onChange={e => setWForm(f => ({ ...f, pacienteNuevo: { ...f.pacienteNuevo, direccion: e.target.value } }))}
                          type="text" className={inputCls} />
                      </div>
                      <div>
                        <label className={labelCls}>Ciudad</label>
                        <input value={wForm.pacienteNuevo.ciudad} onChange={e => setWForm(f => ({ ...f, pacienteNuevo: { ...f.pacienteNuevo, ciudad: e.target.value } }))}
                          type="text" className={inputCls} />
                      </div>
                      <div>
                        <label className={labelCls}>Correo</label>
                        <input value={wForm.pacienteNuevo.correo} onChange={e => setWForm(f => ({ ...f, pacienteNuevo: { ...f.pacienteNuevo, correo: e.target.value } }))}
                          type="email" className={inputCls} />
                      </div>
                      <div>
                        <label className={labelCls}>Teléfono</label>
                        <input value={wForm.pacienteNuevo.telefono} onChange={e => setWForm(f => ({ ...f, pacienteNuevo: { ...f.pacienteNuevo, telefono: e.target.value } }))}
                          type="text" className={inputCls} />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className={labelCls}>Observaciones</label>
                <textarea value={wForm.observaciones} onChange={e => setWForm(f => ({ ...f, observaciones: e.target.value }))}
                  placeholder="Notas adicionales..." rows={3}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-[9px] text-[13.5px] outline-none focus:border-[#D81B43] resize-none placeholder:text-slate-400" />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-slate-100">
              <button onClick={cancelarNuevo}
                className="px-4 py-2.5 border border-slate-200 rounded-[9px] text-[13px] font-medium text-slate-600 hover:border-slate-300">
                Cancelar
              </button>
              <button onClick={avanzarSeccion1}
                className="px-5 py-2.5 bg-[#D81B43] text-white rounded-[9px] text-[13px] font-semibold hover:bg-[#B0172F]">
                Siguiente →
              </button>
            </div>
          </div>

          {/* SECCIÓN 2 — Equipos */}
          {seccion1Completa && (
            <div ref={seccion2Ref} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <div className="text-[13px] font-bold text-slate-700 mb-4">2. Equipos</div>

              <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-4">
                {/* Mini-navegador de inventario */}
                <div>
                  {miniVista === 'tipos' && (
                    <button type="button" onClick={miniVolver}
                      className="flex items-center gap-1 text-[12px] text-slate-500 hover:text-[#D81B43] mb-3 font-medium">
                      <ChevronRight size={12} className="rotate-180" /> Volver
                    </button>
                  )}

                  {miniVista === 'categorias' && (
                    <div>
                      <BuscadorCodigoMini valor={buscarCodigoMini} onChange={setBuscarCodigoMini}
                        resultados={resultadosBusquedaMini} onSeleccionar={irDirectoAUnidad} />
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {categoriasConDisponibles.map(cat => {
                        const nTipos = tiposEquipo.filter(t => t.categoria_id === cat.id).length
                        return (
                          <div key={cat.id} onClick={() => miniIrACategoria(cat)}
                            className="bg-slate-50 rounded-[9px] border border-slate-200 p-3 cursor-pointer hover:border-[#D81B43]/40 transition-all">
                            <div className="text-[12.5px] font-bold text-slate-700 leading-tight">{cat.nombre}</div>
                            <div className="text-[10.5px] text-slate-400 mt-0.5">{nTipos} tipo{nTipos !== 1 ? 's' : ''}</div>
                          </div>
                        )
                      })}
                      {categoriasConDisponibles.length === 0 && (
                        <div className="col-span-full text-[12.5px] text-slate-400 text-center py-6">Sin equipos disponibles en ninguna categoría</div>
                      )}
                    </div>
                    </div>
                  )}

                  {miniVista === 'tipos' && (
                    <div>
                      <BuscadorCodigoMini valor={buscarCodigoMini} onChange={setBuscarCodigoMini}
                        resultados={resultadosBusquedaMini} onSeleccionar={irDirectoAUnidad} />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {miniTiposConDisponibles.map(tipo => {
                        const stockTotal = equipos.filter(eq => eq.tipo_equipo_id === tipo.id).length
                        const stockDisp  = equiposParaMini.filter(eq => eq.tipo_equipo_id === tipo.id).length
                        const enUso = stockTotal - stockDisp
                        return (
                          <div key={tipo.id} onClick={() => miniIrATipo(tipo)}
                            className="bg-white rounded-[9px] border border-slate-200 overflow-hidden cursor-pointer hover:border-[#D81B43]/40 hover:shadow-sm transition-all flex">
                            <div className="w-[44px] h-[44px] flex-shrink-0 bg-slate-50 flex items-center justify-center border-r border-slate-100">
                              <IconoTipo tipo={tipo} categorias={categorias} size={26} />
                            </div>
                            <div className="p-2 flex-1 min-w-0 relative">
                              <div className="text-[11.5px] font-bold text-slate-800 leading-snug pr-8 truncate">{nombreTipo(tipo)}</div>
                              <div className="text-[10px] mt-0.5">
                                <span className="font-bold text-[#0F7B55]">{stockDisp} disp.</span>
                                {enUso > 0 && <span className="text-slate-400"> · {enUso} en uso</span>}
                              </div>
                              <div className="absolute top-1 right-1 bg-white border border-slate-100 rounded-full px-1.5 py-0.5">
                                <span className="text-[10px] font-extrabold text-slate-800 tabular-nums">{stockTotal}</span>
                                <span className="text-[8px] text-slate-400 ml-0.5">uds.</span>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                      {miniTiposConDisponibles.length === 0 && (
                        <div className="col-span-full text-[12.5px] text-slate-400 text-center py-6">Sin tipos con unidades disponibles en esta categoría</div>
                      )}
                    </div>
                    </div>
                  )}

                  {miniVista === 'unidades' && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-2.5 text-[12px]">
                        <button onClick={volverACategorias} className="text-slate-500 hover:text-slate-700 flex items-center gap-1">
                          <ChevronLeft size={13} /> Volver
                        </button>
                        <span className="text-slate-300">/</span>
                        <span className="text-slate-400">{miniCategoria?.nombre}</span>
                        <span className="text-slate-300">/</span>
                        <span className="font-bold text-slate-800">{nombreTipo(miniTipo)}</span>
                      </div>

                      <div className="flex items-center gap-3 mb-3.5 pb-3.5 border-b border-slate-100">
                        <div className="w-[52px] h-[52px] rounded-[10px] bg-slate-50 border border-slate-200 flex items-center justify-center flex-shrink-0">
                          <IconoTipo tipo={miniTipo} categorias={categorias} size={30} />
                        </div>
                        <div>
                          <div className="text-[15px] font-bold text-slate-800">{nombreTipo(miniTipo)}</div>
                          <div className="text-[11.5px] text-slate-400">
                            {miniUnidadesDeTipo.length} disponibles de {unidadesTotalDelTipo.length} unidades
                          </div>
                        </div>
                      </div>

                      <div className="bg-slate-50 border border-slate-200 rounded-[9px] p-2.5 mb-3 grid grid-cols-2 gap-2">
                        {camposUnidadMini.map(campo => {
                          const valoresUnicos = valoresUnicosPorCampoMini[campo.clave] || []
                          const usarDropdown = valoresUnicos.length > 0 && valoresUnicos.length <= 6
                          return (
                            <div key={campo.clave}>
                              <label className="text-[10px] font-bold uppercase text-slate-500 mb-1 block truncate">{campo.nombre}</label>
                              {usarDropdown ? (
                                <select value={filtrosCamposMini[campo.clave] || ''}
                                  onChange={e => setFiltrosCamposMini(f => ({ ...f, [campo.clave]: e.target.value }))}
                                  className="w-full px-2 py-1.5 border border-slate-200 rounded-[7px] text-[12px] outline-none focus:border-[#D81B43] bg-white">
                                  <option value="">Todos</option>
                                  {valoresUnicos.map(v => <option key={v} value={v}>{v}</option>)}
                                </select>
                              ) : (
                                <input type="text" value={filtrosCamposMini[campo.clave] || ''}
                                  onChange={e => setFiltrosCamposMini(f => ({ ...f, [campo.clave]: e.target.value }))}
                                  placeholder="Filtrar…"
                                  className="w-full px-2 py-1.5 border border-slate-200 rounded-[7px] text-[12px] outline-none focus:border-[#D81B43] bg-white placeholder:text-slate-400" />
                              )}
                            </div>
                          )
                        })}
                      </div>

                      <div className="border border-slate-200 rounded-[9px] overflow-hidden overflow-x-auto">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200">
                              {camposUnidadMini.map(c => (
                                <th key={c.clave} className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.05em] text-slate-400 bg-slate-50 whitespace-nowrap">{c.nombre}</th>
                              ))}
                              <th className="w-10 bg-slate-50"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {unidadesPaginadas.map(eq => {
                              const seleccionado = wForm.equipos_ids.includes(eq.id)
                              return (
                                <tr key={eq.id}
                                  onClick={() => seleccionado ? quitarEquipo(eq.id) : agregarEquipo(eq.id)}
                                  className={`border-b border-slate-100 last:border-0 cursor-pointer transition-colors ${seleccionado ? 'bg-[#FFF0F3]' : 'hover:bg-slate-50'}`}>
                                  {camposUnidadMini.map(c => {
                                    const valor = eq.atributos?.[c.clave] ?? eq[c.clave]
                                    return (
                                      <td key={c.clave} className="px-3 py-2 text-[12.5px] text-slate-600 whitespace-nowrap">
                                        {c.clave === 'codigo'
                                          ? <span className="font-mono text-[12px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">{valor || '—'}</span>
                                          : (valor ?? '—')}
                                      </td>
                                    )
                                  })}
                                  <td className="px-2 py-2 text-right">
                                    <button type="button"
                                      onClick={e => { e.stopPropagation(); seleccionado ? quitarEquipo(eq.id) : agregarEquipo(eq.id) }}
                                      className={`w-6 h-6 rounded-full inline-flex items-center justify-center transition-colors ${
                                        seleccionado ? 'bg-[#D81B43] text-white' : 'bg-[#D81B43]/10 text-[#D81B43]'}`}>
                                      {seleccionado ? <Check size={12} strokeWidth={3} /> : <Plus size={12} strokeWidth={3} />}
                                    </button>
                                  </td>
                                </tr>
                              )
                            })}
                            {unidadesPaginadas.length === 0 && (
                              <tr><td colSpan={camposUnidadMini.length + 1} className="text-center py-8 text-[12.5px] text-slate-400">Sin unidades que coincidan</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>

                      {totalPaginasUnidades > 1 && (
                        <div className="flex items-center justify-between mt-2.5 text-[12px] text-slate-500">
                          <button type="button" disabled={paginaUnidades === 1} onClick={() => setPaginaUnidades(p => p - 1)}
                            className="px-2.5 py-1.5 border border-slate-200 rounded-[7px] disabled:opacity-40 disabled:cursor-not-allowed hover:border-slate-300">
                            ‹ Anterior
                          </button>
                          <span>Página {paginaUnidades} de {totalPaginasUnidades} · {unidadesFiltradasEnTipo.length} unidades</span>
                          <button type="button" disabled={paginaUnidades === totalPaginasUnidades} onClick={() => setPaginaUnidades(p => p + 1)}
                            className="px-2.5 py-1.5 border border-slate-200 rounded-[7px] disabled:opacity-40 disabled:cursor-not-allowed hover:border-slate-300">
                            Siguiente ›
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Carrito */}
                <div className="md:border-l md:border-slate-100 md:pl-4">
                  <div className={labelCls}>Carrito ({wForm.equipos_ids.length})</div>
                  {wForm.equipos_ids.length === 0 ? (
                    <div className="text-[12.5px] text-slate-400 text-center py-8 border border-dashed border-slate-200 rounded-[9px]">
                      Agrega equipos desde el panel de la izquierda
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {wForm.equipos_ids.map(id => {
                        const eq = equipos.find(e => e.id === id)
                        if (!eq) return null
                        return (
                          <div key={id} className="flex items-center gap-2.5 p-2.5 rounded-[8px] border border-[#D81B43]/30 bg-[#D81B43]/5">
                            <Package size={14} className="text-[#D81B43] flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="text-[13px] font-semibold text-slate-700 truncate">{nombreEquipo(eq)}</div>
                              <div className="text-[11px] font-mono text-slate-400">{eq.codigo}</div>
                              <div className="text-[10.5px] text-slate-400 truncate">{eq.tipo_equipo?.categoria?.nombre}</div>
                            </div>
                            <button type="button" onClick={() => quitarEquipo(id)}
                              className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors flex-shrink-0">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-slate-100">
                <button onClick={cancelarNuevo}
                  className="px-4 py-2.5 border border-slate-200 rounded-[9px] text-[13px] font-medium text-slate-600 hover:border-slate-300">
                  Cancelar
                </button>
                <button onClick={avanzarSeccion2}
                  className="px-5 py-2.5 bg-[#D81B43] text-white rounded-[9px] text-[13px] font-semibold hover:bg-[#B0172F]">
                  Siguiente →
                </button>
              </div>
            </div>
          )}

          {/* SECCIÓN 3 — Resumen y entrega */}
          {seccion2Completa && (
            <div ref={seccion3Ref} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <div className="text-[13px] font-bold text-slate-700 mb-4">3. Resumen y entrega</div>

              <div className="mb-5 pb-5 border-b border-slate-100 space-y-3">
                <div>
                  <div className="text-[10px] font-semibold uppercase text-slate-400 mb-1">Cliente</div>
                  <div className="text-[13.5px] font-semibold text-slate-800">{clientes.find(c => c.id === wForm.cliente_id)?.nombre || '—'}</div>
                </div>
                {wForm.tiene_paciente && (
                  <div>
                    <div className="text-[10px] font-semibold uppercase text-slate-400 mb-1">Paciente</div>
                    <div className="text-[13.5px] font-semibold text-slate-800">
                      {wForm.pacienteNuevo.nombre || '—'}
                    </div>
                  </div>
                )}
                <div>
                  <div className="text-[10px] font-semibold uppercase text-slate-400 mb-1">Equipos ({wForm.equipos_ids.length})</div>
                  <div className="flex flex-wrap gap-1.5">
                    {wForm.equipos_ids.map(id => {
                      const eq = equipos.find(e => e.id === id)
                      if (!eq) return null
                      return (
                        <span key={id} className="text-[11.5px] font-mono bg-slate-100 text-slate-600 px-2 py-1 rounded">
                          {eq.codigo}
                        </span>
                      )
                    })}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={wForm.domicilio}
                      onChange={e => setWForm(f => ({ ...f, domicilio: e.target.checked, repartidor_id: '', fecha_entrega_domicilio: '', fechaInicioDistinta: false, fecha_inicio: '' }))} />
                    <span className="text-[13.5px] font-medium text-slate-700">¿Entrega a domicilio?</span>
                  </label>
                </div>

                {!wForm.domicilio && (
                  <div>
                    <label className={labelCls}>Fecha de inicio del préstamo <span className="text-[#D81B43]">*</span></label>
                    <input type="date" value={wForm.fecha_inicio}
                      onChange={e => setWForm(f => ({ ...f, fecha_inicio: e.target.value }))} className={inputCls} />
                  </div>
                )}

                {wForm.domicilio && (
                  <>
                    <div>
                      <label className={labelCls}>Repartidor <span className="text-[#D81B43]">*</span></label>
                      <select value={wForm.repartidor_id} onChange={e => setWForm(f => ({ ...f, repartidor_id: e.target.value }))} className={inputCls}>
                        <option value="">Seleccionar repartidor...</option>
                        {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Fecha y hora de entrega del equipo <span className="text-[#D81B43]">*</span></label>
                      <input type="datetime-local" value={wForm.fecha_entrega_domicilio}
                        onChange={e => setWForm(f => ({ ...f, fecha_entrega_domicilio: e.target.value }))} className={inputCls} />
                    </div>
                    <label className="flex items-center gap-2 text-[12.5px] text-slate-600 cursor-pointer">
                      <input type="checkbox" checked={wForm.fechaInicioDistinta}
                        onChange={e => setWForm(f => ({ ...f, fechaInicioDistinta: e.target.checked, fecha_inicio: '' }))} />
                      La fecha de inicio del préstamo es diferente a la fecha de entrega
                    </label>
                    {wForm.fechaInicioDistinta && (
                      <div>
                        <label className={labelCls}>Fecha de inicio del préstamo <span className="text-[#D81B43]">*</span></label>
                        <input type="date" value={wForm.fecha_inicio}
                          onChange={e => setWForm(f => ({ ...f, fecha_inicio: e.target.value }))} className={inputCls} />
                      </div>
                    )}
                  </>
                )}

                <div className="pt-3 border-t border-slate-100">
                  <ControlVigencia value={wForm.fecha_vigencia}
                    onChange={v => setWForm(f => ({ ...f, fecha_vigencia: v }))} />
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-slate-100">
                <button onClick={cancelarNuevo}
                  className="px-4 py-2.5 border border-slate-200 rounded-[9px] text-[13px] font-medium text-slate-600 hover:border-slate-300">
                  Cancelar
                </button>
                <button onClick={crearOrden} disabled={saving}
                  className="px-5 py-2.5 bg-[#D81B43] text-white rounded-[9px] text-[13px] font-semibold hover:bg-[#B0172F] disabled:opacity-50">
                  {saving ? 'Creando...' : '✓ Crear préstamo'}
                </button>
              </div>
            </div>
          )}

        </div>
      )}
      </div>

      {/* ── MODAL CONFIRMACIÓN CAMBIO ESTADO ── */}
      {modalConfirm && (
        <>
          <div className="fixed inset-0 bg-black/50 z-[60] backdrop-blur-sm" />
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-[380px] p-6 shadow-2xl">
              <div className="w-12 h-12 rounded-full bg-[#D81B43]/10 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={22} className="text-[#D81B43]" />
              </div>
              <h3 className="text-[16px] font-bold text-slate-800 mb-2 text-center">Cambiar estado</h3>
              <p className="text-[13px] text-slate-500 text-center mb-1">
                <span className="font-semibold text-slate-700">{modalConfirm.orden.codigo}</span>
              </p>
              <p className="text-[13px] text-center text-slate-400 mb-2">
                {modalConfirm.orden.estado?.nombre} → <span className="font-bold text-[#D81B43]">{modalConfirm.transicion.nombre}</span>
              </p>
              {modalConfirm.transicion.nombre === 'Programada' && !modalConfirm.orden.fecha_entrega && (
                <div className="text-[12px] text-[#B45309] bg-[#FFFBEB] px-3 py-2 rounded-[8px] mb-4 text-center">
                  No hay fecha de entrega programada
                </div>
              )}
              <div className="flex gap-2 mt-4">
                <button onClick={() => avanzarEstado(modalConfirm.orden, modalConfirm.transicion)}
                  className="flex-1 py-2.5 bg-[#D81B43] text-white rounded-[9px] text-[13px] font-semibold hover:bg-[#B0172F]">
                  Confirmar
                </button>
                <button onClick={() => setModalConfirm(null)}
                  className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-[9px] text-[13px] font-semibold hover:bg-slate-200">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </>
      )}

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
          disponibles={equiposParaMini.filter(eq => eq.id !== modalCambio.equipo_id)}
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
        <div className={`fixed bottom-28 md:bottom-6 right-4 md:right-6 left-4 md:left-auto text-center md:text-left z-[70] px-4 py-3 rounded-[10px] text-[13px] font-medium text-white shadow-lg ${toast.tipo === 'error' ? 'bg-red-500' : 'bg-[#0F7B55]'}`}>
          {toast.msg}
        </div>
      )}

    </div>

  )
}
