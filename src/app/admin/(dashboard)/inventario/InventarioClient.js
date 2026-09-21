'use client'
import { registrarBitacora } from '@/lib/bitacora'
import Image from 'next/image'
import { useState, useMemo, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Package, Inbox, Plus, X, Search, Download, Edit3, FileText, AlertTriangle, Clock, CheckCircle2, Box, Hash, Tag, Layers, SlidersHorizontal, Loader2 } from 'lucide-react'
import { IconoEquipo, GaleriaIconos } from '@/components/inventario/IconosEquipo'
import { IconoTipo } from '@/components/inventario/IconoTipo'
import Paginador from '@/components/ui/Paginador'
import { formatear, hoyBogota } from '@/lib/fechas'
import BuzonNovedades from '@/components/layout/BuzonNovedades'
import { useOrdenable } from '@/hooks/useOrdenable'
import { usePaginacion } from '@/hooks/usePaginacion'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const LOGO_URL = `${SUPABASE_URL}/storage/v1/object/public/logos/logo-ingemedic.png`

const CAMPO_FILTRO_STYLES = {
  modelo: { color: '#2EB5D4', Icon: Box },
  serie: { color: '#D81B43', Icon: Hash },
  codigo: { color: '#D81B43', Icon: Hash },
  marca: { color: '#6D28D9', Icon: Tag },
  tipo: { color: '#B45309', Icon: Layers },
}
const FILTRO_PALETTE = [
  { color: '#2EB5D4', Icon: Box },
  { color: '#6D28D9', Icon: Tag },
  { color: '#B45309', Icon: Layers },
  { color: '#0E7490', Icon: SlidersHorizontal },
]
const FILTRO_DROPDOWN_MAX = 6

const ESTADO_STYLES = {
  'Disponible': { bg: '#ECFDF5', color: '#0F7B55', dot: '#0F7B55' },
  'Reservado': { bg: '#FFFBEB', color: '#B45309', dot: '#F59E0B' },
  'En préstamo': { bg: '#E8F7FB', color: '#0E86A0', dot: '#2EB5D4' },
  'En mantenimiento': { bg: '#FFFBEB', color: '#B45309', dot: '#F59E0B' },
  'Con novedad': { bg: '#FEF2F2', color: '#C0392B', dot: '#C0392B' },
  'Baja': { bg: '#F1F5F9', color: '#64748B', dot: '#94A3B8' },
}

const inputCls = 'w-full px-3 py-2.5 border border-slate-200 rounded-[9px] text-[13.5px] text-slate-800 outline-none focus:border-[#D81B43] bg-white transition-colors placeholder:text-slate-400'
const labelCls = 'block text-[11px] font-bold uppercase tracking-[0.07em] text-slate-500 mb-1.5'

function formatearValor(valor, tipo) {
  if (!valor && valor !== 0) return '—'
  if (tipo === 'numero' && !isNaN(valor)) return Number(valor).toLocaleString('es-CO')
  return valor
}

