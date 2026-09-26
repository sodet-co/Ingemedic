'use client'
import { useState, useMemo, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { registrarBitacora } from '@/lib/bitacora'
import {
  Plus, X, Edit3, Search, Building2, User,
  Phone, Mail, MapPin, FileText, AlertTriangle, ChevronRight,
  Package, Truck, Clock, ArrowDownLeft, ArrowUpRight, Download, UserPlus, Loader2, CheckCircle2,
  HeartPulse
} from 'lucide-react'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import LimpiarFiltros from '@/components/ui/LimpiarFiltros'
import ModalDevolucion from '@/components/entregas/ModalDevolucion'
import Paginador from '@/components/ui/Paginador'
import { Box } from '@/components/ui/Skeleton'
import { IconoTipo } from '@/components/inventario/IconoTipo'
import BuzonNovedades from '@/components/layout/BuzonNovedades'
import { useOrdenable } from '@/hooks/useOrdenable'
import { usePaginacion } from '@/hooks/usePaginacion'
import { formatear, formatearSoloFecha, hoyBogota } from '@/lib/fechas'
import { devolverEquipo as devolverEquipoLib } from '@/lib/prestamos'
import { buscarCedulaDuplicada, mensajeCedulaDuplicada, esErrorCedulaDuplicada, MENSAJE_CEDULA_DUPLICADA } from '@/lib/pacientes'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const LOGO_URL = `${SUPABASE_URL}/storage/v1/object/public/logos/logo-ingemedic.png`

const inputCls = 'w-full px-3 py-2.5 border border-slate-200 rounded-[9px] text-[13.5px] text-slate-800 outline-none focus:border-[#D81B43] bg-white transition-colors placeholder:text-slate-400'
const labelCls = 'block text-[11px] font-bold uppercase tracking-[0.07em] text-slate-500 mb-1.5'

const TIPO_STYLES = {
  'Jurídica': { bg: '#E8F7FB', color: '#0E86A0', icon: <Building2 size={14} /> },
  'Natural': { bg: '#F1F5F9', color: '#475569', icon: <User size={14} /> },
}

function msNow() { return Date.now() }

export default function ClientesClient({ clientesIniciales, clientesInactivosIniciales = [], departamentos, municipios, pacientesIniciales = [], equiposConPaciente = [], equiposConCliente = [] }) {
  const router = useRouter()
  const supabase = createClient()
  const skipSyncUntil = useRef(0)

  const [tabActiva, setTabActiva] = useState('clientes') // 'clientes' | 'pacientes'

  const [clientes, setClientes] = useState(clientesIniciales)
  const [clientesInactivos, setClientesInactivos] = useState(clientesInactivosIniciales)
  const [mostrarInactivos, setMostrarInactivos] = useState(false)
  const [pacientes, setPacientes] = useState(pacientesIniciales)
  // Copia local de equiposConPaciente — a diferencia de "clientes"/"pacientes", esta lista
  // SÍ necesita actualizarse al instante (no esperar el round-trip de router.refresh()) porque
  // de ella depende directamente que el equipo desaparezca de "Equipos actuales" al devolverlo
  // desde el panel de Paciente (ver confirmarDevolucion).
  const [equiposConPacienteLocal, setEquiposConPacienteLocal] = useState(equiposConPaciente)

  // Mantener el estado local sincronizado cuando el servidor manda datos frescos
  useEffect(() => {
    const t = setTimeout(() => {
      if (Date.now() < skipSyncUntil.current) return
      setClientes(clientesIniciales)
    }, 0)
    return () => clearTimeout(t)
  }, [clientesIniciales])

  useEffect(() => {
    const t = setTimeout(() => {
      if (Date.now() < skipSyncUntil.current) return
      setClientesInactivos(clientesInactivosIniciales)
    }, 0)
    return () => clearTimeout(t)
  }, [clientesInactivosIniciales])

  useEffect(() => {
    const t = setTimeout(() => {
      if (Date.now() < skipSyncUntil.current) return
      setPacientes(pacientesIniciales)
    }, 0)
    return () => clearTimeout(t)
  }, [pacientesIniciales])

  useEffect(() => {
    const t = setTimeout(() => {
      if (Date.now() < skipSyncUntil.current) return
      setEquiposConPacienteLocal(equiposConPaciente)
    }, 0)
    return () => clearTimeout(t)
  }, [equiposConPaciente])

  // ── SINCRONIZACIÓN EN TIEMPO REAL ─────────────────────────
  // Sin esto, un dispositivo no se entera de cambios hechos en otro
  // (ej. otro usuario creó o editó un cliente) hasta recargar la página.
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
      .channel('clientes-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clientes' }, refrescarConDebounce)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pacientes' }, refrescarConDebounce)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'equipos' }, refrescarConDebounce)
      .subscribe()

    return () => { clearTimeout(debounceTimer); supabase.removeChannel(canal) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [search, setSearch] = useState('')
  const [filtroCliente, setFiltroCliente] = useState('todos') // 'todos' | 'con_prestamos' | 'sin_prestamos'
  const [drawer, setDrawer] = useState(null)
  const [modal, setModal] = useState(false)
  const [modalEliminar, setModalEliminar] = useState(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)
  const [form, setForm] = useState({})
  const [formDirty, setFormDirty] = useState(false)
  const [confirmarSalir, setConfirmarSalir] = useState(false)
  const [municipiosFiltrados, setMunicipiosFiltrados] = useState([])
  const [historial, setHistorial] = useState({ loading: false, ordenes: [], entregas: [] })
  const [tabHoja, setTabHoja] = useState('prestamo') // 'prestamo' | 'ordenes' | 'linea'
  const [pdfGenerando, setPdfGenerando] = useState(false)
  const [exportando, setExportando] = useState(false)

  // ── DEVOLUCIÓN DE EQUIPOS (Cliente y Paciente) — mismo modal/lógica que Préstamos ──
  const [modalDevolucion, setModalDevolucion] = useState(null) // { ordenEquipoId, equipoId, ordenId, contexto: 'cliente'|'paciente' } o null
  const [formDevolucion, setFormDevolucion]   = useState({ fecha: '', observaciones: '' })

  // ── PESTAÑA PACIENTES ──
  const [searchPaciente, setSearchPaciente] = useState('')
  const [filtroPaciente, setFiltroPaciente] = useState('todos') // 'todos' | 'con_equipo' | 'sin_equipo'
  const [drawerPaciente, setDrawerPaciente] = useState(null)
  const [ordenesPorEquipo, setOrdenesPorEquipo] = useState({ loading: false, mapa: {} })
  // Crear paciente desde este módulo. La otra vía (crearlo dentro del wizard
  // de Nuevo préstamo, OrdenesClient.js) sigue igual — mismos campos y mismas
  // validaciones que allá, para que los dos caminos dejen datos equivalentes.
  const [modalPaciente, setModalPaciente] = useState(false)
  const [formPaciente, setFormPaciente] = useState({})

  // ESC cierra el detalle abierto y regresa a la vista normal — el listener solo
  // existe mientras hay algo seleccionado, para no interceptar ESC en el resto de la app.
  useEffect(() => {
    if (!drawer) return
    const onEsc = e => { if (e.key === 'Escape') setDrawer(null) }
    window.addEventListener('keydown', onEsc)
    return () => window.removeEventListener('keydown', onEsc)
  }, [drawer])

  useEffect(() => {
    if (!drawerPaciente) return
    const onEsc = e => { if (e.key === 'Escape') setDrawerPaciente(null) }
    window.addEventListener('keydown', onEsc)
    return () => window.removeEventListener('keydown', onEsc)
  }, [drawerPaciente])

  function showToast(msg, tipo = 'success') {
    setToast({ msg, tipo })
    setTimeout(() => setToast(null), 3000)
  }

  // Cierra cualquiera de los dos modales (cliente o paciente) — comparten formDirty y el ConfirmDialog de salir
  function cerrarModal() { setModal(false); setModalPaciente(false); setFormDirty(false) }
  function intentarCerrarModal() { if (formDirty) setConfirmarSalir(true); else cerrarModal() }

  function abrirModal(cliente = null) {
    setFormDirty(false)
    if (cliente) {
      setForm({
        id: cliente.id,
        tipo_persona: cliente.tipo_persona || '',
        nombre: cliente.nombre || '',
        nit_cc: cliente.nit_cc || '',
        digito_verificacion: cliente.digito_verificacion || '',
        direccion: cliente.direccion || '',
        telefono: (cliente.telefono || '').replace(/\D/g, '').slice(0, 12),
        email: cliente.email || '',
        departamento_id: cliente.departamento_id || '',
        municipio_id: cliente.municipio_id || '',
      })
      if (cliente.departamento_id)
        setMunicipiosFiltrados(municipios.filter(m => m.departamento_id === cliente.departamento_id))
    } else {
      setForm({ tipo_persona: '', nombre: '', nit_cc: '', digito_verificacion: '', direccion: '', telefono: '', email: '', departamento_id: '', municipio_id: '' })
      setMunicipiosFiltrados([])
    }
    setModal(true)
  }

  function abrirModalPaciente() {
    setFormDirty(false)
    setFormPaciente({ nombre: '', cedula: '', direccion: '', ciudad: '', telefono: '', correo: '' })
    setModalPaciente(true)
  }

  async function guardarPaciente() {
    const f = formPaciente
    if (!f.nombre?.trim()) { showToast('El nombre del paciente es requerido', 'error'); return }
    if (!f.direccion?.trim()) { showToast('La dirección del paciente es requerida', 'error'); return }
    if (f.correo?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.correo.trim())) { showToast('El correo no tiene un formato válido', 'error'); return }
    const cedula = f.cedula?.trim()
    const duplicado = buscarCedulaDuplicada(pacientes, cedula)
    if (duplicado) { showToast(mensajeCedulaDuplicada(duplicado), 'error'); return }
    setSaving(true)
    const { data, error } = await supabase.from('pacientes')
      .insert({
        nombre:    f.nombre.trim(),
        cedula:    cedula || null,
        direccion: f.direccion.trim(),
        ciudad:    f.ciudad?.trim() || null,
        telefono:  f.telefono?.trim() || null,
        correo:    f.correo?.trim() || null,
      })
      .select('*')
      .single()
    if (error) {
      showToast(esErrorCedulaDuplicada(error) ? MENSAJE_CEDULA_DUPLICADA : 'Error: ' + error.message, 'error')
      setSaving(false); return
    }
    skipSyncUntil.current = Date.now() + 2500
    setPacientes(prev => [...prev, data].sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es')))
    showToast('Paciente creado')
    registrarBitacora({ modulo: 'clientes', accion: 'crear', entidad: 'paciente', entidad_id: data.id, detalle: { nombre: data.nombre } })
    setSaving(false); cerrarModal()
  }

  function onChangeDepartamento(depId) {
    setForm(f => ({ ...f, departamento_id: depId, municipio_id: '' }))
    setMunicipiosFiltrados(municipios.filter(m => m.departamento_id === depId))
  }

  // ── HOJA DE VIDA DEL CLIENTE — órdenes, entregas y equipos en préstamo ──
  async function abrirDrawer(cliente) {
    setDrawer(cliente)
    setTabHoja('prestamo')
    setHistorial({ loading: true, ordenes: [], entregas: [] })

    const [{ data: ordenes }, { data: entregas }] = await Promise.all([
      supabase.from('ordenes_servicio').select(`
        id, codigo, fecha_creacion, fecha_vigencia, observaciones,
        tipo:tipos_orden(id, nombre),
        estado:estados_orden(id, nombre),
        equipos:orden_equipos(
          id, fecha_entrega, fecha_devolucion,
          equipo:equipos(id, codigo, tipo_equipo:tipos_equipo(id, nombre, atributos), paciente_actual:pacientes(nombre))
        )
      `).eq('cliente_id', cliente.id).order('fecha_creacion', { ascending: false }),
      supabase.from('entregas').select(`
        id, codigo, tipo, fecha_completada, fecha_asignacion, recibido_por,
        estado:estados_entrega(id, nombre),
        orden:ordenes_servicio(id, codigo)
      `).eq('cliente_id', cliente.id).order('fecha_asignacion', { ascending: false }),
    ])

    setHistorial({ loading: false, ordenes: ordenes || [], entregas: entregas || [] })
  }

  // ── DEVOLUCIÓN DE EQUIPOS — misma lógica que Préstamos (src/lib/prestamos.js), reutilizada
  // acá para los paneles de Cliente y Paciente. "contexto" dice de cuál de los dos vino el
  // click, para saber qué actualizar localmente después: el drawer de Cliente arma su lista de
  // "En préstamo" con un fetch propio (historial) que hay que volver a llamar; el de Paciente se
  // arma del prop equiposConPaciente — probado que esperar a que router.refresh() lo actualice
  // no es instantáneo, así que ahí se hace un splice optimista sobre la copia local del prop.
  function abrirModalDevolucion(oe, contexto) {
    setModalDevolucion({ ordenEquipoId: oe.ordenEquipoId, equipoId: oe.equipoId, ordenId: oe.ordenId, contexto })
    setFormDevolucion({ fecha: hoyBogota(), observaciones: '' })
  }

  async function confirmarDevolucion() {
    const { ordenEquipoId, equipoId, ordenId, contexto } = modalDevolucion
    const { error, todosDevueltos } = await devolverEquipoLib({
      supabase, ordenEquipoId, equipoId, ordenId,
      fechaDevolucion: formDevolucion.fecha, observaciones: formDevolucion.observaciones,
    })
    if (error) { showToast('Error: ' + error.message, 'error'); return }

    showToast(todosDevueltos ? 'Todos los equipos devueltos — préstamo finalizado' : 'Equipo devuelto')
    setModalDevolucion(null)

    if (contexto === 'cliente' && drawer) {
      await abrirDrawer(drawer)
    } else if (contexto === 'paciente') {
      skipSyncUntil.current = Date.now() + 2500
      setEquiposConPacienteLocal(prev => prev.filter(e => e.id !== equipoId))
    }
    router.refresh()
  }

  // Equipos actualmente en préstamo: tienen fecha_entrega pero no fecha_devolucion,
  // en una orden que no esté cancelada.
  const equiposEnPrestamo = useMemo(() => {
    const lista = []
    for (const orden of historial.ordenes) {
      for (const oe of orden.equipos || []) {
        if (oe.fecha_entrega && !oe.fecha_devolucion) {
          lista.push({ ...oe, orden })
        }
      }
    }
    return lista
  }, [historial.ordenes])

  // ── LÍNEA DE TIEMPO — cliente creado + órdenes + entregas, todo en un solo hilo cronológico ──
  const lineaTiempo = useMemo(() => {
    if (!drawer) return []
    const eventos = []

    if (drawer.fecha_creacion) {
      eventos.push({ fecha: drawer.fecha_creacion, tipo: 'cliente', label: 'Cliente registrado en el sistema' })
    }
    for (const o of historial.ordenes) {
      eventos.push({ fecha: o.fecha_creacion, tipo: 'orden', label: `Orden ${o.codigo} creada · ${o.tipo?.nombre || '—'}`, sub: o.estado?.nombre })
    }
    for (const en of historial.entregas) {
      const fecha = en.fecha_completada || en.fecha_asignacion
      eventos.push({
        fecha,
        tipo: en.tipo === 'devolucion' ? 'devolucion' : 'entrega',
        label: `${en.tipo === 'devolucion' ? 'Devolución' : 'Entrega'} ${en.codigo} · OS ${en.orden?.codigo || '—'}`,
        sub: en.recibido_por ? `Recibido por ${en.recibido_por}` : en.estado?.nombre,
      })
    }
    return eventos
      .filter(ev => ev.fecha)
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
  }, [drawer, historial])

  const ICONO_EVENTO = {
    cliente: { icon: <UserPlus size={13} />, color: '#64748B', bg: '#F1F5F9' },
    orden: { icon: <FileText size={13} />, color: '#1B3A6B', bg: '#E8EEF9' },
    entrega: { icon: <ArrowUpRight size={13} />, color: '#0F7B55', bg: '#E7F6EF' },
    devolucion: { icon: <ArrowDownLeft size={13} />, color: '#B45309', bg: '#FEF3E2' },
  }

  // ── EXPORTAR HOJA DE VIDA A PDF (Cliente o Paciente) ──
  // Mismo patrón visual/técnico que generarHojaVidaPDF del equipo en InventarioClient.js
  // (logo + franja azul + línea de tiempo vía html2canvas+jsPDF) — trae el historial COMPLETO
  // de préstamos (activos y devueltos), no solo los activos que ya se ven en pantalla.
  async function generarHojaVidaClientePaciente(seleccionado, tipo) {
    setPdfGenerando(true)
    try {
      const esCliente   = tipo === 'clientes'
      const campoFiltro = esCliente ? 'cliente_id' : 'paciente_id'

      const { data: ordenes, error } = await supabase
        .from('ordenes_servicio')
        .select(`
          id, codigo, fecha_creacion,
          cliente:clientes(nombre),
          paciente:pacientes(nombre),
          equipos:orden_equipos(fecha_entrega, fecha_devolucion, observaciones_devolucion,
            equipo:equipos(codigo, tipo_equipo:tipos_equipo(nombre))
          )
        `)
        .eq(campoFiltro, seleccionado.id)
        .order('fecha_creacion', { ascending: false })
      if (error) throw error

      const { default: jsPDF }       = await import('jspdf')
      const { default: html2canvas } = await import('html2canvas')

      async function toB64(url) {
        const res  = await fetch(url)
        const blob = await res.blob()
        return new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob) })
      }
      let logoB64 = ''
      try { logoB64 = await toB64(LOGO_URL) } catch { /* sin logo */ }

      const fechaHoy = formatear(new Date().toISOString(), { month: 'long' })
      const titulo   = esCliente ? 'HOJA DE VIDA DEL CLIENTE' : 'HOJA DE VIDA DEL PACIENTE'
      const inicial  = (seleccionado.nombre || '?').charAt(0).toUpperCase()

      const infoRows = esCliente
        ? [
            ['NIT / CC', seleccionado.nit_cc ? seleccionado.nit_cc + (seleccionado.digito_verificacion ? '-' + seleccionado.digito_verificacion : '') : '—'],
            ['Teléfono', seleccionado.telefono || '—'],
            ['Email', seleccionado.email || '—'],
            ['Dirección', seleccionado.direccion || '—'],
            ['Ubicación', seleccionado.municipio ? seleccionado.municipio.nombre + ', ' + (seleccionado.departamento?.nombre || '') : '—'],
          ]
        : [
            ['Cédula', seleccionado.cedula || '—'],
            ['Teléfono', seleccionado.telefono || '—'],
            ['Dirección', seleccionado.direccion || '—'],
            ['Ciudad', seleccionado.ciudad || '—'],
          ]

      const identificacionHTML = infoRows.map(([k, v]) =>
        `<div><div style="font-size:10px;color:#94A3B8">${k}</div><div style="font-size:12.5px;color:#0F172A;margin-top:2px">${v}</div></div>`
      ).join('')

      // Cada préstamo de equipo genera hasta 2 eventos: entrega y (si ya ocurrió) devolución
      const eventosH = []
      ;(ordenes || []).forEach(orden => {
        ;(orden.equipos || []).forEach(oe => {
          const equipoNombre = oe.equipo?.tipo_equipo?.nombre || 'Equipo'
          const codigo       = oe.equipo?.codigo || '—'
          const contraparte  = esCliente ? orden.paciente?.nombre : orden.cliente?.nombre
          const activo       = !oe.fecha_devolucion
          eventosH.push({
            fecha:    oe.fecha_entrega ? new Date(oe.fecha_entrega) : new Date(orden.fecha_creacion),
            titulo:   `Préstamo — ${equipoNombre} (${codigo})`,
            badge:    activo
              ? { text: 'Activo', bg: '#E8F7FB', color: '#0E7490' }
              : { text: 'Completado', bg: '#ECFDF5', color: '#0F7B55' },
            detalle:  [contraparte ? (esCliente ? `Paciente: ${contraparte}` : `Cliente: ${contraparte}`) : null, `Orden: ${orden.codigo}`].filter(Boolean).join('  ·  '),
            dotColor: activo ? '#0E86A0' : '#0F7B55',
          })
          if (oe.fecha_devolucion) eventosH.push({
            fecha:    new Date(oe.fecha_devolucion),
            titulo:   `Devolución — ${equipoNombre} (${codigo})`,
            badge:    { text: 'Devuelto', bg: '#ECFDF5', color: '#0F7B55' },
            detalle:  [`Orden: ${orden.codigo}`, oe.observaciones_devolucion || null].filter(Boolean).join('  ·  '),
            dotColor: '#0F7B55',
          })
        })
      })
      eventosH.sort((a, b) => b.fecha - a.fecha)

      const timelineHTML = eventosH.length === 0
        ? '<div style="font-size:13px;color:#94A3B8">Sin actividad registrada</div>'
        : eventosH.map((ev, idx) => {
            const isLast = idx === eventosH.length - 1
            const dia    = formatear(ev.fecha, { year: undefined })
            const anio   = formatear(ev.fecha, { day: undefined, month: undefined })
            return `
              <div style="display:flex;gap:14px;padding-bottom:${isLast ? '0' : '16px'};border-bottom:${isLast ? 'none' : '0.5px solid #F1F5F9'};margin-bottom:${isLast ? '0' : '16px'}">
                <div style="width:78px;flex-shrink:0;text-align:right;padding-top:2px">
                  <div style="font-size:15px;font-weight:700;color:#1B3A6B;line-height:1.2">${dia}</div>
                  <div style="font-size:11px;font-weight:700;color:#64748B">${anio}</div>
                </div>
                <div style="width:1.5px;background:#E2E8F0;position:relative;flex-shrink:0">
                  <div style="width:11px;height:11px;border-radius:50%;background:${ev.dotColor};border:2px solid #fff;box-shadow:0 0 0 2px ${ev.dotColor}55;position:absolute;left:50%;top:4px;transform:translateX(-50%)"></div>
                </div>
                <div style="flex:1;padding-top:2px">
                  <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                    <span style="font-size:13.5px;font-weight:700;color:#0F172A">${ev.titulo}</span>
                    <table style="display:inline-table;border-collapse:collapse;vertical-align:middle"><tr><td style="background:${ev.badge.bg};border-radius:20px;padding:0 10px;height:20px;color:${ev.badge.color};font-size:11px;font-weight:700;white-space:nowrap;vertical-align:middle;line-height:normal">${ev.badge.text}</td></tr></table>
                  </div>
                  ${ev.detalle ? `<div style="font-size:12px;color:#64748B;margin-top:4px">${ev.detalle}</div>` : ''}
                </div>
              </div>`
          }).join('')

      const html = `
        <div style="max-width:680px;background:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
          <div style="display:flex;align-items:stretch">
            <div style="flex:1;padding:20px 24px;display:flex;align-items:center">
              ${logoB64 ? `<img src="${logoB64}" style="height:56px;width:auto;object-fit:contain">` : ''}
            </div>
            <div style="background:#1B3A6B;padding:20px 26px;flex-shrink:0;min-width:250px">
              <div style="color:#fff;font-size:13px;font-weight:700;letter-spacing:.02em">${titulo}</div>
              <div style="color:#AFC1DE;font-size:11px;margin-top:3px">Ingemedic de Colombia S.A.S.</div>
              <div style="color:#7C93BE;font-size:10px;margin-top:10px">Generado: ${fechaHoy}</div>
            </div>
          </div>
          <div style="padding:20px 24px;display:flex;gap:20px">
            <div style="width:130px;flex-shrink:0;display:flex;flex-direction:column;align-items:flex-start">
              <div style="width:64px;height:64px;border-radius:50%;background:#F1F5F9;color:#475569;display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:700">${inicial}</div>
              <div style="font-size:14px;font-weight:700;color:#0F172A;margin-top:10px;line-height:1.3">${seleccionado.nombre}</div>
            </div>
            <div style="flex:1;display:flex;flex-direction:column;gap:10px">
              <div style="background:#F1F5F9;padding:6px 10px;font-size:10.5px;font-weight:700;color:#334155;letter-spacing:.04em">${esCliente ? 'INFORMACIÓN DEL CLIENTE' : 'INFORMACIÓN DEL PACIENTE'}</div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:0 2px">${identificacionHTML}</div>
            </div>
          </div>
          <div style="padding:0 24px 24px">
            <div style="background:#F1F5F9;padding:6px 10px;font-size:10.5px;font-weight:700;color:#334155;letter-spacing:.04em;margin-bottom:14px">HISTORIAL — LÍNEA DE TIEMPO</div>
            ${timelineHTML}
          </div>
        </div>`

      const contenedor = document.createElement('div')
      contenedor.style.cssText = 'position:fixed;top:0;left:-680px;width:680px;pointer-events:none'
      contenedor.innerHTML     = html
      document.body.appendChild(contenedor)

      try {
        const isMobile      = typeof window !== 'undefined' && window.innerWidth < 768
        const canvas        = await html2canvas(contenedor, { scale: isMobile ? 1 : 2, useCORS: true, allowTaint: false, backgroundColor: '#ffffff', logging: false })
        const pdf           = new jsPDF('p', 'mm', 'a4')
        const anchoPDF      = 210
        const pageHeightPx  = Math.round(canvas.width * (297 / 210))
        const totalPages    = Math.ceil(canvas.height / pageHeightPx)

        let position = 0, pageNum = 0
        while (position < canvas.height) {
          if (pageNum > 0) pdf.addPage()
          const sliceH = Math.min(pageHeightPx, canvas.height - position)
          const slice  = document.createElement('canvas')
          slice.width  = canvas.width
          slice.height = sliceH
          slice.getContext('2d').drawImage(canvas, 0, -position)
          pdf.addImage(slice.toDataURL('image/png'), 'PNG', 0, 0, anchoPDF, (sliceH / canvas.width) * anchoPDF)
          pdf.setDrawColor(238, 242, 246)
          pdf.line(0, 282, 210, 282)
          pdf.setFontSize(8)
          pdf.setTextColor(148, 163, 184)
          pdf.text('Ingemedic de Colombia S.A.S. · Valledupar, Cesar', 12, 288)
          pdf.text(`Página ${pageNum + 1} de ${totalPages}`, 198, 288, { align: 'right' })
          position += pageHeightPx
          pageNum++
        }

        pdf.save(`HojaDeVida_${(seleccionado.nombre || tipo).replace(/\s+/g, '_')}.pdf`)
        showToast('PDF generado')
      } finally {
        document.body.removeChild(contenedor)
      }
    } catch (e) {
      showToast('Error generando el PDF', 'error')
    } finally {
      setPdfGenerando(false)
    }
  }

  // ── PACIENTES: conteo de equipos activos por paciente ──
  const conteoEquiposPorPaciente = useMemo(() => {
    const mapa = {}
    equiposConPacienteLocal.forEach(e => {
      if (!e.paciente_actual_id) return
      mapa[e.paciente_actual_id] = (mapa[e.paciente_actual_id] || 0) + 1
    })
    return mapa
  }, [equiposConPacienteLocal])

  const statsPacientes = useMemo(() => {
    let conEquipo = 0
    pacientes.forEach(p => { if (conteoEquiposPorPaciente[p.id] > 0) conEquipo++ })
    return {
      total: pacientes.length,
      conEquipo,
      sinEquipo: pacientes.length - conEquipo,
    }
  }, [pacientes, conteoEquiposPorPaciente])

  const pacientesFiltrados = useMemo(() => {
    let result = pacientes
    if (searchPaciente.trim()) {
      const q = searchPaciente.trim().toLowerCase()
      result = result.filter(p =>
        p.nombre?.toLowerCase().includes(q) ||
        p.cedula?.toLowerCase().includes(q) ||
        p.ciudad?.toLowerCase().includes(q)
      )
    }
    if (filtroPaciente === 'con_equipo') result = result.filter(p => conteoEquiposPorPaciente[p.id] > 0)
    if (filtroPaciente === 'sin_equipo') result = result.filter(p => !conteoEquiposPorPaciente[p.id])
    return result
  }, [pacientes, searchPaciente, filtroPaciente, conteoEquiposPorPaciente])

  const { itemsOrdenados: pacientesOrdenados, config: configPacientes, solicitarOrden: solicitarOrdenPacientes } = useOrdenable(pacientesFiltrados)
  const paginacionPacientes = usePaginacion(pacientesOrdenados, 20)
  const pacientesPagina = paginacionPacientes.itemsPagina

  const equiposDelPacienteDrawer = useMemo(() => {
    if (!drawerPaciente) return []
    return equiposConPacienteLocal.filter(e => e.paciente_actual_id === drawerPaciente.id)
  }, [drawerPaciente, equiposConPacienteLocal])

  // Categorías derivadas de los equipos ya cargados — evita traer categorias_equipo
  // completo solo para el fallback de ícono por categoría en IconoTipo.
  const categoriasParaIcono = useMemo(() => {
    const mapa = new Map()
    equiposConPacienteLocal.forEach(e => {
      const cat = e.tipo_equipo?.categoria
      if (cat?.id) mapa.set(cat.id, cat)
    })
    return [...mapa.values()]
  }, [equiposConPacienteLocal])

  // Abre el drawer y trae, en lazy-load, la orden de préstamo activa (fecha_devolucion IS NULL)
  // de cada equipo del paciente — se hace acá y no en la carga inicial porque solo se necesita
  // cuando el usuario realmente entra al detalle de un paciente puntual.
  async function abrirDrawerPaciente(paciente) {
    setDrawerPaciente(paciente)
    const idsEquipos = equiposConPacienteLocal
      .filter(e => e.paciente_actual_id === paciente.id)
      .map(e => e.id)

    if (idsEquipos.length === 0) { setOrdenesPorEquipo({ loading: false, mapa: {} }); return }

    setOrdenesPorEquipo({ loading: true, mapa: {} })
    const { data } = await supabase
      .from('orden_equipos')
      .select('id, equipo_id, orden:ordenes_servicio(id, codigo, equipos:orden_equipos(id))')
      .in('equipo_id', idsEquipos)
      .is('fecha_devolucion', null)

    const mapa = {}
    // Guarda también el id de este orden_equipos (para poder marcarlo como devuelto) y los
    // equipos hermanos de la misma orden (para el criterio "Finalizar préstamo" si es el único).
    ;(data || []).forEach(oe => { mapa[oe.equipo_id] = { ...oe.orden, ordenEquipoId: oe.id } })
    setOrdenesPorEquipo({ loading: false, mapa })
  }

  async function exportarExcel() {
    setExportando(true)
    try {
      const res = await fetch('/api/exportar/clientes')
      if (!res.ok) { showToast('Error exportando', 'error'); return }
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `clientes_pacientes_${hoyBogota()}.xlsx`
      a.click()
    } catch (e) {
      showToast('Error exportando', 'error')
    } finally {
      setExportando(false)
    }
  }

  const conteoEquiposPorCliente = useMemo(() => {
    const mapa = {}
    equiposConCliente.forEach(e => {
      if (!e.cliente_actual_id) return
      mapa[e.cliente_actual_id] = (mapa[e.cliente_actual_id] || 0) + 1
    })
    return mapa
  }, [equiposConCliente])

  const clientesFiltrados = useMemo(() => {
    let result = clientes
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(c =>
        c.nombre?.toLowerCase().includes(q) ||
        c.nit_cc?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.telefono?.toLowerCase().includes(q)
      )
    }
    if (filtroCliente === 'con_prestamos') result = result.filter(c => conteoEquiposPorCliente[c.id] > 0)
    if (filtroCliente === 'sin_prestamos') result = result.filter(c => !conteoEquiposPorCliente[c.id])
    return result
  }, [clientes, search, filtroCliente, conteoEquiposPorCliente])

  const { itemsOrdenados: clientesOrdenados, config: configClientes, solicitarOrden: solicitarOrdenClientes } = useOrdenable(clientesFiltrados)
  const paginacionClientes = usePaginacion(clientesOrdenados, 20)
  const clientesPagina = paginacionClientes.itemsPagina

  async function guardarCliente() {
    if (!form.nombre?.trim()) { showToast('El nombre es requerido', 'error'); return }
    if (!form.tipo_persona) { showToast('El tipo de persona es requerido', 'error'); return }
    if (form.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) { showToast('El email no tiene un formato válido', 'error'); return }
    setSaving(true)
    const payload = {
      tipo_persona: form.tipo_persona,
      nombre: form.nombre.trim(),
      nit_cc: form.nit_cc?.trim() || null,
      digito_verificacion: form.tipo_persona !== 'Natural' ? (form.digito_verificacion?.trim() || null) : null,
      direccion: form.direccion?.trim() || null,
      telefono: form.telefono?.trim() || null,
      email: form.email?.trim() || null,
      departamento_id: form.departamento_id || null,
      municipio_id: form.municipio_id || null,
    }
    if (form.id) {
      const { error } = await supabase.from('clientes').update(payload).eq('id', form.id)
      if (error) { showToast('Error: ' + error.message, 'error'); setSaving(false); return }
      skipSyncUntil.current = Date.now() + 2500
      setClientes(prev => prev.map(c => c.id === form.id ? {
        ...c, ...payload,
        departamento: departamentos.find(d => d.id === form.departamento_id) || c.departamento,
        municipio: municipios.find(m => m.id === form.municipio_id) || c.municipio,
      } : c))
      if (drawer?.id === form.id) setDrawer(prev => ({
        ...prev, ...payload,
        departamento: departamentos.find(d => d.id === form.departamento_id) || prev.departamento,
        municipio: municipios.find(m => m.id === form.municipio_id) || prev.municipio,
      }))
      showToast('Cliente actualizado')
      registrarBitacora({ modulo: 'clientes', accion: 'editar', entidad: 'cliente', entidad_id: form.id, detalle: { nombre: payload.nombre } })
    } else {
      const { data, error } = await supabase.from('clientes')
        .insert({ ...payload, activo: true })
        .select('*, municipio:municipios(id, nombre), departamento:departamentos(id, nombre)')
        .single()
      if (error) { showToast('Error: ' + error.message, 'error'); setSaving(false); return }
      skipSyncUntil.current = Date.now() + 2500
      setClientes(prev => [data, ...prev])
      showToast('Cliente creado')
      registrarBitacora({ modulo: 'clientes', accion: 'crear', entidad: 'cliente', entidad_id: data.id, detalle: { nombre: data.nombre } })
    }
    setSaving(false); cerrarModal()
  }

  async function toggleActivo(id, nuevoActivo) {
    const { error } = await supabase.from('clientes').update({ activo: nuevoActivo }).eq('id', id)
    if (error) { showToast('Error: ' + error.message, 'error'); return }
    skipSyncUntil.current = msNow() + 2500

    // Buscar el cliente en cualquiera de los dos arrays (por si estuviera en el lado incorrecto)
    const clienteRef = clientes.find(c => c.id === id) || clientesInactivos.find(c => c.id === id)

    if (!nuevoActivo) {
      // Siempre quitar de AMBOS arrays antes de agregar al destino → evita duplicados
      setClientes(prev => prev.filter(c => c.id !== id))
      setClientesInactivos(prev => {
        const limpio = prev.filter(c => c.id !== id)
        if (!clienteRef) return limpio
        return [...limpio, { ...clienteRef, activo: false }].sort((a, b) => a.nombre.localeCompare(b.nombre))
      })
      if (drawer?.id === id) setDrawer(null)
      setModalEliminar(null)
      showToast('Cliente desactivado')
      registrarBitacora({ modulo: 'clientes', accion: 'desactivar', entidad: 'cliente', entidad_id: id, detalle: { nombre: clienteRef?.nombre } })
    } else {
      setClientesInactivos(prev => prev.filter(c => c.id !== id))
      setClientes(prev => {
        const limpio = prev.filter(c => c.id !== id)
        if (!clienteRef) return limpio
        return [...limpio, { ...clienteRef, activo: true }].sort((a, b) => a.nombre.localeCompare(b.nombre))
      })
      if (drawer?.id === id) setDrawer(prev => ({ ...prev, activo: true }))
      showToast('Cliente activado')
      registrarBitacora({ modulo: 'clientes', accion: 'activar', entidad: 'cliente', entidad_id: id, detalle: { nombre: clienteRef?.nombre } })
    }
  }

  const estiloTipo = c => TIPO_STYLES[c.tipo_persona] || TIPO_STYLES['Jurídica']

  const stats = useMemo(() => {
    let conPrestamos = 0
    clientes.forEach(c => { if (conteoEquiposPorCliente[c.id] > 0) conPrestamos++ })
    return {
      total: clientes.length,
      conPrestamos,
      sinPrestamos: clientes.length - conPrestamos,
    }
  }, [clientes, conteoEquiposPorCliente])

  // El Excel trae clientes y pacientes, por eso va en la franja de filtros de ambas pestañas
  const botonExportar = (
    <button onClick={exportarExcel} disabled={exportando}
      className="hidden md:flex items-center gap-1.5 px-3 h-[38px] text-[13px] font-medium text-slate-600 border border-slate-200 rounded-[9px] hover:border-slate-300 transition-all disabled:opacity-50 flex-shrink-0 whitespace-nowrap">
      <Download size={13} /> {exportando ? 'Exportando…' : 'Exportar Excel'}
    </button>
  )

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Topbar */}
      <div className="h-14 md:h-16 md:bg-white md:border-b md:border-slate-200 flex items-center px-4 md:px-7 flex-shrink-0">
        <div>
          <div className="text-[18px] font-bold text-slate-800">Clientes</div>
          <div className="text-[12px] text-slate-400 mt-0.5">Gestión de clientes, arrendatarios y pacientes</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <BuzonNovedades />
        </div>
      </div>

      {/* FAB móvil — crea cliente o paciente según la pestaña activa */}
      <button onClick={() => tabActiva === 'clientes' ? abrirModal() : abrirModalPaciente()}
        className="fixed bottom-[calc(var(--mobile-nav-space,0px)+16px)] right-4 z-30 md:hidden shadow-lg rounded-full w-14 h-14 bg-[#D81B43] text-white flex items-center justify-center">
        <Plus size={22} strokeWidth={2.5} />
      </button>

      {/* Pestañas Clientes / Pacientes */}
      <div className="flex gap-1 border-b border-slate-200 px-4 md:px-7 flex-shrink-0 bg-white">
        <button onClick={() => setTabActiva('clientes')}
          className={`flex items-center gap-1.5 px-3 py-2.5 text-[13px] font-semibold border-b-2 transition-all ${tabActiva === 'clientes' ? 'border-[#D81B43] text-[#D81B43]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          <Building2 size={14} /> Clientes ({clientes.length})
        </button>
        <button onClick={() => setTabActiva('pacientes')}
          className={`flex items-center gap-1.5 px-3 py-2.5 text-[13px] font-semibold border-b-2 transition-all ${tabActiva === 'pacientes' ? 'border-[#D81B43] text-[#D81B43]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          <HeartPulse size={14} /> Pacientes ({pacientes.length})
        </button>
      </div>

      {tabActiva === 'clientes' && (
      <div className="flex-1 overflow-hidden flex flex-col p-3 md:p-6 pb-28 md:pb-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">

          {/* FRANJA 1 — Filtros, SIEMPRE fija, nunca cambia con la selección */}
          <div className="p-3 md:p-6 pb-3 md:pb-4 flex-shrink-0 border-b border-slate-200">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
                <div className="relative w-full md:w-[340px] md:flex-shrink-0">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar por nombre, NIT, email o teléfono..."
                    className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-[9px] text-[13px] outline-none focus:border-[#D81B43] bg-white" />
                </div>
                <div className="flex items-center gap-2 md:gap-3 md:flex-1 min-w-0">
                  <div className="flex items-center gap-2 overflow-x-auto flex-1 min-w-0">
                    {[
                      { value: 'todos', label: `Todos (${stats.total})` },
                      { value: 'con_prestamos', label: `Con préstamos activos (${stats.conPrestamos})` },
                      { value: 'sin_prestamos', label: `Sin préstamos activos (${stats.sinPrestamos})` },
                    ].map(t => (
                      <button key={t.value} onClick={() => setFiltroCliente(t.value)}
                        className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-all whitespace-nowrap ${filtroCliente === t.value
                          ? 'bg-[#D81B43] text-white'
                          : 'bg-white border border-slate-200 text-slate-500 hover:border-[#D81B43] hover:text-[#D81B43]'
                          }`}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <LimpiarFiltros activo={!!search || filtroCliente !== 'todos'}
                    onLimpiar={() => { setSearch(''); setFiltroCliente('todos') }} />
                  {!drawer && (
                    <div className="hidden md:block text-[12px] text-slate-400 flex-shrink-0">
                      {clientesFiltrados.length} cliente{clientesFiltrados.length !== 1 ? 's' : ''}
                    </div>
                  )}
                  {botonExportar}
                  <button onClick={() => abrirModal()}
                    className="hidden md:flex items-center gap-1.5 px-4 h-[38px] bg-[#D81B43] text-white text-[13px] font-semibold rounded-[9px] hover:bg-[#B0172F] transition-colors flex-shrink-0 whitespace-nowrap">
                    <Plus size={14} strokeWidth={2.5} /> Nuevo cliente
                  </button>
                </div>
              </div>
            </div>

          {/* FRANJA 2 — aquí ocurre toda la transición: lista + panel */}
          <div className="flex flex-1 overflow-hidden flex-col md:flex-row">

            {/* Columna lista — SIEMPRE montada; solo cambia de ancho (100% ↔ 380px) según haya o no detalle abierto */}
            <div className={`${drawer ? 'hidden md:flex' : 'flex'} flex-col overflow-hidden transition-all duration-300 w-full ${drawer ? 'md:w-[380px] md:flex-shrink-0 md:border-r md:border-slate-200' : ''}`}>

              {/* Lista/tabla — un solo contenedor de scroll; adentro cambia cómo se pinta cada fila según el ancho disponible */}
              <div className="flex-1 overflow-y-auto px-3 md:px-6 pt-3 md:pt-6 pb-28 md:pb-6">
              {clientesFiltrados.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                    <Building2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <div className="font-semibold mb-1">{search || filtroCliente !== 'todos' ? 'Sin resultados' : 'Sin clientes registrados'}</div>
                    <div className="text-[13px]">{search || filtroCliente !== 'todos' ? 'Intenta con otros filtros' : 'Usa "Nuevo cliente" para agregar uno'}</div>
                  </div>
              ) : drawer ? (
                /* Lista compacta — solo se ve cuando la columna está angosta (detalle abierto) */
                <div className="-mx-3 md:-mx-6">
                  {clientesFiltrados.map(c => (
                    <div key={c.id} onClick={() => abrirDrawer(c)}
                      className={`px-4 py-3 border-b border-slate-100 cursor-pointer transition-colors ${drawer?.id === c.id ? 'bg-[#FFF0F3] border-l-[3px] border-l-[#D81B43]' : 'hover:bg-slate-50'}`}>
                      <div className="text-[13px] font-bold text-slate-800 truncate">{c.nombre}</div>
                      <div className="text-[11.5px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                        <span className="font-medium" style={{ color: estiloTipo(c).color }}>{c.tipo_persona || '—'}</span>
                        {c.nit_cc && <span>· {c.nit_cc}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  {/* Cards móvil */}
                  <div className="md:hidden space-y-2">
                    {clientesPagina.map(c => {
                      const st = estiloTipo(c)
                      return (
                        <div key={c.id} onClick={() => abrirDrawer(c)}
                          className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 cursor-pointer active:bg-slate-50 transition-colors">
                          <div className="flex items-center gap-3 mb-2.5">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center text-[14px] font-bold flex-shrink-0"
                              style={{ background: st.bg, color: st.color }}>
                              {c.nombre?.charAt(0)?.toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-[14px] font-semibold text-slate-700 truncate">{c.nombre}</div>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold mt-0.5"
                                style={{ background: st.bg, color: st.color }}>
                                {st.icon} {c.tipo_persona || '—'}
                              </span>
                            </div>
                            <ChevronRight size={16} className="text-slate-300 flex-shrink-0" />
                          </div>
                          <div className="space-y-1 pl-1">
                            {c.nit_cc && (
                              <div className="flex items-center gap-2 text-[12px] text-slate-500">
                                <FileText size={11} className="text-slate-400" />
                                <span className="font-mono">{c.nit_cc}{c.digito_verificacion ? `-${c.digito_verificacion}` : ''}</span>
                              </div>
                            )}
                            {c.telefono && (
                              <div className="flex items-center gap-2 text-[12px] text-slate-500">
                                <Phone size={11} className="text-slate-400" /> {c.telefono}
                              </div>
                            )}
                            {c.email && (
                              <div className="flex items-center gap-2 text-[12px] text-slate-500">
                                <Mail size={11} className="text-slate-400" /> {c.email}
                              </div>
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
                            { label: 'Cliente', clave: 'nombre' },
                            { label: 'Tipo', clave: 'tipo_persona' },
                            { label: 'NIT / CC', clave: null },
                            { label: 'Contacto', clave: null },
                            { label: 'Ubicación', clave: 'ubicacion', accessor: c => c.municipio?.nombre || '' },
                            { label: '', clave: null },
                          ].map(col => (
                            <th key={col.label || 'acciones'}
                              onClick={col.clave ? () => solicitarOrdenClientes(col.clave, col.accessor) : undefined}
                              className={`px-4 py-3 text-left text-[10.5px] font-bold uppercase tracking-[0.07em] text-slate-400 bg-slate-50 ${col.clave ? 'cursor-pointer select-none hover:bg-slate-100 transition-colors' : ''}`}>
                              <div className="flex items-center gap-1">
                                {col.label}
                                {configClientes?.clave === col.clave && (
                                  <span className="text-[10px]">{configClientes.direccion === 'asc' ? '▲' : '▼'}</span>
                                )}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {clientesPagina.map(c => {
                          const st = estiloTipo(c)
                          return (
                            <tr key={c.id} onClick={() => abrirDrawer(c)}
                              className="border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-[12px] font-bold"
                                    style={{ background: st.bg, color: st.color }}>
                                    {c.nombre?.charAt(0)?.toUpperCase()}
                                  </div>
                                  <span className="text-[13px] font-semibold text-slate-700">{c.nombre}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold"
                                  style={{ background: st.bg, color: st.color }}>
                                  {st.icon} {c.tipo_persona || '—'}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                {c.nit_cc
                                  ? <span className="font-mono text-[12.5px] text-slate-600">{c.nit_cc}{c.digito_verificacion ? `-${c.digito_verificacion}` : ''}</span>
                                  : <span className="text-slate-300">—</span>}
                              </td>
                              <td className="px-4 py-3">
                                <div className="space-y-0.5">
                                  {c.telefono && <div className="flex items-center gap-1.5 text-[12px] text-slate-500"><Phone size={11} className="text-slate-400" />{c.telefono}</div>}
                                  {c.email && <div className="flex items-center gap-1.5 text-[12px] text-slate-500"><Mail size={11} className="text-slate-400" />{c.email}</div>}
                                  {!c.telefono && !c.email && <span className="text-slate-300 text-[12px]">—</span>}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-[12.5px] text-slate-500">
                                {c.municipio?.nombre
                                  ? <div className="flex items-center gap-1"><MapPin size={11} className="text-slate-400 flex-shrink-0" />{c.municipio.nombre}, {c.departamento?.nombre}</div>
                                  : <span className="text-slate-300">—</span>}
                              </td>
                              <td className="px-3 py-3 text-slate-300"><ChevronRight size={14} /></td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                    <Paginador {...paginacionClientes} />
                  </div>
                  <div className="md:hidden mt-2">
                    <Paginador {...paginacionClientes} />
                  </div>

                  {/* ── CLIENTES INACTIVOS ── */}
                  {clientesInactivos.length > 0 && (
                    <div className="mt-4">
                      <button
                        onClick={() => setMostrarInactivos(v => !v)}
                        className="flex items-center gap-2 text-[12px] font-semibold text-slate-400 hover:text-slate-500 transition-colors mb-2 select-none">
                        <ChevronRight size={14} className={`transition-transform duration-200 ${mostrarInactivos ? 'rotate-90' : ''}`} />
                        Clientes inactivos ({clientesInactivos.length})
                      </button>

                      {mostrarInactivos && (
                        <>
                          {/* Mobile cards */}
                          <div className="md:hidden space-y-2">
                            {clientesInactivos.map(c => {
                              const st = estiloTipo(c)
                              return (
                                <div key={c.id} onClick={() => abrirDrawer(c)}
                                  className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 cursor-pointer opacity-60 hover:opacity-80 transition-opacity">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-[14px] font-bold flex-shrink-0"
                                      style={{ background: st.bg, color: st.color }}>
                                      {c.nombre?.charAt(0)?.toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="text-[14px] font-semibold text-slate-600 truncate">{c.nombre}</div>
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold mt-0.5"
                                        style={{ background: st.bg, color: st.color }}>
                                        {st.icon} {c.tipo_persona || '—'}
                                      </span>
                                    </div>
                                    <button
                                      onClick={e => { e.stopPropagation(); toggleActivo(c.id, true) }}
                                      className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 border border-green-200 text-[#0F7B55] rounded-[8px] text-[11.5px] font-semibold hover:bg-green-50 transition-colors">
                                      <CheckCircle2 size={12} /> Activar
                                    </button>
                                  </div>
                                </div>
                              )
                            })}
                          </div>

                          {/* Desktop table */}
                          <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden opacity-70">
                            <table className="w-full border-collapse">
                              <thead>
                                <tr className="border-b-2 border-slate-100">
                                  {['Cliente', 'Tipo', 'NIT / CC', 'Contacto', ''].map(h => (
                                    <th key={h} className="px-4 py-3 text-left text-[10.5px] font-bold uppercase tracking-[0.07em] text-slate-400 bg-slate-50">{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {clientesInactivos.map(c => {
                                  const st = estiloTipo(c)
                                  return (
                                    <tr key={c.id} onClick={() => abrirDrawer(c)}
                                      className="border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer">
                                      <td className="px-4 py-3">
                                        <div className="flex items-center gap-2.5">
                                          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-[12px] font-bold"
                                            style={{ background: st.bg, color: st.color }}>
                                            {c.nombre?.charAt(0)?.toUpperCase()}
                                          </div>
                                          <span className="text-[13px] font-semibold text-slate-500">{c.nombre}</span>
                                        </div>
                                      </td>
                                      <td className="px-4 py-3">
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold"
                                          style={{ background: st.bg, color: st.color }}>
                                          {st.icon} {c.tipo_persona || '—'}
                                        </span>
                                      </td>
                                      <td className="px-4 py-3">
                                        {c.nit_cc
                                          ? <span className="font-mono text-[12.5px] text-slate-500">{c.nit_cc}{c.digito_verificacion ? `-${c.digito_verificacion}` : ''}</span>
                                          : <span className="text-slate-300">—</span>}
                                      </td>
                                      <td className="px-4 py-3">
                                        <div className="space-y-0.5">
                                          {c.telefono && <div className="flex items-center gap-1.5 text-[12px] text-slate-400"><Phone size={11} className="text-slate-300" />{c.telefono}</div>}
                                          {c.email && <div className="flex items-center gap-1.5 text-[12px] text-slate-400"><Mail size={11} className="text-slate-300" />{c.email}</div>}
                                          {!c.telefono && !c.email && <span className="text-slate-300 text-[12px]">—</span>}
                                        </div>
                                      </td>
                                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                                        <button
                                          onClick={() => toggleActivo(c.id, true)}
                                          className="flex items-center gap-1.5 px-3 py-1.5 border border-green-200 text-[#0F7B55] rounded-[8px] text-[11.5px] font-semibold hover:bg-green-50 transition-colors whitespace-nowrap">
                                          <CheckCircle2 size={12} /> Activar
                                        </button>
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Panel de detalle — aparece a la derecha sin reemplazar la columna de lista */}
          {drawer && (
            <div className="flex flex-col flex-1 overflow-hidden animate-panel-detalle">
              <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-[15px] font-bold flex-shrink-0"
                    style={{ background: estiloTipo(drawer).bg, color: estiloTipo(drawer).color }}>
                    {drawer.nombre?.charAt(0)?.toUpperCase()}
                  </div>
                  <div>
                    <div className="text-[15px] font-bold text-slate-800 leading-tight">{drawer.nombre}</div>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold mt-0.5"
                      style={{ color: estiloTipo(drawer).color }}>
                      {estiloTipo(drawer).icon} Persona {drawer.tipo_persona}
                    </span>
                  </div>
                </div>
                <button onClick={() => setDrawer(null)} title="Cerrar (ESC)"
                  className="text-slate-400 hover:text-slate-600 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 flex-shrink-0"><X size={16} /></button>
              </div>

              <div className="flex-1 overflow-y-auto pb-28 md:pb-6">
                <div className="p-6 space-y-3 border-b border-slate-100">
                  <div className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-3">Información general</div>
                  {[
                    { label: 'NIT / CC', value: drawer.nit_cc ? `${drawer.nit_cc}${drawer.digito_verificacion ? `-${drawer.digito_verificacion}` : ''}` : null },
                    { label: 'Teléfono', value: drawer.telefono, icon: <Phone size={12} /> },
                    { label: 'Email', value: drawer.email, icon: <Mail size={12} /> },
                    { label: 'Dirección', value: drawer.direccion, icon: <MapPin size={12} /> },
                    { label: 'Ubicación', value: drawer.municipio ? `${drawer.municipio.nombre}, ${drawer.departamento?.nombre}` : null, icon: <MapPin size={12} /> },
                  ].filter(f => f.value).map(f => (
                    <div key={f.label} className="flex justify-between text-[12.5px]">
                      <span className="text-slate-400 flex items-center gap-1">{f.icon}{f.label}</span>
                      <span className="font-medium text-slate-700 text-right ml-4 max-w-[220px]">{f.value}</span>
                    </div>
                  ))}
                </div>

                <div className="p-6">
                  {/* Tabs + exportar */}
                  <div className="flex items-center justify-between mb-1 gap-2">
                    <div className="flex gap-1 border-b border-slate-200 flex-1 overflow-x-auto">
                      {[
                        { id: 'prestamo', label: 'En préstamo', count: equiposEnPrestamo.length },
                        { id: 'ordenes', label: 'Órdenes', count: historial.ordenes.length },
                        { id: 'linea', label: 'Línea de tiempo', count: lineaTiempo.length },
                      ].map(t => (
                        <button key={t.id} onClick={() => setTabHoja(t.id)}
                          className={`px-3 py-2 text-[12.5px] font-semibold border-b-2 whitespace-nowrap transition-all ${tabHoja === t.id ? 'border-[#D81B43] text-[#D81B43]' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                          {t.label} {t.count > 0 && <span className="ml-1 text-[10.5px] opacity-60">({t.count})</span>}
                        </button>
                      ))}
                    </div>
                    <button onClick={() => generarHojaVidaClientePaciente(drawer, 'clientes')} disabled={pdfGenerando}
                      className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 bg-[#1B3A6B] text-white rounded-[8px] text-[11.5px] font-semibold hover:bg-[#152D54] transition-all mb-2 disabled:opacity-70 disabled:cursor-not-allowed">
                      {pdfGenerando ? <><Loader2 size={12} className="animate-spin" /> Generando…</> : <><FileText size={13} /> Hoja de vida (PDF)</>}
                    </button>
                  </div>

                  {historial.loading ? (
                    <div className="space-y-2 mt-3">
                      {[0, 1, 2].map(i => (
                        <div key={i} className="flex items-center gap-2.5 p-3 rounded-[9px] border border-slate-100">
                          <Box className="w-8 h-8 rounded-lg flex-shrink-0" />
                          <div className="flex-1 space-y-1.5">
                            <Box className="h-3 w-32" />
                            <Box className="h-2.5 w-44" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-3">
                      {/* EQUIPOS EN PRÉSTAMO */}
                      {tabHoja === 'prestamo' && (
                        equiposEnPrestamo.length > 0 ? (
                          <div className="space-y-2">
                            {equiposEnPrestamo.map(oe => {
                              const esUnico = (oe.orden?.equipos?.length || 0) === 1
                              return (
                                <div key={oe.id} className="flex items-start gap-2.5 p-3 rounded-[9px] border border-slate-100 bg-slate-50">
                                  <Package size={15} className="text-[#D81B43] mt-0.5 flex-shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <div className="text-[12.5px] font-semibold text-slate-700">
                                      {oe.equipo?.tipo_equipo?.atributos?.nombre || oe.equipo?.tipo_equipo?.nombre || 'Equipo'}
                                    </div>
                                    <div className="text-[11px] text-slate-400 mt-0.5">
                                      Código: {oe.equipo?.codigo || '—'}
                                    </div>
                                    <div className="text-[11px] text-slate-400 mt-0.5">
                                      OS {oe.orden?.codigo} · desde {formatear(oe.fecha_entrega)}
                                    </div>
                                    <div className="text-[11px] text-slate-400 mt-0.5">
                                      {oe.equipo?.paciente_actual?.nombre ? `Paciente: ${oe.equipo.paciente_actual.nombre}` : 'Sin paciente asociado'}
                                    </div>
                                    <div className="mt-2">
                                      <button type="button"
                                        onClick={() => abrirModalDevolucion({ ordenEquipoId: oe.id, equipoId: oe.equipo?.id, ordenId: oe.orden?.id }, 'cliente')}
                                        className="text-[11.5px] text-[#D81B43] font-semibold hover:underline">
                                        {esUnico ? 'Finalizar préstamo' : 'Marcar como devuelto'}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <div className="text-center py-8 text-slate-400">
                            <FileText className="w-10 h-10 mx-auto mb-2 opacity-20" />
                            <div className="text-[12.5px]">Sin equipos activos</div>
                            <div className="text-[11.5px] mt-1 text-slate-300">Los préstamos aparecerán aquí</div>
                          </div>
                        )
                      )}

                      {/* ÓRDENES */}
                      {tabHoja === 'ordenes' && (
                        historial.ordenes.length > 0 ? (
                          <div className="space-y-2">
                            {historial.ordenes.map(o => (
                              <div key={o.id} className="p-3 rounded-[9px] border border-slate-100">
                                <div className="flex items-center justify-between">
                                  <span className="text-[12.5px] font-semibold text-slate-700">{o.codigo}</span>
                                  <span className="text-[10.5px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{o.estado?.nombre || '—'}</span>
                                </div>
                                <div className="text-[11px] text-slate-400 mt-1">
                                  {o.tipo?.nombre || '—'} · {formatear(o.fecha_creacion)}
                                  {o.fecha_vigencia && ` · vigente hasta ${formatearSoloFecha(o.fecha_vigencia)}`}
                                </div>
                                <div className="text-[11px] text-slate-400 mt-0.5">{(o.equipos || []).length} equipo(s)</div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8 text-slate-400">
                            <FileText className="w-10 h-10 mx-auto mb-2 opacity-20" />
                            <div className="text-[12.5px]">Sin órdenes registradas</div>
                          </div>
                        )
                      )}

                      {/* LÍNEA DE TIEMPO */}
                      {tabHoja === 'linea' && (
                        lineaTiempo.length > 0 ? (
                          <div className="relative pl-5">
                            <div className="absolute left-[7px] top-1 bottom-1 w-px bg-slate-200" />
                            <div className="space-y-4">
                              {lineaTiempo.map((ev, i) => {
                                const ic = ICONO_EVENTO[ev.tipo] || ICONO_EVENTO.orden
                                return (
                                  <div key={i} className="relative flex items-start gap-3">
                                    <div className="absolute -left-5 w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                                      style={{ background: ic.bg, color: ic.color }}>
                                      <div className="scale-75">{ic.icon}</div>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="text-[12px] font-semibold text-slate-700">{ev.label}</div>
                                      <div className="text-[10.5px] text-slate-400 mt-0.5">
                                        {formatear(ev.fecha, { hour: '2-digit', minute: '2-digit' })} {ev.sub && `· ${ev.sub}`}
                                      </div>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-8 text-slate-400">
                            <Clock className="w-10 h-10 mx-auto mb-2 opacity-20" />
                            <div className="text-[12.5px]">Sin actividad registrada</div>
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="px-6 py-4 border-t border-slate-200 flex gap-2 flex-shrink-0">
                <button onClick={() => abrirModal(drawer)}
                  className="flex items-center gap-1.5 px-4 py-2.5 border border-slate-200 rounded-[9px] text-[13px] font-medium text-slate-600 hover:border-slate-300 transition-all">
                  <Edit3 size={13} /> Editar
                </button>
                {drawer.activo === false ? (
                  <button onClick={() => toggleActivo(drawer.id, true)}
                    className="flex items-center gap-1.5 px-4 py-2.5 border border-green-200 text-[#0F7B55] rounded-[9px] text-[13px] font-medium hover:bg-green-50 transition-all ml-auto">
                    <CheckCircle2 size={13} /> Activar
                  </button>
                ) : (
                  <button onClick={() => setModalEliminar(drawer)}
                    className="flex items-center gap-1.5 px-4 py-2.5 border border-red-200 text-red-400 rounded-[9px] text-[13px] font-medium hover:bg-red-50 transition-all ml-auto">
                    <X size={13} /> Desactivar
                  </button>
                )}
              </div>
            </div>
          )}
          </div>
        </div>
      </div>
      )}

      {/* ── PESTAÑA PACIENTES ── */}
      {tabActiva === 'pacientes' && (
      <div className="flex-1 overflow-hidden flex flex-col p-3 md:p-6 pb-28 md:pb-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">

          {/* FRANJA 1 — Filtros, SIEMPRE fija, nunca cambia con la selección */}
          <div className="p-3 md:p-6 pb-3 md:pb-4 flex-shrink-0 border-b border-slate-200">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
                <div className="relative w-full md:w-[340px] md:flex-shrink-0">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input value={searchPaciente} onChange={e => setSearchPaciente(e.target.value)}
                    placeholder="Buscar por nombre, cédula o ciudad..."
                    className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-[9px] text-[13px] outline-none focus:border-[#D81B43] bg-white" />
                </div>
                <div className="flex items-center gap-2 md:gap-3 md:flex-1 min-w-0">
                  <div className="flex items-center gap-2 overflow-x-auto flex-1 min-w-0">
                    {[
                      { value: 'todos', label: `Todos (${statsPacientes.total})` },
                      { value: 'con_equipo', label: `Con equipo activo (${statsPacientes.conEquipo})` },
                      { value: 'sin_equipo', label: `Sin equipo (${statsPacientes.sinEquipo})` },
                    ].map(t => (
                      <button key={t.value} onClick={() => setFiltroPaciente(t.value)}
                        className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-all whitespace-nowrap ${filtroPaciente === t.value
                          ? 'bg-[#D81B43] text-white'
                          : 'bg-white border border-slate-200 text-slate-500 hover:border-[#D81B43] hover:text-[#D81B43]'
                          }`}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <LimpiarFiltros activo={!!searchPaciente || filtroPaciente !== 'todos'}
                    onLimpiar={() => { setSearchPaciente(''); setFiltroPaciente('todos') }} />
                  {!drawerPaciente && (
                    <div className="hidden md:block text-[12px] text-slate-400 flex-shrink-0">
                      {pacientesFiltrados.length} paciente{pacientesFiltrados.length !== 1 ? 's' : ''}
                    </div>
                  )}
                  {botonExportar}
                  <button onClick={abrirModalPaciente}
                    className="hidden md:flex items-center gap-1.5 px-4 h-[38px] bg-[#D81B43] text-white text-[13px] font-semibold rounded-[9px] hover:bg-[#B0172F] transition-colors flex-shrink-0 whitespace-nowrap">
                    <Plus size={14} strokeWidth={2.5} /> Nuevo paciente
                  </button>
                </div>
              </div>
            </div>

          {/* FRANJA 2 — aquí ocurre toda la transición: lista + panel */}
          <div className="flex flex-1 overflow-hidden flex-col md:flex-row">

            {/* Columna lista — SIEMPRE montada; solo cambia de ancho (100% ↔ 380px) según haya o no detalle abierto */}
            <div className={`${drawerPaciente ? 'hidden md:flex' : 'flex'} flex-col overflow-hidden transition-all duration-300 w-full ${drawerPaciente ? 'md:w-[380px] md:flex-shrink-0 md:border-r md:border-slate-200' : ''}`}>

              {/* Lista/tabla — un solo contenedor de scroll; adentro cambia cómo se pinta cada fila según el ancho disponible */}
              <div className="flex-1 overflow-y-auto px-3 md:px-6 pt-3 md:pt-6 pb-28 md:pb-6">
              {pacientesFiltrados.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                    <HeartPulse className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <div className="font-semibold mb-1">{searchPaciente || filtroPaciente !== 'todos' ? 'Sin resultados' : 'Sin pacientes registrados'}</div>
                    <div className="text-[13px]">{searchPaciente || filtroPaciente !== 'todos' ? 'Intenta con otros filtros' : 'Usa "Nuevo paciente" o regístralo al crear un préstamo'}</div>
                  </div>
              ) : drawerPaciente ? (
                /* Lista compacta — solo se ve cuando la columna está angosta (detalle abierto) */
                <div className="-mx-3 md:-mx-6">
                  {pacientesFiltrados.map(p => {
                    const nEquipos = conteoEquiposPorPaciente[p.id] || 0
                    return (
                      <div key={p.id} onClick={() => abrirDrawerPaciente(p)}
                        className={`px-4 py-3 border-b border-slate-100 cursor-pointer transition-colors ${drawerPaciente?.id === p.id ? 'bg-[#FFF0F3] border-l-[3px] border-l-[#D81B43]' : 'hover:bg-slate-50'}`}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-[13px] font-bold text-slate-800 truncate">{p.nombre}</div>
                          <span className="flex-shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10.5px] font-bold bg-[#D81B43]/8 text-[#D81B43]">
                            <Package size={10} /> {nEquipos}
                          </span>
                        </div>
                        <div className="text-[11.5px] text-slate-400 mt-0.5">{p.ciudad || '—'}{p.cedula ? ` · ${p.cedula}` : ''}</div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <>
                  {/* Cards móvil */}
                  <div className="md:hidden space-y-2">
                    {pacientesPagina.map(p => {
                      const nEquipos = conteoEquiposPorPaciente[p.id] || 0
                      return (
                        <div key={p.id} onClick={() => abrirDrawerPaciente(p)}
                          className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 cursor-pointer active:bg-slate-50 transition-colors">
                          <div className="flex items-center gap-3 mb-2.5">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center text-[14px] font-bold flex-shrink-0 bg-[#F1F5F9] text-[#475569]">
                              {p.nombre?.charAt(0)?.toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-[14px] font-semibold text-slate-700 truncate">{p.nombre}</div>
                              {p.cedula && <div className="text-[11.5px] text-slate-400 font-mono">{p.cedula}</div>}
                            </div>
                            <span className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold bg-[#D81B43]/8 text-[#D81B43]">
                              <Package size={11} /> {nEquipos}
                            </span>
                            <ChevronRight size={16} className="text-slate-300 flex-shrink-0" />
                          </div>
                          {p.ciudad && (
                            <div className="flex items-center gap-2 text-[12px] text-slate-500 pl-1">
                              <MapPin size={11} className="text-slate-400" /> {p.ciudad}
                            </div>
                          )}
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
                            { label: 'Paciente', clave: 'nombre' },
                            { label: 'Cédula', clave: null },
                            { label: 'Ciudad', clave: 'ciudad' },
                            { label: 'Equipos activos', clave: 'equipos_activos', accessor: p => conteoEquiposPorPaciente[p.id] || 0 },
                            { label: '', clave: null },
                          ].map(col => (
                            <th key={col.label || 'acciones'}
                              onClick={col.clave ? () => solicitarOrdenPacientes(col.clave, col.accessor) : undefined}
                              className={`px-4 py-3 text-left text-[10.5px] font-bold uppercase tracking-[0.07em] text-slate-400 bg-slate-50 ${col.clave ? 'cursor-pointer select-none hover:bg-slate-100 transition-colors' : ''}`}>
                              <div className="flex items-center gap-1">
                                {col.label}
                                {configPacientes?.clave === col.clave && (
                                  <span className="text-[10px]">{configPacientes.direccion === 'asc' ? '▲' : '▼'}</span>
                                )}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {pacientesPagina.map(p => {
                          const nEquipos = conteoEquiposPorPaciente[p.id] || 0
                          return (
                            <tr key={p.id} onClick={() => abrirDrawerPaciente(p)}
                              className="border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-[12px] font-bold bg-[#F1F5F9] text-[#475569]">
                                    {p.nombre?.charAt(0)?.toUpperCase()}
                                  </div>
                                  <span className="text-[13px] font-semibold text-slate-700">{p.nombre}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                {p.cedula
                                  ? <span className="font-mono text-[12.5px] text-slate-600">{p.cedula}</span>
                                  : <span className="text-slate-300">—</span>}
                              </td>
                              <td className="px-4 py-3 text-[12.5px] text-slate-500">
                                {p.ciudad
                                  ? <div className="flex items-center gap-1"><MapPin size={11} className="text-slate-400 flex-shrink-0" />{p.ciudad}</div>
                                  : <span className="text-slate-300">—</span>}
                              </td>
                              <td className="px-4 py-3">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#D81B43]/8 text-[#D81B43]">
                                  <Package size={11} /> {nEquipos}
                                </span>
                              </td>
                              <td className="px-3 py-3 text-slate-300"><ChevronRight size={14} /></td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                    <Paginador {...paginacionPacientes} />
                  </div>
                  <div className="md:hidden mt-2">
                    <Paginador {...paginacionPacientes} />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Panel de detalle — aparece a la derecha sin reemplazar la columna de lista */}
          {drawerPaciente && (
            <div className="flex flex-col flex-1 overflow-hidden animate-panel-detalle">
              <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-[15px] font-bold flex-shrink-0 bg-[#F1F5F9] text-[#475569]">
                    {drawerPaciente.nombre?.charAt(0)?.toUpperCase()}
                  </div>
                  <div>
                    <div className="text-[15px] font-bold text-slate-800 leading-tight">{drawerPaciente.nombre}</div>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold mt-0.5 text-slate-400">
                      <HeartPulse size={12} /> Paciente
                    </span>
                  </div>
                </div>
                <button onClick={() => setDrawerPaciente(null)} title="Cerrar (ESC)"
                  className="text-slate-400 hover:text-slate-600 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 flex-shrink-0"><X size={16} /></button>
              </div>

              <div className="flex-1 overflow-y-auto pb-28 md:pb-6">
                <div className="p-6 space-y-3 border-b border-slate-100">
                  <div className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-3">Información general</div>
                  {[
                    { label: 'Cédula', value: drawerPaciente.cedula },
                    { label: 'Teléfono', value: drawerPaciente.telefono, icon: <Phone size={12} /> },
                    { label: 'Dirección', value: drawerPaciente.direccion, icon: <MapPin size={12} /> },
                    { label: 'Ciudad', value: drawerPaciente.ciudad, icon: <MapPin size={12} /> },
                  ].filter(f => f.value).map(f => (
                    <div key={f.label} className="flex justify-between text-[12.5px]">
                      <span className="text-slate-400 flex items-center gap-1">{f.icon}{f.label}</span>
                      <span className="font-medium text-slate-700 text-right ml-4 max-w-[220px]">{f.value}</span>
                    </div>
                  ))}
                </div>

                <div className="p-6">
                  <div className="flex items-center justify-between mb-3 gap-2">
                    <div className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-slate-400">
                      Equipos actuales {equiposDelPacienteDrawer.length > 0 && `(${equiposDelPacienteDrawer.length})`}
                    </div>
                    <button onClick={() => generarHojaVidaClientePaciente(drawerPaciente, 'pacientes')} disabled={pdfGenerando}
                      className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 bg-[#1B3A6B] text-white rounded-[8px] text-[11.5px] font-semibold hover:bg-[#152D54] transition-all disabled:opacity-70 disabled:cursor-not-allowed">
                      {pdfGenerando ? <><Loader2 size={12} className="animate-spin" /> Generando…</> : <><FileText size={13} /> Hoja de vida (PDF)</>}
                    </button>
                  </div>

                  {equiposDelPacienteDrawer.length === 0 ? (
                    <div className="text-center py-8 text-slate-400">
                      <Package className="w-10 h-10 mx-auto mb-2 opacity-20" />
                      <div className="text-[12.5px]">Sin equipos asignados actualmente</div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                      {equiposDelPacienteDrawer.map(eq => {
                        const orden = ordenesPorEquipo.mapa[eq.id]
                        const esUnico = (orden?.equipos?.length || 0) === 1
                        return (
                          <div key={eq.id} className="border border-slate-200 rounded-[10px] p-3 flex gap-3 items-center">
                            <div className="w-12 h-12 rounded-[9px] bg-slate-50 border border-slate-200 flex items-center justify-center flex-shrink-0">
                              <IconoTipo tipo={eq.tipo_equipo} categorias={categoriasParaIcono} size={28} />
                            </div>
                            <div className="min-w-0">
                              <div className="text-[13px] font-bold text-slate-800 truncate">
                                {eq.tipo_equipo?.categoria?.nombre || 'Equipo'}
                              </div>
                              <div className="text-[11.5px] text-slate-400 truncate">
                                {eq.tipo_equipo?.nombre || '—'} · {eq.codigo || '—'}
                              </div>
                              {eq.cliente_actual?.nombre && (
                                <div className="text-[11px] text-slate-400">Vía {eq.cliente_actual.nombre}</div>
                              )}
                              <div className="text-[11px] text-slate-400">
                                {ordenesPorEquipo.loading
                                  ? <Box className="h-2.5 w-20 inline-block align-middle" />
                                  : orden?.codigo
                                    ? orden.codigo
                                    : 'Sin orden activa'}
                              </div>
                              {orden?.ordenEquipoId && (
                                <div className="mt-1.5">
                                  <button type="button"
                                    onClick={() => abrirModalDevolucion({ ordenEquipoId: orden.ordenEquipoId, equipoId: eq.id, ordenId: orden.id }, 'paciente')}
                                    className="text-[11.5px] text-[#D81B43] font-semibold hover:underline">
                                    {esUnico ? 'Finalizar préstamo' : 'Marcar como devuelto'}
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          </div>
        </div>
      </div>
      )}

      {/* ── MODAL CREAR / EDITAR ── */}
      {modal && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm" onClick={() => intentarCerrarModal()} />
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
            <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-[560px] max-h-[calc(100vh-2rem)] flex flex-col shadow-2xl overflow-hidden"
              onClick={e => e.stopPropagation()}>
              <div className="px-6 py-4 border-b flex items-center justify-between flex-shrink-0">
                <h3 className="text-[16px] font-bold text-slate-800">{form.id ? 'Editar cliente' : 'Nuevo cliente'}</h3>
                <button onClick={() => intentarCerrarModal()} className="text-slate-400 hover:text-slate-600 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100"><X size={16} /></button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4" onChange={() => setFormDirty(true)}>
                {/* Tipo persona */}
                <div>
                  <label className={labelCls}>Tipo de persona <span className="text-[#D81B43]">*</span></label>
                  <div className="grid grid-cols-2 gap-3">
                    {['Jurídica', 'Natural'].map(tipo => (
                      <button key={tipo} type="button"
                        onClick={() => setForm(f => ({ ...f, tipo_persona: tipo, ...(tipo === 'Natural' ? { digito_verificacion: '' } : {}) }))}
                        className={`flex items-center gap-2 px-4 py-3 rounded-[9px] border-2 text-[13px] font-semibold transition-all ${form.tipo_persona === tipo
                          ? 'border-[#D81B43] bg-[#D81B43]/5 text-[#D81B43]'
                          : 'border-slate-200 text-slate-500 hover:border-slate-300'
                          }`}>
                        {tipo === 'Jurídica' ? <Building2 size={15} /> : <User size={15} />}
                        Persona {tipo}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Nombre */}
                <div>
                  <label className={labelCls}>Nombre / Razón social <span className="text-[#D81B43]">*</span></label>
                  <input value={form.nombre || ''} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                    placeholder="Nombre completo o razón social" className={inputCls} />
                </div>

                {/* NIT / CC */}
                <div className={`grid gap-3 ${form.tipo_persona !== 'Natural' ? 'grid-cols-3' : 'grid-cols-1'}`}>
                  <div className={form.tipo_persona !== 'Natural' ? 'col-span-2' : ''}>
                    <label className={labelCls}>{form.tipo_persona === 'Natural' ? 'CC' : 'NIT'}</label>
                    <input value={form.nit_cc || ''}
                      onChange={e => setForm(f => ({ ...f, nit_cc: e.target.value.replace(/[^0-9]/g, '') }))}
                      placeholder={form.tipo_persona === 'Natural' ? '1234567890' : '900123456'}
                      inputMode="numeric" className={inputCls} />
                  </div>
                  {form.tipo_persona !== 'Natural' && (
                    <div>
                      <label className={labelCls}>Dígito verif.</label>
                      <input value={form.digito_verificacion || ''}
                        onChange={e => setForm(f => ({ ...f, digito_verificacion: e.target.value.replace(/[^0-9]/g, '') }))}
                        placeholder="5" maxLength={1} inputMode="numeric" className={inputCls} />
                    </div>
                  )}
                </div>

                {/* Contacto */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Teléfono</label>
                    <div className="flex">
                      <span className="inline-flex items-center px-3 border border-r-0 border-slate-200 rounded-l-[9px] text-[13px] text-slate-500 bg-slate-50 select-none whitespace-nowrap">+57</span>
                      <input value={form.telefono || ''}
                        onChange={e => setForm(f => ({ ...f, telefono: e.target.value.replace(/\D/g, '').slice(0, 12) }))}
                        placeholder="3001234567" inputMode="numeric"
                        className={`${inputCls} rounded-l-none border-l-0`} />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Email</label>
                    <input value={form.email || ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      type="email" placeholder="correo@empresa.com"
                      className={inputCls + (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()) ? ' !border-red-300 focus:!border-red-400' : '')} />
                    {form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()) && (
                      <p className="text-[11px] text-red-400 mt-1">Formato inválido</p>
                    )}
                  </div>
                </div>

                {/* Ubicación */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Departamento</label>
                    <select value={form.departamento_id || ''} onChange={e => onChangeDepartamento(e.target.value)} className={inputCls}>
                      <option value="">Seleccionar...</option>
                      {departamentos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Municipio</label>
                    <select value={form.municipio_id || ''} onChange={e => setForm(f => ({ ...f, municipio_id: e.target.value }))}
                      disabled={!form.departamento_id} className={inputCls + (!form.departamento_id ? ' opacity-50' : '')}>
                      <option value="">Seleccionar...</option>
                      {municipiosFiltrados.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                    </select>
                  </div>
                </div>

                {/* Dirección */}
                <div>
                  <label className={labelCls}>Dirección</label>
                  <input value={form.direccion || ''} onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))}
                    placeholder="Calle 10 # 5-20" className={inputCls} />
                </div>
              </div>

              <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2 flex-shrink-0 bg-white">
                <button onClick={() => intentarCerrarModal()} className="px-4 py-2.5 border border-slate-200 rounded-[9px] text-[13px] font-medium text-slate-600 hover:border-slate-300">Cancelar</button>
                <button onClick={guardarCliente} disabled={saving}
                  className="px-5 py-2.5 bg-[#D81B43] text-white rounded-[9px] text-[13px] font-semibold hover:bg-[#B0172F] disabled:opacity-50">
                  {saving ? 'Guardando...' : form.id ? 'Guardar cambios' : 'Crear cliente'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── MODAL NUEVO PACIENTE ── */}
      {modalPaciente && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm" onClick={() => intentarCerrarModal()} />
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
            <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-[560px] max-h-[calc(100vh-2rem)] flex flex-col shadow-2xl overflow-hidden"
              onClick={e => e.stopPropagation()}>
              <div className="px-6 py-4 border-b flex items-center justify-between flex-shrink-0">
                <h3 className="text-[16px] font-bold text-slate-800">Nuevo paciente</h3>
                <button onClick={() => intentarCerrarModal()} className="text-slate-400 hover:text-slate-600 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100"><X size={16} /></button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4" onChange={() => setFormDirty(true)}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Nombre <span className="text-[#D81B43]">*</span></label>
                    <input value={formPaciente.nombre || ''} onChange={e => setFormPaciente(f => ({ ...f, nombre: e.target.value }))}
                      placeholder="Nombre completo" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Cédula</label>
                    <input value={formPaciente.cedula || ''}
                      onChange={e => setFormPaciente(f => ({ ...f, cedula: e.target.value.replace(/[^0-9]/g, '') }))}
                      placeholder="1234567890" inputMode="numeric" className={inputCls} />
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Dirección <span className="text-[#D81B43]">*</span></label>
                  <input value={formPaciente.direccion || ''} onChange={e => setFormPaciente(f => ({ ...f, direccion: e.target.value }))}
                    placeholder="Calle 10 # 5-20" className={inputCls} />
                </div>

                <div>
                  <label className={labelCls}>Ciudad</label>
                  <input value={formPaciente.ciudad || ''} onChange={e => setFormPaciente(f => ({ ...f, ciudad: e.target.value }))}
                    placeholder="Valledupar" className={inputCls} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Teléfono</label>
                    <div className="flex">
                      <span className="inline-flex items-center px-3 border border-r-0 border-slate-200 rounded-l-[9px] text-[13px] text-slate-500 bg-slate-50 select-none whitespace-nowrap">+57</span>
                      <input value={formPaciente.telefono || ''}
                        onChange={e => setFormPaciente(f => ({ ...f, telefono: e.target.value.replace(/\D/g, '').slice(0, 12) }))}
                        placeholder="3001234567" inputMode="numeric"
                        className={`${inputCls} rounded-l-none border-l-0`} />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Correo</label>
                    <input value={formPaciente.correo || ''} onChange={e => setFormPaciente(f => ({ ...f, correo: e.target.value }))}
                      type="email" placeholder="correo@ejemplo.com"
                      className={inputCls + (formPaciente.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formPaciente.correo.trim()) ? ' !border-red-300 focus:!border-red-400' : '')} />
                    {formPaciente.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formPaciente.correo.trim()) && (
                      <p className="text-[11px] text-red-400 mt-1">Formato inválido</p>
                    )}
                  </div>
                </div>

                <p className="text-[11.5px] text-slate-400">
                  También puedes registrar pacientes al crear un préstamo, desde el paso de datos del paciente.
                </p>
              </div>

              <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2 flex-shrink-0 bg-white">
                <button onClick={() => intentarCerrarModal()} className="px-4 py-2.5 border border-slate-200 rounded-[9px] text-[13px] font-medium text-slate-600 hover:border-slate-300">Cancelar</button>
                <button onClick={guardarPaciente} disabled={saving}
                  className="px-5 py-2.5 bg-[#D81B43] text-white rounded-[9px] text-[13px] font-semibold hover:bg-[#B0172F] disabled:opacity-50">
                  {saving ? 'Guardando...' : 'Crear paciente'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      <ConfirmDialog
        abierto={!!modalEliminar}
        titulo="¿Desactivar cliente?"
        mensaje={modalEliminar ? `"${modalEliminar.nombre}" pasará a la sección de inactivos. Podrás reactivarlo en cualquier momento.` : ''}
        textoConfirmar="Sí, desactivar"
        textoCancelar="Cancelar"
        tipo="peligro"
        onConfirmar={() => toggleActivo(modalEliminar.id, false)}
        onCancelar={() => setModalEliminar(null)}
      />

      <ConfirmDialog
        abierto={confirmarSalir}
        titulo="¿Descartar cambios?"
        mensaje="Tienes cambios sin guardar. ¿Deseas salir sin guardar?"
        textoConfirmar="Sí, salir"
        textoCancelar="Seguir editando"
        tipo="default"
        onConfirmar={() => { setConfirmarSalir(false); cerrarModal() }}
        onCancelar={() => setConfirmarSalir(false)}
      />

      <ModalDevolucion
        abierto={!!modalDevolucion}
        form={formDevolucion}
        onChangeFecha={v => setFormDevolucion(f => ({ ...f, fecha: v }))}
        onChangeObservaciones={v => setFormDevolucion(f => ({ ...f, observaciones: v }))}
        onConfirmar={confirmarDevolucion}
        onCancelar={() => setModalDevolucion(null)}
      />

      {toast && (
        <div className={`fixed bottom-28 md:bottom-6 right-4 md:right-6 z-[70] px-4 py-3 rounded-[10px] text-[13px] font-medium text-white shadow-lg ${toast.tipo === 'error' ? 'bg-red-500' : 'bg-[#0F7B55]'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}