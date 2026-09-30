'use client'
import { registrarBitacora } from '@/lib/bitacora'
import Image from 'next/image'
import { useState, useEffect, useMemo } from 'react'
import {
  Users, Lock, Tag, Cpu, Building2,
  FileText, Upload, Plus, X, Edit3, Trash2,
  Check, Save, ClipboardList, Download, CheckCircle2, Smartphone,
  ChevronDown, ChevronRight, Search
} from 'lucide-react'
import { GaleriaIconos, IconoEquipo } from '@/components/inventario/IconosEquipo'
import { MODULOS_PRINCIPALES, MODULOS_CONFIGURACION, MODULOS_OCULTOS_POR_DEFECTO, puedeVerModulo } from '@/lib/permisos'
import BuzonNovedades from '@/components/layout/BuzonNovedades'

const NAV_MODULO = {
  usuarios: 'configuracion.usuarios', roles: 'configuracion.roles', categorias: 'configuracion.categorias',
  tipos: 'configuracion.tipos', listas: 'configuracion.listas', empresa: 'configuracion.empresa',
  plantillas: 'configuracion.plantillas', cargue: 'configuracion.cargue', preferencias: 'configuracion.preferencias',
}

const NAV = [
  { id: 'usuarios',   label: 'Usuarios',               icon: Users,         grupo: 'Acceso' },
  { id: 'roles',      label: 'Roles y permisos',       icon: Lock,          grupo: 'Acceso' },
  { id: 'categorias', label: 'Categorías',              icon: Tag,           grupo: 'Inventario' },
  { id: 'tipos',      label: 'Tipos de equipo',         icon: Cpu,           grupo: 'Inventario' },
  { id: 'listas',     label: 'Listas de mantenimiento', icon: ClipboardList, grupo: 'Mantenimientos' },
  { id: 'empresa',    label: 'Datos de la empresa',     icon: Building2,     grupo: 'Sistema' },
  { id: 'plantillas', label: 'Plantillas documentos',   icon: FileText,      grupo: 'Sistema' },
  { id: 'cargue',     label: 'Cargue masivo',           icon: Upload,        grupo: 'Sistema' },
  { id: 'preferencias', label: 'Preferencias',          icon: Smartphone,    grupo: 'Sistema' },
]
const GRUPOS = ['Acceso', 'Inventario', 'Mantenimientos', 'Sistema']
const TIPOS_CAMPO = [
  { value: 'texto',    label: 'Texto' },
  { value: 'numero',   label: 'Número' },
  { value: 'lista',    label: 'Lista de opciones' },
  { value: 'fecha',    label: 'Fecha' },
  { value: 'booleano', label: 'Sí / No' },
]
const inputCls = 'w-full px-3 py-2.5 border border-slate-200 rounded-[9px] text-[13.5px] text-slate-800 outline-none focus:border-[#D81B43] bg-white transition-colors placeholder:text-slate-400'
const labelCls = 'block text-[11px] font-bold uppercase tracking-[0.07em] text-slate-500 mb-1.5'

function ResultadoCargue({ resultado }) {
  if (!resultado) return null
  return (
    <div className="rounded-[10px] p-4 bg-green-50">
      <div className="flex items-center gap-2 font-semibold text-[#0F7B55] mb-2 text-[13px]">
        <CheckCircle2 size={16} />
        {resultado.exitosos ?? 0} de {resultado.total ?? 0} registros importados correctamente
      </div>
      {resultado.errores?.length > 0 && (
        <div className="text-[12px] text-slate-600 space-y-1 mt-2">
          <div className="font-semibold text-slate-700">{resultado.errores.length} error{resultado.errores.length !== 1 ? 'es' : ''}:</div>
          {resultado.errores.map((e, i) => <div key={i}>· {e}</div>)}
        </div>
      )}
    </div>
  )
}

// Piezas compartidas por las dos tarjetas de cargue
function PasoCargue({ n, titulo, deshabilitado = false, children }) {
  return (
    <div className={`flex gap-3 transition-opacity ${deshabilitado ? 'opacity-40 pointer-events-none' : ''}`}>
      <div className="w-6 h-6 rounded-full bg-[#D81B43]/10 text-[#D81B43] text-[12px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{n}</div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-slate-700 mb-2">{titulo}</div>
        {children}
      </div>
    </div>
  )
}

function ColumnasCargue({ columnas }) {
  if (!columnas.length) return <div className="text-[12px] text-slate-400">Sin columnas adicionales</div>
  return (
    <div className="flex flex-wrap gap-1">
      {columnas.map(c => <code key={c} className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{c}</code>)}
    </div>
  )
}

// Toda la zona es clickeable (label) y también acepta arrastrar y soltar
function ZonaArchivo({ archivo, onArchivo }) {
  const [dragOver, setDragOver] = useState(false)
  return (
    <label
      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { e.preventDefault(); e.stopPropagation(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) onArchivo(f) }}
      className={`flex items-center gap-3 border-2 border-dashed rounded-[10px] px-4 py-4 cursor-pointer transition-all ${
        dragOver || archivo ? 'border-[#D81B43] bg-[#D81B43]/5' : 'border-slate-200 hover:border-[#D81B43]'
      }`}>
      <Upload size={20} className={archivo ? 'text-[#D81B43]' : 'text-slate-300'} />
      <div className="min-w-0">
        <div className="text-[13px] font-semibold text-slate-600 truncate">{archivo ? archivo.name : 'Arrastra tu CSV aquí o haz clic para elegirlo'}</div>
        <div className="text-[11.5px] text-slate-400">{archivo ? `${(archivo.size / 1024).toFixed(1)} KB · clic para cambiarlo` : 'Solo archivos .csv'}</div>
      </div>
      <input type="file" accept=".csv,text/csv" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onArchivo(f); e.target.value = '' }} />
    </label>
  )
}

function AccionesCargue({ archivo, cargando, textoImportar, onImportar, onCancelar }) {
  if (!archivo) return null
  return (
    <div className="flex items-center gap-2 mt-3">
      <button onClick={onImportar} disabled={cargando}
        className="px-4 py-2 bg-[#D81B43] text-white rounded-[9px] text-[13px] font-semibold hover:bg-[#B0172F] disabled:opacity-50">
        {cargando ? 'Procesando...' : textoImportar}
      </button>
      <button onClick={onCancelar} disabled={cargando}
        className="px-3 py-2 border border-slate-200 rounded-[9px] text-[13px] text-slate-500 hover:border-slate-300">
        Cancelar
      </button>
    </div>
  )
}

function EncabezadoCargue({ Icono, titulo, sub }) {
  return (
    <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg bg-[#D81B43]/10 text-[#D81B43] flex items-center justify-center flex-shrink-0"><Icono size={16} /></div>
      <div>
        <div className="text-[14px] font-bold text-slate-700">{titulo}</div>
        <div className="text-[12px] text-slate-400 mt-0.5">{sub}</div>
      </div>
    </div>
  )
}

const btnPlantillaCls = 'inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-[8px] text-[12.5px] font-medium text-slate-600 hover:border-[#D81B43] hover:text-[#D81B43] transition-all'

function CargueEquipos({ cats }) {
  const [catId, setCatId]         = useState('')
  const [archivo, setArchivo]     = useState(null)
  const [cargando, setCargando]   = useState(false)
  const [resultado, setResultado] = useState(null)
  const cat         = cats.find(c => c.id === catId)
  const camposExtra = [...(cat?.atributos_extra?.campos_tipo || []), ...(cat?.atributos_extra?.campos_unidad || [])]

  async function descargarPlantilla() {
    if (!catId) return
    const res = await fetch(`/api/cargue/plantilla?tipo=equipos&categoria_id=${catId}`)
    const blob = await res.blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `plantilla_equipos_${cat?.nombre?.replace(/\s+/g, '_') || catId}.csv`
    a.click()
  }
  async function procesarCargue() {
    if (!archivo) return
    setCargando(true); setResultado(null)
    const fd = new FormData()
    fd.append('tipo', 'equipos'); fd.append('archivo', archivo)
    if (catId) fd.append('categoria_id', catId)
    const res = await fetch('/api/cargue', { method: 'POST', body: fd })
    setResultado(await res.json()); setCargando(false)
  }
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden h-full">
      <EncabezadoCargue Icono={Cpu} titulo="Equipos" sub="Importa unidades — las columnas dependen de la categoría" />
      <div className="p-5 space-y-5">
        <PasoCargue n={1} titulo="Elige la categoría">
          <select value={catId} onChange={e => { setCatId(e.target.value); setArchivo(null); setResultado(null) }} className={inputCls}>
            <option value="">Seleccionar categoría...</option>
            {cats.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          {catId && (
            <div className="mt-2">
              <div className="text-[11px] text-slate-400 mb-1">Columnas propias de esta categoría:</div>
              <ColumnasCargue columnas={camposExtra.map(c => c.clave)} />
            </div>
          )}
        </PasoCargue>
        <PasoCargue n={2} titulo="Descarga la plantilla y llénala" deshabilitado={!catId}>
          <button onClick={descargarPlantilla} className={btnPlantillaCls}>
            <Download size={13} /> Descargar plantilla
          </button>
        </PasoCargue>
        <PasoCargue n={3} titulo="Sube el archivo" deshabilitado={!catId}>
          <ZonaArchivo archivo={archivo} onArchivo={f => { setArchivo(f); setResultado(null) }} />
          <AccionesCargue archivo={archivo} cargando={cargando} textoImportar="Importar equipos"
            onImportar={procesarCargue} onCancelar={() => { setArchivo(null); setResultado(null) }} />
        </PasoCargue>
        <ResultadoCargue resultado={resultado} />
      </div>
    </div>
  )
}

function CargueCard({ titulo, tipo, sub, cols, Icono = Upload }) {
  const [archivo, setArchivo]     = useState(null)
  const [cargando, setCargando]   = useState(false)
  const [resultado, setResultado] = useState(null)

  async function descargarPlantilla() {
    const res = await fetch(`/api/cargue/plantilla?tipo=${tipo}`)
    const blob = await res.blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob); a.download = `plantilla_${tipo}.csv`; a.click()
  }
  async function procesarCargue() {
    if (!archivo) return
    setCargando(true); setResultado(null)
    const fd = new FormData(); fd.append('tipo', tipo); fd.append('archivo', archivo)
    const res = await fetch('/api/cargue', { method: 'POST', body: fd })
    setResultado(await res.json()); setCargando(false)
  }
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden h-full">
      <EncabezadoCargue Icono={Icono} titulo={titulo} sub={sub} />
      <div className="p-5 space-y-5">
        <PasoCargue n={1} titulo="Descarga la plantilla y llénala">
          <button onClick={descargarPlantilla} className={btnPlantillaCls}>
            <Download size={13} /> Descargar plantilla
          </button>
          <div className="mt-2">
            <div className="text-[11px] text-slate-400 mb-1">Columnas:</div>
            <ColumnasCargue columnas={cols.split(',').map(c => c.trim()).filter(Boolean)} />
          </div>
        </PasoCargue>
        <PasoCargue n={2} titulo="Sube el archivo">
          <ZonaArchivo archivo={archivo} onArchivo={f => { setArchivo(f); setResultado(null) }} />
          <AccionesCargue archivo={archivo} cargando={cargando} textoImportar={`Importar ${titulo.toLowerCase()}`}
            onImportar={procesarCargue} onCancelar={() => { setArchivo(null); setResultado(null) }} />
        </PasoCargue>
        <ResultadoCargue resultado={resultado} />
      </div>
    </div>
  )
}