export default function InventarioClient({ categorias: catsIniciales, tipos: tiposIniciales, equipos, estados }) {
  const router = useRouter()
  const supabase = createClient()

  const [categorias, setCategorias] = useState(catsIniciales)
  const [tipos, setTipos] = useState(tiposIniciales)
  const skipSyncUntil = useRef(0)

  useEffect(() => {
    const t = setTimeout(() => {
      if (Date.now() < skipSyncUntil.current) return
      setCategorias(catsIniciales)
    }, 0)
    return () => clearTimeout(t)
  }, [catsIniciales])

  useEffect(() => {
    const t = setTimeout(() => {
      if (Date.now() < skipSyncUntil.current) return
      setTipos(tiposIniciales)
    }, 0)
    return () => clearTimeout(t)
  }, [tiposIniciales])

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
      .channel('inventario-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'equipos' }, refrescarConDebounce)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tipos_equipo' }, refrescarConDebounce)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categorias_equipo' }, refrescarConDebounce)
      .subscribe()

    return () => { clearTimeout(debounceTimer); supabase.removeChannel(canal) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [vista, setVista] = useState('categorias')
  const [catActual, setCatActual] = useState(null)
  const [tipoActual, setTipoActual] = useState(null)
  const [search, setSearch] = useState('')
  const [buscarCategoria, setBuscarCategoria] = useState('')
  const [buscarUnidad, setBuscarUnidad] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroDisponibilidad, setFiltroDisponibilidad] = useState('todos')
  const [filtrosCampos, setFiltrosCampos] = useState({})
  const [drawer, setDrawer] = useState(null)
  const [modalNueva, setModalNueva] = useState(false)
  const [modalTipo, setModalTipo] = useState(false)
  const [modalEditar, setModalEditar] = useState(false)
  const [modalSalir, setModalSalir] = useState(false)
  const [formDirty, setFormDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [exportando, setExportando] = useState(false)
  const [pdfGenerando, setPdfGenerando] = useState(false)
  const [toast, setToast] = useState(null)
  const [formUnidad, setFormUnidad] = useState({ estado_id: '', atributos: {} })
  const [formTipo, setFormTipo] = useState({ icono: '', atributos: {} })
  const [formEditar, setFormEditar] = useState({ estado_id: '', atributos: {}, motivo: '' })
  const [prestamosDrawer, setPrestamosDrawer] = useState([])

  useEffect(() => {
    let cancelled = false
    const t = setTimeout(() => {
      if (!drawer?.id) {
        if (!cancelled) setPrestamosDrawer([])
        return
      }
      supabase
        .from('orden_equipos')
        .select(`
          id, fecha_entrega, fecha_devolucion, observaciones_devolucion,
          orden:ordenes_servicio(
            id, codigo, fecha_creacion,
            estado:estados_orden(nombre),
            cliente:clientes(id, nombre),
            paciente:pacientes(id, nombre)
          )
        `)
        .eq('equipo_id', drawer.id)
        .order('fecha_entrega', { ascending: false })
        .then(({ data }) => { if (!cancelled) setPrestamosDrawer(data || []) })
    }, 0)
    return () => { cancelled = true; clearTimeout(t) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawer?.id])

  function showToast(msg, tipo = 'success') {
    setToast({ msg, tipo })
    setTimeout(() => setToast(null), 3000)
  }

  const stats = useMemo(() => {
    let base = equipos
    if (vista === 'tipos' && catActual) {
      const idsTipos = tipos.filter(t => t.categoria_id === catActual.id).map(t => t.id)
      base = equipos.filter(e => idsTipos.includes(e.tipo_equipo_id))
    } else if (vista === 'unidades' && tipoActual) {
      base = equipos.filter(e => e.tipo_equipo_id === tipoActual.id)
    }
    return {
      total: base.length,
      disponibles: base.filter(e => e.estado?.nombre === 'Disponible').length,
      prestamo: base.filter(e => e.estado?.nombre === 'En préstamo').length,
      mant: base.filter(e => e.estado?.nombre === 'En mantenimiento').length,
    }
  }, [equipos, vista, catActual, tipoActual, tipos])

  const tiposDeCat = useMemo(() =>
    catActual ? tipos.filter(t => t.categoria_id === catActual.id) : [],
    [tipos, catActual]
  )

  const stockPorTipo = useMemo(() => {
    const map = {}
    equipos.forEach(e => {
      if (!e.tipo_equipo_id) return
      if (!map[e.tipo_equipo_id]) map[e.tipo_equipo_id] = { total: 0, disponibles: 0, prestamo: 0, mant: 0 }
      map[e.tipo_equipo_id].total++
      if (e.estado?.nombre === 'Disponible') map[e.tipo_equipo_id].disponibles++
      if (e.estado?.nombre === 'En préstamo') map[e.tipo_equipo_id].prestamo++
      if (e.estado?.nombre === 'En mantenimiento') map[e.tipo_equipo_id].mant++
    })
    return map
  }, [equipos])

  const categoriasFiltradas = useMemo(() => {
    if (!buscarCategoria.trim()) return categorias
    const q = buscarCategoria.trim().toLowerCase()
    return categorias.filter(c => c.nombre.toLowerCase().includes(q))
  }, [categorias, buscarCategoria])

  const tiposFiltrados = useMemo(() => {
    return tiposDeCat.filter(t => {
      if (search && !nombreTipo(t).toLowerCase().includes(search.toLowerCase())) return false
      if (filtroDisponibilidad !== 'todos') {
        const stock = stockPorTipo[t.id] || { disponibles: 0 }
        if (filtroDisponibilidad === 'con_disponibles' && stock.disponibles === 0) return false
        if (filtroDisponibilidad === 'sin_disponibles' && stock.disponibles > 0) return false
      }
      return true
    })
  }, [tiposDeCat, search, filtroDisponibilidad, stockPorTipo])

  const resultadosUnidad = useMemo(() => {
    if (!buscarUnidad.trim()) return []
    const q = buscarUnidad.trim().toLowerCase()
    return equipos.filter(e => {
      if (!tiposDeCat.some(t => t.id === e.tipo_equipo_id)) return false
      const codigoMatch = e.codigo?.toLowerCase().includes(q)
      const atrsMatch   = Object.values(e.atributos || {}).some(v => v?.toString().toLowerCase().includes(q))
      return codigoMatch || atrsMatch
    })
  }, [buscarUnidad, equipos, tiposDeCat])

  const baseUnidadesDeTipo = useMemo(() =>
    tipoActual ? equipos.filter(e => e.tipo_equipo_id === tipoActual.id) : [],
    [equipos, tipoActual]
  )

  const unidadesDeTipo = useMemo(() => {
    if (!tipoActual) return []
    let result = [...baseUnidadesDeTipo]
    if (search) result = result.filter(e => {
      const atrs = e.atributos || {}
      return Object.values(atrs).some(v => v?.toString().toLowerCase().includes(search.toLowerCase())) ||
        e.codigo?.toLowerCase().includes(search.toLowerCase())
    })
    if (filtroEstado) result = result.filter(e => e.estado?.nombre === filtroEstado)
    Object.entries(filtrosCampos).forEach(([clave, valor]) => {
      if (valor) result = result.filter(e =>
        e.atributos?.[clave]?.toString().toLowerCase().includes(valor.toLowerCase())
      )
    })
    return result
  }, [baseUnidadesDeTipo, tipoActual, search, filtroEstado, filtrosCampos])

  const camposTipo = catActual?.atributos_extra?.campos_tipo || []
  const camposUnidad = catActual?.atributos_extra?.campos_unidad || []
  // En "Nueva unidad" el código (clave 'codigo' o 'codigo_inventario', según la
  // categoría) ya se captura con el campo unificado "Código de inventario" —
  // se excluye aquí para no duplicarlo en "Detalles de la unidad".
  const camposUnidadExtra = camposUnidad.filter(c => c.clave !== 'codigo' && c.clave !== 'codigo_inventario')

  const { itemsOrdenados: unidadesOrdenadas, config: configUnidades, solicitarOrden: solicitarOrdenUnidades } = useOrdenable(unidadesDeTipo)
  const paginacionUnidades = usePaginacion(unidadesOrdenadas, 20)
  const unidadesPagina = paginacionUnidades.itemsPagina

  const valoresUnicosPorCampo = useMemo(() => {
    const result = {}
    for (const campo of camposUnidad) {
      result[campo.clave] = [...new Set(
        baseUnidadesDeTipo
          .map(e => e.atributos?.[campo.clave])
          .filter(v => v != null && v !== '')
      )].sort()
    }
    return result
  }, [baseUnidadesDeTipo, camposUnidad])

  function irACat(cat) {
    setCatActual(categorias.find(c => c.id === cat.id) || cat)
    setSearch('')
    setBuscarUnidad('')
    setFiltroDisponibilidad('todos')
    setVista('tipos')
  }

  function irATipo(tipo) {
    setTipoActual(tipo)
    setSearch('')
    setBuscarUnidad('')
    setFiltroEstado('')
    setFiltrosCampos({})
    setVista('unidades')
  }

  function volver() {
    if (vista === 'unidades') { setVista('tipos'); setTipoActual(null); setBuscarUnidad('') }
    else if (vista === 'tipos') { setVista('categorias'); setCatActual(null); setBuscarUnidad('') }
  }

  function abrirEditar() {
    setFormEditar({
      estado_id: drawer?.estado_id || '',
      atributos: { ...(drawer?.atributos || {}) },
      motivo: '',
    })
    setFormDirty(false)
    setModalEditar(true)
  }

  function intentarCerrarEditar() {
    if (formDirty) setModalSalir(true)
    else setModalEditar(false)
  }

  async function guardarEdicion() {
    if (!formEditar.motivo?.trim()) { showToast('El motivo de cambio es obligatorio', 'error'); return }
    setSaving(true)
    const { error } = await supabase.from('equipos').update({
      estado_id: formEditar.estado_id || null,
      atributos: Object.keys(formEditar.atributos).length > 0 ? formEditar.atributos : null,
    }).eq('id', drawer.id)
    if (error) { showToast('Error: ' + error.message, 'error'); setSaving(false); return }
    registrarBitacora({ modulo: 'inventario', accion: 'editar', entidad: 'equipo', entidad_id: drawer.id, detalle: { codigo: drawer.codigo || drawer.atributos?.codigo } })
    showToast('Equipo actualizado')
    setSaving(false)
    setModalEditar(false)
    setDrawer(null)
    router.refresh()
  }

  async function exportar(nivel, extra = {}) {
    setExportando(true)
    try {
      const res = await fetch('/api/exportar/inventario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nivel, ...extra }),
      })
      if (!res.ok) { showToast('Error exportando', 'error'); return }
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `inventario_${nivel}_${hoyBogota()}.xlsx`
      a.click()
    } catch (e) {
      showToast('Error exportando', 'error')
    } finally {
      setExportando(false)
    }
  }

  // ── GENERAR HOJA DE VIDA PDF ─────────────────────────────
  async function generarHojaVidaPDF(equipo) {
    setPdfGenerando(true)
    const { default: jsPDF }       = await import('jspdf')
    const { default: html2canvas } = await import('html2canvas')

    async function toB64(url) {
      const res  = await fetch(url)
      const blob = await res.blob()
      return new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob) })
    }

    let logoB64 = ''
    try { logoB64 = await toB64(LOGO_URL) } catch { /* continuar sin logo */ }

    const tipo      = equipo.tipo_equipo
    const imagenUrl = tipo?.imagen_url && !tipo.imagen_url.startsWith('icono:') ? tipo.imagen_url : null
    let imagenB64   = ''
    if (imagenUrl) { try { imagenB64 = await toB64(imagenUrl) } catch { /* sin imagen */ } }

    const estadoNombre = equipo.estado?.nombre || '—'
    const estadoSty    = ESTADO_STYLES[estadoNombre] || { bg: '#F1F5F9', color: '#64748B' }
    const fechaHoy     = formatear(new Date().toISOString(), { month: 'long' })
    const fechaReg     = formatear(equipo.fecha_creacion)

    const atrsAll = { ...(tipo?.atributos || {}), ...(equipo.atributos || {}) }
    delete atrsAll.serie
    const atrsEntries = Object.entries(atrsAll).filter(([, v]) => v != null && v !== '')

    const caracteristicasHTML = atrsEntries.length === 0
      ? '<div style="font-size:12px;color:#94A3B8;grid-column:span 2">Sin características registradas</div>'
      : atrsEntries.map(([k, v]) => `
          <div>
            <div style="font-size:10px;color:#94A3B8">${k}</div>
            <div style="font-size:12.5px;color:#0F172A;margin-top:2px">${String(v)}</div>
          </div>`).join('')

    const eventosH = []
    ;(prestamosDrawer || []).forEach(p => {
      const fE     = p.fecha_entrega    ? new Date(p.fecha_entrega)    : (p.orden?.fecha_creacion ? new Date(p.orden.fecha_creacion) : null)
      const fD     = p.fecha_devolucion ? new Date(p.fecha_devolucion) : null
      const activo = !fD
      const cli    = p.orden?.cliente?.nombre  || 'Cliente desconocido'
      const pac    = p.orden?.paciente?.nombre || null
      const cod    = p.orden?.codigo           || null
      eventosH.push({
        fecha:    fE,
        titulo:   `Préstamo — ${cli}`,
        badge:    activo
          ? { text: 'En préstamo', bg: '#E8F7FB', color: '#0E7490' }
          : { text: 'Completado',  bg: '#ECFDF5', color: '#0F7B55' },
        detalle:  [pac ? `Paciente: ${pac}` : null, cod ? `Orden: ${cod}` : null].filter(Boolean).join('  ·  '),
        dotColor: activo ? '#0E86A0' : '#0F7B55',
      })
      if (fD) eventosH.push({
        fecha:    fD,
        titulo:   'Devolución',
        badge:    { text: 'Devuelto', bg: '#ECFDF5', color: '#0F7B55' },
        detalle:  [cod ? `Orden: ${cod}` : null, p.observaciones_devolucion || null].filter(Boolean).join('  ·  '),
        dotColor: '#0F7B55',
      })
    })
    eventosH.sort((a, b) => {
      if (!a.fecha && !b.fecha) return 0
      if (!a.fecha) return 1
      if (!b.fecha) return -1
      return b.fecha - a.fecha
    })

    const timelineHTML = eventosH.length === 0
      ? '<div style="font-size:13px;color:#94A3B8">Sin actividad registrada</div>'
      : eventosH.map((ev, idx) => {
          const isLast = idx === eventosH.length - 1
          const dia    = ev.fecha ? formatear(ev.fecha, { year: undefined }) : '—'
          const anio   = ev.fecha ? formatear(ev.fecha, { day: undefined, month: undefined }) : ''
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
            <div style="color:#fff;font-size:13px;font-weight:700;letter-spacing:.02em">HOJA DE VIDA DEL EQUIPO</div>
            <div style="color:#AFC1DE;font-size:11px;margin-top:3px">Ingemedic de Colombia S.A.S.</div>
            <div style="color:#7C93BE;font-size:10px;margin-top:10px">Generado: ${fechaHoy}</div>
          </div>
        </div>

        <div style="padding:20px 24px;display:flex;gap:20px">
          <div style="width:150px;flex-shrink:0;display:flex;flex-direction:column;align-items:flex-start">
            <div style="width:150px;height:120px;border-radius:8px;background:#F8FAFC;border:0.5px solid #E2E8F0;display:flex;align-items:center;justify-content:center;margin-bottom:10px;overflow:hidden">
              ${imagenB64 ? `<img src="${imagenB64}" style="max-width:140px;max-height:110px;object-fit:contain">` : ''}
            </div>
            <div style="font-size:15px;font-weight:700;color:#0F172A">${tipo?.nombre || '—'}</div>
            <div style="margin-top:6px">
              <table style="display:inline-table;border-collapse:collapse"><tr><td style="background:${estadoSty.bg};border-radius:20px;padding:0 10px;height:22px;color:${estadoSty.color};font-size:11px;font-weight:700;white-space:nowrap;vertical-align:middle;line-height:normal">${estadoNombre}</td></tr></table>
            </div>
          </div>
          <div style="flex:1;display:flex;flex-direction:column;gap:10px">
            <div style="background:#F1F5F9;padding:6px 10px;font-size:10.5px;font-weight:700;color:#334155;letter-spacing:.04em">IDENTIFICACIÓN</div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:0 2px">
              <div><div style="font-size:10px;color:#94A3B8">Código</div><div style="font-size:13px;font-weight:700;color:#0F172A;margin-top:2px">${equipo.codigo || '—'}</div></div>
              <div><div style="font-size:10px;color:#94A3B8">Serie</div><div style="font-size:13px;color:#0F172A;margin-top:2px">${equipo.atributos?.serie || '—'}</div></div>
              <div><div style="font-size:10px;color:#94A3B8">Registrado</div><div style="font-size:13px;color:#0F172A;margin-top:2px">${fechaReg}</div></div>
            </div>
            <div style="background:#F1F5F9;padding:6px 10px;font-size:10.5px;font-weight:700;color:#334155;letter-spacing:.04em;margin-top:4px">CARACTERÍSTICAS TÉCNICAS</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:0 2px">
              ${caracteristicasHTML}
            </div>
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
      const isMobile    = typeof window !== 'undefined' && window.innerWidth < 768
      const canvas      = await html2canvas(contenedor, { scale: isMobile ? 1 : 2, useCORS: true, allowTaint: false, backgroundColor: '#ffffff', logging: false })
      const pdf         = new jsPDF('p', 'mm', 'a4')
      const anchoPDF    = 210
      const pageHeightPx = Math.round(canvas.width * (297 / 210))

      const totalPages = Math.ceil(canvas.height / pageHeightPx)
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

      pdf.save(`HojaVida_${equipo.codigo || 'equipo'}.pdf`)
      showToast('PDF generado')
    } finally {
      document.body.removeChild(contenedor)
      setPdfGenerando(false)
    }
  }

  function abrirModalTipo() {
    setFormTipo({ icono: '', atributos: {} })
    setModalTipo(true)
  }

  async function guardarTipo() {
    const nombreVal = formTipo.atributos?.nombre?.trim()
    if (!nombreVal) { showToast('El nombre es obligatorio', 'error'); return }
    for (const campo of camposTipo) {
      if (campo.obligatorio && !formTipo.atributos?.[campo.clave]?.toString().trim()) {
        showToast(`El campo "${campo.nombre}" es obligatorio`, 'error'); return
      }
    }
    setSaving(true)
    const { data, error } = await supabase.from('tipos_equipo')
      .insert({
        categoria_id: catActual.id,
        nombre: nombreVal,
        imagen_url: formTipo.icono ? `icono:${formTipo.icono}` : null,
        atributos: Object.keys(formTipo.atributos).length > 0 ? formTipo.atributos : null,
        activo: true,
      })
      .select('*, categoria:categorias_equipo(id, nombre, atributos_extra)').single()
    if (error) { showToast('Error: ' + error.message, 'error'); setSaving(false); return }
    registrarBitacora({ modulo: 'inventario', accion: 'crear', entidad: 'tipo de equipo', entidad_id: data.id, detalle: { nombre: formTipo.atributos?.nombre } })
    skipSyncUntil.current = Date.now() + 2500
    setTipos(prev => [...prev, data])
    showToast('Tipo creado')
    setSaving(false)
    setModalTipo(false)
  }

  function abrirModalNueva() {
    const estadoDisponible = estados.find(e => e.nombre === 'Disponible')
    setFormUnidad({ codigo_inventario: '', estado_id: estadoDisponible?.id || '', atributos: {} })
    setModalNueva(true)
  }

  async function guardarUnidad() {
    const codigoInventario = formUnidad.codigo_inventario?.trim()
    if (!codigoInventario) { showToast('El código de inventario es obligatorio', 'error'); return }
    for (const campo of camposUnidadExtra) {
      if (campo.obligatorio && !formUnidad.atributos[campo.clave]?.toString().trim()) {
        showToast(`El campo "${campo.nombre}" es obligatorio`, 'error'); return
      }
    }
    setSaving(true)
    const { data: newUnit, error } = await supabase.from('equipos').insert({
      tipo_equipo_id: tipoActual.id,
      codigo: codigoInventario,
      estado_id: formUnidad.estado_id || null,
      atributos: { ...formUnidad.atributos, codigo_inventario: codigoInventario },
    }).select('id').single()
    if (error) { showToast('Error: ' + error.message, 'error'); setSaving(false); return }
    registrarBitacora({ modulo: 'inventario', accion: 'crear', entidad: 'equipo', entidad_id: newUnit?.id, detalle: { codigo: codigoInventario } })
    showToast('Equipo registrado')
    setSaving(false)
    setModalNueva(false)
    router.refresh()
  }

  function renderCampo(campo, atributos, setAtributos) {
    const val = atributos[campo.clave] || ''
    const onChange = v => setAtributos({ ...atributos, [campo.clave]: v })
    if (campo.tipo === 'booleano') return (
      <select value={val} onChange={e => onChange(e.target.value)} className={inputCls}>
        <option value="">Seleccionar...</option>
        <option value="si">Sí</option>
        <option value="no">No</option>
      </select>
    )
    if (campo.tipo === 'lista') return (
      <select value={val} onChange={e => onChange(e.target.value)} className={inputCls}>
        <option value="">Seleccionar...</option>
        {(campo.opciones || []).map(op => <option key={op} value={op}>{op}</option>)}
      </select>
    )
    return (
      <input type={campo.tipo === 'numero' ? 'number' : campo.tipo === 'fecha' ? 'date' : 'text'}
        value={val} onChange={e => onChange(e.target.value)} placeholder={campo.nombre} className={inputCls} />
    )
  }

  function nombreTipo(tipo) {
    return tipo?.nombre || '—'
  }

  function renderIconoTipo(tipo, size = 48) {
    return <IconoTipo tipo={tipo} categorias={categorias} size={size} />
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">

      {/* Topbar */}
      <div className="h-14 md:h-16 md:bg-white md:border-b md:border-slate-200 flex items-center px-4 md:px-7 flex-shrink-0 flex-wrap gap-2">
        <div className="flex items-center gap-2 text-sm text-slate-600 md:text-slate-400 flex-wrap">
          {vista !== 'categorias' && (
            <button onClick={volver}
              className="md:hidden w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-200 transition-colors text-slate-700 font-bold text-base">
              ←
            </button>
          )}
          <button onClick={() => { setVista('categorias'); setCatActual(null); setTipoActual(null) }}
            className="text-[18px] font-bold text-slate-800 md:text-sm md:font-medium md:text-slate-400 md:hover:text-slate-700 transition-colors">Inventario</button>
          {catActual && <>
            <span>/</span>
            <button onClick={() => { setVista('tipos'); setTipoActual(null) }}
              className="hover:text-slate-700 transition-colors">{catActual.nombre}</button>
          </>}
          {tipoActual && <>
            <span>/</span>
            <span className="text-slate-700 font-semibold">{nombreTipo(tipoActual)}</span>
          </>}
        </div>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <BuzonNovedades />
          {vista !== 'categorias' && (
            <button onClick={volver}
              className="hidden md:flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium text-slate-500 border border-slate-200 rounded-[9px] hover:border-slate-300 transition-all">
              ← Volver
            </button>
          )}
          <button
            onClick={() => {
              if (vista === 'unidades' && tipoActual) exportar('unidades', { tipo_id: tipoActual.id })
              else if (vista === 'tipos' && catActual) exportar('tipos', { categoria_id: catActual.id })
              else exportar('completo')
            }}
            disabled={exportando}
            className="hidden md:flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium text-slate-600 border border-slate-200 rounded-[9px] hover:border-slate-300 transition-all disabled:opacity-50">
            <Download size={13} /> {exportando ? 'Exportando…' : 'Exportar Excel'}
          </button>
          {vista === 'tipos' && (
            <button onClick={abrirModalTipo}
              className="hidden md:flex items-center gap-1.5 px-4 py-2 bg-[#D81B43] text-white text-[13px] font-semibold rounded-[9px] hover:bg-[#B0172F] transition-colors">
              <Plus size={14} strokeWidth={2.5} /> Nuevo tipo
            </button>
          )}
          {vista === 'unidades' && (
            <button onClick={abrirModalNueva}
              className="hidden md:flex items-center gap-1.5 px-4 py-2 bg-[#D81B43] text-white text-[13px] font-semibold rounded-[9px] hover:bg-[#B0172F] transition-colors">
              <Plus size={14} strokeWidth={2.5} /> Nueva unidad
            </button>
          )}
        </div>
      </div>

      {/* FAB móvil — solo en vista tipos o unidades */}
      {vista === 'tipos' && (
        <button onClick={abrirModalTipo}
          className="fixed bottom-[calc(var(--mobile-nav-space,0px)+16px)] right-4 z-30 md:hidden shadow-lg rounded-full w-14 h-14 bg-[#D81B43] text-white flex items-center justify-center">
          <Plus size={22} strokeWidth={2.5} />
        </button>
      )}
      {vista === 'unidades' && (
        <button onClick={abrirModalNueva}
          className="fixed bottom-[calc(var(--mobile-nav-space,0px)+16px)] right-4 z-30 md:hidden shadow-lg rounded-full w-14 h-14 bg-[#D81B43] text-white flex items-center justify-center">
          <Plus size={22} strokeWidth={2.5} />
        </button>
      )}

      <div className="flex-1 overflow-y-auto p-3 md:p-6 pb-28 md:pb-6">

        {/* Stats — desktop: grid 4 cols / móvil: chips en scroll horizontal */}
        {(() => {
          const statsItems = [
            { label: 'Total equipos', value: stats.total, color: '#1E293B' },
            { label: 'Disponibles', value: stats.disponibles, color: '#0F7B55' },
            { label: 'En préstamo', value: stats.prestamo, color: '#0E86A0' },
            { label: 'Mantenimiento', value: stats.mant, color: '#B45309' },
          ]
          return (
            <>
              {/* Desktop */}
              <div className="hidden md:grid md:grid-cols-4 gap-4 mb-6">
                {statsItems.map(s => (
                  <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                    <div className="text-2xl font-extrabold tabular-nums" style={{ color: s.color }}>{s.value}</div>
                    <div className="text-[11.5px] text-slate-400 mt-1">{s.label}</div>
                  </div>
                ))}
              </div>
              {/* Móvil: scroll horizontal */}
              <div className="md:hidden flex gap-2 overflow-x-auto pb-1 mb-4 -mx-3 px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {statsItems.map(s => (
                  <div key={s.label} className="flex-shrink-0 bg-white border border-slate-200 rounded-full px-3 py-1.5 flex items-center gap-2 shadow-sm">
                    <span className="text-[15px] font-extrabold tabular-nums leading-none" style={{ color: s.color }}>{s.value}</span>
                    <span className="text-[11px] text-slate-400 whitespace-nowrap">{s.label}</span>
                  </div>
                ))}
              </div>
            </>
          )
        })()}

        {/* VISTA CATEGORÍAS */}
        {vista === 'categorias' && (
          <div>
            {categorias.length > 0 && (
              <div className="relative flex-1 min-w-[160px] md:max-w-[260px] mb-4">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={buscarCategoria} onChange={e => setBuscarCategoria(e.target.value)}
                  placeholder="Buscar categoría..."
                  className="w-full pl-8 pr-4 py-2 border border-slate-200 rounded-[9px] text-[13px] outline-none focus:border-[#D81B43] bg-white h-[38px]" />
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {categorias.length === 0 && (
              <div className="col-span-full text-center py-16 text-slate-400">
                <Package className="w-16 h-16 mx-auto mb-3 opacity-20" />
                <div className="font-semibold mb-1">Sin categorías configuradas</div>
                <div className="text-[13px]">Ve a <a href="/admin/configuracion" className="text-[#D81B43] hover:underline">Configuración → Categorías</a></div>
              </div>
            )}
            {categorias.length > 0 && categoriasFiltradas.length === 0 && (
              <div className="col-span-full text-center py-16 text-slate-400">
                <Search className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <div className="font-semibold">Ninguna categoría coincide con &quot;{buscarCategoria}&quot;</div>
              </div>
            )}
            {categoriasFiltradas.map(cat => {
              const tiposCat = tipos.filter(t => t.categoria_id === cat.id)
              const equiposCat = equipos.filter(e => tiposCat.some(t => t.id === e.tipo_equipo_id))
              const nCampos = (cat.atributos_extra?.campos_tipo?.length || 0) + (cat.atributos_extra?.campos_unidad?.length || 0)
              const iconoClave = cat.imagen_url?.startsWith('icono:') ? cat.imagen_url.replace('icono:', '') : null
              return (
                <div key={cat.id} onClick={() => irACat(cat)}
                  className="bg-white rounded-xl border border-slate-200 p-3 cursor-pointer hover:border-[#D81B43]/40 hover:shadow-md transition-all group flex items-center gap-3">
                  <div className="w-8 h-8 shrink-0 rounded-lg bg-[#D81B43]/5 flex items-center justify-center">
                    {iconoClave
                      ? <IconoEquipo clave={iconoClave} size={18} color="#D81B43" />
                      : <Package className="w-4 h-4 text-[#D81B43] opacity-60" />
                    }
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-bold text-slate-800 leading-tight truncate">{cat.nombre}</div>
                    <div className="text-[11.5px] text-slate-400">
                      {tiposCat.length} tipo{tiposCat.length !== 1 ? 's' : ''} · {equiposCat.length} uds.
                      {nCampos > 0 && <span className="text-[#D81B43]/50"> · {nCampos} campos</span>}
                    </div>
                  </div>
                  <div className="shrink-0 text-[#D81B43] text-[11.5px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity">→</div>
                </div>
              )
            })}
            </div>
          </div>
        )}

        {/* VISTA TIPOS */}
        {vista === 'tipos' && (
          <div>
            {tiposDeCat.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mb-4">
                {/* Buscador de tipo (marca) */}
                <div className="relative flex-1 min-w-[160px] md:max-w-[220px]">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar tipo..."
                    className="w-full pl-8 pr-4 py-2 border border-slate-200 rounded-[9px] text-[13px] outline-none focus:border-[#D81B43] bg-white h-[38px]" />
                </div>
                {/* Buscador de unidad (código / serie) */}
                <div className="relative flex-1 min-w-[180px] md:max-w-[260px]">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={buscarUnidad} onChange={e => setBuscarUnidad(e.target.value)}
                    onBlur={() => setTimeout(() => setBuscarUnidad(''), 200)}
                    placeholder="Buscar por código o serie..."
                    className="w-full pl-8 pr-4 py-2 border border-slate-200 rounded-[9px] text-[13px] outline-none focus:border-[#D81B43] bg-white h-[38px]" />
                  {resultadosUnidad.length > 0 && (
                    <div className="absolute z-20 left-0 top-full mt-1 w-full min-w-[260px] bg-white border border-slate-200 rounded-[9px] shadow-lg overflow-hidden">
                      {resultadosUnidad.slice(0, 8).map(eq => {
                        const tipo = tiposDeCat.find(t => t.id === eq.tipo_equipo_id)
                        const estSty = ESTADO_STYLES[eq.estado?.nombre] || {}
                        return (
                          <div key={eq.id}
                            onMouseDown={e => { e.preventDefault(); irATipo(tipo); setDrawer(eq); setBuscarUnidad('') }}
                            className="px-3 py-2.5 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0 flex items-center gap-2.5">
                            <div className="w-6 h-6 rounded-md bg-[#D81B43]/8 flex items-center justify-center flex-shrink-0">
                              <Package size={12} className="text-[#D81B43]" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-[12.5px] font-bold text-slate-800 truncate">{nombreTipo(tipo)}</div>
                              <div className="text-[11px] text-slate-400">{eq.codigo || '—'}</div>
                            </div>
                            <span className="text-[10.5px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                              style={{ background: estSty.bg, color: estSty.color }}>
                              {eq.estado?.nombre || '—'}
                            </span>
                          </div>
                        )
                      })}
                      {resultadosUnidad.length > 8 && (
                        <div className="px-3 py-2 text-[11px] text-slate-400 bg-slate-50 text-center">
                          +{resultadosUnidad.length - 8} más — escribe más caracteres para afinar
                        </div>
                      )}
                    </div>
                  )}
                  {buscarUnidad.trim() && resultadosUnidad.length === 0 && (
                    <div className="absolute z-20 left-0 top-full mt-1 w-full min-w-[220px] bg-white border border-slate-200 rounded-[9px] shadow-lg px-3 py-3 text-[12px] text-slate-400">
                      Sin resultados en esta categoría
                    </div>
                  )}
                </div>
                <select value={filtroDisponibilidad} onChange={e => setFiltroDisponibilidad(e.target.value)}
                  className="px-3 py-2 border border-slate-200 rounded-[9px] text-[13px] outline-none focus:border-[#D81B43] bg-white h-[38px] text-slate-600">
                  <option value="todos">Todos</option>
                  <option value="con_disponibles">Con disponibles</option>
                  <option value="sin_disponibles">Sin disponibles</option>
                </select>
                <div className="text-[12px] text-slate-400 flex-shrink-0 ml-auto">
                  {tiposFiltrados.length} tipo{tiposFiltrados.length !== 1 ? 's' : ''}
                </div>
              </div>
            )}
            {tiposDeCat.length === 0 && (
              <div className="text-center py-12 text-slate-400">
                <Inbox className="w-16 h-16 mx-auto mb-3 opacity-20" />
                <div className="font-semibold mb-1">Sin tipos en esta categoría</div>
                <div className="text-[13px]">Usa el botón &quot;Nuevo tipo&quot; para agregar uno</div>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {tiposFiltrados.map(tipo => {
                  const stock = stockPorTipo[tipo.id] || { total: 0, disponibles: 0 }
                  const campos = camposTipo.filter(c => c.clave !== 'nombre').slice(0, 2)
                  return (
                    <div key={tipo.id} onClick={() => irATipo(tipo)}
                      className="bg-white rounded-xl border border-slate-200 overflow-hidden cursor-pointer hover:border-[#D81B43]/50 hover:shadow-sm transition-all group flex">
                      {/* Imagen — izquierda, más compacta en móvil */}
                      <div className="w-[72px] h-[72px] md:w-[100px] md:h-[100px] flex-shrink-0 bg-[#F8FAFC] flex items-center justify-center p-2 md:p-4 border-r border-slate-100">
                        {renderIconoTipo(tipo, 48)}
                      </div>
                      {/* Contenido — derecha */}
                      <div className="p-3 flex-1 min-w-0 flex flex-col justify-center relative">
                        <div className="text-[13px] font-bold text-slate-800 leading-snug mb-1 pr-10 break-words">{nombreTipo(tipo)}</div>
                        {campos.map(c => (
                          <div key={c.clave} className="text-[11px] text-slate-500 truncate">
                            <span className="text-slate-400">{c.nombre}:</span> {formatearValor(tipo.atributos?.[c.clave], c.tipo)}
                          </div>
                        ))}
                        <div className="mt-1.5 pt-1.5 border-t border-slate-100">
                          <span className="text-[11px] font-bold text-[#0F7B55]">{stock.disponibles} disp.</span>
                          {stock.total - stock.disponibles > 0 && (
                            <span className="text-[11px] text-slate-400"> · {stock.total - stock.disponibles} en uso</span>
                          )}
                        </div>
                        {/* Badge unidades */}
                        <div className="absolute top-2 right-2 bg-white border border-slate-100 rounded-full px-2 py-0.5 shadow-sm">
                          <span className="text-[13px] font-extrabold text-slate-800 tabular-nums">{stock.total}</span>
                          <span className="text-[9px] text-slate-400 ml-0.5">uds.</span>
                        </div>
                      </div>
                    </div>
                  )
                })
              }
            </div>
          </div>
        )}

        {/* VISTA UNIDADES */}
        {vista === 'unidades' && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="relative flex-1 min-w-[160px] max-w-[300px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..."
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-[9px] text-[13px] outline-none focus:border-[#D81B43] bg-white" />
              </div>
              <div className="text-[12px] text-slate-400 ml-auto">
                {unidadesDeTipo.length} unidad{unidadesDeTipo.length !== 1 ? 'es' : ''}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-3 md:p-4 mb-4 shadow-sm">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <CheckCircle2 size={13} color="#0F7B55" />
                    <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-slate-500">Estado</span>
                  </div>
                  <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-[9px] text-[13px] outline-none focus:border-[#D81B43] bg-white text-slate-600 h-[38px]">
                    <option value="">Todos</option>
                    {estados.map(e => <option key={e.id} value={e.nombre}>{e.nombre}</option>)}
                  </select>
                </div>
                {camposUnidad.map((campo, idx) => {
                  const style = CAMPO_FILTRO_STYLES[campo.clave] || FILTRO_PALETTE[idx % FILTRO_PALETTE.length]
                  const Icon = style.Icon
                  const valoresUnicos = valoresUnicosPorCampo[campo.clave] || []
                  const usarDropdown = valoresUnicos.length > 0 && valoresUnicos.length <= FILTRO_DROPDOWN_MAX
                  return (
                    <div key={campo.clave}>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Icon size={13} color={style.color} />
                        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-slate-500">{campo.nombre}</span>
                      </div>
                      {usarDropdown ? (
                        <select
                          value={filtrosCampos[campo.clave] || ''}
                          onChange={e => setFiltrosCampos(f => ({ ...f, [campo.clave]: e.target.value }))}
                          className="w-full px-3 py-2 border border-slate-200 rounded-[9px] text-[13px] outline-none focus:border-[#D81B43] bg-white text-slate-600 h-[38px]"
                        >
                          <option value="">Todos</option>
                          {valoresUnicos.map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={filtrosCampos[campo.clave] || ''}
                          onChange={e => setFiltrosCampos(f => ({ ...f, [campo.clave]: e.target.value }))}
                          placeholder="Filtrar…"
                          className="w-full px-3 py-2 border border-slate-200 rounded-[9px] text-[13px] outline-none focus:border-[#D81B43] bg-white h-[38px] placeholder:text-slate-400"
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {unidadesDeTipo.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm text-center py-12 text-slate-400">
                <Inbox className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <div className="font-semibold mb-1">Sin unidades registradas</div>
                <div className="text-[13px]">Usa &quot;Nueva unidad&quot; para registrar el primer equipo</div>
              </div>
            ) : (
              <>
                {/* Tabla — solo en md+ */}
                <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b-2 border-slate-100">
                        {camposUnidad.map(c => {
                          const accessor = eq => c.tipo === 'numero'
                            ? Number(eq.atributos?.[c.clave] ?? eq[c.clave]) || null
                            : (eq.atributos?.[c.clave] ?? eq[c.clave] ?? null)
                          return (
                            <th key={c.clave} onClick={() => solicitarOrdenUnidades(c.clave, accessor)}
                              className="px-4 py-3 text-left text-[10.5px] font-bold uppercase tracking-[0.07em] text-slate-400 bg-slate-50 cursor-pointer select-none hover:bg-slate-100 transition-colors">
                              <div className="flex items-center gap-1">
                                {c.nombre}
                                {configUnidades?.clave === c.clave && (
                                  <span className="text-[10px]">{configUnidades.direccion === 'asc' ? '▲' : '▼'}</span>
                                )}
                              </div>
                            </th>
                          )
                        })}
                        <th onClick={() => solicitarOrdenUnidades('estado', eq => eq.estado?.nombre || '')}
                          className="px-4 py-3 text-left text-[10.5px] font-bold uppercase tracking-[0.07em] text-slate-400 bg-slate-50 cursor-pointer select-none hover:bg-slate-100 transition-colors">
                          <div className="flex items-center gap-1">
                            Estado
                            {configUnidades?.clave === 'estado' && (
                              <span className="text-[10px]">{configUnidades.direccion === 'asc' ? '▲' : '▼'}</span>
                            )}
                          </div>
                        </th>
                        <th className="px-4 py-3 text-left text-[10.5px] font-bold uppercase tracking-[0.07em] text-slate-400 bg-slate-50">Paciente</th>
                        <th className="px-4 py-3 text-left text-[10.5px] font-bold uppercase tracking-[0.07em] text-slate-400 bg-slate-50">Dirección</th>
                        <th className="w-10 bg-slate-50"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {unidadesPagina.map(eq => {
                        const est = eq.estado?.nombre || '—'
                        const estSty = ESTADO_STYLES[est] || {}
                        return (
                          <tr key={eq.id}
                            className="border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer"
                            onClick={() => setDrawer(eq)}>
                            {camposUnidad.map(c => (
                              <td key={c.clave} className="px-4 py-3 text-[13px] text-slate-600">
                                {c.clave === 'codigo'
                                  ? <span className="font-mono text-[12.5px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                                    {eq.atributos?.[c.clave] || eq[c.clave] || '—'}
                                  </span>
                                  : formatearValor(eq.atributos?.[c.clave] || eq[c.clave], c.tipo)
                                }
                              </td>
                            ))}
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold"
                                style={{ background: estSty.bg, color: estSty.color }}>
                                <span className="w-1.5 h-1.5 rounded-full" style={{ background: estSty.dot }} />
                                {est}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-[12.5px] text-slate-600">
                              {eq.paciente_actual?.nombre
                                ? <span className="truncate max-w-[140px] block">{eq.paciente_actual.nombre}</span>
                                : <span className="text-slate-300">—</span>}
                            </td>
                            <td className="px-4 py-3 text-[12.5px] text-slate-500">
                              {eq.paciente_actual?.direccion
                                ? <span className="truncate max-w-[160px] block">{eq.paciente_actual.direccion}</span>
                                : <span className="text-slate-300">—</span>}
                            </td>
                            <td className="px-3 py-3 text-slate-300">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  <Paginador {...paginacionUnidades} />
                </div>

                {/* Cards móvil — solo en mobile */}
                <div className="md:hidden flex flex-col gap-2">
                  {unidadesPagina.map(eq => {
                    const est = eq.estado?.nombre || '—'
                    const estSty = ESTADO_STYLES[est] || {}
                    const primerCampo = camposUnidad[0]
                    const segundoCampo = camposUnidad[1]
                    return (
                      <div key={eq.id}
                        className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 cursor-pointer active:bg-slate-50"
                        onClick={() => setDrawer(eq)}>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            {primerCampo && (
                              <div className="font-mono text-[13px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded inline-block">
                                {eq.atributos?.[primerCampo.clave] || eq[primerCampo.clave] || '—'}
                              </div>
                            )}
                            {segundoCampo && (
                              <div className="text-[12px] text-slate-500 mt-1">
                                <span className="text-slate-400">{segundoCampo.nombre}:</span>{' '}
                                {formatearValor(eq.atributos?.[segundoCampo.clave] || eq[segundoCampo.clave], segundoCampo.tipo)}
                              </div>
                            )}
                          </div>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold flex-shrink-0"
                            style={{ background: estSty.bg, color: estSty.color }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: estSty.dot }} />
                            {est}
                          </span>
                        </div>
                        {camposUnidad.slice(2).map(c => (
                          <div key={c.clave} className="text-[11.5px] text-slate-500">
                            <span className="text-slate-400">{c.nombre}:</span>{' '}
                            {formatearValor(eq.atributos?.[c.clave] || eq[c.clave], c.tipo)}
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </div>
                <div className="md:hidden bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mt-2">
                  <Paginador {...paginacionUnidades} />
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── DRAWER HOJA DE VIDA ── */}
      {drawer && (
        <>
          <div className="fixed inset-0 bg-black/30 z-[45] backdrop-blur-sm" onClick={() => setDrawer(null)} />
          <div className="fixed inset-x-0 bottom-0 h-[92vh] rounded-t-2xl md:rounded-none md:inset-x-auto md:top-0 md:right-0 md:bottom-0 md:h-full md:w-[500px] bg-white z-[50] flex flex-col shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between flex-shrink-0">
              <div>
                <div className="text-[16px] font-bold text-slate-800">
                  {drawer.atributos?.codigo || drawer.codigo || 'Equipo'}
                  {tipoActual && <span className="text-slate-400 font-normal ml-2">— {nombreTipo(tipoActual)}</span>}
                </div>
                <div className="text-[12px] text-slate-400 mt-0.5">{catActual?.nombre}</div>
              </div>
              <button onClick={() => setDrawer(null)} className="text-slate-400 hover:text-slate-600 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100">
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 border-b border-slate-100">
                {camposTipo.length > 0 && (
                  <div>
                    <div className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-3">Información del equipo</div>
                    <div className="space-y-2.5">
                      {camposTipo.map(c => (
                        <div key={c.clave} className="flex justify-between text-[12.5px]">
                          <span className="text-slate-400">{c.nombre}</span>
                          <span className="font-medium text-slate-700 text-right ml-4">{formatearValor(tipoActual?.atributos?.[c.clave], c.tipo)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <div className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-3">Estado y adquisición</div>
                  <div className="space-y-2.5">
                    <div className="flex justify-between text-[12.5px]">
                      <span className="text-slate-400">Estado</span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold"
                        style={{ background: (ESTADO_STYLES[drawer.estado?.nombre] || {}).bg, color: (ESTADO_STYLES[drawer.estado?.nombre] || {}).color }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: (ESTADO_STYLES[drawer.estado?.nombre] || {}).dot }} />
                        {drawer.estado?.nombre || '—'}
                      </span>
                    </div>
                    {camposUnidad.filter(c => c.clave !== 'codigo').map(c => (
                      <div key={c.clave} className="flex justify-between text-[12.5px]">
                        <span className="text-slate-400">{c.nombre}</span>
                        <span className="font-medium text-slate-700 text-right ml-4">{formatearValor(drawer.atributos?.[c.clave], c.tipo)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-6">
                <div className="text-[13px] font-bold text-slate-700 mb-4">Hoja de vida · Línea de tiempo</div>
                {(() => {
                  const eventos = []

                  prestamosDrawer.forEach(p => {
                    const fechaEntrega    = p.fecha_entrega    ? new Date(p.fecha_entrega)    : (p.orden?.fecha_creacion ? new Date(p.orden.fecha_creacion) : null)
                    const fechaDevolucion = p.fecha_devolucion ? new Date(p.fecha_devolucion) : null
                    const activo          = !fechaDevolucion
                    const cliente         = p.orden?.cliente?.nombre  || 'Cliente desconocido'
                    const paciente        = p.orden?.paciente?.nombre || null
                    const codigo          = p.orden?.codigo           || null

                    eventos.push({
                      key:     `prestamo-${p.id}`,
                      fecha:   fechaEntrega,
                      entidad: cliente,
                      badge:   activo
                        ? { text: 'En préstamo', bg: '#E8F7FB', color: '#0E86A0' }
                        : { text: 'Completado',  bg: '#ECFDF5', color: '#0F7B55' },
                      details: [paciente ? `Paciente: ${paciente}` : null, codigo ? `Orden ${codigo}` : null].filter(Boolean),
                      dot:     activo ? { bg: '#0E86A0', ring: true } : { bg: '#0F7B55', ring: false },
                    })

                    if (fechaDevolucion) {
                      eventos.push({
                        key:     `devolucion-${p.id}`,
                        fecha:   fechaDevolucion,
                        entidad: 'Equipo devuelto',
                        badge:   { text: 'Devuelto', bg: '#ECFDF5', color: '#0F7B55' },
                        details: [codigo ? `Orden ${codigo}` : null, p.observaciones_devolucion || null].filter(Boolean),
                        dot:     { bg: '#0F7B55', ring: false },
                      })
                    }
                  })

                  eventos.sort((a, b) => {
                    if (!a.fecha && !b.fecha) return 0
                    if (!a.fecha) return 1
                    if (!b.fecha) return -1
                    return b.fecha - a.fecha
                  })

                  if (eventos.length === 0) {
                    return (
                      <div className="text-[12px] text-slate-400 italic py-2">
                        Sin actividad registrada aún
                      </div>
                    )
                  }

                  return (
                    <div className="space-y-0">
                      {eventos.map((ev, idx) => (
                        <div key={ev.key} className="flex gap-3">
                          {/* Columna dot + conector */}
                          <div className="flex flex-col items-center flex-shrink-0">
                            <div className="w-3.5 h-3.5 rounded-full mt-1 z-10 flex-shrink-0 flex items-center justify-center"
                              style={{
                                backgroundColor: ev.dot.ring ? 'white' : ev.dot.bg,
                                border:     ev.dot.ring ? `2px solid ${ev.dot.bg}` : 'none',
                                boxShadow:  ev.dot.ring ? `0 0 0 3px ${ev.dot.bg}22` : 'none',
                              }}>
                              {ev.dot.ring && <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: ev.dot.bg }} />}
                            </div>
                            {idx < eventos.length - 1 && (
                              <div className="w-[1.5px] flex-1 mt-1 min-h-[12px] bg-slate-100" />
                            )}
                          </div>
                          {/* Contenido */}
                          <div className="pb-4 flex-1 min-w-0">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-bold mb-1"
                              style={{ background: ev.badge.bg, color: ev.badge.color }}>
                              {ev.badge.text}
                            </span>
                            <div className="text-[13px] font-bold text-slate-800 leading-snug">{ev.entidad}</div>
                            {ev.details.map((d, i) => (
                              <div key={i} className="text-[11.5px] text-slate-400 mt-0.5">{d}</div>
                            ))}
                            <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                              <Clock size={9} />
                              {ev.fecha ? formatear(ev.fecha) : 'Fecha no disponible'}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>
            </div>

            <div className="px-4 pt-3 border-t border-slate-200 flex flex-col sm:flex-row gap-2 flex-shrink-0"
              style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom, 12px))' }}>
              <button onClick={abrirEditar}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 border border-slate-200 rounded-[9px] text-[13px] font-medium text-slate-600 hover:border-slate-300 transition-all">
                <Edit3 size={13} /> Editar ficha
              </button>
              <button onClick={() => generarHojaVidaPDF(drawer)} disabled={pdfGenerando}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#1B3A6B] text-white rounded-[9px] text-[13px] font-semibold hover:bg-[#152D54] transition-colors sm:ml-auto disabled:opacity-70 disabled:cursor-not-allowed">
                {pdfGenerando
                  ? <><Loader2 size={13} className="animate-spin" /> Generando PDF…</>
                  : <><FileText size={13} /> Hoja de vida PDF</>}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── MODAL EDITAR FICHA ── */}
      {modalEditar && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm" onClick={intentarCerrarEditar} />
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
            <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-[540px] max-h-[90vh] flex flex-col shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="px-6 py-4 border-b flex items-center justify-between flex-shrink-0">
                <h3 className="text-[15px] font-bold text-slate-800">Editar equipo</h3>
                <button onClick={intentarCerrarEditar} className="text-slate-400 hover:text-slate-600 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100"><X size={16} /></button>
              </div>
              <div className="mx-6 mt-4 flex items-center gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-[8px]">
                <AlertTriangle size={14} className="text-amber-500 flex-shrink-0" />
                <span className="text-[12px] text-amber-700">Los cambios quedan registrados en la bitácora con fecha y usuario</span>
              </div>
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                <div>
                  <label className={labelCls}>Estado</label>
                  <select value={formEditar.estado_id}
                    onChange={e => { setFormEditar(f => ({ ...f, estado_id: e.target.value })); setFormDirty(true) }}
                    className={inputCls}>
                    {estados.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                  </select>
                </div>
                {camposUnidad.length > 0 && (
                  <div className="space-y-3">
                    <div className="text-[11px] font-bold uppercase tracking-[0.07em] text-slate-400">Columnas de la unidad</div>
                    {camposUnidad.map(campo => (
                      <div key={campo.clave}>
                        <label className={labelCls}>{campo.nombre}</label>
                        {renderCampo(campo, formEditar.atributos, atrs => {
                          setFormEditar(f => ({ ...f, atributos: atrs }))
                          setFormDirty(true)
                        })}
                      </div>
                    ))}
                  </div>
                )}
                <div className="border-t border-slate-100 pt-4">
                  <label className={labelCls}>Motivo de cambio <span className="text-[#D81B43]">*</span></label>
                  <textarea value={formEditar.motivo}
                    onChange={e => { setFormEditar(f => ({ ...f, motivo: e.target.value })); setFormDirty(true) }}
                    placeholder="Describe el asunto de la corrección..." rows={3}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-[9px] text-[13.5px] text-slate-800 outline-none focus:border-[#D81B43] resize-none placeholder:text-slate-400" />
                </div>
              </div>
              <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2 flex-shrink-0">
                <button onClick={intentarCerrarEditar} className="px-4 py-2.5 border border-slate-200 rounded-[9px] text-[13px] font-medium text-slate-600 hover:border-slate-300">Cancelar</button>
                <button onClick={guardarEdicion} disabled={saving}
                  className="px-5 py-2.5 bg-[#D81B43] text-white rounded-[9px] text-[13px] font-semibold hover:bg-[#B0172F] disabled:opacity-50">
                  {saving ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── MODAL CONFIRMAR SALIR ── */}
      {modalSalir && (
        <>
          <div className="fixed inset-0 bg-black/50 z-[60] backdrop-blur-sm" />
          <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center p-0 md:p-4">
            <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-[360px] p-6 shadow-2xl text-center">
              <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={22} className="text-[#D81B43]" />
              </div>
              <h3 className="text-[16px] font-bold text-slate-800 mb-2">¿Seguro quieres salir?</h3>
              <p className="text-[13px] text-slate-400 mb-6">Se perderán los cambios que hiciste si sales</p>
              <div className="flex gap-2">
                <button onClick={() => { setModalSalir(false); setModalEditar(false) }}
                  className="flex-1 py-2.5 border border-[#D81B43] text-[#D81B43] rounded-[9px] text-[13px] font-semibold hover:bg-red-50 transition-colors">
                  Sí, quiero salir
                </button>
                <button onClick={() => setModalSalir(false)}
                  className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-[9px] text-[13px] font-semibold hover:bg-slate-200 transition-colors">
                  No, quedarme
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── MODAL NUEVO TIPO ── */}
      {modalTipo && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40 backdrop-blur-sm" onClick={() => setModalTipo(false)} />
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
            <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-[560px] max-h-[90vh] flex flex-col shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="px-6 py-4 border-b flex items-center justify-between flex-shrink-0">
                <div>
                  <h3 className="text-[15px] font-bold text-slate-800">Nuevo tipo de equipo</h3>
                  <div className="text-[12px] text-slate-400 mt-0.5">{catActual?.nombre}</div>
                </div>
                <button onClick={() => setModalTipo(false)} className="text-slate-400 hover:text-slate-600 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100"><X size={16} /></button>
              </div>
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                {camposTipo.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <div className="text-[13px]">Esta categoría no tiene columnas del tipo configuradas.</div>
                    <a href="/admin/configuracion" className="text-[#D81B43] text-[13px] hover:underline mt-1 block">Ir a Configuración →</a>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className={labelCls}>Ícono del tipo <span className="text-slate-300 font-normal normal-case">(opcional)</span></label>
                      <GaleriaIconos seleccionado={formTipo.icono} onSeleccionar={clave => setFormTipo(f => ({ ...f, icono: f.icono === clave ? '' : clave }))} />
                    </div>
                    <div className="border-t border-slate-100 pt-4 space-y-3">
                      <div className="text-[11px] font-bold uppercase tracking-[0.07em] text-slate-400">Columnas del tipo</div>
                      {camposTipo.map(campo => (
                        <div key={campo.clave}>
                          <label className={labelCls}>{campo.nombre}{campo.obligatorio && <span className="text-[#D81B43] ml-1">*</span>}</label>
                          {renderCampo(campo, formTipo.atributos, atrs => setFormTipo(f => ({ ...f, atributos: atrs })))}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2 flex-shrink-0">
                <button onClick={() => setModalTipo(false)} className="px-4 py-2.5 border border-slate-200 rounded-[9px] text-[13px] font-medium text-slate-600 hover:border-slate-300">Cancelar</button>
                <button onClick={guardarTipo} disabled={saving}
                  className="px-5 py-2.5 bg-[#D81B43] text-white rounded-[9px] text-[13px] font-semibold hover:bg-[#B0172F] disabled:opacity-50">
                  {saving ? 'Guardando...' : 'Guardar tipo'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── MODAL NUEVA UNIDAD ── */}
      {modalNueva && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40 backdrop-blur-sm" onClick={() => setModalNueva(false)} />
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
            <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-[720px] max-h-[90vh] flex flex-col shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="px-6 py-4 border-b flex items-center justify-between flex-shrink-0">
                <div>
                  <h3 className="text-[15px] font-bold text-slate-800">Nueva unidad</h3>
                  <div className="text-[12px] text-slate-400 mt-0.5">{nombreTipo(tipoActual)} · {catActual?.nombre}</div>
                </div>
                <button onClick={() => setModalNueva(false)} className="text-slate-400 hover:text-slate-600 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100"><X size={16} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 md:p-8">
                {camposTipo.length > 0 && (
                  <div className="bg-slate-50 rounded-[10px] border border-slate-200 p-4 mb-6">
                    <div className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-slate-400 mb-3">Columnas del tipo</div>
                    <div className="grid grid-cols-2 gap-3">
                      {camposTipo.map(campo => (
                        <div key={campo.clave}>
                          <div className="text-[10.5px] font-semibold uppercase text-slate-400 mb-1">{campo.nombre}</div>
                          <div className="text-[13px] font-medium text-slate-700">{formatearValor(tipoActual?.atributos?.[campo.clave], campo.tipo)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                  <div>
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-3.5">Identificación</div>
                    <div className="mb-4">
                      <label className={labelCls}>Código de inventario<span className="text-[#D81B43] ml-1">*</span></label>
                      <input value={formUnidad.codigo_inventario || ''} onChange={e => setFormUnidad(f => ({ ...f, codigo_inventario: e.target.value }))}
                        placeholder="ej. RL1234" className={inputCls} />
                      <div className="text-[11px] text-slate-400 mt-1">Identifica la unidad en todo el sistema</div>
                    </div>
                    <div>
                      <label className={labelCls}>Estado</label>
                      <select value={formUnidad.estado_id} onChange={e => setFormUnidad(f => ({ ...f, estado_id: e.target.value }))} className={inputCls}>
                        {estados.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-3.5">Detalles de la unidad</div>
                    {camposUnidadExtra.length > 0 ? (
                      <div className="space-y-4">
                        {camposUnidadExtra.map(campo => (
                          <div key={campo.clave}>
                            <label className={labelCls}>{campo.nombre}{campo.obligatorio && <span className="text-[#D81B43] ml-1">*</span>}</label>
                            {renderCampo(campo, formUnidad.atributos, atrs => setFormUnidad(f => ({ ...f, atributos: atrs })))}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-[12.5px] text-slate-400">Este tipo no tiene columnas adicionales configuradas.</div>
                    )}
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2 flex-shrink-0">
                <button onClick={() => setModalNueva(false)} className="px-4 py-2.5 border border-slate-200 rounded-[9px] text-[13px] font-medium text-slate-600 hover:border-slate-300">Cancelar</button>
                <button onClick={guardarUnidad} disabled={saving}
                  className="px-5 py-2.5 bg-[#D81B43] text-white rounded-[9px] text-[13px] font-semibold hover:bg-[#B0172F] disabled:opacity-50">
                  {saving ? 'Guardando...' : 'Guardar unidad'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {toast && (
        <div className={`fixed bottom-28 md:bottom-6 right-4 md:right-6 z-[60] px-4 py-3 rounded-[10px] text-[13px] font-medium text-white shadow-lg ${toast.tipo === 'error' ? 'bg-red-500' : 'bg-[#0F7B55]'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}