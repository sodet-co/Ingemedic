'use client'
import { registrarBitacora } from '@/lib/bitacora'
import { useState, useMemo, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import {
  Plus, X, Search, Wrench, CheckCircle2,
  Package, AlertTriangle, Edit3, Upload,
  FileText, Download, Paperclip, Eye
} from 'lucide-react'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import LimpiarFiltros from '@/components/ui/LimpiarFiltros'
import Paginador from '@/components/ui/Paginador'
import { usePaginacion } from '@/hooks/usePaginacion'
import { formatear, formatearSoloFecha, hoyBogota } from '@/lib/fechas'
import BuzonNovedades from '@/components/layout/BuzonNovedades'

const ESTADOS = {
  Abierto: '9c71ba4d-e82d-4714-b2fb-4cc242cd47be',
  EnProceso: 'eef1b963-5bf5-4be7-85ab-312d9605234d',
  Cerrado: '08136bd6-f134-406a-98e9-2132516edd7f',
}

const ESTADO_EQUIPO = {
  Disponible: 'f33e7c6f-0f81-484e-9f0a-93fd28f9c414',
  EnMantenimiento: 'edf159bf-6402-4991-a673-ade689ded77e',
  Baja: '1be9843f-bcbf-46f2-bb6c-5a487225b8c3',
}

const ESTADO_STYLES = {
  'Abierto': { bg: '#FFFBEB', color: '#B45309', dot: '#F59E0B' },
  'En proceso': { bg: '#EFF6FF', color: '#1D4ED8', dot: '#3B82F6' },
  'Cerrado': { bg: '#ECFDF5', color: '#0F7B55', dot: '#0F7B55' },
}

function EstadoBadge({ nombre }) {
  const s = ESTADO_STYLES[nombre] || ESTADO_STYLES['Abierto']
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold"
      style={{ background: s.bg, color: s.color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.dot }} />
      {nombre}
    </span>
  )
}