export default function ConfiguracionClient({
  usuariosIniciales = [], roles = [], categorias: catsIniciales = [],
  tipos: tiposIniciales = [], plantillas = [], listas: listasIniciales = [],
  actividades: actividadesIniciales = [], empresaInicial = {},
  esSuperAdmin = false, permisosDelRolActual = [], todosPermisosIniciales = [],
}) {
  const [seccion, setSeccion]         = useState('usuarios')
  const [todosPermisos, setTodosPermisos] = useState(todosPermisosIniciales ?? [])
  const [rolSeleccionadoPermisos, setRolSeleccionadoPermisos] = useState(null)
  const [guardandoPermiso, setGuardandoPermiso] = useState(null)

  // Oculta del menú interno de Configuración las secciones que el rol actual
  // no tiene permitidas. SuperAdmin ve todas, sin importar la tabla permisos.
  const navVisible = useMemo(() => (
    esSuperAdmin ? NAV : NAV.filter(n => puedeVerModulo(NAV_MODULO[n.id], permisosDelRolActual))
  ), [esSuperAdmin, permisosDelRolActual])

  // Si la sección activa dejó de estar visible (o nunca lo estuvo para este rol),
  // se usa la primera sección permitida en su lugar — derivado en el render,
  // no vía efecto, para no disparar un setState en cascada.
  const seccionActiva = navVisible.some(n => n.id === seccion) ? seccion : (navVisible[0]?.id ?? seccion)

  const rolesSinSuperAdmin = roles.filter(r => r.nombre !== 'SuperAdmin')
  // Solo un SuperAdmin puede asignar ese rol (lo exige también /api/usuarios)
  const rolesAsignables = esSuperAdmin ? roles : rolesSinSuperAdmin
  const rolIdActivoPermisos = rolSeleccionadoPermisos || rolesSinSuperAdmin[0]?.id || null
  const permisosDelRolSeleccionado = todosPermisos.filter(p => p.rol_id === rolIdActivoPermisos)

  async function toggleModuloPermiso(modulo, visibleActual) {
    if (!rolIdActivoPermisos) return
    const key = `${rolIdActivoPermisos}:${modulo}`
    setGuardandoPermiso(key)
    try {
      const supabase = await getSupabase()
      const invertido = MODULOS_OCULTOS_POR_DEFECTO.includes(modulo)
      const nuevoVisible = !visibleActual
      // Si la nueva visibilidad coincide con el comportamiento por defecto de ese
      // módulo, no hace falta guardar nada — se borra la fila para volver al default.
      const coincideConDefault = invertido ? nuevoVisible === false : nuevoVisible === true

      if (coincideConDefault) {
        const { error } = await supabase.from('permisos').delete()
          .eq('rol_id', rolIdActivoPermisos).eq('modulo', modulo)
        if (error) throw error
        setTodosPermisos(prev => prev.filter(p => !(p.rol_id === rolIdActivoPermisos && p.modulo === modulo)))
      } else {
        const filaExistente = todosPermisos.find(p => p.rol_id === rolIdActivoPermisos && p.modulo === modulo)
        if (filaExistente) {
          const { error } = await supabase.from('permisos').update({ puede_ver: nuevoVisible }).eq('id', filaExistente.id)
          if (error) throw error
          setTodosPermisos(prev => prev.map(p => p.id === filaExistente.id ? { ...p, puede_ver: nuevoVisible } : p))
        } else {
          const { data, error } = await supabase.from('permisos').insert({
            rol_id: rolIdActivoPermisos, modulo, puede_ver: nuevoVisible,
            puede_crear: nuevoVisible, puede_editar: nuevoVisible, puede_eliminar: nuevoVisible,
          }).select().single()
          if (error) throw error
          setTodosPermisos(prev => [...prev, data])
        }
      }
      showToast(nuevoVisible ? 'Módulo habilitado' : 'Módulo ocultado')
      registrarBitacora({
        modulo: 'configuracion', accion: 'editar', entidad: 'permiso', entidad_id: rolIdActivoPermisos,
        detalle: { modulo, puede_ver: nuevoVisible, rol: rolesSinSuperAdmin.find(r => r.id === rolIdActivoPermisos)?.nombre },
      })
    } catch (e) {
      showToast('Error actualizando permiso: ' + e.message, 'error')
    } finally {
      setGuardandoPermiso(null)
    }
  }

  const [mobileNavMode, setMobileNavMode] = useState(() => {
    if (typeof window === 'undefined') return 'barra'
    const saved = localStorage.getItem('ingemedic_mobile_nav_mode')
    return (saved === 'flotante' || saved === 'barra') ? saved : 'barra'
  })

  function cambiarModoMobile(modo) {
    setMobileNavMode(modo)
    localStorage.setItem('ingemedic_mobile_nav_mode', modo)
    window.dispatchEvent(new CustomEvent('mobile-nav-mode-change', { detail: modo }))
    showToast(modo === 'barra' ? 'Modo barra fija activado' : 'Acceso Rápido activado')
  }

  // Escuchar evento del tour para cambiar sección automáticamente
  useEffect(() => {
    function onTourSeccion(e) { setSeccion(e.detail) }
    window.addEventListener('tour-seccion', onTourSeccion)
    return () => window.removeEventListener('tour-seccion', onTourSeccion)
  }, [])
  const [usuarios, setUsuarios]       = useState(usuariosIniciales ?? [])
  const [cats, setCats]               = useState(catsIniciales ?? [])
  const [tipos, setTipos]             = useState(tiposIniciales ?? [])
  const [listas, setListas]           = useState(listasIniciales ?? [])
  const [actividades, setActividades] = useState(actividadesIniciales ?? [])
  const [modal, setModal]             = useState(null)
  const [saving, setSaving]           = useState(false)
  const [toast, setToast]             = useState(null)
  const [form, setForm]               = useState({})
  const [listaExpandida, setListaExpandida] = useState(null)
  const [tipoExpandido, setTipoExpandido]   = useState(null)
  // Tipos de equipo: categoría seleccionada a la izquierda (null = la primera con tipos) y buscador
  const [catTiposId, setCatTiposId] = useState(null)
  const [buscarTipo, setBuscarTipo] = useState('')
  const [nuevaActividad, setNuevaActividad] = useState('')
  const [empresa, setEmpresa]         = useState(empresaInicial)
  const [subiendoLogo, setSubiendoLogo] = useState(false)
  const [camposModal, setCamposModal] = useState({ campos_tipo: [], campos_unidad: [] })
  const [nuevoCampo, setNuevoCampo]   = useState({ nombre: '', tipo: 'texto', obligatorio: false, opciones: '', nivel: '' })
  const [iconoSeleccionado, setIconoSeleccionado] = useState('')   // para categorías
  const [imagenTipo, setImagenTipo]               = useState(null)  // File object para tipos
  const [imagenTipoUrl, setImagenTipoUrl]         = useState('')    // URL actual del tipo
  const [subiendoImagen, setSubiendoImagen]       = useState(false)

  function showToast(msg, tipo = 'success') {
    setToast({ msg, tipo })
    setTimeout(() => setToast(null), 3000)
  }

  async function getSupabase() {
    const { createClient } = await import('@/lib/supabase')
    return createClient()
  }

  function abrirModal(tipo, data = {}) {
    if (tipo === 'categoria') {
      const cat = cats.find(c => c.id === data.id)
      setCamposModal({
        campos_tipo:   cat?.atributos_extra?.campos_tipo   || [],
        campos_unidad: cat?.atributos_extra?.campos_unidad || [],
      })
      setNuevoCampo({ nombre: '', tipo: 'texto', obligatorio: false, opciones: '', nivel: '' })
      // Ícono de la categoría
      const iconoActual = data.imagen_url?.startsWith('icono:')
        ? data.imagen_url.replace('icono:', '') : ''
      setIconoSeleccionado(iconoActual)
    }
    if (tipo === 'tipo') {
      // Imagen real del tipo
      const urlActual = data.imagen_url && !data.imagen_url.startsWith('icono:')
        ? data.imagen_url : ''
      setImagenTipo(null)
      setImagenTipoUrl(urlActual)
    }
    setForm({ ...data, password: '', atributos: data.atributos || {} })
    setModal(tipo)
  }

  // ── USUARIOS ──────────────────────────────────────────────
  async function guardarUsuario() {
    if (!form.nombre?.trim() || !form.email?.trim() || !form.username?.trim()) {
      showToast('Nombre, correo y usuario son requeridos', 'error'); return
    }
    if (!form.id && !form.password?.trim()) { showToast('La contraseña es requerida', 'error'); return }
    if (form.password && form.password.length < 6) { showToast('Mínimo 6 caracteres', 'error'); return }
    setSaving(true)
    const res = await fetch('/api/usuarios', {
      method: form.id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: form.id, nombre: form.nombre.trim(), email: form.email.trim(),
        username: form.username.trim().toLowerCase().replace(/\s+/g, '_'),
        password: form.password?.trim() || undefined, rol_id: form.rol_id,
      }),
    })
    const data = await res.json()
    if (!res.ok) { showToast('Error: ' + data.error, 'error'); setSaving(false); return }
    if (form.id) {
      setUsuarios(prev => prev.map(u => u.id === form.id ? data.usuario : u))
      registrarBitacora({ modulo: 'configuracion', accion: 'editar', entidad: 'usuario', entidad_id: form.id, detalle: { nombre: form.nombre, email: form.email } })
      showToast('Usuario actualizado')
    } else {
      setUsuarios(prev => [data.usuario, ...prev])
      registrarBitacora({ modulo: 'configuracion', accion: 'crear', entidad: 'usuario', entidad_id: data.usuario?.id, detalle: { nombre: form.nombre, email: form.email } })
      showToast('Usuario creado')
    }
    setSaving(false); setModal(null); setForm({})
  }

  async function toggleUsuario(u) {
    const res = await fetch('/api/usuarios', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: u.id, activo: !u.activo }),
    })
    const data = await res.json()
    if (!res.ok) { showToast('Error: ' + data.error, 'error'); return }
    registrarBitacora({ modulo: 'configuracion', accion: u.activo ? 'desactivar' : 'activar', entidad: 'usuario', entidad_id: u.id, detalle: { nombre: u.nombre } })
    setUsuarios(prev => prev.map(x => x.id === u.id ? { ...x, activo: !x.activo } : x))
    showToast(u.activo ? 'Usuario desactivado' : 'Usuario activado')
  }

  // ── CATEGORÍAS ────────────────────────────────────────────
  async function guardarCat() {
    if (!form.nombre?.trim()) { showToast('El nombre es requerido', 'error'); return }
    setSaving(true)
    const supabase = await getSupabase()
    const payload = {
      nombre: form.nombre, descripcion: form.descripcion,
      imagen_url: iconoSeleccionado ? `icono:${iconoSeleccionado}` : null,
      atributos_extra: { campos_tipo: camposModal.campos_tipo, campos_unidad: camposModal.campos_unidad },
    }
    if (form.id) {
      const { error } = await supabase.from('categorias_equipo').update(payload).eq('id', form.id)
      if (error) { showToast('Error: ' + error.message, 'error'); setSaving(false); return }
      setCats(prev => prev.map(c => c.id === form.id ? { ...c, ...payload } : c))
      registrarBitacora({ modulo: 'configuracion', accion: 'editar', entidad: 'categoría de equipo', entidad_id: form.id, detalle: { nombre: form.nombre } })
      showToast('Categoría actualizada')
    } else {
      const { data, error } = await supabase.from('categorias_equipo').insert({ ...payload, activo: true }).select().single()
      if (error) { showToast('Error: ' + error.message, 'error'); setSaving(false); return }
      setCats(prev => [...prev, data])
      registrarBitacora({ modulo: 'configuracion', accion: 'crear', entidad: 'categoría de equipo', entidad_id: data.id, detalle: { nombre: form.nombre } })
      showToast('Categoría creada')
    }
    setSaving(false); setModal(null)
  }

  async function eliminarCat(id) {
    if (!confirm('¿Eliminar esta categoría?')) return
    const supabase = await getSupabase()
    const { error } = await supabase.from('categorias_equipo').update({ activo: false }).eq('id', id)
    if (error) { showToast('Error: ' + error.message, 'error'); return }
    registrarBitacora({ modulo: 'configuracion', accion: 'eliminar', entidad: 'categoría de equipo', entidad_id: id })
    setCats(prev => prev.filter(c => c.id !== id))
    showToast('Categoría eliminada')
  }

  function agregarCampoModal() {
    if (!nuevoCampo.nombre.trim()) return
    const key = `campos_${nuevoCampo.nivel}`
    const campo = {
      nombre: nuevoCampo.nombre.trim(),
      clave:  nuevoCampo.nombre.trim().toLowerCase().replace(/\s+/g, '_').normalize('NFD').replace(/[\u0300-\u036f]/g, ''),
      tipo:   nuevoCampo.tipo, obligatorio: nuevoCampo.obligatorio,
      opciones: nuevoCampo.tipo === 'lista' ? nuevoCampo.opciones.split(',').map(o => o.trim()).filter(Boolean) : [],
    }
    setCamposModal(prev => ({ ...prev, [key]: [...prev[key], campo] }))
    setNuevoCampo(p => ({ ...p, nombre: '', opciones: '' }))
  }

  function eliminarCampoModal(nivel, idx) {
    const key = `campos_${nivel}`
    setCamposModal(prev => ({ ...prev, [key]: prev[key].filter((_, i) => i !== idx) }))
  }

  // ── TIPOS ─────────────────────────────────────────────────
  async function guardarTipo() {
    if (!form.categoria_id) { showToast('La categoría es requerida', 'error'); return }
    const cat = cats.find(c => c.id === form.categoria_id)
    const camposTipo = cat?.atributos_extra?.campos_tipo || []
    for (const campo of camposTipo) {
      if (campo.obligatorio && !form.atributos?.[campo.clave]?.toString().trim()) {
        showToast(`El campo "${campo.nombre}" es obligatorio`, 'error'); return
      }
    }
    const nombreTipo = form.atributos?.nombre?.trim()
    if (!nombreTipo) { showToast('El nombre del tipo es obligatorio', 'error'); return }
    setSaving(true)
    const supabase = await getSupabase()

    // Subir imagen si hay una nueva
    let finalImagenUrl = imagenTipoUrl || null
    if (imagenTipo) {
      setSubiendoImagen(true)
      const ext  = imagenTipo.name.split('.').pop()
      const path = `tipos/${form.id || crypto.randomUUID()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('equipos-imagenes').upload(path, imagenTipo, { upsert: true })
      if (uploadError) {
        showToast('Error subiendo imagen: ' + uploadError.message, 'error')
        setSaving(false); setSubiendoImagen(false); return
      }
      const { data: { publicUrl } } = supabase.storage.from('equipos-imagenes').getPublicUrl(path)
      finalImagenUrl = publicUrl
      setSubiendoImagen(false)
    }

    const payload = {
      categoria_id:           form.categoria_id,
      nombre:                 nombreTipo,
      imagen_url:             finalImagenUrl,
      lista_mantenimiento_id: form.lista_mantenimiento_id || null,
      atributos:              Object.keys(form.atributos || {}).length > 0 ? form.atributos : null,
    }
    if (form.id) {
      const { error } = await supabase.from('tipos_equipo').update(payload).eq('id', form.id)
      if (error) { showToast('Error: ' + error.message, 'error'); setSaving(false); return }
      setTipos(prev => prev.map(t => t.id === form.id ? {
        ...t, ...payload,
        categoria: cats.find(c => c.id === form.categoria_id) || t.categoria,
        lista: listas.find(l => l.id === form.lista_mantenimiento_id) || t.lista,
      } : t))
      registrarBitacora({ modulo: 'configuracion', accion: 'editar', entidad: 'tipo de equipo', entidad_id: form.id, detalle: { nombre: nombreTipo } })
      showToast('Tipo actualizado')
    } else {
      const { data, error } = await supabase.from('tipos_equipo')
        .insert({ ...payload, activo: true })
        .select('*, categoria:categorias_equipo(id, nombre, atributos_extra), lista:listas_mantenimiento(id, nombre)').single()
      if (error) { showToast('Error: ' + error.message, 'error'); setSaving(false); return }
      setTipos(prev => [...prev, data])
      registrarBitacora({ modulo: 'configuracion', accion: 'crear', entidad: 'tipo de equipo', entidad_id: data.id, detalle: { nombre: nombreTipo } })
      showToast('Tipo creado')
    }
    setSaving(false); setModal(null)
  }

  async function eliminarTipo(id) {
    if (!confirm('¿Eliminar este tipo de equipo?')) return
    const supabase = await getSupabase()
    const { error } = await supabase.from('tipos_equipo').update({ activo: false }).eq('id', id)
    if (error) { showToast('Error: ' + error.message, 'error'); return }
    registrarBitacora({ modulo: 'configuracion', accion: 'eliminar', entidad: 'tipo de equipo', entidad_id: id })
    setTipos(prev => prev.filter(t => t.id !== id))
    showToast('Tipo eliminado')
  }

  // ── LISTAS ────────────────────────────────────────────────
  async function guardarLista() {
    if (!form.nombre?.trim()) { showToast('El nombre es requerido', 'error'); return }
    setSaving(true)
    const supabase = await getSupabase()
    if (form.id) {
      const { error } = await supabase.from('listas_mantenimiento').update({ nombre: form.nombre, descripcion: form.descripcion }).eq('id', form.id)
      if (error) { showToast('Error: ' + error.message, 'error'); setSaving(false); return }
      setListas(prev => prev.map(l => l.id === form.id ? { ...l, ...form } : l))
      registrarBitacora({ modulo: 'configuracion', accion: 'editar', entidad: 'lista de mantenimiento', entidad_id: form.id, detalle: { nombre: form.nombre } })
      showToast('Lista actualizada')
    } else {
      const { data, error } = await supabase.from('listas_mantenimiento').insert({ nombre: form.nombre, descripcion: form.descripcion, activo: true }).select().single()
      if (error) { showToast('Error: ' + error.message, 'error'); setSaving(false); return }
      setListas(prev => [...prev, data]); setListaExpandida(data.id)
      registrarBitacora({ modulo: 'configuracion', accion: 'crear', entidad: 'lista de mantenimiento', entidad_id: data.id, detalle: { nombre: form.nombre } })
      showToast('Lista creada')
    }
    setSaving(false); setModal(null)
  }

  async function eliminarLista(id) {
    if (!confirm('¿Eliminar esta lista?')) return
    const supabase = await getSupabase()
    const { error } = await supabase.from('listas_mantenimiento').update({ activo: false }).eq('id', id)
    if (error) { showToast('Error: ' + error.message, 'error'); return }
    registrarBitacora({ modulo: 'configuracion', accion: 'eliminar', entidad: 'lista de mantenimiento', entidad_id: id })
    setListas(prev => prev.filter(l => l.id !== id))
    setActividades(prev => prev.filter(a => a.lista_id !== id))
    showToast('Lista eliminada')
  }

  async function agregarActividad(listaId) {
    if (!nuevaActividad.trim()) return
    const supabase = await getSupabase()
    const orden = actividades.filter(a => a.lista_id === listaId).length + 1
    const { data, error } = await supabase.from('actividades_lista_mantenimiento')
      .insert({ lista_id: listaId, nombre: nuevaActividad.trim(), orden, activo: true }).select().single()
    if (error) { showToast('Error: ' + error.message, 'error'); return }
    setActividades(prev => [...prev, data]); setNuevaActividad('')
    showToast('Actividad agregada')
  }

  async function eliminarActividad(id) {
    if (!confirm('¿Eliminar esta actividad?')) return
    const supabase = await getSupabase()
    const { error } = await supabase.from('actividades_lista_mantenimiento').update({ activo: false }).eq('id', id)
    if (error) { showToast('Error: ' + error.message, 'error'); return }
    setActividades(prev => prev.filter(a => a.id !== id))
    showToast('Actividad eliminada')
  }

  async function subirLogo(file) {
    setSubiendoLogo(true)
    const supabase = await getSupabase()
    const ext = file.name.split('.').pop()
    const { error: uploadError } = await supabase.storage.from('logos').upload(`logo-ingemedic.${ext}`, file, { upsert: true })
    if (uploadError) { showToast('Error subiendo logo: ' + uploadError.message, 'error'); setSubiendoLogo(false); return }
    const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(`logo-ingemedic.${ext}`)
    setEmpresa(p => ({ ...p, logo_url: publicUrl })); setSubiendoLogo(false)
    showToast('Logo actualizado')
  }

  async function guardarEmpresa() {
    const supabase = await getSupabase()
    const { error } = await supabase.from('configuracion_empresa').update({
      razon_social: empresa.razon_social, nit: empresa.nit, tel: empresa.tel,
      email: empresa.email, dir: empresa.dir, rep: empresa.rep, web: empresa.web,
      logo_url: empresa.logo_url, clausula_certificacion: empresa.clausula_certificacion || null,
      fecha_actualizacion: new Date().toISOString(),
    }).eq('id', empresa.id)
    if (error) { showToast('Error: ' + error.message, 'error'); return }
    registrarBitacora({ modulo: 'configuracion', accion: 'editar', entidad: 'configuración de empresa', entidad_id: empresa.id, detalle: { razon_social: empresa.razon_social } })
    showToast('Datos guardados')
  }

  function previsualizarPlantilla(plantilla) {
    const vars = {
      empresa_logo: empresa.logo_url || '', empresa_dir: empresa.dir || '',
      empresa_tel: empresa.tel || '', empresa_email: empresa.email || '', empresa_web: empresa.web || '',
      orden_codigo: 'OS-2024-001', ciudad: 'Valledupar', orden_fecha: '15/01/2024',
      cliente_nombre: 'IPS San Juan de Dios', equipo_nombre: 'Concentrador de Oxígeno',
      equipo_serial: 'SN-001234', equipo_codigo: 'EQ-001',
    }
    let html = plantilla.contenido || ''
    for (const [k, v] of Object.entries(vars)) html = html.replaceAll(`{{${k}}}`, v)
    const w = window.open('', '_blank')
    if (!w) { showToast('No se pudo abrir la previsualización', 'error'); return }
    w.document.write(html); w.document.close()
  }

  const actividadesDeLista = id => actividades.filter(a => a.lista_id === id)

  function renderCampoForm(campo) {
    const val = form.atributos?.[campo.clave] || ''
    const set = v => setForm(f => ({ ...f, atributos: { ...f.atributos, [campo.clave]: v } }))
    if (campo.tipo === 'lista') return (
      <select value={val} onChange={e => set(e.target.value)} className={inputCls}>
        <option value="">Seleccionar...</option>
        {(campo.opciones || []).map(op => <option key={op} value={op}>{op}</option>)}
      </select>
    )
    if (campo.tipo === 'booleano') return (
      <select value={val} onChange={e => set(e.target.value)} className={inputCls}>
        <option value="">Seleccionar...</option>
        <option value="si">Sí</option>
        <option value="no">No</option>
      </select>
    )
    return <input type={campo.tipo === 'numero' ? 'number' : campo.tipo === 'fecha' ? 'date' : 'text'}
      value={val} onChange={e => set(e.target.value)} placeholder={campo.nombre} className={inputCls} />
  }

  const tiposPorCategoria = cats.map(cat => ({
    categoria: cat,
    tipos: tipos.filter(t => (t.categoria_id ?? t.categoria?.id) === cat.id),
  }))

  // ── RENDER ────────────────────────────────────────────────
  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Header */}
      <div className="h-14 md:h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-7 flex-shrink-0">
        <div>
          <div className="text-[18px] font-bold text-slate-800">Configuración</div>
          <div className="text-[12px] text-slate-400 mt-0.5">Panel de control del sistema</div>
        </div>
        <BuzonNovedades />
      </div>

      {/* Mobile tabs */}
      <div className="flex md:hidden overflow-x-auto border-b border-slate-200 bg-white flex-shrink-0">
        <div className="flex">
          {navVisible.map(n => {
            const Icon = n.icon; const active = seccionActiva === n.id
            return (
              <button key={n.id} onClick={() => setSeccion(n.id)}
                className={`flex items-center gap-1.5 px-4 py-3 text-[12px] font-medium whitespace-nowrap border-b-2 transition-all flex-shrink-0 ${active ? 'border-[#D81B43] text-[#D81B43]' : 'border-transparent text-slate-500'}`}>
                <Icon size={14} />{n.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
        {/* Sidebar nav */}
        <aside className="hidden md:flex w-56 min-w-[224px] bg-white border-r border-slate-200 flex-col py-4 overflow-y-auto flex-shrink-0">
          {GRUPOS.filter(grupo => navVisible.some(n => n.grupo === grupo)).map(grupo => (
            <div key={grupo} className="mb-2">
              <div className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-slate-400 px-4 py-1.5">{grupo}</div>
              {navVisible.filter(n => n.grupo === grupo).map(n => {
                const Icon = n.icon; const active = seccionActiva === n.id
                const tourId = n.id === 'empresa' ? 'nav-empresa'
                  : n.id === 'categorias' ? 'nav-categorias'
                  : n.id === 'tipos' ? 'nav-tipos'
                  : n.id === 'listas' ? 'nav-listas'
                  : n.id === 'usuarios' ? 'nav-usuarios'
                  : undefined
                return (
                  <button key={n.id} onClick={() => setSeccion(n.id)}
                    data-tour={tourId}
                    className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-medium transition-all ${active ? 'bg-[#D81B43]/5 text-[#D81B43] font-semibold border-r-2 border-[#D81B43]' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}>
                    <Icon size={15} className={active ? 'text-[#D81B43]' : 'text-slate-400'} />
                    {n.label}
                  </button>
                )
              })}
            </div>
          ))}
        </aside>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3 md:p-6 pb-28 md:pb-6">
          <div className="max-w-[1280px]">

            {/* USUARIOS */}
            {seccionActiva === 'usuarios' && (
              <div>
                <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                  <div>
                    <h2 className="text-[20px] font-bold text-slate-800">Usuarios</h2>
                    <p className="text-[13px] text-slate-400 mt-0.5">Gestiona quién tiene acceso al sistema</p>
                  </div>
                  <button onClick={() => abrirModal('usuario', { rol_id: rolesAsignables[0]?.id })}
                    className="flex items-center gap-1.5 px-4 py-2 bg-[#D81B43] text-white text-[13px] font-semibold rounded-[9px] hover:bg-[#B0172F] transition-colors">
                    <Plus size={14} /> Nuevo usuario
                  </button>
                </div>
                <div className="hidden md:block bg-white rounded-xl border border-slate-200 overflow-x-auto shadow-sm">
                  <table className="w-full border-collapse min-w-[560px]">
                    <thead>
                      <tr className="border-b-2 border-slate-200">
                        {['Nombre','Correo','Usuario','Rol','Estado',''].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-[10.5px] font-bold uppercase tracking-[0.07em] text-slate-400 bg-slate-50">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {usuarios.map(u => (
                        <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-[#D81B43] flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">{u.nombre?.charAt(0)}</div>
                              <span className="text-[13px] font-semibold text-slate-700">{u.nombre}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-[12.5px] text-slate-500">{u.email}</td>
                          <td className="px-4 py-3 font-mono text-[12.5px] text-slate-500">{u.username}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${u.rol?.nombre === 'Administrador' ? 'bg-[#E8F7FB] text-[#0E86A0]' : 'bg-green-50 text-green-700'}`}>
                              {u.rol?.nombre || '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-[12px] font-semibold ${u.activo ? 'text-[#0F7B55]' : 'text-slate-400'}`}>
                              {u.activo ? '● Activo' : '○ Inactivo'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <button onClick={() => abrirModal('usuario', { ...u, rol_id: u.rol_id })} className="p-1.5 text-slate-400 hover:text-[#D81B43] hover:bg-slate-100 rounded-[6px] transition-all"><Edit3 size={13} /></button>
                              <button onClick={() => toggleUsuario(u)} className={`p-1.5 rounded-[6px] transition-all ${u.activo ? 'text-slate-400 hover:text-red-500 hover:bg-red-50' : 'text-slate-400 hover:text-green-600 hover:bg-green-50'}`}>
                                {u.activo ? <X size={13} /> : <Check size={13} />}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Celular: una tarjeta por usuario */}
                <div className="md:hidden space-y-2">
                  {usuarios.map(u => (
                    <div key={u.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-3.5 flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-[14px] font-bold flex-shrink-0 ${u.activo ? 'bg-[#D81B43]' : 'bg-slate-300'}`}>{u.nombre?.charAt(0)}</div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-[14px] font-semibold truncate ${u.activo ? 'text-slate-700' : 'text-slate-400'}`}>{u.nombre}</span>
                          {!u.activo && <span className="text-[10.5px] font-semibold text-slate-400 flex-shrink-0">Inactivo</span>}
                        </div>
                        <div className="text-[12px] text-slate-400 truncate">{u.email}</div>
                        <div className="flex items-center gap-2 mt-1 min-w-0">
                          <span className="font-mono text-[11.5px] text-slate-500 truncate">@{u.username}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold flex-shrink-0 ${u.rol?.nombre === 'Administrador' ? 'bg-[#E8F7FB] text-[#0E86A0]' : 'bg-green-50 text-green-700'}`}>
                            {u.rol?.nombre || '—'}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 flex-shrink-0">
                        <button onClick={() => abrirModal('usuario', { ...u, rol_id: u.rol_id })} aria-label="Editar"
                          className="p-2 text-slate-400 active:text-[#D81B43] active:bg-slate-100 rounded-[8px]"><Edit3 size={16} /></button>
                        <button onClick={() => toggleUsuario(u)} aria-label={u.activo ? 'Desactivar' : 'Activar'}
                          className={`p-2 rounded-[8px] ${u.activo ? 'text-slate-400 active:text-red-500 active:bg-red-50' : 'text-green-600 active:bg-green-50'}`}>
                          {u.activo ? <X size={16} /> : <Check size={16} />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ROLES */}
            {seccionActiva === 'roles' && (
              <div>
                <h2 className="text-[20px] font-bold text-slate-800 mb-1">Roles y permisos</h2>
                <p className="text-[13px] text-slate-400 mb-6">
                  Define qué módulos puede ver cada rol. Por defecto todo está visible — solo se restringe lo que
                  desmarques aquí. <span className="font-semibold text-slate-500">SuperAdmin</span> no aparece en esta
                  lista: siempre tiene acceso total, sin excepción.
                </p>

                {rolesSinSuperAdmin.length === 0 ? (
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-16 text-center text-slate-400 text-[13px]">
                    No hay roles editables además de SuperAdmin.
                  </div>
                ) : (
                  <div className="flex flex-col md:flex-row gap-4">
                    {/* Lista de roles */}
                    <div className="w-full md:w-[220px] flex-shrink-0 bg-white rounded-xl border border-slate-200 shadow-sm p-2 h-fit">
                      {rolesSinSuperAdmin.map(r => (
                        <button key={r.id} onClick={() => setRolSeleccionadoPermisos(r.id)}
                          className={`w-full text-left px-3 py-2.5 rounded-[8px] transition-all ${rolIdActivoPermisos === r.id ? 'bg-[#D81B43]/8' : 'hover:bg-slate-50'}`}>
                          <div className={`text-[13px] font-semibold ${rolIdActivoPermisos === r.id ? 'text-[#D81B43]' : 'text-slate-700'}`}>{r.nombre}</div>
                          {r.descripcion && <div className="text-[11px] text-slate-400 mt-0.5">{r.descripcion}</div>}
                        </button>
                      ))}
                    </div>

                    {/* Checkboxes de módulos para el rol seleccionado */}
                    <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                      <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400 mb-3">Módulos</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-4 gap-y-0.5 mb-6">
                        {MODULOS_PRINCIPALES.map(m => {
                          const visible   = puedeVerModulo(m.modulo, permisosDelRolSeleccionado)
                          const guardando = guardandoPermiso === `${rolIdActivoPermisos}:${m.modulo}`
                          return (
                            <label key={m.modulo} className="flex items-center gap-2.5 px-2 py-2 rounded-[8px] hover:bg-slate-50 cursor-pointer">
                              <input type="checkbox" checked={visible} disabled={guardando}
                                onChange={() => toggleModuloPermiso(m.modulo, visible)}
                                className="w-4 h-4 accent-[#D81B43]" />
                              <span className="text-[13px] text-slate-700">{m.label}</span>
                              {guardando && <span className="text-[11px] text-slate-400">Guardando…</span>}
                            </label>
                          )
                        })}
                      </div>

                      <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400 mb-3">Dentro de Configuración</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-4 gap-y-0.5">
                        {MODULOS_CONFIGURACION.map(m => {
                          const visible    = puedeVerModulo(m.modulo, permisosDelRolSeleccionado)
                          const guardando  = guardandoPermiso === `${rolIdActivoPermisos}:${m.modulo}`
                          const esSensible = MODULOS_OCULTOS_POR_DEFECTO.includes(m.modulo)
                          return (
                            <label key={m.modulo} className="flex items-center gap-2.5 px-2 py-2 rounded-[8px] hover:bg-slate-50 cursor-pointer">
                              <input type="checkbox" checked={visible} disabled={guardando}
                                onChange={() => toggleModuloPermiso(m.modulo, visible)}
                                className="w-4 h-4 accent-[#D81B43]" />
                              <span className="text-[13px] text-slate-700">{m.label}</span>
                              {esSensible && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold">Oculto por defecto</span>
                              )}
                              {guardando && <span className="text-[11px] text-slate-400">Guardando…</span>}
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* CATEGORÍAS */}
            {seccionActiva === 'categorias' && (
              <div>
                <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                  <div>
                    <h2 className="text-[20px] font-bold text-slate-800">Categorías de equipo</h2>
                    <p className="text-[13px] text-slate-400 mt-0.5">Define columnas del tipo y de la unidad por categoría</p>
                  </div>
                  <button onClick={() => abrirModal('categoria', {})}
                    className="flex items-center gap-1.5 px-4 py-2 bg-[#D81B43] text-white text-[13px] font-semibold rounded-[9px] hover:bg-[#B0172F] transition-colors">
                    <Plus size={14} /> Nueva categoría
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {cats.map(c => {
                    const nT = c.atributos_extra?.campos_tipo?.length || 0
                    const nU = c.atributos_extra?.campos_unidad?.length || 0
                    const iconoClave = c.imagen_url?.startsWith('icono:') ? c.imagen_url.replace('icono:', '') : null
                    return (
                      <div key={c.id} className="bg-white rounded-xl border border-slate-200 shadow-sm flex items-center gap-3 px-4 py-3.5 hover:border-slate-300 transition-colors">
                        {/* Ícono categoría */}
                        <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center flex-shrink-0">
                          {iconoClave
                            ? <IconoEquipo clave={iconoClave} size={22} color="#D81B43" />
                            : <Tag size={16} className="text-slate-300" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13.5px] font-semibold text-slate-700 truncate">{c.nombre}</div>
                          {c.descripcion && <div className="text-[12px] text-slate-400 mt-0.5">{c.descripcion}</div>}
                          <div className="text-[11.5px] text-slate-400 mt-1">
                            {tipos.filter(t => t.categoria_id === c.id).length} tipos
                            {nT > 0 && <span className="ml-2 text-[#25A9E0]">· {nT} col. tipo</span>}
                            {nU > 0 && <span className="ml-2 text-[#25A9E0]">· {nU} col. unidad</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => abrirModal('categoria', { ...c })} className="p-1.5 text-slate-400 hover:text-[#D81B43] hover:bg-slate-100 rounded-[6px] transition-all"><Edit3 size={13} /></button>
                          <button onClick={() => eliminarCat(c.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-[6px] transition-all"><Trash2 size={13} /></button>
                        </div>
                      </div>
                    )
                  })}
                  {cats.length === 0 && <div className="col-span-full bg-white rounded-xl border border-slate-200 shadow-sm text-center py-12 text-slate-400">Sin categorías configuradas</div>}
                </div>
              </div>
            )}

            {/* TIPOS — maestro-detalle: categorías a la izquierda, tipos de la seleccionada a la derecha */}
            {seccionActiva === 'tipos' && (() => {
              const grupoActivo = tiposPorCategoria.find(g => g.categoria.id === catTiposId)
                || tiposPorCategoria.find(g => g.tipos.length > 0)
                || tiposPorCategoria[0]
              const q = buscarTipo.trim().toLowerCase()
              const tiposVisibles = (grupoActivo?.tipos || []).filter(t =>
                !q || [t.atributos?.nombre, t.nombre].some(v => (v || '').toLowerCase().includes(q)))
              return (
              <div>
                <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                  <div>
                    <h2 className="text-[20px] font-bold text-slate-800">Tipos de equipo</h2>
                    <p className="text-[13px] text-slate-400 mt-0.5">Cada tipo agrupa unidades del mismo modelo</p>
                  </div>
                  <button onClick={() => abrirModal('tipo', grupoActivo ? { categoria_id: grupoActivo.categoria.id } : {})}
                    className="flex items-center gap-1.5 px-4 py-2 bg-[#D81B43] text-white text-[13px] font-semibold rounded-[9px] hover:bg-[#B0172F] transition-colors">
                    <Plus size={14} /> Nuevo tipo
                  </button>
                </div>

                {!grupoActivo ? (
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm text-center py-12 text-slate-400">
                    Primero crea una categoría
                    <button onClick={() => setSeccion('categorias')} className="ml-2 text-[#D81B43] font-medium hover:underline">Ir a Categorías →</button>
                  </div>
                ) : (
                <div className="flex flex-col md:flex-row gap-4 md:items-start">
                  {/* Categorías: columna en escritorio, chips con scroll en móvil */}
                  <div className="w-full md:w-[230px] flex-shrink-0 bg-white rounded-xl border border-slate-200 shadow-sm p-1.5 flex md:flex-col gap-1 overflow-x-auto">
                    {tiposPorCategoria.map(g => {
                      const activa = g.categoria.id === grupoActivo.categoria.id
                      return (
                        <button key={g.categoria.id}
                          onClick={() => { setCatTiposId(g.categoria.id); setTipoExpandido(null); setBuscarTipo('') }}
                          className={`flex items-center justify-between gap-2 px-3 py-2 rounded-[8px] text-left flex-shrink-0 md:flex-shrink transition-all ${activa ? 'bg-[#D81B43]/8 text-[#D81B43]' : 'text-slate-600 hover:bg-slate-50'}`}>
                          <span className="text-[13px] font-semibold whitespace-nowrap md:whitespace-normal md:truncate">{g.categoria.nombre}</span>
                          <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${activa ? 'bg-[#D81B43]/10' : g.tipos.length ? 'bg-slate-100 text-slate-500' : 'bg-slate-50 text-slate-300'}`}>
                            {g.tipos.length}
                          </span>
                        </button>
                      )
                    })}
                  </div>

                  {/* Tipos de la categoría seleccionada */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 md:gap-3 mb-3 flex-wrap">
                      <div className="min-w-0">
                        <div className="text-[15px] font-bold text-slate-800 truncate">{grupoActivo.categoria.nombre}</div>
                        <div className="text-[12px] text-slate-400">
                          {q ? `${tiposVisibles.length} de ${grupoActivo.tipos.length}` : grupoActivo.tipos.length} tipo{grupoActivo.tipos.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                      {grupoActivo.tipos.length > 0 && (
                        <div className="relative w-full sm:w-[240px] sm:ml-auto">
                          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input value={buscarTipo} onChange={e => setBuscarTipo(e.target.value)} placeholder="Buscar modelo o marca..."
                            className="w-full pl-8 pr-3 h-[36px] border border-slate-200 rounded-[8px] text-[13px] outline-none focus:border-[#D81B43] bg-white" />
                        </div>
                      )}
                      <button onClick={() => abrirModal('tipo', { categoria_id: grupoActivo.categoria.id })}
                        className={`flex items-center gap-1 px-3 h-[36px] text-[12.5px] font-semibold text-[#D81B43] border border-[#D81B43]/30 hover:bg-[#D81B43]/5 rounded-[8px] transition-colors flex-shrink-0 ${grupoActivo.tipos.length === 0 ? 'ml-auto' : ''}`}>
                        <Plus size={13} /> Agregar aquí
                      </button>
                    </div>

                    {tiposVisibles.length === 0 ? (
                      <div className="bg-white rounded-xl border border-slate-200 shadow-sm text-center py-12 text-slate-400 text-[13px]">
                        {q ? `Ningún tipo coincide con "${buscarTipo}"` : 'Esta categoría todavía no tiene tipos'}
                      </div>
                    ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3 items-start">
                      {tiposVisibles.map(t => {
                        const cat = grupoActivo.categoria
                        const camposTipo = cat?.atributos_extra?.campos_tipo || []
                        const expanded = tipoExpandido === t.id
                        const nombre = t.atributos?.nombre || t.nombre || '—'
                        const tieneIcono   = t.imagen_url?.startsWith('icono:')
                        const tieneImagen  = t.imagen_url && !tieneIcono
                        const iconoClave   = tieneIcono ? t.imagen_url.replace('icono:', '') : null
                        const iconoCatClave = !t.imagen_url && cat?.imagen_url?.startsWith('icono:')
                          ? cat.imagen_url.replace('icono:', '') : null
                        return (
                          <div key={t.id} className={`bg-white rounded-xl border overflow-hidden transition-shadow ${expanded ? 'border-slate-300 shadow-sm' : 'border-slate-200 hover:border-slate-300'}`}>
                            <div className="flex items-center gap-3 px-3 py-3 cursor-pointer"
                              onClick={() => setTipoExpandido(prev => prev === t.id ? null : t.id)}>
                              <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                                {tieneImagen
                                  ? <img src={t.imagen_url} alt={nombre} className="w-full h-full object-contain p-1" />
                                  : iconoClave
                                  ? <IconoEquipo clave={iconoClave} size={22} color="#D81B43" />
                                  : iconoCatClave
                                  ? <IconoEquipo clave={iconoCatClave} size={20} color="#94A3B8" />
                                  : <Cpu size={16} className="text-slate-300" />
                                }
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-[13.5px] font-bold text-slate-700 truncate">{nombre}</div>
                                {t.nombre && t.nombre !== nombre && <div className="text-[11.5px] text-slate-500 truncate">{t.nombre}</div>}
                                <div className="text-[11px] mt-0.5 truncate">
                                  {t.lista
                                    ? <span className="font-semibold text-[#0F7B55]">✓ {t.lista.nombre}</span>
                                    : <span className="text-slate-400">Sin lista de mantenimiento</span>}
                                </div>
                              </div>
                              <div className="flex items-center gap-0.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                                <button onClick={() => abrirModal('tipo', { ...t, categoria_id: t.categoria_id ?? t.categoria?.id, lista_mantenimiento_id: t.lista_mantenimiento_id ?? t.lista?.id })}
                                  className="p-1.5 text-slate-400 hover:text-[#D81B43] hover:bg-slate-100 rounded-[6px] transition-all"><Edit3 size={13} /></button>
                                <button onClick={() => eliminarTipo(t.id)}
                                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-[6px] transition-all"><Trash2 size={13} /></button>
                              </div>
                              <div className="text-slate-400">
                                {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              </div>
                            </div>
                            {expanded && (
                              <div className="border-t border-slate-200 bg-[#F8FAFC] px-3 py-3">
                                {camposTipo.length > 0 ? (
                                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                                    {camposTipo.map(campo => (
                                      <div key={campo.clave} className="min-w-0">
                                        <div className="text-[10px] font-semibold uppercase text-slate-400 truncate">{campo.nombre}</div>
                                        <div className="text-[13px] font-medium text-slate-700 mt-0.5 break-words">{t.atributos?.[campo.clave] || '—'}</div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="text-[12.5px] text-slate-400">
                                    Esta categoría no tiene columnas del tipo.
                                    <button onClick={() => setSeccion('categorias')} className="ml-2 text-[#D81B43] font-medium hover:underline">Ir a Categorías →</button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    )}
                  </div>
                </div>
                )}
              </div>
              )
            })()}

            {/* LISTAS */}
            {seccionActiva === 'listas' && (
              <div>
                <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                  <div>
                    <h2 className="text-[20px] font-bold text-slate-800">Listas de mantenimiento</h2>
                    <p className="text-[13px] text-slate-400 mt-0.5">Crea listas con actividades y asígnalas a tipos de equipo</p>
                  </div>
                  <button onClick={() => abrirModal('lista', {})}
                    className="flex items-center gap-1.5 px-4 py-2 bg-[#D81B43] text-white text-[13px] font-semibold rounded-[9px] hover:bg-[#B0172F] transition-colors">
                    <Plus size={14} /> Nueva lista
                  </button>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
                  {listas.length === 0 && (
                    <div className="col-span-full bg-white rounded-xl border border-slate-200 shadow-sm text-center py-12 text-slate-400">
                      <ClipboardList size={32} className="mx-auto mb-2 opacity-30" />
                      <div>Sin listas configuradas</div>
                    </div>
                  )}
                  {listas.map(l => {
                    const acts = actividadesDeLista(l.id)
                    const expanded = listaExpandida === l.id
                    return (
                      <div key={l.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-slate-50 transition-colors"
                          onClick={() => setListaExpandida(expanded ? null : l.id)}>
                          <div className="flex-1">
                            <div className="text-[14px] font-bold text-slate-700">{l.nombre}</div>
                            {l.descripcion && <div className="text-[12px] text-slate-400 mt-0.5">{l.descripcion}</div>}
                            <div className="text-[11.5px] text-slate-400 mt-1">
                              {acts.length} actividad{acts.length !== 1 ? 'es' : ''} · {tipos.filter(t => t.lista_mantenimiento_id === l.id).length} tipo{tipos.filter(t => t.lista_mantenimiento_id === l.id).length !== 1 ? 's' : ''} asignado{tipos.filter(t => t.lista_mantenimiento_id === l.id).length !== 1 ? 's' : ''}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                            <button onClick={() => abrirModal('lista', { ...l })} className="p-1.5 text-slate-400 hover:text-[#D81B43] hover:bg-slate-100 rounded-[6px]"><Edit3 size={13} /></button>
                            <button onClick={() => eliminarLista(l.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-[6px]"><Trash2 size={13} /></button>
                          </div>
                          <div className="text-slate-400 ml-1">
                            {expanded
                              ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="18 15 12 9 6 15"/></svg>
                              : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>}
                          </div>
                        </div>
                        {expanded && (
                          <div className="border-t border-slate-100 px-5 py-4">
                            <div className="space-y-2 mb-3">
                              {acts.map((a, i) => (
                                <div key={a.id} className="flex items-center gap-2.5 p-2.5 bg-slate-50 rounded-[8px] border border-slate-200">
                                  <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500 flex-shrink-0">{i + 1}</div>
                                  <span className="flex-1 text-[13px] text-slate-700">{a.nombre}</span>
                                  <button onClick={() => eliminarActividad(a.id)} className="p-1 text-slate-400 hover:text-red-500"><X size={12} /></button>
                                </div>
                              ))}
                              {acts.length === 0 && <div className="text-[12.5px] text-slate-400 text-center py-2">Sin actividades</div>}
                            </div>
                            <div className="flex gap-2">
                              <input value={nuevaActividad} onChange={e => setNuevaActividad(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && agregarActividad(l.id)}
                                placeholder="ej. Limpieza de filtros" className={inputCls} />
                              <button onClick={() => agregarActividad(l.id)}
                                className="px-3 py-2.5 bg-[#D81B43] text-white rounded-[9px] hover:bg-[#B0172F] transition-colors flex-shrink-0">
                                <Plus size={14} />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* EMPRESA */}
            {seccionActiva === 'empresa' && (
              <div>
                <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                  <div>
                    <h2 className="text-[20px] font-bold text-slate-800">Datos de la empresa</h2>
                    <p className="text-[13px] text-slate-400 mt-0.5">Información que aparece en los documentos generados</p>
                  </div>
                  <button onClick={guardarEmpresa} className="flex items-center gap-1.5 px-5 py-2.5 bg-[#D81B43] text-white text-[13px] font-semibold rounded-[9px] hover:bg-[#B0172F] transition-colors">
                    <Save size={14} /> Guardar cambios
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
                  {/* Logo */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                    <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400 mb-3">Logo</div>
                    <div className="h-[150px] rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden mb-3">
                      {empresa.logo_url
                        ? <Image src={empresa.logo_url} alt="Logo" width={240} height={150} className="object-contain max-h-full max-w-full w-auto h-auto p-3" />
                        : <Building2 size={36} className="text-slate-300" />}
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <label className={`flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-[8px] text-[12.5px] font-medium transition-all cursor-pointer w-fit ${subiendoLogo ? 'opacity-50 pointer-events-none text-slate-400' : 'text-slate-600 hover:border-[#D81B43] hover:text-[#D81B43]'}`}>
                        <Upload size={13} /> {subiendoLogo ? 'Subiendo...' : 'Cambiar logo'}
                        <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files[0]; if (f) subirLogo(f); e.target.value = '' }} />
                      </label>
                      {empresa.logo_url && <button onClick={() => setEmpresa(p => ({ ...p, logo_url: null }))} className="text-[12px] text-red-400 hover:text-red-600">Quitar logo</button>}
                    </div>
                    <p className="text-[11.5px] text-slate-400 mt-3">Aparece en el encabezado de actas y documentos.</p>
                  </div>

                  {/* Datos legales y de contacto */}
                  <div className="lg:col-span-2 space-y-4">
                    {[
                      { titulo: 'Datos legales', campos: [
                        { key: 'razon_social', label: 'Razón social', full: true },
                        { key: 'nit', label: 'NIT', placeholder: '900123456-7' },
                        { key: 'rep', label: 'Representante legal' },
                      ] },
                      { titulo: 'Contacto', campos: [
                        { key: 'tel', label: 'Teléfono', placeholder: '300 123 4567' },
                        { key: 'email', label: 'Email', placeholder: 'contacto@empresa.com' },
                        { key: 'dir', label: 'Dirección', full: true },
                        { key: 'web', label: 'Página web', placeholder: 'www.empresa.com', full: true },
                      ] },
                    ].map(bloque => (
                      <div key={bloque.titulo} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                        <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400 mb-3">{bloque.titulo}</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {bloque.campos.map(c => (
                            <div key={c.key} className={c.full ? 'sm:col-span-2' : ''}>
                              <label className={labelCls}>{c.label}</label>
                              <input value={empresa[c.key] || ''} placeholder={c.placeholder}
                                onChange={e => setEmpresa(p => ({ ...p, [c.key]: e.target.value }))} className={inputCls} />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Cláusula de certificación — se incluye en el acta de entrega, en un lugar fijo, antes de las firmas */}
                  <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                    <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400 mb-1">Acta de entrega</div>
                    <div className="text-[12.5px] text-slate-500 mb-3">Cláusula de certificación — siempre aparece en el mismo lugar del acta, justo antes de las firmas.</div>
                    <textarea
                      value={empresa.clausula_certificacion ?? 'El firmante certifica y confirma haber leído los documentos anexos dispuestos previo a la firma de los mismos, por lo cual acepta los términos allí contenidos y confirma la entrega de los equipos relacionados en los estados indicados.'}
                      onChange={e => setEmpresa(p => ({ ...p, clausula_certificacion: e.target.value }))}
                      rows={3}
                      placeholder="Texto de la cláusula..."
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-[9px] text-[13.5px] text-slate-800 outline-none focus:border-[#D81B43] bg-white resize-y placeholder:text-slate-400" />
                  </div>
                </div>
              </div>
            )}

            {/* PLANTILLAS */}
            {seccionActiva === 'plantillas' && (
              <div>
                <h2 className="text-[20px] font-bold text-slate-800 mb-1">Plantillas de documentos</h2>
                <p className="text-[13px] text-slate-400 mb-6">Documentos legales usados en las órdenes de servicio</p>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {plantillas.map(p => (
                    <div key={p.id} className="bg-white rounded-xl border border-slate-200 shadow-sm flex items-center gap-3 px-4 py-3.5 hover:border-slate-300 transition-colors">
                      <div className="w-8 h-8 rounded-[8px] bg-[#D81B43]/10 flex items-center justify-center flex-shrink-0"><FileText size={15} className="text-[#D81B43]" /></div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13.5px] font-semibold text-slate-700 truncate">{p.nombre}</div>
                        {p.descripcion && <div className="text-[12px] text-slate-400 mt-0.5">{p.descripcion}</div>}
                        <div className="text-[11px] text-slate-300 font-mono mt-0.5">v{p.version || '1'}</div>
                      </div>
                      <button onClick={() => previsualizarPlantilla(p)} className="flex-shrink-0 px-3 py-1.5 border border-slate-200 rounded-[7px] text-[12px] font-medium text-slate-600 hover:border-[#D81B43] hover:text-[#D81B43] transition-all">
                        Previsualizar
                      </button>
                    </div>
                  ))}
                  {plantillas.length === 0 && <div className="col-span-full bg-white rounded-xl border border-slate-200 shadow-sm text-center py-12 text-slate-400">Sin plantillas configuradas</div>}
                </div>
              </div>
            )}

            {/* CARGUE */}
            {seccionActiva === 'cargue' && (
              <div>
                <h2 className="text-[20px] font-bold text-slate-800 mb-1">Cargue masivo</h2>
                <p className="text-[13px] text-slate-400 mb-6">Importa equipos y clientes desde archivos CSV</p>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                  <CargueEquipos cats={cats} />
                  <CargueCard titulo="Clientes" tipo="clientes" sub="Importa clientes desde CSV" Icono={Users}
                    cols="tipo_persona, nombre, nit_cc, departamento, municipio, direccion, telefono, email" />
                </div>
              </div>
            )}

            {/* PREFERENCIAS */}
            {seccionActiva === 'preferencias' && (
              <div className="max-w-[860px]">
                <h2 className="text-[20px] font-bold text-slate-800 mb-1">Preferencias</h2>
                <p className="text-[13px] text-slate-400 mb-6">Ajustes de la experiencia en dispositivos móviles</p>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                  <div className="flex items-center gap-2 mb-1">
                    <Smartphone size={16} className="text-slate-400" />
                    <div className="text-[14px] font-bold text-slate-700">Navegación móvil</div>
                  </div>
                  <p className="text-[12.5px] text-slate-400 mb-5">
                    Elige cómo se muestra la barra de navegación en celular. Este ajuste solo aplica en pantallas pequeñas.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Opción: Barra fija */}
                    <button onClick={() => cambiarModoMobile('barra')}
                      className={`text-left p-4 rounded-[12px] border-2 transition-all ${
                        mobileNavMode === 'barra' ? 'border-[#D81B43] bg-[#D81B43]/5' : 'border-slate-200 hover:border-slate-300'
                      }`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-[13px] font-bold text-slate-700">Barra fija</div>
                        {mobileNavMode === 'barra' && <CheckCircle2 size={16} className="text-[#D81B43]" />}
                      </div>
                      <div className="text-[12px] text-slate-500 mb-3">
                        Accesos críticos siempre visibles abajo. Usa flechas laterales para ver más módulos.
                      </div>
                      {/* Mini preview */}
                      <div className="bg-slate-50 border border-slate-200 rounded-[8px] p-2 flex items-center justify-around">
                        <span className="text-slate-300 text-[10px]">‹</span>
                        {[0,1,2,3].map(i => (
                          <div key={i} className={`w-5 h-5 rounded-full ${i === 0 ? 'bg-[#D81B43]/20' : 'bg-slate-200'}`} />
                        ))}
                        <span className="text-slate-300 text-[10px]">›</span>
                      </div>
                    </button>

                    {/* Opción: Acceso Rápido */}
                    <button onClick={() => cambiarModoMobile('flotante')}
                      className={`text-left p-4 rounded-[12px] border-2 transition-all ${
                        mobileNavMode === 'flotante' ? 'border-[#D81B43] bg-[#D81B43]/5' : 'border-slate-200 hover:border-slate-300'
                      }`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-[13px] font-bold text-slate-700">Acceso Rápido</div>
                        {mobileNavMode === 'flotante' && <CheckCircle2 size={16} className="text-[#D81B43]" />}
                      </div>
                      <div className="text-[12px] text-slate-500 mb-3">
                        Botón flotante y arrastrable que despliega todos los módulos en una cuadrícula. Muévelo a donde te quede más cómodo.
                      </div>
                      {/* Mini preview */}
                      <div className="bg-slate-50 border border-slate-200 rounded-[8px] p-2 h-[36px] relative">
                        <div className="absolute bottom-1 right-1 w-6 h-6 rounded-full bg-slate-400/70" />
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* ── MODALES — sin scroll interno, tamaño adaptativo ── */}
      {modal && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm" onClick={() => setModal(null)} />
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
            <div className={`bg-white rounded-t-2xl md:rounded-2xl w-full flex flex-col shadow-2xl overflow-hidden
              ${modal === 'categoria' ? 'max-w-[640px]' : modal === 'tipo' ? 'max-w-[600px]' : 'max-w-[480px]'}
              max-h-[92dvh] md:max-h-[calc(100dvh-2rem)]`}
              onClick={e => e.stopPropagation()}>

              {/* Modal header */}
              <div className="px-6 py-4 border-b flex items-center justify-between flex-shrink-0">
                <h3 className="text-[16px] font-bold text-slate-800">
                  {modal === 'usuario'   ? (form.id ? 'Editar usuario'       : 'Nuevo usuario')        :
                   modal === 'categoria' ? (form.id ? 'Editar categoría'     : 'Nueva categoría')      :
                   modal === 'tipo'      ? (form.id ? 'Editar tipo de equipo': 'Nuevo tipo de equipo') :
                   modal === 'lista'     ? (form.id ? 'Editar lista'         : 'Nueva lista')          : ''}
                </h3>
                <button onClick={() => setModal(null)} className="text-slate-400 hover:text-slate-600 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100"><X size={16} /></button>
              </div>

              {/* Modal body — scroll solo si no cabe en pantalla */}
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

                {/* USUARIO */}
                {modal === 'usuario' && <>
                  <div>
                    <label className={labelCls}>Nombre completo</label>
                    <input value={form.nombre || ''} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} className={inputCls} placeholder="Nombre del usuario" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Correo</label>
                      <input value={form.email || ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={inputCls} type="email" />
                    </div>
                    <div>
                      <label className={labelCls}>Usuario</label>
                      <input value={form.username || ''} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} className={inputCls} />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Rol</label>
                    <select value={form.rol_id || ''} onChange={e => setForm(f => ({ ...f, rol_id: e.target.value }))} className={inputCls}>
                      {rolesAsignables.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>{form.id ? 'Nueva contraseña' : 'Contraseña'} {form.id && <span className="text-slate-300 font-normal normal-case">(opcional)</span>}</label>
                    <div className="relative">
                      <input value={form.password || ''} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                        type={form._showPass ? 'text' : 'password'}
                        className={inputCls} placeholder={form.id ? 'Dejar vacío para no cambiar' : 'Mínimo 6 caracteres'} />
                      <button type="button" onClick={() => setForm(f => ({ ...f, _showPass: !f._showPass }))}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        {form._showPass
                          ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                          : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        }
                      </button>
                    </div>
                  </div>
                </>}

                {/* CATEGORÍA */}
                {modal === 'categoria' && <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Nombre</label>
                      <input value={form.nombre || ''} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} className={inputCls} placeholder="ej. Oxigenoterapia" />
                    </div>
                    <div>
                      <label className={labelCls}>Descripción <span className="text-slate-300 font-normal normal-case">(opcional)</span></label>
                      <input value={form.descripcion || ''} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} className={inputCls} />
                    </div>
                  </div>

                  {/* Galería de iconos para la categoría */}
                  <div>
                    <label className={labelCls}>Ícono de la categoría <span className="text-slate-300 font-normal normal-case">(clic para seleccionar · clic de nuevo para deseleccionar)</span></label>
                    <GaleriaIconos
                      seleccionado={iconoSeleccionado}
                      onSeleccionar={clave => setIconoSeleccionado(prev => prev === clave ? '' : clave)}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 border-t border-slate-100 pt-4">
                    {[
                      { nivel: 'tipo',   label: 'Columnas del tipo',    sub: 'Mismas para todos los modelos' },
                      { nivel: 'unidad', label: 'Columnas de la unidad', sub: 'Varían por unidad individual' },
                    ].map(sec => {
                      const campos = camposModal[`campos_${sec.nivel}`]
                      return (
                        <div key={sec.nivel}>
                          <div className="text-[12px] font-bold text-slate-700 mb-0.5">{sec.label}</div>
                          <div className="text-[11px] text-slate-400 mb-2">{sec.sub}</div>
                          {campos.length > 0 && (
                            <div className="space-y-1.5 mb-2">
                              {campos.map((c, i) => (
                                <div key={i} className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-[8px] border border-slate-200">
                                  <div className="flex-1 min-w-0">
                                    <span className="text-[12px] font-semibold text-slate-700">{c.nombre}</span>
                                    <span className="text-[11px] text-slate-400 ml-1.5">{TIPOS_CAMPO.find(t => t.value === c.tipo)?.label}{c.obligatorio ? ' · req.' : ''}</span>
                                  </div>
                                  <button onClick={() => eliminarCampoModal(sec.nivel, i)} className="p-1 text-slate-400 hover:text-red-500 flex-shrink-0"><X size={11} /></button>
                                </div>
                              ))}
                            </div>
                          )}
                          {nuevoCampo.nivel === sec.nivel ? (
                            <div className="space-y-2 p-3 bg-slate-50 rounded-[9px] border border-slate-200">
                              <input value={nuevoCampo.nombre} onChange={e => setNuevoCampo(p => ({ ...p, nombre: e.target.value }))}
                                onKeyDown={e => e.key === 'Enter' && agregarCampoModal()}
                                placeholder="Nombre del campo"
                                className="w-full px-3 py-2 border border-slate-200 rounded-[8px] text-[13px] outline-none focus:border-[#D81B43] bg-white placeholder:text-slate-400" />
                              <div className="flex gap-2 flex-wrap">
                                <select value={nuevoCampo.tipo} onChange={e => setNuevoCampo(p => ({ ...p, tipo: e.target.value }))}
                                  className="flex-1 min-w-[120px] px-3 py-2 border border-slate-200 rounded-[8px] text-[12.5px] outline-none focus:border-[#D81B43] bg-white">
                                  {TIPOS_CAMPO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                </select>
                                <label className="flex items-center gap-1.5 text-[12px] text-slate-600 cursor-pointer whitespace-nowrap">
                                  <input type="checkbox" checked={nuevoCampo.obligatorio} onChange={e => setNuevoCampo(p => ({ ...p, obligatorio: e.target.checked }))} className="accent-[#D81B43]" />
                                  Requerido
                                </label>
                              </div>
                              {nuevoCampo.tipo === 'lista' && (
                                <input value={nuevoCampo.opciones} onChange={e => setNuevoCampo(p => ({ ...p, opciones: e.target.value }))}
                                  placeholder="opción1, opción2, opción3"
                                  className="w-full px-3 py-2 border border-slate-200 rounded-[8px] text-[12.5px] outline-none focus:border-[#D81B43] bg-white placeholder:text-slate-400" />
                              )}
                              <div className="flex gap-2">
                                <button onClick={agregarCampoModal}
                                  className="flex-1 py-2 bg-[#D81B43] text-white text-[12.5px] font-semibold rounded-[8px] hover:bg-[#B0172F] flex items-center justify-center gap-1">
                                  <Plus size={13} /> Agregar
                                </button>
                                <button onClick={() => setNuevoCampo(p => ({ ...p, nivel: '' }))}
                                  className="px-3 py-2 border border-slate-200 rounded-[8px] text-[12.5px] text-slate-500">Cancelar</button>
                              </div>
                            </div>
                          ) : (
                            <button onClick={() => setNuevoCampo({ nombre: '', tipo: 'texto', obligatorio: false, opciones: '', nivel: sec.nivel })}
                              className="flex items-center gap-1.5 text-[12.5px] font-medium text-[#D81B43] hover:underline">
                              <Plus size={13} /> Agregar campo
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </>}

                {/* TIPO */}
                {modal === 'tipo' && <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Categoría</label>
                      <select value={form.categoria_id || ''}
                        onChange={e => setForm(f => ({ ...f, categoria_id: e.target.value, atributos: {} }))}
                        className={inputCls}>
                        <option value="">Seleccionar...</option>
                        {cats.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Lista de mantenimiento <span className="text-slate-300 font-normal normal-case">(opcional)</span></label>
                      <select value={form.lista_mantenimiento_id || ''} onChange={e => setForm(f => ({ ...f, lista_mantenimiento_id: e.target.value }))} className={inputCls}>
                        <option value="">Sin lista</option>
                        {listas.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Nombre del tipo — siempre visible */}
                  <div>
                    <label className={labelCls}>Nombre del tipo <span className="text-[#D81B43]">*</span></label>
                    <input
                      value={form.atributos?.nombre || ''}
                      onChange={e => setForm(f => ({ ...f, atributos: { ...f.atributos, nombre: e.target.value } }))}
                      placeholder="ej. Concentrador de Oxígeno EverFlo"
                      className={inputCls} />
                  </div>

                  {/* Imagen del tipo */}
                  <div>
                    <label className={labelCls}>Imagen del equipo <span className="text-slate-300 font-normal normal-case">(opcional — foto real del modelo)</span></label>
                    <div className="flex items-center gap-4">
                      {/* Preview */}
                      <div className="w-20 h-20 rounded-xl border-2 border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {imagenTipo
                          ? <img src={URL.createObjectURL(imagenTipo)} alt="preview" className="w-full h-full object-contain p-1" />
                          : imagenTipoUrl
                          ? <img src={imagenTipoUrl} alt="actual" className="w-full h-full object-contain p-1" />
                          : <Cpu size={28} className="text-slate-200" />
                        }
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-[8px] text-[12.5px] font-medium text-slate-600 hover:border-[#D81B43] hover:text-[#D81B43] transition-all cursor-pointer w-fit">
                          <Upload size={13} /> {imagenTipo ? imagenTipo.name.slice(0, 20) + '...' : 'Subir imagen'}
                          <input type="file" accept="image/*" className="hidden"
                            onChange={e => { const f = e.target.files?.[0]; if (f) setImagenTipo(f); e.target.value = '' }} />
                        </label>
                        {(imagenTipo || imagenTipoUrl) && (
                          <button onClick={() => { setImagenTipo(null); setImagenTipoUrl('') }}
                            className="text-[12px] text-red-400 hover:text-red-600 transition-colors text-left">
                            Quitar imagen
                          </button>
                        )}
                        <div className="text-[11px] text-slate-400">JPG, PNG o WEBP · máx. 2MB</div>
                      </div>
                    </div>
                  </div>

                  {/* Campos dinámicos */}
                  {(() => {
                    const cat = cats.find(c => c.id === form.categoria_id)
                    const campos = cat?.atributos_extra?.campos_tipo || []
                    if (!form.categoria_id) return <div className="text-[12.5px] text-slate-400 py-2">Selecciona una categoría para ver sus campos</div>
                    if (campos.length === 0) return (
                      <div className="text-[12.5px] text-slate-400 py-2">
                        Esta categoría no tiene columnas del tipo.
                        <button onClick={() => { setModal(null); setSeccion('categorias') }} className="ml-2 text-[#D81B43] font-medium hover:underline">Configurar →</button>
                      </div>
                    )
                    return (
                      <div className="border-t border-slate-100 pt-3 space-y-3">
                        <div className="text-[11px] font-bold uppercase tracking-[0.07em] text-[#25A9E0]">Columnas del tipo — {cat.nombre}</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {campos.map(campo => (
                            <div key={campo.clave}>
                              <label className={labelCls}>{campo.nombre}{campo.obligatorio && <span className="text-[#D81B43] ml-1">*</span>}</label>
                              {renderCampoForm(campo)}
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })()}
                </>}

                {/* LISTA */}
                {modal === 'lista' && <>
                  <div>
                    <label className={labelCls}>Nombre de la lista</label>
                    <input value={form.nombre || ''} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} className={inputCls} placeholder="ej. Revisión básica concentrador" />
                  </div>
                  <div>
                    <label className={labelCls}>Descripción <span className="text-slate-300 font-normal normal-case">(opcional)</span></label>
                    <input value={form.descripcion || ''} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} className={inputCls} />
                  </div>
                </>}
              </div>

              {/* Modal footer */}
              <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2 flex-shrink-0 bg-white">
                <button onClick={() => setModal(null)} className="px-4 py-2.5 border border-slate-200 rounded-[9px] text-[13px] font-medium text-slate-600 hover:border-slate-300">Cancelar</button>
                <button onClick={
                  modal === 'usuario'   ? guardarUsuario :
                  modal === 'categoria' ? guardarCat     :
                  modal === 'tipo'      ? guardarTipo    :
                  guardarLista
                } disabled={saving || subiendoImagen}
                  className="px-5 py-2.5 bg-[#D81B43] text-white rounded-[9px] text-[13px] font-semibold hover:bg-[#B0172F] disabled:opacity-50">
                  {subiendoImagen ? 'Subiendo imagen...' : saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {toast && (
        <div className={`fixed bottom-28 md:bottom-6 right-4 md:right-6 left-4 md:left-auto text-center md:text-left z-50 px-4 py-3 rounded-[10px] text-[13px] font-medium text-white shadow-lg ${toast.tipo === 'error' ? 'bg-red-500' : 'bg-[#0F7B55]'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