function TipoBadge({ nombre }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold ${nombre === 'Correctivo' ? 'bg-[#FEF2F2] text-[#D81B43]' : 'bg-[#E8F7FB] text-[#0E86A0]'
      }`}>
      {nombre === 'Correctivo' ? <AlertTriangle size={9} /> : <Wrench size={9} />}
      {nombre}
    </span>
  )
}

function nombreEquipo(eq) {
  return eq?.tipo_equipo?.atributos?.nombre || eq?.tipo_equipo?.nombre || '—'
}

const inputCls = 'w-full px-3 py-2.5 border border-slate-200 rounded-[9px] text-[13.5px] text-slate-800 outline-none focus:border-[#D81B43] bg-white transition-colors placeholder:text-slate-400'
const labelCls = 'block text-[11px] font-bold uppercase tracking-[0.07em] text-slate-500 mb-1.5'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const LOGO_URL = `${SUPABASE_URL}/storage/v1/object/public/logos/logo-ingemedic.png`

export default function MantenimientosClient({ mantenimientosIniciales, tipos, equipos, listas }) {
  const router = useRouter()
  const supabase = createClient()

  const [mantenimientos, setMantenimientos] = useState(mantenimientosIniciales || [])
  const skipSyncUntil = useRef(0)

  // Mantener el estado local sincronizado cuando el servidor manda datos frescos
  // (esto se dispara después de router.refresh(), incluido el que llega por realtime)
  useEffect(() => {
    const t = setTimeout(() => {
      if (Date.now() < skipSyncUntil.current) return
      setMantenimientos(mantenimientosIniciales || [])
    }, 0)
    return () => clearTimeout(t)
  }, [mantenimientosIniciales])

  // ── SINCRONIZACIÓN EN TIEMPO REAL ─────────────────────────
  // Sin esto, un dispositivo no se entera de cambios hechos en otro
  // (ej. un técnico cerró un mantenimiento) hasta recargar la página.
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
      .channel('mantenimientos-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mantenimientos' }, refrescarConDebounce)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'actividades_mantenimiento' }, refrescarConDebounce)
      .subscribe()

    return () => { clearTimeout(debounceTimer); supabase.removeChannel(canal) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [search, setSearch] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [drawer, setDrawer] = useState(null)
  const [modal, setModal] = useState(false)
  const [modalCierre, setModalCierre] = useState(null)
  const [saving, setSaving] = useState(false)
  const [formDirty, setFormDirty] = useState(false)
  const [confirmarSalir, setConfirmarSalir] = useState(false)
  const [toast, setToast] = useState(null)
  const [uploading, setUploading] = useState({})
  const [form, setForm] = useState({
    equipo_id: '', tipo_mantenimiento_id: '', tecnico: '',
    observaciones_cliente: '', lista_id: '',
  })
  const [cierreForm, setCierreForm] = useState({
    actividades: '', tecnico: '', fecha_cierre: '', resultado: 'disponible',
  })

  function showToast(msg, tipo = 'success') {
    setToast({ msg, tipo })
    setTimeout(() => setToast(null), 3200)
  }

  function abrirModal() {
    setForm({ equipo_id: '', tipo_mantenimiento_id: '', tecnico: '', observaciones_cliente: '', lista_id: '' })
    setFormDirty(false)
    setModal(true)
  }
  function cerrarModal() { setModal(false); setFormDirty(false) }
  function intentarCerrarModal() { if (formDirty) setConfirmarSalir(true); else cerrarModal() }

  const stats = useMemo(() => ({
    total: (mantenimientos || []).length,
    abiertos: (mantenimientos || []).filter(m => m.estado?.nombre === 'Abierto').length,
    enProceso: (mantenimientos || []).filter(m => m.estado?.nombre === 'En proceso').length,
    cerrados: (mantenimientos || []).filter(m => m.estado?.nombre === 'Cerrado').length,
    correctivos: (mantenimientos || []).filter(m => m.tipo?.nombre === 'Correctivo').length,
  }), [mantenimientos])

  const filtrados = useMemo(() => {
    return (mantenimientos || []).filter(m => {
      const mq = !search || [m.codigo, nombreEquipo(m.equipo), m.tecnico]
        .some(v => v?.toLowerCase().includes(search.toLowerCase()))
      const me = !filtroEstado || m.estado?.nombre === filtroEstado
      const mt = !filtroTipo || m.tipo?.nombre === filtroTipo
      return mq && me && mt
    })
  }, [mantenimientos, search, filtroEstado, filtroTipo])

  const paginacionMantenimientos = usePaginacion(filtrados, 20)
  const mantenimientosPagina = paginacionMantenimientos.itemsPagina

  // ── CREAR MANTENIMIENTO ──────────────────────────────────
  async function crearMantenimiento() {
    if (!form.equipo_id) { showToast('Selecciona un equipo', 'error'); return }
    if (!form.tipo_mantenimiento_id) { showToast('Selecciona el tipo', 'error'); return }
    setSaving(true)

    // Verificar que no haya mantenimiento activo para ese equipo
    const { data: activo } = await supabase.from('mantenimientos')
      .select('id').eq('equipo_id', form.equipo_id)
      .in('estado_id', [ESTADOS.Abierto, ESTADOS.EnProceso])
      .maybeSingle()
    if (activo) {
      showToast('Este equipo ya tiene un mantenimiento activo', 'error')
      setSaving(false); return
    }

    const { count } = await supabase.from('mantenimientos').select('*', { count: 'exact', head: true })
    const codigo = `MAN-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(3, '0')}`

    const { data, error } = await supabase.from('mantenimientos').insert({
      codigo,
      equipo_id: form.equipo_id,
      tipo_mantenimiento_id: form.tipo_mantenimiento_id,
      estado_id: ESTADOS.EnProceso, // directo a En proceso
      tecnico: form.tecnico || null,
      fecha_apertura: hoyBogota(),
      observaciones_cliente: form.observaciones_cliente || null,
      en_curso: true,
    })
      .select(`
      *,
      equipo:equipos(id, codigo,
        tipo_equipo:tipos_equipo(id, nombre, atributos, categoria:categorias_equipo(id, nombre)),
        estado:estados_equipo(id, nombre)
      ),
      estado:estados_mantenimiento(id, nombre),
      tipo:tipos_mantenimiento(id, nombre),
      actividades:actividades_mantenimiento(id, descripcion, completado, observaciones, fecha, archivo_url, adjuntos:adjuntos_actividad_mantenimiento(id, nombre, url, tipo))
    `)
      .single()

    if (error) { showToast('Error: ' + error.message, 'error'); setSaving(false); return }
    registrarBitacora({ modulo: 'mantenimientos', accion: 'crear', entidad: 'mantenimiento', entidad_id: data.id, detalle: { codigo } })

    // Cambiar estado del equipo a "En mantenimiento"
    await supabase.from('equipos').update({ estado_id: ESTADO_EQUIPO.EnMantenimiento }).eq('id', form.equipo_id)

    // Insertar actividades de la lista seleccionada
    if (form.lista_id) {
      const lista = listas.find(l => l.id === form.lista_id)
      const acts = lista?.actividades?.sort((a, b) => a.orden - b.orden) || []
      if (acts.length > 0) {
        const { data: actsCreadas } = await supabase.from('actividades_mantenimiento').insert(
          acts.map(a => ({
            mantenimiento_id: data.id,
            checklist_item_id: null,
            descripcion: a.nombre,
            completado: false,
          }))
        ).select('id, descripcion, completado, observaciones, fecha, archivo_url')
        data.actividades = actsCreadas || []
      }
    }

    skipSyncUntil.current = Date.now() + 2500
    setMantenimientos(prev => [data, ...prev])
    setSaving(false)
    cerrarModal()
    setDrawer(data)
    showToast('Mantenimiento abierto — equipo en mantenimiento')
  }

  // ── TOGGLE ACTIVIDAD ─────────────────────────────────────
  async function toggleActividad(act) {
    const nuevoEstado = !act.completado
    const { error } = await supabase.from('actividades_mantenimiento')
      .update({ completado: nuevoEstado, fecha: nuevoEstado ? new Date().toISOString() : null })
      .eq('id', act.id)
    if (error) { showToast('Error: ' + error.message, 'error'); return }
    const cambios = { completado: nuevoEstado, fecha: nuevoEstado ? new Date().toISOString() : null }
    actualizarActividad(act.id, cambios)
    // También actualizar modalCierre si está abierto
    if (modalCierre) {
      setModalCierre(prev => ({
        ...prev,
        actividades: (prev.actividades || []).map(a => a.id === act.id ? { ...a, ...cambios } : a)
      }))
    }
  }

  // ── GUARDAR OBSERVACIÓN ACTIVIDAD ────────────────────────
  async function guardarObservacion(act, obs) {
    const { error } = await supabase.from('actividades_mantenimiento')
      .update({ observaciones: obs }).eq('id', act.id)
    if (error) { showToast('Error: ' + error.message, 'error'); return }
    actualizarActividad(act.id, { observaciones: obs })
    if (modalCierre) {
      setModalCierre(prev => ({
        ...prev,
        actividades: (prev.actividades || []).map(a => a.id === act.id ? { ...a, observaciones: obs } : a)
      }))
    }
    showToast('Observación guardada')
  }

  // ── SUBIR ADJUNTO ────────────────────────────────────────
  async function subirAdjunto(act, file, mantId = null) {
    const idMant = mantId || drawer?.id
    if (!idMant) { showToast('Error: mantenimiento no identificado', 'error'); return }
    setUploading(prev => ({ ...prev, [act.id]: true }))
    const ext = file.name.split('.').pop().toLowerCase()
    const uuid = crypto.randomUUID()
    const path = `adjuntos/${idMant}_${act.id}_${uuid}.${ext}`
    const { error: upErr } = await supabase.storage.from('mantenimientos-adjuntos').upload(path, file)
    if (upErr) { showToast('Error subiendo archivo: ' + upErr.message, 'error'); setUploading(prev => ({ ...prev, [act.id]: false })); return }

    const { data: { publicUrl } } = supabase.storage.from('mantenimientos-adjuntos').getPublicUrl(path)

    const { data: adj, error } = await supabase.from('adjuntos_actividad_mantenimiento').insert({
      actividad_id: act.id,
      nombre: file.name,
      url: publicUrl,
      tipo: file.type,
    }).select('id, nombre, url, tipo').single()

    if (error) { showToast('Error: ' + error.message, 'error'); setUploading(prev => ({ ...prev, [act.id]: false })); return }

    const adjuntos = [...(act.adjuntos || []), adj]
    actualizarActividad(act.id, { adjuntos })
    if (modalCierre) {
      setModalCierre(prev => ({
        ...prev,
        actividades: (prev.actividades || []).map(a => a.id === act.id ? { ...a, adjuntos } : a)
      }))
    }
    setUploading(prev => ({ ...prev, [act.id]: false }))
    showToast('Archivo adjuntado')
  }

  function actualizarActividad(actId, cambios) {
    const updFn = (m) => ({
      ...m,
      actividades: (m.actividades || []).map((a) =>
        a.id === actId ? { ...a, ...cambios } : a
      ),
    });

    queueMicrotask(() => {
      skipSyncUntil.current = performance.now() + 2500;

      setMantenimientos((prev) =>
        prev.map((m) => (m.id === drawer?.id ? updFn(m) : m))
      );

      if (drawer) {
        setDrawer((prev) => updFn(prev));
      }
    });
  }

  // ── CERRAR MANTENIMIENTO ─────────────────────────────────
  async function cerrarMantenimiento() {
    if (!modalCierre.actividades?.length && !cierreForm.actividades?.trim()) {
      showToast('Registra las actividades realizadas', 'error'); return
    }
    setSaving(true)

    const estadoEquipoId = cierreForm.resultado === 'disponible' ? ESTADO_EQUIPO.Disponible : ESTADO_EQUIPO.Baja

    const { error } = await supabase.from('mantenimientos').update({
      estado_id: ESTADOS.Cerrado,
      en_curso: false,
      actividades: cierreForm.actividades,
      tecnico: cierreForm.tecnico || modalCierre.tecnico || null,
      fecha_cierre: cierreForm.fecha_cierre || hoyBogota(),
      fecha_cierre_real: hoyBogota(),
    }).eq('id', modalCierre.id)

    if (error) { showToast('Error: ' + error.message, 'error'); setSaving(false); return }
    registrarBitacora({ modulo: 'mantenimientos', accion: 'cerrar', entidad: 'mantenimiento', entidad_id: modalCierre.id, detalle: { codigo: modalCierre.codigo } })

    await supabase.from('equipos').update({ estado_id: estadoEquipoId }).eq('id', modalCierre.equipo_id)

    const nuevoEstado = { id: ESTADOS.Cerrado, nombre: 'Cerrado' }
    const updCambios = {
      estado: nuevoEstado, en_curso: false,
      actividades_texto: cierreForm.actividades,
      tecnico: cierreForm.tecnico || modalCierre.tecnico,
      fecha_cierre: cierreForm.fecha_cierre || hoyBogota(),
    }
    skipSyncUntil.current = Date.now() + 2500
    setMantenimientos(prev => prev.map(m => m.id === modalCierre.id ? { ...m, ...updCambios } : m))
    if (drawer?.id === modalCierre.id) setDrawer(prev => ({ ...prev, ...updCambios }))
    setSaving(false); setModalCierre(null)
    showToast('Mantenimiento cerrado ✓')
    router.refresh()
  }

  // ── GENERAR PDF ACTA ─────────────────────────────────────
  async function generarActaPDF(mant) {
    // Traer datos frescos de BD incluyendo actividades y adjuntos
    const { data: mantFresh } = await supabase.from('mantenimientos').select(`
      *,
      equipo:equipos(id, codigo,
        tipo_equipo:tipos_equipo(id, nombre, atributos, categoria:categorias_equipo(id, nombre)),
        estado:estados_equipo(id, nombre)
      ),
      estado:estados_mantenimiento(id, nombre),
      tipo:tipos_mantenimiento(id, nombre),
      actividades:actividades_mantenimiento(
        id, descripcion, completado, observaciones, fecha,
        adjuntos:adjuntos_actividad_mantenimiento(id, nombre, url, tipo)
      )
    `).eq('id', mant.id).single()

    const m = mantFresh || mant

    const { default: jsPDF } = await import('jspdf')
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const W = 210, M = 15, CW = W - M * 2
    const HEADER_H = 28
    let logoEndX = M // donde termina el logo, para arrancar la franja roja

    try {
      const res = await fetch(LOGO_URL)
      const blob = await res.blob()
      const b64 = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob) })
      const dims = await new Promise(r => { const img = new window.Image(); img.onload = () => r({ w: img.naturalWidth, h: img.naturalHeight }); img.src = b64 })
      const maxH = HEADER_H // logo llena toda la altura del header
      const ratio = maxH / dims.h
      const logoW = dims.w * ratio
      const logoH = maxH
      doc.addImage(b64, 'PNG', M + 2, M, logoW, logoH)
      logoEndX = M + logoW + 6
    } catch {
      logoEndX = M + 4
    }

    // Franja roja — arranca justo después del logo
    doc.setFillColor(216, 27, 67)
    doc.rect(logoEndX, M, W - M - logoEndX, HEADER_H, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(10.5); doc.setFont('helvetica', 'bold')
    doc.text('REPORTE TECNICO EQUIPOS BIOMEDICOS', logoEndX + 3, M + 9)
    doc.setFontSize(8.5); doc.setFont('helvetica', 'normal')
    doc.text(`N\u00b0 ${m.codigo}`, logoEndX + 3, M + 16)
    doc.text(`Fecha: ${formatearSoloFecha(m.fecha_apertura || hoyBogota())}`, W - M - 2, M + 16, { align: 'right' })
    doc.text(m.tipo?.nombre || '', logoEndX + 3, M + 23)

    let y = M + HEADER_H + 7

    // Sección helper
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

    // Datos equipo
    y = seccion('DATOS DEL EQUIPO', [
      ['Equipo', nombreEquipo(m.equipo)],
      ['Código', m.equipo?.codigo],
      ['Categoría', m.equipo?.tipo_equipo?.categoria?.nombre],
    ], y)

    // Datos cliente / orden (si aplica)
    y = seccion('DATOS DEL SERVICIO', [
      ['Código', m.codigo],
      ['Tipo', m.tipo?.nombre],
      ['Técnico', m.tecnico],
      ['Apertura', m.fecha_apertura],
      ['Cierre', m.fecha_cierre || 'En proceso'],
    ], y)

    // Observaciones cliente
    if (m.observaciones_cliente) {
      y = seccion('OBSERVACIONES DEL CLIENTE', [], y)
      doc.setTextColor(30, 30, 30); doc.setFontSize(8)
      const lines = doc.splitTextToSize(m.observaciones_cliente, CW - 4)
      doc.text(lines, M + 2, y)
      y += lines.length * 4.5 + 4
    }

    // Actividades checklist
    if (m.actividades?.length > 0) {
      doc.setFillColor(240, 240, 240)
      doc.rect(M, y, CW, 6, 'F')
      doc.setTextColor(30, 30, 30); doc.setFontSize(8.5); doc.setFont('helvetica', 'bold')
      doc.text('ACTIVIDADES DE MANTENIMIENTO', M + 2, y + 4)
      y += 9

      const completadas = m.actividades.filter(a => a.completado).length
      doc.setFontSize(8); doc.setFont('helvetica', 'normal')
      doc.setTextColor(100, 100, 100)
      doc.text(`Completadas: ${completadas}/${m.actividades.length}`, M + 2, y)
      y += 6

      for (const act of m.actividades) {
        if (y > 250) { doc.addPage(); y = M }
        doc.setDrawColor(150, 150, 150)
        doc.rect(M + 2, y - 3.5, 4, 4)
        if (act.completado) {
          doc.setTextColor(15, 123, 85); doc.setFontSize(8); doc.setFont('helvetica', 'bold')
          doc.text('X', M + 3, y - 0.5)
        }
        doc.setTextColor(30, 30, 30); doc.setFontSize(8.5); doc.setFont('helvetica', act.completado ? 'bold' : 'normal')
        doc.text(act.descripcion || '', M + 9, y)
        y += 5
        if (act.observaciones) {
          doc.setTextColor(80, 80, 80); doc.setFontSize(7.5); doc.setFont('helvetica', 'italic')
          const obsLines = doc.splitTextToSize(`Obs: ${act.observaciones}`, CW - 12)
          doc.text(obsLines, M + 9, y)
          y += obsLines.length * 4 + 1
        }
        // Imágenes adjuntas
        const adjImgs = (act.adjuntos || []).filter(a => a.tipo?.startsWith('image/') || /\.(png|jpg|jpeg|webp)$/i.test(a.nombre))
        for (const img of adjImgs) {
          try {
            if (y > 220) { doc.addPage(); y = M }
            const res = await fetch(img.url)
            const blob = await res.blob()
            const b64 = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob) })
            const dims = await new Promise(r => { const i = new window.Image(); i.onload = () => r({ w: i.naturalWidth, h: i.naturalHeight }); i.src = b64 })
            const ext = img.tipo === 'image/png' ? 'PNG' : 'JPEG'
            const maxImgW = 80, maxImgH = 55
            const ratio = Math.min(maxImgW / dims.w, maxImgH / dims.h)
            const imgW = dims.w * ratio
            const imgH = dims.h * ratio
            doc.addImage(b64, ext, M + 9, y, imgW, imgH, undefined, 'FAST')
            doc.setTextColor(130, 130, 130); doc.setFontSize(7); doc.setFont('helvetica', 'normal')
            doc.text(img.nombre, M + 9, y + imgH + 3)
            y += imgH + 7
          } catch { }
        }
        y += 3
      }
      y += 2
    }

    // Observaciones generales / actividades texto
    const obsGeneral = m.actividades_texto || m.actividades
    if (typeof obsGeneral === 'string' && obsGeneral) {
      if (y > 240) { doc.addPage(); y = M }
      y = seccion('OBSERVACIONES GENERALES', [], y)
      doc.setTextColor(30, 30, 30); doc.setFontSize(8)
      const lines = doc.splitTextToSize(obsGeneral, CW - 4)
      doc.text(lines, M + 2, y)
      y += lines.length * 4.5 + 4
    }

    // Estado del equipo
    if (y > 240) { doc.addPage(); y = M }
    doc.setFillColor(240, 240, 240)
    doc.rect(M, y, CW, 6, 'F')
    doc.setTextColor(30, 30, 30); doc.setFontSize(8.5); doc.setFont('helvetica', 'bold')
    doc.text('ESTADO DEL EQUIPO AL CIERRE', M + 2, y + 4)
    y += 9
    const estadoTexto = m.estado?.nombre === 'Cerrado'
      ? (m.resultado === 'baja' ? 'DADO DE BAJA' : 'OPERATIVO — DISPONIBLE')
      : 'EN PROCESO DE MANTENIMIENTO'
    doc.setFontSize(9); doc.setFont('helvetica', 'bold')
    doc.setTextColor(m.estado?.nombre === 'Cerrado' ? 15 : 180, m.estado?.nombre === 'Cerrado' ? 123 : 100, 85)
    doc.text(estadoTexto, M + 2, y)
    y += 10

    // Firmas
    if (y > 230) { doc.addPage(); y = M }
    y = Math.max(y, 240)
    doc.setDrawColor(200, 200, 200)
    doc.line(M, y, M + CW / 2 - 5, y)
    doc.line(M + CW / 2 + 5, y, M + CW, y)
    doc.setTextColor(100, 100, 100); doc.setFontSize(8); doc.setFont('helvetica', 'normal')
    doc.text('Representante del Servicio', M + 2, y + 5)
    doc.text(m.tecnico || '________________', M + 2, y + 10)
    doc.text('Recibimos en Conformidad', M + CW / 2 + 7, y + 5)
    doc.text('Firma y Sello', M + CW / 2 + 7, y + 10)

    doc.save(`Acta_Mantenimiento_${m.codigo}.pdf`)
    showToast('PDF generado')
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Topbar */}
      <div className="h-14 md:h-16 md:bg-white md:border-b md:border-slate-200 flex items-center px-4 md:px-7 flex-shrink-0">
        <div>
          <div className="text-[18px] font-bold text-slate-800">Mantenimientos</div>
          <div className="text-[12px] text-slate-400 mt-0.5">{(mantenimientos || []).length} registros</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <BuzonNovedades />
        </div>
      </div>

      {/* FAB móvil */}
      <button onClick={() => { abrirModal() }}
        className="fixed bottom-[calc(var(--mobile-nav-space,0px)+16px)] right-4 z-30 md:hidden shadow-lg rounded-full w-14 h-14 bg-[#D81B43] text-white flex items-center justify-center">
        <Plus size={22} strokeWidth={2.5} />
      </button>

      <div className="flex-1 overflow-hidden flex flex-col p-3 md:p-6 gap-4">
        {/* Stats — en móvil, chips compactos con scroll horizontal (siguen filtrando); en desktop, cards */}
        <div className="flex-shrink-0">
          {/* Móvil: chips */}
          <div className="flex md:hidden gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {[
              { label: 'Total', value: stats.total, color: '#1E293B', f: '', t: '' },
              { label: 'Abiertos', value: stats.abiertos, color: '#B45309', f: 'Abierto', t: '' },
              { label: 'En proceso', value: stats.enProceso, color: '#1D4ED8', f: 'En proceso', t: '' },
            ].map(s => (
              <button key={s.label}
                onClick={() => s.t ? setFiltroTipo(p => p === s.t ? '' : s.t) : setFiltroEstado(p => p === s.f ? '' : s.f)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full border text-[12px] font-medium whitespace-nowrap transition-all ${(filtroEstado === s.f && s.f) || (filtroTipo === s.t && s.t) ? 'border-[#D81B43] bg-[#D81B43]/5' : 'border-slate-200 bg-white'
                  }`}>
                <span className="font-extrabold tabular-nums" style={{ color: s.color }}>{s.value}</span>
                <span className="text-slate-500">{s.label}</span>
              </button>
            ))}
          </div>

          {/* Desktop: cards (igual que antes) */}
          <div className="hidden md:grid md:grid-cols-5 gap-3">
            {[
              { label: 'Total', value: stats.total, color: '#1E293B', f: '', t: '' },
              { label: 'Abiertos', value: stats.abiertos, color: '#B45309', f: 'Abierto', t: '' },
              { label: 'En proceso', value: stats.enProceso, color: '#1D4ED8', f: 'En proceso', t: '' },
              { label: 'Cerrados', value: stats.cerrados, color: '#0F7B55', f: 'Cerrado', t: '' },
              { label: 'Correctivos', value: stats.correctivos, color: '#D81B43', f: '', t: 'Correctivo' },
            ].map(s => (
              <div key={s.label}
                onClick={() => s.t ? setFiltroTipo(p => p === s.t ? '' : s.t) : setFiltroEstado(p => p === s.f ? '' : s.f)}
                className={`bg-white rounded-xl border p-3 shadow-sm cursor-pointer transition-all hover:shadow-md ${(filtroEstado === s.f && s.f) || (filtroTipo === s.t && s.t) ? 'border-[#D81B43]' : 'border-slate-200'
                  }`}>
                <div className="text-xl font-extrabold tabular-nums" style={{ color: s.color }}>{s.value}</div>
                <div className="text-[10.5px] text-slate-400 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap md:flex-nowrap items-center gap-2 md:gap-3 flex-shrink-0">
          <div className="relative flex-1 md:flex-none md:w-[340px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por código, equipo o técnico..."
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-[9px] text-[13px] outline-none focus:border-[#D81B43] bg-white" />
          </div>
          {/* En celular bajan a su propia fila, con scroll lateral */}
          <div className="order-last md:order-none w-full md:w-auto flex gap-2 overflow-x-auto">
            {tipos.map(t => (
              <button key={t.id} onClick={() => setFiltroTipo(p => p === t.nombre ? '' : t.nombre)}
                className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-all whitespace-nowrap flex-shrink-0 ${filtroTipo === t.nombre
                  ? t.nombre === 'Correctivo' ? 'bg-[#D81B43] text-white' : 'bg-[#25A9E0] text-white'
                  : 'bg-white border border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}>{t.nombre}</button>
            ))}
          </div>
          <LimpiarFiltros activo={!!(search || filtroEstado || filtroTipo)}
            onLimpiar={() => { setSearch(''); setFiltroEstado(''); setFiltroTipo('') }} />
          <div className="hidden sm:block text-[12px] text-slate-400 ml-auto flex-shrink-0">{filtrados.length} registro{filtrados.length !== 1 ? 's' : ''}</div>
          <button onClick={() => { abrirModal() }}
            className="hidden md:flex items-center gap-1.5 px-4 h-[38px] bg-[#D81B43] text-white text-[13px] font-semibold rounded-[9px] hover:bg-[#B0172F] transition-colors flex-shrink-0 whitespace-nowrap">
            <Plus size={14} strokeWidth={2.5} /> Nuevo mantenimiento
          </button>
        </div>

        {/* Cards móvil */}
        <div className="flex-1 overflow-y-auto pb-28 md:hidden space-y-2">
          {filtrados.length === 0 && (
            <div className="text-center py-16 text-slate-400">
              <Wrench className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <div className="font-semibold">{search || filtroEstado || filtroTipo ? 'Sin resultados' : 'Sin mantenimientos registrados'}</div>
            </div>
          )}
          {mantenimientosPagina.map(m => (
            <div key={m.id} onClick={() => setDrawer(m)}
              className={`bg-white rounded-xl p-4 cursor-pointer shadow-sm ${m.tipo?.nombre === 'Correctivo' && m.estado?.nombre !== 'Cerrado'
                ? 'border-l-4 border-l-[#D81B43] border border-t-slate-200 border-r-slate-200 border-b-slate-200'
                : 'border border-slate-200'
                }`}>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="font-mono text-[12px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">{m.codigo}</span>
                <TipoBadge nombre={m.tipo?.nombre} />
                <div className="ml-auto"><EstadoBadge nombre={m.estado?.nombre} /></div>
              </div>
              <div className="mb-2">
                <div className="text-[13px] font-semibold text-slate-700">{nombreEquipo(m.equipo)}</div>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-slate-400 mb-3 flex-wrap">
                {m.tecnico && <span>Técnico: {m.tecnico}</span>}
                <span>Apertura: {m.fecha_apertura || '—'}</span>
                {m.fecha_cierre && <span>Cierre: {m.fecha_cierre}</span>}
              </div>
              <div className="flex justify-end" onClick={e => e.stopPropagation()}>
                {m.estado?.nombre === 'En proceso' && (
                  <button onClick={() => { const mc = mantenimientos.find(x => x.id === m.id) || m; setModalCierre(mc); setCierreForm({ actividades: mc.actividades_texto || '', tecnico: mc.tecnico || '', fecha_cierre: hoyBogota(), resultado: 'disponible' }) }}
                    className="px-3 py-1.5 bg-[#D81B43] text-white text-[11px] font-bold rounded-[7px] hover:bg-[#B0172F]">
                    🛠 Cerrar
                  </button>
                )}
                {m.estado?.nombre === 'Cerrado' && (
                  <button onClick={() => generarActaPDF(m)}
                    className="flex items-center gap-1 px-2.5 py-1 border border-slate-200 text-slate-600 text-[11px] font-medium rounded-[7px] hover:border-[#D81B43] hover:text-[#D81B43]">
                    <Download size={11} /> PDF
                  </button>
                )}
                {m.estado?.nombre === 'Abierto' && (
                  <button onClick={() => setDrawer(m)}
                    className="flex items-center gap-1 px-2.5 py-1 border border-slate-200 text-slate-600 text-[11px] font-medium rounded-[7px] hover:border-slate-300">
                    <Eye size={11} /> Ver
                  </button>
                )}
              </div>
            </div>
          ))}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mt-2">
            <Paginador {...paginacionMantenimientos} />
          </div>
        </div>

        {/* Tabla (solo escritorio) */}
        <div className="hidden md:flex flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-col">
          <div className="overflow-auto flex-1">
            <table className="w-full border-collapse min-w-[800px]">
              <thead className="sticky top-0 z-10">
                <tr className="border-b-2 border-slate-200">
                  {['Código', 'Equipo', 'Tipo', 'Técnico', 'Estado', 'Apertura', 'Cierre', 'Acciones'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10.5px] font-bold uppercase tracking-[0.07em] text-slate-400 bg-slate-50 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtrados.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-16 text-slate-400">
                    <Wrench className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <div className="font-semibold">{search || filtroEstado || filtroTipo ? 'Sin resultados' : 'Sin mantenimientos registrados'}</div>
                  </td></tr>
                )}
                {mantenimientosPagina.map(m => (
                  <tr key={m.id} onClick={() => setDrawer(m)}
                    className={`border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer ${m.tipo?.nombre === 'Correctivo' && m.estado?.nombre !== 'Cerrado' ? 'border-l-4 border-l-[#D81B43]' : ''
                      }`}>
                    <td className="px-4 py-3">
                      <span className="font-mono text-[12.5px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">{m.codigo}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-[13px] font-semibold text-slate-700 truncate max-w-[160px]">{nombreEquipo(m.equipo)}</div>
                    </td>
                    <td className="px-4 py-3"><TipoBadge nombre={m.tipo?.nombre} /></td>
                    <td className="px-4 py-3 text-[12.5px] text-slate-500">{m.tecnico || '—'}</td>
                    <td className="px-4 py-3"><EstadoBadge nombre={m.estado?.nombre} /></td>
                    <td className="px-4 py-3 text-[12px] font-mono text-slate-400">{m.fecha_apertura || '—'}</td>
                    <td className="px-4 py-3 text-[12px] font-mono text-slate-400">{m.fecha_cierre || '—'}</td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        {m.estado?.nombre === 'En proceso' && (
                          <button onClick={() => { const mc = mantenimientos.find(x => x.id === m.id) || m; setModalCierre(mc); setCierreForm({ actividades: mc.actividades_texto || '', tecnico: mc.tecnico || '', fecha_cierre: hoyBogota(), resultado: 'disponible' }) }}
                            className="px-2.5 py-1 bg-[#D81B43] text-white text-[11px] font-bold rounded-[7px] hover:bg-[#B0172F]">
                            🛠 Cerrar
                          </button>
                        )}
                        {m.estado?.nombre === 'Cerrado' && (
                          <button onClick={() => generarActaPDF(m)}
                            className="flex items-center gap-1 px-2.5 py-1 border border-slate-200 text-slate-600 text-[11px] font-medium rounded-[7px] hover:border-[#D81B43] hover:text-[#D81B43]">
                            <Download size={11} /> PDF
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Paginador {...paginacionMantenimientos} />
        </div>
      </div>

      {/* ── DRAWER ── */}
      {drawer && (
        <>
          <div className="fixed inset-0 bg-black/30 z-20 backdrop-blur-sm" onClick={() => setDrawer(null)} />
          <div className="fixed inset-x-0 bottom-0 h-[92vh] rounded-t-2xl md:rounded-none md:inset-x-auto md:top-0 md:right-0 md:bottom-0 md:h-full md:w-[520px] bg-white z-30 flex flex-col shadow-2xl">
            <div className={`px-6 py-4 border-b flex items-start justify-between flex-shrink-0 ${drawer.tipo?.nombre === 'Correctivo' ? 'bg-[#D81B43]' : 'bg-[#1D4ED8]'}`}>
              <div>
                <div className="text-[11px] text-white/60">{drawer.tipo?.nombre} · {drawer.codigo}</div>
                <div className="text-[15px] font-bold text-white">{nombreEquipo(drawer.equipo)}</div>
              </div>
              <div className="flex items-center gap-2">
                {drawer.estado?.nombre === 'Cerrado' && (
                  <button onClick={() => generarActaPDF(drawer)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 text-white text-[12px] font-semibold rounded-[7px] hover:bg-white/30">
                    <Download size={13} /> Acta PDF
                  </button>
                )}
                <button onClick={() => setDrawer(null)} className="text-white/60 hover:text-white w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20">
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {/* Estado + timeline */}
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <EstadoBadge nombre={drawer.estado?.nombre} />
                  {drawer.estado?.nombre === 'En proceso' && (
                    <button onClick={() => { const mc = mantenimientos.find(x => x.id === drawer.id) || drawer; setModalCierre(mc); setCierreForm({ actividades: mc.actividades_texto || '', tecnico: mc.tecnico || '', fecha_cierre: hoyBogota(), resultado: 'disponible' }) }}
                      className="px-3 py-1.5 bg-[#D81B43] text-white text-[12px] font-semibold rounded-[7px] hover:bg-[#B0172F]">
                      🛠 Cerrar mantenimiento
                    </button>
                  )}
                </div>
                <div className="flex items-start mt-3">
                  {['Abierto', 'En proceso', 'Cerrado'].map((paso, i) => {
                    const idx = ['Abierto', 'En proceso', 'Cerrado'].indexOf(drawer.estado?.nombre || 'En proceso')
                    const st = i < idx ? 'done' : i === idx ? 'active' : 'pending'
                    return (
                      <div key={paso} className="flex-1 flex flex-col items-center relative">
                        {i > 0 && <div className={`absolute top-3 right-1/2 w-full h-0.5 ${st === 'done' || st === 'active' ? 'bg-[#D81B43]' : 'bg-slate-200'}`} />}
                        <div className={`w-6 h-6 rounded-full z-10 flex items-center justify-center ${st === 'done' ? 'bg-[#D81B43]' : st === 'active' ? 'bg-white border-2 border-[#D81B43]' : 'bg-white border-2 border-slate-200'
                          }`}>
                          {st === 'done' && <CheckCircle2 size={10} className="text-white" />}
                          {st === 'active' && <div className="w-2 h-2 bg-[#D81B43] rounded-full" />}
                        </div>
                        <div className={`text-[9px] font-semibold mt-1 text-center ${st === 'done' || st === 'active' ? 'text-[#D81B43]' : 'text-slate-400'}`}>{paso}</div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Detalles */}
              <div className="p-5">
                <div className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-3">Detalles</div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Tipo', value: drawer.tipo?.nombre },
                    { label: 'Técnico', value: drawer.tecnico || '—' },
                    { label: 'Apertura', value: drawer.fecha_apertura || '—' },
                    { label: 'Cierre', value: drawer.fecha_cierre || '—' },
                  ].map(f => (
                    <div key={f.label}>
                      <div className="text-[10px] font-semibold uppercase text-slate-400 mb-1">{f.label}</div>
                      <div className="text-[13px] font-medium text-slate-700">{f.value}</div>
                    </div>
                  ))}
                </div>
                {drawer.observaciones_cliente && (
                  <div className="mt-3 p-3 bg-slate-50 rounded-[9px] border border-slate-200">
                    <div className="text-[10px] font-semibold uppercase text-slate-400 mb-1">Observaciones cliente</div>
                    <div className="text-[13px] text-slate-600 italic">{drawer.observaciones_cliente}</div>
                  </div>
                )}
              </div>

              {/* Checklist interactivo */}
              {drawer.actividades?.length > 0 && (
                <div className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-slate-400">
                      Checklist ({drawer.actividades.filter(a => a.completado).length}/{drawer.actividades.length})
                    </div>
                    {/* Barra progreso */}
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-[#0F7B55] rounded-full transition-all"
                          style={{ width: `${(drawer.actividades.filter(a => a.completado).length / drawer.actividades.length) * 100}%` }} />
                      </div>
                      <span className="text-[11px] font-semibold text-slate-500">
                        {Math.round((drawer.actividades.filter(a => a.completado).length / drawer.actividades.length) * 100)}%
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {drawer.actividades.map(act => (
                      <ActividadItem
                        key={act.id}
                        act={act}
                        cerrado={drawer.estado?.nombre === 'Cerrado'}
                        uploading={uploading[act.id]}
                        onToggle={() => toggleActividad(act)}
                        onObservacion={(obs) => guardarObservacion(act, obs)}
                        onAdjunto={(file) => subirAdjunto(act, file)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Actividades texto (si fue cerrado con texto libre) */}
              {drawer.actividades_texto && (
                <div className="p-5">
                  <div className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-3">Resumen de actividades</div>
                  <div className="text-[13px] text-slate-600 whitespace-pre-line leading-relaxed">{drawer.actividades_texto}</div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── MODAL NUEVO MANTENIMIENTO ── */}
      {modal && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm" onClick={() => intentarCerrarModal()} />
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
            <div className="bg-white rounded-t-2xl md:rounded-2xl w-full md:max-w-[560px] max-h-[92vh] md:max-h-[calc(100vh-2rem)] flex flex-col shadow-2xl overflow-hidden"
              onClick={e => e.stopPropagation()}>
              <div className="px-6 py-4 border-b flex items-center justify-between flex-shrink-0 bg-[#D81B43]">
                <div className="text-[15px] font-bold text-white">Nuevo mantenimiento</div>
                <button onClick={() => intentarCerrarModal()} className="text-white/60 hover:text-white w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20">
                  <X size={16} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4" onChange={() => setFormDirty(true)}>
                {/* Tipo */}
                <div>
                  <label className={labelCls}>Tipo de mantenimiento <span className="text-[#D81B43]">*</span></label>
                  <div className="grid grid-cols-2 gap-3">
                    {tipos.map(t => (
                      <button key={t.id} onClick={() => setForm(f => ({ ...f, tipo_mantenimiento_id: t.id }))}
                        className={`flex items-center gap-2 px-4 py-3 rounded-[9px] border-2 text-[13px] font-semibold transition-all ${form.tipo_mantenimiento_id === t.id
                          ? t.nombre === 'Correctivo' ? 'border-[#D81B43] bg-[#D81B43]/5 text-[#D81B43]' : 'border-[#25A9E0] bg-[#E8F7FB] text-[#0E86A0]'
                          : 'border-slate-200 text-slate-500 hover:border-slate-300'
                          }`}>
                        {t.nombre === 'Correctivo' ? <AlertTriangle size={15} /> : <Wrench size={15} />}
                        {t.nombre}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Equipo */}
                <div>
                  <label className={labelCls}>Equipo <span className="text-[#D81B43]">*</span></label>
                  <select value={form.equipo_id} onChange={e => setForm(f => ({ ...f, equipo_id: e.target.value }))} className={inputCls}>
                    <option value="">Seleccionar equipo...</option>
                    {equipos.map(eq => (
                      <option key={eq.id} value={eq.id}>
                        {nombreEquipo(eq)} — {eq.codigo} ({eq.estado?.nombre})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Técnico */}
                <div>
                  <label className={labelCls}>Técnico responsable</label>
                  <input value={form.tecnico} onChange={e => setForm(f => ({ ...f, tecnico: e.target.value }))}
                    placeholder="Nombre del técnico" className={inputCls} />
                </div>

                {/* Lista de actividades */}
                {listas.length > 0 && (
                  <div>
                    <label className={labelCls}>Lista de actividades predefinida</label>
                    <select value={form.lista_id} onChange={e => setForm(f => ({ ...f, lista_id: e.target.value }))} className={inputCls}>
                      <option value="">Sin lista — ingresar manualmente al cerrar</option>
                      {listas.map(l => <option key={l.id} value={l.id}>{l.nombre} ({l.actividades?.length || 0} actividades)</option>)}
                    </select>
                    {form.lista_id && (
                      <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                        {listas.find(l => l.id === form.lista_id)?.actividades
                          ?.sort((a, b) => a.orden - b.orden)
                          .map(a => (
                            <div key={a.id} className="flex items-center gap-2 text-[12px] text-slate-500 py-0.5">
                              <div className="w-1.5 h-1.5 rounded-full bg-slate-300 flex-shrink-0" />
                              {a.nombre}
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Observaciones */}
                <div>
                  <label className={labelCls}>Observaciones del cliente / motivo</label>
                  <textarea value={form.observaciones_cliente}
                    onChange={e => setForm(f => ({ ...f, observaciones_cliente: e.target.value }))}
                    placeholder="Descripción del problema o motivo..." rows={3}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-[9px] text-[13.5px] outline-none focus:border-[#D81B43] resize-none placeholder:text-slate-400" />
                </div>
              </div>
              <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2 flex-shrink-0 bg-white">
                <button onClick={() => intentarCerrarModal()} className="px-4 py-2.5 border border-slate-200 rounded-[9px] text-[13px] font-medium text-slate-600 hover:border-slate-300">Cancelar</button>
                <button onClick={crearMantenimiento} disabled={saving}
                  className="px-5 py-2.5 bg-[#D81B43] text-white rounded-[9px] text-[13px] font-semibold hover:bg-[#B0172F] disabled:opacity-50">
                  {saving ? 'Creando...' : 'Abrir mantenimiento'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── MODAL CIERRE ── */}
      {modalCierre && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm" onClick={() => setModalCierre(null)} />
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
            <div className="bg-white rounded-t-2xl md:rounded-2xl w-full md:max-w-[520px] max-h-[92vh] md:max-h-[calc(100vh-2rem)] flex flex-col shadow-2xl overflow-hidden"
              onClick={e => e.stopPropagation()}>
              <div className="px-6 py-4 border-b flex items-center justify-between flex-shrink-0 bg-[#D81B43]">
                <div>
                  <div className="text-[11px] text-white/60">Cerrar mantenimiento</div>
                  <div className="text-[15px] font-bold text-white font-mono">{modalCierre.codigo}</div>
                </div>
                <button onClick={() => setModalCierre(null)} className="text-white/60 hover:text-white w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20">
                  <X size={16} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

                {/* CHECKLIST INTERACTIVO — si hay actividades */}
                {modalCierre.actividades?.length > 0 ? (
                  <div className="space-y-3">
                    {/* Barra de progreso */}
                    <div className="bg-slate-50 rounded-[10px] p-3 border border-slate-200">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-[12px] font-semibold text-slate-600">Progreso del checklist</div>
                        <div className="text-[12px] font-bold text-slate-700">
                          {modalCierre.actividades.filter(a => a.completado).length}/{modalCierre.actividades.length}
                        </div>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2">
                        <div className="bg-[#0F7B55] h-2 rounded-full transition-all"
                          style={{ width: `${(modalCierre.actividades.filter(a => a.completado).length / modalCierre.actividades.length) * 100}%` }} />
                      </div>
                      {modalCierre.actividades.some(a => !a.completado) && (
                        <div className="text-[11.5px] text-[#B45309] mt-1.5">
                          ⚠ {modalCierre.actividades.filter(a => !a.completado).length} actividad(es) sin completar
                        </div>
                      )}
                    </div>

                    {/* Lista de actividades con toggle, observación y adjunto */}
                    <div className="space-y-2">
                      {modalCierre.actividades.map(act => (
                        <ActividadItem
                          key={act.id}
                          act={act}
                          cerrado={false}
                          uploading={uploading[act.id]}
                          onToggle={() => toggleActividad(act)}
                          onObservacion={(obs) => guardarObservacion(act, obs)}
                          onAdjunto={(file) => subirAdjunto(act, file)}
                        />
                      ))}
                    </div>

                    {/* Resumen opcional */}
                    <div>
                      <label className={labelCls}>Observaciones adicionales <span className="text-slate-300 font-normal normal-case">(opcional)</span></label>
                      <textarea value={cierreForm.actividades}
                        onChange={e => setCierreForm(f => ({ ...f, actividades: e.target.value }))}
                        placeholder="Notas adicionales del cierre..." rows={2}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-[9px] text-[13.5px] outline-none focus:border-[#D81B43] resize-none placeholder:text-slate-400" />
                    </div>
                  </div>
                ) : (
                  /* Sin lista — textarea libre obligatorio */
                  <div>
                    <label className={labelCls}>Resumen de actividades realizadas <span className="text-[#D81B43]">*</span></label>
                    <textarea value={cierreForm.actividades}
                      onChange={e => setCierreForm(f => ({ ...f, actividades: e.target.value }))}
                      placeholder="Describe las actividades realizadas durante el mantenimiento..." rows={4}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-[9px] text-[13.5px] outline-none focus:border-[#D81B43] resize-none placeholder:text-slate-400" />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Técnico responsable</label>
                    <input value={cierreForm.tecnico}
                      onChange={e => setCierreForm(f => ({ ...f, tecnico: e.target.value }))}
                      placeholder="Nombre del técnico" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Fecha de cierre</label>
                    <input type="date" value={cierreForm.fecha_cierre}
                      onChange={e => setCierreForm(f => ({ ...f, fecha_cierre: e.target.value }))} className={inputCls} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Resultado del mantenimiento <span className="text-[#D81B43]">*</span></label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { value: 'disponible', label: 'Vuelve a Disponible', icon: <CheckCircle2 size={15} />, color: '#0F7B55' },
                      { value: 'baja', label: 'Dar de baja', icon: <X size={15} />, color: '#D81B43' },
                    ].map(r => (
                      <button key={r.value} onClick={() => setCierreForm(f => ({ ...f, resultado: r.value }))}
                        className="flex items-center gap-2 px-4 py-3 rounded-[9px] border-2 text-[13px] font-semibold transition-all border-slate-200 text-slate-500 hover:border-slate-300"
                        style={cierreForm.resultado === r.value ? { borderColor: r.color, background: `${r.color}10`, color: r.color } : {}}>
                        {r.icon} {r.label}
                      </button>
                    ))}
                  </div>
                </div>
                {cierreForm.resultado === 'baja' && (
                  <div className="flex items-start gap-2 text-[12.5px] text-[#D81B43] bg-[#FEF2F2] px-3 py-3 rounded-[9px] border border-[#D81B43]/20">
                    <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                    El equipo quedará en estado <strong>Baja</strong> y no podrá asignarse en nuevas órdenes.
                  </div>
                )}
              </div>
              <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2 flex-shrink-0 bg-white">
                <button onClick={() => setModalCierre(null)} className="px-4 py-2.5 border border-slate-200 rounded-[9px] text-[13px] font-medium text-slate-600">Cancelar</button>
                <button onClick={cerrarMantenimiento} disabled={saving}
                  className="px-5 py-2.5 bg-[#D81B43] text-white rounded-[9px] text-[13px] font-semibold hover:bg-[#B0172F] disabled:opacity-50">
                  {saving ? 'Guardando...' : '✓ Cerrar mantenimiento'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {toast && (
        <div className={`fixed bottom-28 md:bottom-6 right-4 md:right-6 z-[70] px-4 py-3 rounded-[10px] text-[13px] font-medium text-white shadow-lg ${toast.tipo === 'error' ? 'bg-red-500' : 'bg-[#0F7B55]'}`}>
          {toast.msg}
        </div>
      )}

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
    </div>
  )
}

// ── COMPONENTE ACTIVIDAD ─────────────────────────────────────
function ActividadItem({ act, cerrado, uploading, onToggle, onObservacion, onAdjunto }) {
  const [showObs, setShowObs] = useState(false)
  const [obsText, setObsText] = useState(act.observaciones || '')
  const fileRef = useRef(null)

  return (
    <div className={`rounded-[9px] border transition-all ${act.completado ? 'bg-[#ECFDF5] border-[#0F7B55]/20' : 'bg-white border-slate-200'}`}>
      <div className="flex items-start gap-3 p-3">
        <button onClick={() => !cerrado && onToggle()}
          className={`w-5 h-5 rounded flex-shrink-0 flex items-center justify-center mt-0.5 transition-all ${act.completado ? 'bg-[#0F7B55]' : cerrado ? 'border-2 border-slate-200' : 'border-2 border-slate-300 hover:border-[#0F7B55] cursor-pointer'
            }`}>
          {act.completado && <CheckCircle2 size={11} className="text-white" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className={`text-[13px] font-medium ${act.completado ? 'text-[#0F7B55] line-through' : 'text-slate-700'}`}>
            {act.descripcion}
          </div>
          {act.observaciones && (
            <div className="text-[11.5px] text-slate-500 mt-0.5 italic">{act.observaciones}</div>
          )}
          {act.fecha && (
            <div className="text-[10.5px] text-slate-400 mt-0.5">{formatear(act.fecha, { month: '2-digit', year: undefined, hour: '2-digit', minute: '2-digit' })}</div>
          )}
          {/* Adjuntos */}
          {act.adjuntos?.length > 0 && (
            <div className="mt-2 space-y-1.5">
              {act.adjuntos.map(adj => {
                const esImagen = adj.tipo?.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp)$/i.test(adj.nombre)
                return esImagen ? (
                  <div key={adj.id}>
                    <a href={adj.url} target="_blank" rel="noopener noreferrer">
                      <img src={adj.url} alt={adj.nombre}
                        className="max-h-[160px] w-auto rounded-[8px] border border-slate-200 object-contain bg-slate-50 hover:opacity-90 transition-opacity cursor-pointer" />
                    </a>
                    <div className="text-[10.5px] text-slate-400 mt-0.5 flex items-center gap-1">
                      <Paperclip size={9} /> {adj.nombre}
                    </div>
                  </div>
                ) : (
                  <a key={adj.id} href={adj.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 px-2 py-1 bg-slate-100 rounded-[6px] text-[11px] text-slate-600 hover:bg-slate-200 transition-colors w-fit">
                    <Paperclip size={10} /> {adj.nombre}
                  </a>
                )
              })}
            </div>
          )}
        </div>
        {!cerrado && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button onClick={() => setShowObs(v => !v)}
              className="w-6 h-6 flex items-center justify-center rounded-[6px] text-slate-400 hover:text-[#D81B43] hover:bg-slate-100 transition-all">
              <Edit3 size={12} />
            </button>
            <button onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="w-6 h-6 flex items-center justify-center rounded-[6px] text-slate-400 hover:text-[#D81B43] hover:bg-slate-100 transition-all disabled:opacity-40">
              {uploading ? <span className="text-[9px]">...</span> : <Paperclip size={12} />}
            </button>
            <input ref={fileRef} type="file" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) onAdjunto(f); e.target.value = '' }} />
          </div>
        )}
      </div>
      {showObs && !cerrado && (
        <div className="px-3 pb-3 space-y-1.5">
          <textarea value={obsText} onChange={e => setObsText(e.target.value)}
            placeholder="Observación sobre esta actividad..." rows={2}
            className="w-full px-2.5 py-2 border border-slate-200 rounded-[7px] text-[12.5px] outline-none focus:border-[#D81B43] resize-none placeholder:text-slate-400" />
          <div className="flex gap-1.5">
            <button onClick={() => { onObservacion(obsText); setShowObs(false) }}
              className="px-3 py-1.5 bg-[#D81B43] text-white text-[12px] font-semibold rounded-[7px] hover:bg-[#B0172F]">
              Guardar
            </button>
            <button onClick={() => setShowObs(false)}
              className="px-3 py-1.5 border border-slate-200 text-slate-500 text-[12px] rounded-[7px]">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}