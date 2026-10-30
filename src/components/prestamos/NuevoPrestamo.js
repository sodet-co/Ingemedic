'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, X, Check, Plus, ChevronDown, ChevronLeft, User, Building, Truck, Store, FileText, RotateCcw, Eye, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { registrarBitacora } from '@/lib/bitacora'
import { paraGuardar, hoyBogota, formatear, formatearSoloFecha } from '@/lib/fechas'
import { buscarCedulaDuplicada, mensajeCedulaDuplicada, esErrorCedulaDuplicada, MENSAJE_CEDULA_DUPLICADA } from '@/lib/pacientes'
import { plantillasSugeridas, plantillasOfrecidas } from '@/lib/actas/acciones'
import { DATOS_ACTA_VACIO, leerDatosActa, camposPedidos, camposVacios } from '@/lib/actas/campos'
import { construirContexto, paraPlantilla } from '@/lib/actas/contexto'
import LlenarFormatos, { VentanaLlenarFormatos } from '@/components/actas/LlenarFormatos'
import PreviaActas from '@/components/actas/PreviaActas'
import ControlVigencia from '@/components/prestamos/ControlVigencia'
import SelectorEquiposPrestamo from '@/components/prestamos/SelectorEquiposPrestamo'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { ui } from '@/lib/ui'

// Asistente de préstamo nuevo, un paso a la vez:
//   1 Cliente y paciente · 2 Equipos · 3 Entrega · 4 Formatos · 5 Confirmación
// En Formatos se eligen las plantillas y se llenan los datos que piden
// mirando la hoja (LlenarFormatos): al repartidor solo le quedan las firmas.
// Pensado para el caso del día a día (94% con paciente, 96% en oficina, 1–2
// equipos): el paciente viene activado y la entrega por defecto es en oficina.
// Los equipos se eligen con el selector de siempre (SelectorEquiposPrestamo,
// pedido del cliente). El formulario se guarda
// como borrador en este navegador mientras se llena (localStorage) y se puede
// retomar si se sale o se recarga la página.

const inputCls = 'w-full px-3 py-2.5 border border-slate-200 rounded-[9px] text-[16px] md:text-[13.5px] text-slate-800 outline-none focus:border-[#D81B43] bg-white transition-colors placeholder:text-slate-400'
const labelCls = 'block text-[11px] font-bold uppercase tracking-[0.07em] text-slate-500 mb-1.5'
const TIPOS_DOC = ['CC', 'TI', 'RC', 'CE', 'PA']
const PASOS = ['Cliente y paciente', 'Equipos', 'Entrega', 'Formatos', 'Confirmación']
const CLAVE_BORRADOR = 'ingemedic.borradorPrestamo'

export const PACIENTE_VACIO = { nombre: '', cedula: '', tipo_documento: 'CC', direccion: '', barrio: '', ciudad: '', telefono: '', correo: '', eps: '', fecha_nacimiento: '' }

const FORM_VACIO = {
  cliente_id: '', sinPaciente: false, paciente_id: '', paciente: { ...PACIENTE_VACIO }, pacienteNuevo: false,
  diagnostico: '', equipos_ids: [],
  modo: 'oficina', fecha_oficina: '', fecha_domicilio: '', repartidor_id: '', inicioDistinto: false, fecha_inicio: '',
  fecha_vigencia: null, observaciones: '', plantillas_acta: [], formatos_a_mano: false, datos_acta: DATOS_ACTA_VACIO,
}

const nombreEquipo = eq => eq?.tipo_equipo?.atributos?.nombre || eq?.tipo_equipo?.nombre || '—'
const leerBorrador = () => { try { return JSON.parse(localStorage.getItem(CLAVE_BORRADOR) || 'null') } catch { return null } }
const borrarBorrador = () => { try { localStorage.removeItem(CLAVE_BORRADOR) } catch { /* sin almacenamiento */ } }
const tieneDatos = f => !!(f.cliente_id || f.equipos_ids.length || f.paciente.nombre)

function Campo({ label, requerido, error, children, className = '' }) {
  return (
    <div className={className}>
      <label className={labelCls}>{label}{requerido && <span className="text-[#D81B43] ml-0.5">*</span>}</label>
      {children}
      {error && <div className="text-[12px] text-[#D81B43] mt-1">{error}</div>}
    </div>
  )
}

export default function NuevoPrestamo({
  clientes, pacientes, equipos, categorias, tiposEquipo, plantillas, repartidores, estados, estadosEquipo, tipos,
  usoClientes = {}, onSalir, onCreado,
}) {
  const supabase = useMemo(() => createClient(), [])
  const [f, setF] = useState(() => ({ ...FORM_VACIO, fecha_oficina: hoyBogota() }))
  const [paso, setPaso] = useState(0)
  const [errores, setErrores] = useState({})
  const [guardando, setGuardando] = useState(false)
  const [errorGeneral, setErrorGeneral] = useState(null)
  const [borrador, setBorrador] = useState(null) // borrador encontrado al abrir, pendiente de decidir
  const [confirmarDescarte, setConfirmarDescarte] = useState(false)
  const contenidoRef = useRef(null)
  const set = (k, v) => setF(x => ({ ...x, [k]: v }))
  const setPac = (k, v) => setF(x => ({ ...x, paciente: { ...x.paciente, [k]: v } }))

  // ── Borrador (H) ─────────────────────────────────────────
  useEffect(() => {
    const b = leerBorrador()
    if (b?.f && tieneDatos(b.f)) { const t = setTimeout(() => setBorrador(b), 0); return () => clearTimeout(t) }
  }, [])
  useEffect(() => {
    if (borrador || !tieneDatos(f)) return
    const t = setTimeout(() => {
      try { localStorage.setItem(CLAVE_BORRADOR, JSON.stringify({ f, paso, guardado: new Date().toISOString() })) } catch { /* sin almacenamiento */ }
    }, 400)
    return () => clearTimeout(t)
  }, [f, paso, borrador])

  const disponibles = useMemo(() => equipos.filter(e => e.estado?.nombre === 'Disponible'), [equipos])
  const idsDisponibles = useMemo(() => new Set(disponibles.map(e => e.id)), [disponibles])

  function retomarBorrador() {
    // Lo que entretanto se prestó o entró a mantenimiento sale del carrito
    const quitados = borrador.f.equipos_ids.filter(id => !idsDisponibles.has(id))
    setF({ ...FORM_VACIO, ...borrador.f, datos_acta: leerDatosActa(borrador.f.datos_acta), equipos_ids: borrador.f.equipos_ids.filter(id => idsDisponibles.has(id)) })
    setPaso(Math.min(borrador.paso || 0, quitados.length ? 1 : PASOS.length - 1))
    if (quitados.length) setErrorGeneral(`${quitados.length} equipo(s) del borrador ya no están disponibles y se quitaron.`)
    setBorrador(null)
  }
  function descartarBorrador() { borrarBorrador(); setBorrador(null) }

  // ── Paso 1: cliente y paciente (C) ───────────────────────
  const [buscarCliente, setBuscarCliente] = useState('')
  const [buscarPaciente, setBuscarPaciente] = useState('')
  const [masDatos, setMasDatos] = useState(false)
  const clienteSel = clientes.find(c => c.id === f.cliente_id)
  const clientesFrecuentes = useMemo(() => [...clientes].sort((a, b) => (usoClientes[b.id] || 0) - (usoClientes[a.id] || 0)).slice(0, 3), [clientes, usoClientes])
  const clientesFiltrados = useMemo(() => {
    const q = buscarCliente.trim().toLowerCase()
    return q ? clientes.filter(c => [c.nombre, c.nit_cc].some(v => v?.toLowerCase().includes(q))) : clientes
  }, [clientes, buscarCliente])
  const pacientesEncontrados = useMemo(() => {
    const q = buscarPaciente.trim().toLowerCase()
    if (q.length < 2) return []
    return pacientes.filter(p => [p.nombre, p.cedula].some(v => v?.toLowerCase().includes(q))).slice(0, 8)
  }, [pacientes, buscarPaciente])

  function elegirCliente(id) {
    setF(x => ({ ...x, cliente_id: id, formatos_a_mano: false, plantillas_acta: plantillasSugeridas(plantillas, id, 'prestamo', unidadesDe(x.equipos_ids)) }))
    setBuscarCliente('')
    setErrores(e => ({ ...e, cliente: null }))
  }
  function elegirPaciente(p) {
    setF(x => ({ ...x, pacienteNuevo: false, paciente_id: p.id, paciente: {
      ...PACIENTE_VACIO, ...Object.fromEntries(Object.keys(PACIENTE_VACIO).map(k => [k, p[k] || PACIENTE_VACIO[k]])),
    } }))
    setBuscarPaciente('')
    setErrores(e => ({ ...e, paciente: null }))
  }
  function pacienteNuevo() {
    setF(x => ({ ...x, pacienteNuevo: true, paciente_id: '', paciente: { ...PACIENTE_VACIO, nombre: /\d/.test(buscarPaciente) ? '' : buscarPaciente, cedula: /^\d+$/.test(buscarPaciente.trim()) ? buscarPaciente.trim() : '' } }))
    setBuscarPaciente('')
  }
  function quitarPaciente() { setF(x => ({ ...x, pacienteNuevo: false, paciente_id: '', paciente: { ...PACIENTE_VACIO } })) }
  const conPaciente = !f.sinPaciente
  const editandoPaciente = f.pacienteNuevo || !!f.paciente_id

  // ── Paso 2: equipos (E) ──────────────────────────────────
  const unidadesDe = ids => ids.map(id => equipos.find(e => e.id === id)).filter(Boolean)
  const carrito = unidadesDe(f.equipos_ids)

  // Los formatos sugeridos dependen de los equipos (F-FAM-11 de CPAP, oxígeno…):
  // se vuelven a sugerir al cambiar el carrito, salvo que ya se hayan elegido a mano
  function alternarEquipo(id) {
    setF(x => {
      const equipos_ids = x.equipos_ids.includes(id) ? x.equipos_ids.filter(i => i !== id) : [...x.equipos_ids, id]
      const plantillas_acta = x.cliente_id && !x.formatos_a_mano ? plantillasSugeridas(plantillas, x.cliente_id, 'prestamo', unidadesDe(equipos_ids)) : x.plantillas_acta
      return { ...x, equipos_ids, plantillas_acta }
    })
    setErrores(e => ({ ...e, equipos: null }))
  }
  // ── Paso 3: entrega (F) ──────────────────────────────────
  const repartidorSel = repartidores.find(r => r.id === f.repartidor_id)

  // ── Paso 4: formatos ─────────────────────────────────────
  const elegidas = useMemo(() => f.plantillas_acta.map(id => plantillas.find(p => p.id === id)).filter(Boolean), [f.plantillas_acta, plantillas])
  const valoresFormatos = { paciente: f.paciente, diagnostico: f.diagnostico, acta: f.sinPaciente ? { ...f.datos_acta, recibe: { ...f.datos_acta.recibe, esPaciente: false } } : f.datos_acta }
  const faltantes = useMemo(() => camposVacios(camposPedidos(elegidas, { conPaciente: conPaciente }).campos, valoresFormatos).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [elegidas, conPaciente, f.paciente, f.diagnostico, f.datos_acta, f.sinPaciente])
  const [previa, setPrevia] = useState(null) // filas de la vista previa abierta
  const [llenando, setLlenando] = useState(false) // ventana grande de llenar formatos

  // Los formatos tal como quedarán (sin firmas), para revisarlos antes de crear
  const contextoFormatos = (acta = valoresFormatos.acta) => construirContexto({
    orden: { diagnostico: f.diagnostico, cliente: clienteSel, paciente: conPaciente ? f.paciente : null },
    equipos: carrito,
    datos: { ...acta, fecha: (f.modo === 'oficina' ? f.fecha_oficina && f.fecha_oficina + 'T12:00:00' : f.fecha_domicilio) || undefined },
  })
  function filasPrevia() {
    const ctx = contextoFormatos()
    return elegidas.map(p => ({ id: p.id, nombre: p.nombre, bloques: p.bloques, datos: paraPlantilla(ctx, p), firma_recibe: null, firma_entrega: null }))
  }
  // Lo que la hoja necesita además de lo que se escribe (LlenarFormatos)
  const fechaFormatos = (f.modo === 'oficina' ? f.fecha_oficina && f.fecha_oficina + 'T12:00:00' : f.fecha_domicilio) || undefined
  const baseFormatos = useMemo(() => ({ orden: { cliente: clienteSel }, equipos: carrito, fecha: fechaFormatos }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clienteSel, f.equipos_ids, fechaFormatos])

  // ── Validación por paso, con el error junto a su campo ──
  function validar(p) {
    const e = {}
    if (p === 0) {
      if (!f.cliente_id) e.cliente = 'Elige el cliente'
      if (conPaciente) {
        if (!editandoPaciente) e.paciente = 'Busca el paciente o crea uno nuevo (o marca "sin paciente")'
        else {
          if (!f.paciente.nombre.trim()) e.pac_nombre = 'Escribe el nombre'
          if (!f.paciente.direccion.trim()) e.pac_direccion = 'La dirección es obligatoria'
          const dup = buscarCedulaDuplicada(pacientes, f.paciente.cedula, f.paciente_id || null)
          if (dup) e.pac_cedula = mensajeCedulaDuplicada(dup)
        }
      }
    }
    if (p === 1 && f.equipos_ids.length === 0) e.equipos = 'Agrega al menos un equipo'
    if (p === 2) {
      if (f.modo === 'oficina' && !f.fecha_oficina) e.fecha = 'Elige la fecha de entrega'
      if (f.modo === 'domicilio') {
        if (!f.repartidor_id) e.repartidor = 'Elige el repartidor'
        if (!f.fecha_domicilio) e.fecha = 'Elige la fecha y hora de entrega'
        if (f.inicioDistinto && !f.fecha_inicio) e.inicio = 'Elige la fecha de inicio'
      }
    }
    if (p === 3 && !f.plantillas_acta.some(id => plantillas.find(x => x.id === id)?.tipo !== 'anexo')) e.formatos = 'Elige al menos un formato de entrega'
    return e
  }

  function irA(destino) {
    if (destino > paso) {
      for (let p = paso; p < destino; p++) {
        const e = validar(p)
        if (Object.keys(e).length) { setErrores(e); setPaso(p); return }
      }
    }
    setErrores({}); setErrorGeneral(null); setPaso(destino)
    contenidoRef.current?.scrollTo({ top: 0 })
  }

  // ── Crear ────────────────────────────────────────────────
  async function crear() {
    const e = validar(3)
    if (Object.keys(e).length) { setErrores(e); return }
    setGuardando(true); setErrorGeneral(null)
    const fallo = msg => { setErrorGeneral(msg); setGuardando(false) }

    const tipoOrden = tipos.find(t => /arrendamiento|préstamo|prestamo/i.test(t.nombre || ''))
    if (!tipoOrden) return fallo('No se encontró el tipo de orden de préstamo/arrendamiento')

    // La lista se cargó al abrir la página: si entretanto a un equipo lo prestaron o
    // le abrieron un mantenimiento, no se presta
    const { data: actuales, error: errEst } = await supabase.from('equipos').select('codigo, estado:estados_equipo(nombre)').in('id', f.equipos_ids)
    if (errEst) return fallo('Error verificando los equipos: ' + errEst.message)
    const ocupados = (actuales || []).filter(x => x.estado?.nombre !== 'Disponible')
    if (ocupados.length) { setPaso(1); return fallo(`Ya no está disponible: ${ocupados.map(x => `${x.codigo} (${x.estado?.nombre})`).join(', ')}`) }

    let pacienteId = null
    if (conPaciente) {
      const p = f.paciente
      const datos = {
        nombre: p.nombre.trim(), cedula: p.cedula.trim() || null, direccion: p.direccion.trim(),
        ciudad: p.ciudad.trim() || null, telefono: p.telefono.trim() || null, correo: p.correo.trim() || null,
        tipo_documento: p.tipo_documento || 'CC', barrio: p.barrio.trim() || null, eps: p.eps.trim() || null,
        fecha_nacimiento: p.fecha_nacimiento || null,
      }
      const res = f.paciente_id
        ? await supabase.from('pacientes').update(datos).eq('id', f.paciente_id).select('id').single()
        : await supabase.from('pacientes').insert(datos).select('id').single()
      if (res.error) { setPaso(0); return fallo(esErrorCedulaDuplicada(res.error) ? MENSAJE_CEDULA_DUPLICADA : 'Error guardando el paciente: ' + res.error.message) }
      pacienteId = res.data.id
    }

    const domicilio = f.modo === 'domicilio'
    const estadoInicial = estados.find(x => x.nombre === (domicilio ? 'Programada' : 'Entregada'))
    if (!estadoInicial) return fallo('No se encontraron los estados de orden (Programada/Entregada)')
    const notaInicio = domicilio && f.inicioDistinto && f.fecha_inicio
      ? `[Inicio: ${f.fecha_inicio}]${f.observaciones ? ' ' + f.observaciones : ''}`
      : f.observaciones.trim() || null

    const { data: orden, error: errOrden } = await supabase.from('ordenes_servicio').insert({
      tipo_orden_id: tipoOrden.id, cliente_id: f.cliente_id, paciente_id: pacienteId,
      estado_id: estadoInicial.id, repartidor_id: domicilio ? f.repartidor_id : null,
      fecha_entrega: paraGuardar(domicilio ? f.fecha_domicilio : f.fecha_oficina),
      observaciones: notaInicio, fecha_vigencia: f.fecha_vigencia || null,
      diagnostico: f.diagnostico.trim() || null, plantillas_acta: f.plantillas_acta,
      datos_acta: valoresFormatos.acta,
    }).select('id, codigo').single()
    if (errOrden) return fallo('Error: ' + errOrden.message)

    const estadoEquipo = estadosEquipo.find(x => x.nombre === (domicilio ? 'Reservado' : 'En préstamo'))
    for (const equipoId of f.equipos_ids) {
      const { error } = await supabase.from('orden_equipos').insert({
        orden_id: orden.id, equipo_id: equipoId, fecha_entrega: domicilio ? null : paraGuardar(f.fecha_oficina),
      })
      if (error) return fallo('Error vinculando equipo: ' + error.message)
      if (estadoEquipo) {
        await supabase.from('equipos').update({ estado_id: estadoEquipo.id, paciente_actual_id: pacienteId, cliente_actual_id: f.cliente_id }).eq('id', equipoId)
      }
    }

    registrarBitacora({
      modulo: 'ordenes', accion: 'crear', entidad: 'préstamo', entidad_id: orden.id,
      detalle: { cliente_id: f.cliente_id, equipos_ids: f.equipos_ids, con_domicilio: domicilio, fecha_vigencia: f.fecha_vigencia || null },
    })
    borrarBorrador()
    setGuardando(false)
    onCreado({ id: orden.id, codigo: orden.codigo, domicilio })
  }

  function salir() {
    // El borrador queda guardado: se puede retomar la próxima vez
    onSalir(tieneDatos(f))
  }

  // ── Render ───────────────────────────────────────────────
  // Solo se ofrecen las plantillas de préstamo del cliente, las de uso general y la
  // de Ingemedic (Configuración → Plantillas → Clientes); así la lista no crece con cada cliente
  const ofrecidas = plantillasOfrecidas(plantillas, f.cliente_id, 'prestamo', f.plantillas_acta)
  const formatosEntrega = ofrecidas.filter(p => (p.tipo || 'entrega') === 'entrega')
  const anexos = ofrecidas.filter(p => p.tipo === 'anexo')

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Pasos */}
      <div className="flex-shrink-0 bg-white border-b border-slate-200 px-3 md:px-6 py-3">
        <div className="flex items-center gap-3 max-w-[1100px] mx-auto">
          <button onClick={salir} className="flex items-center gap-1 text-[12.5px] font-medium text-slate-500 hover:text-slate-700 flex-shrink-0">
            <ChevronLeft size={15} /> <span className="hidden sm:inline">Salir</span>
          </button>
          <ol className="flex-1 flex items-center gap-1.5 md:gap-2 min-w-0">
            {PASOS.map((nombre, i) => (
              <li key={nombre} className="flex items-center gap-1.5 md:gap-2 min-w-0 flex-1 last:flex-none">
                <button type="button" onClick={() => irA(i)} disabled={guardando}
                  className="flex items-center gap-2 min-w-0" aria-current={i === paso ? 'step' : undefined}>
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${
                    i < paso ? 'bg-[#0F7B55] text-white' : i === paso ? 'bg-[#D81B43] text-white' : 'bg-slate-100 text-slate-400'}`}>
                    {i < paso ? <Check size={12} strokeWidth={3} /> : i + 1}
                  </span>
                  <span className={`text-[12.5px] font-semibold truncate ${i === paso ? 'text-slate-800' : 'text-slate-400'} ${i === paso ? '' : 'hidden lg:inline'}`}>{nombre}</span>
                </button>
                {i < PASOS.length - 1 && <span className={`h-[2px] flex-1 rounded-full ${i < paso ? 'bg-[#0F7B55]/40' : 'bg-slate-100'}`} />}
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div ref={contenidoRef} className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-[1100px] mx-auto p-3 md:p-6 space-y-4">
          {borrador && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 bg-[#FFFBEB] border border-amber-200 rounded-xl">
              <RotateCcw size={16} className="text-amber-600 flex-shrink-0 hidden sm:block" />
              <div className="flex-1 text-[13px] text-amber-900">
                Tienes un préstamo sin terminar
                {borrador.f.cliente_id && <> para <b>{clientes.find(c => c.id === borrador.f.cliente_id)?.nombre}</b></>}
                {borrador.f.equipos_ids.length > 0 && <> con {borrador.f.equipos_ids.length} equipo(s)</>}
                <span className="text-amber-700"> · {formatear(borrador.guardado, { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={retomarBorrador} className="px-3 py-1.5 bg-amber-600 text-white rounded-[8px] text-[12.5px] font-semibold hover:bg-amber-700">Retomar</button>
                <button onClick={descartarBorrador} className="px-3 py-1.5 border border-amber-300 text-amber-800 rounded-[8px] text-[12.5px] font-semibold hover:bg-amber-100">Empezar de cero</button>
              </div>
            </div>
          )}

          {errorGeneral && <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-[13px] text-red-700">{errorGeneral}</div>}

          {/* ── PASO 1: CLIENTE Y PACIENTE ── */}
          {paso === 0 && (
            <>
              <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 md:p-6">
                <div className="flex items-center gap-2 text-[14px] font-bold text-slate-800 mb-4"><Building size={16} className="text-[#1B3A6B]" /> Cliente</div>
                {clienteSel ? (
                  <div className="flex items-center gap-3 px-4 py-3 bg-[#1B3A6B]/[0.04] border border-[#1B3A6B]/20 rounded-[10px]">
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-bold text-slate-800 truncate">{clienteSel.nombre}</div>
                      {clienteSel.nit_cc && <div className="text-[12px] text-slate-500">{clienteSel.nit_cc}</div>}
                    </div>
                    <button onClick={() => set('cliente_id', '')} className="text-[12.5px] font-semibold text-[#1B3A6B] hover:underline">Cambiar</button>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {clientesFrecuentes.map(c => (
                        <button key={c.id} onClick={() => elegirCliente(c.id)}
                          className="px-3 py-1.5 rounded-full border border-slate-200 text-[12.5px] font-semibold text-slate-600 hover:border-[#D81B43] hover:text-[#D81B43]">{c.nombre}</button>
                      ))}
                    </div>
                    <div className="relative mb-2">
                      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input value={buscarCliente} onChange={e => setBuscarCliente(e.target.value)} placeholder="Buscar cliente por nombre o NIT…"
                        className={`${inputCls} pl-9`} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 max-h-[220px] overflow-y-auto">
                      {clientesFiltrados.map(c => (
                        <button key={c.id} onClick={() => elegirCliente(c.id)}
                          className="text-left px-3 py-2.5 rounded-[9px] border border-slate-200 hover:border-[#D81B43]/50 hover:bg-slate-50 text-[13px] font-medium text-slate-700 truncate">{c.nombre}</button>
                      ))}
                    </div>
                    {errores.cliente && <div className="text-[12px] text-[#D81B43] mt-2">{errores.cliente}</div>}
                  </>
                )}
              </section>

              <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 md:p-6">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2 text-[14px] font-bold text-slate-800"><User size={16} className="text-[#1B3A6B]" /> Paciente</div>
                  <label className="flex items-center gap-2 text-[12.5px] text-slate-500 cursor-pointer">
                    <input type="checkbox" checked={f.sinPaciente} onChange={e => { set('sinPaciente', e.target.checked); setErrores(x => ({ ...x, paciente: null })) }} />
                    Sin paciente (institución)
                  </label>
                </div>

                {f.sinPaciente ? (
                  <div className="text-[13px] text-slate-400">El préstamo queda a nombre del cliente, sin paciente.</div>
                ) : !editandoPaciente ? (
                  <>
                    <div className="relative">
                      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input value={buscarPaciente} onChange={e => setBuscarPaciente(e.target.value)} autoFocus={!!clienteSel}
                        placeholder="Buscar paciente por nombre o cédula…" className={`${inputCls} pl-9`} />
                    </div>
                    {pacientesEncontrados.length > 0 && (
                      <div className="mt-2 border border-slate-200 rounded-[10px] divide-y divide-slate-100 overflow-hidden">
                        {pacientesEncontrados.map(p => (
                          <button key={p.id} onClick={() => elegirPaciente(p)} className="w-full text-left px-4 py-2.5 hover:bg-slate-50">
                            <div className="text-[13.5px] font-semibold text-slate-800 truncate">{p.nombre}</div>
                            <div className="text-[12px] text-slate-500 truncate">{[p.cedula && `${p.tipo_documento || 'CC'} ${p.cedula}`, p.direccion, p.ciudad].filter(Boolean).join(' · ') || 'Sin datos'}</div>
                          </button>
                        ))}
                      </div>
                    )}
                    {buscarPaciente.trim().length >= 2 && pacientesEncontrados.length === 0 && (
                      <div className="mt-2 text-[12.5px] text-slate-400">No hay pacientes con «{buscarPaciente.trim()}».</div>
                    )}
                    <button onClick={pacienteNuevo} className="mt-3 flex items-center gap-1.5 text-[13px] font-semibold text-[#D81B43] hover:underline">
                      <Plus size={14} /> Paciente nuevo{buscarPaciente.trim() && !/^\d+$/.test(buscarPaciente.trim()) ? `: ${buscarPaciente.trim()}` : ''}
                    </button>
                    {errores.paciente && <div className="text-[12px] text-[#D81B43] mt-2">{errores.paciente}</div>}
                  </>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-3 px-3 py-2 bg-slate-50 rounded-[9px] text-[12.5px]">
                      <span className="text-slate-500">{f.pacienteNuevo ? 'Paciente nuevo' : 'Paciente existente · puedes corregir sus datos'}</span>
                      <button onClick={quitarPaciente} className="font-semibold text-[#1B3A6B] hover:underline flex-shrink-0">Cambiar</button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Campo label="Nombre" requerido error={errores.pac_nombre} className="sm:col-span-2">
                        <input value={f.paciente.nombre} onChange={e => setPac('nombre', e.target.value)} className={inputCls} />
                      </Campo>
                      <Campo label="Documento" error={errores.pac_cedula}>
                        <div className="flex gap-2">
                          <select value={f.paciente.tipo_documento} onChange={e => setPac('tipo_documento', e.target.value)} className={`${inputCls} !w-[80px] flex-shrink-0`}>
                            {TIPOS_DOC.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                          <input value={f.paciente.cedula} inputMode="numeric" onChange={e => setPac('cedula', e.target.value.replace(/[^0-9]/g, ''))} className={inputCls} />
                        </div>
                      </Campo>
                      <Campo label="Teléfono">
                        <input value={f.paciente.telefono} inputMode="tel" onChange={e => setPac('telefono', e.target.value)} className={inputCls} />
                      </Campo>
                      <Campo label="Dirección" requerido error={errores.pac_direccion}>
                        <input value={f.paciente.direccion} onChange={e => setPac('direccion', e.target.value)} className={inputCls} />
                      </Campo>
                      <Campo label="Ciudad">
                        <input value={f.paciente.ciudad} onChange={e => setPac('ciudad', e.target.value)} className={inputCls} />
                      </Campo>
                    </div>
                    <div className="border-t border-slate-100 pt-3">
                      <button type="button" onClick={() => setMasDatos(v => !v)} className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-600">
                        <ChevronDown size={15} className={`transition-transform ${masDatos ? 'rotate-180' : ''}`} /> Datos para los formatos
                        <span className="font-normal text-slate-400">· EPS, barrio, nacimiento, diagnóstico</span>
                      </button>
                      {masDatos && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                          <Campo label="EPS"><input value={f.paciente.eps} onChange={e => setPac('eps', e.target.value)} className={inputCls} /></Campo>
                          <Campo label="Barrio"><input value={f.paciente.barrio} onChange={e => setPac('barrio', e.target.value)} className={inputCls} /></Campo>
                          <Campo label="Fecha de nacimiento"><input type="date" value={f.paciente.fecha_nacimiento} onChange={e => setPac('fecha_nacimiento', e.target.value)} className={inputCls} /></Campo>
                          <Campo label="Correo"><input type="email" value={f.paciente.correo} onChange={e => setPac('correo', e.target.value)} className={inputCls} /></Campo>
                          <Campo label="Diagnóstico (Dx)" className="sm:col-span-2"><input value={f.diagnostico} placeholder="Ej.: G473 Apnea del sueño" onChange={e => set('diagnostico', e.target.value)} className={inputCls} /></Campo>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </section>
            </>
          )}

          {/* ── PASO 2: EQUIPOS (selector de siempre, pedido del cliente) ── */}
          {paso === 1 && (
            <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 md:p-6">
              {errores.equipos && <div className="text-[12px] text-[#D81B43] mb-3">{errores.equipos}</div>}
              <SelectorEquiposPrestamo equipos={equipos} categorias={categorias} tiposEquipo={tiposEquipo}
                seleccionados={f.equipos_ids}
                onAgregar={id => { if (!f.equipos_ids.includes(id)) alternarEquipo(id) }}
                onQuitar={id => { if (f.equipos_ids.includes(id)) alternarEquipo(id) }} />
            </section>
          )}

          {/* ── PASO 3: ENTREGA ── */}
          {paso === 2 && (
            <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 md:p-6 space-y-5 max-w-[720px]">
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-[12px]" role="radiogroup" aria-label="Tipo de entrega">
                {[['oficina', 'En oficina', Store, 'El equipo sale hoy de la bodega'], ['domicilio', 'A domicilio', Truck, 'Lo lleva un repartidor']].map(([v, l, Icono, sub]) => (
                  <button key={v} role="radio" aria-checked={f.modo === v} onClick={() => { set('modo', v); setErrores({}) }}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-[9px] text-left transition-all ${f.modo === v ? 'bg-white shadow-sm' : 'text-slate-500'}`}>
                    <Icono size={18} className={f.modo === v ? 'text-[#D81B43]' : ''} />
                    <span className="min-w-0">
                      <span className={`block text-[13.5px] font-bold ${f.modo === v ? 'text-slate-800' : ''}`}>{l}</span>
                      <span className="block text-[11.5px] text-slate-400 truncate">{sub}</span>
                    </span>
                  </button>
                ))}
              </div>

              {f.modo === 'oficina' ? (
                <Campo label="Fecha de entrega" requerido error={errores.fecha}>
                  <input type="date" value={f.fecha_oficina} onChange={e => set('fecha_oficina', e.target.value)} className={inputCls} />
                </Campo>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Campo label="Repartidor" requerido error={errores.repartidor}>
                    <select value={f.repartidor_id} onChange={e => set('repartidor_id', e.target.value)} className={inputCls}>
                      <option value="">Seleccionar…</option>
                      {repartidores.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                    </select>
                  </Campo>
                  <Campo label="Fecha y hora de entrega" requerido error={errores.fecha}>
                    <input type="datetime-local" value={f.fecha_domicilio} onChange={e => set('fecha_domicilio', e.target.value)} className={inputCls} />
                  </Campo>
                  <label className="sm:col-span-2 flex items-center gap-2 text-[12.5px] text-slate-600 cursor-pointer">
                    <input type="checkbox" checked={f.inicioDistinto} onChange={e => set('inicioDistinto', e.target.checked)} />
                    El préstamo empieza otro día (no el de la entrega)
                  </label>
                  {f.inicioDistinto && (
                    <Campo label="Fecha de inicio del préstamo" requerido error={errores.inicio}>
                      <input type="date" value={f.fecha_inicio} onChange={e => set('fecha_inicio', e.target.value)} className={inputCls} />
                    </Campo>
                  )}
                </div>
              )}

              <div className="pt-4 border-t border-slate-100">
                <ControlVigencia value={f.fecha_vigencia} onChange={v => set('fecha_vigencia', v)} />
              </div>

              <Campo label="Observaciones">
                <textarea value={f.observaciones} onChange={e => set('observaciones', e.target.value)} rows={3}
                  placeholder="Notas del préstamo…" className={`${inputCls} resize-none`} />
              </Campo>
            </section>
          )}

          {/* ── PASO 4: FORMATOS (elegirlos arriba y llenarlos mirando la hoja) ── */}
          {paso === 3 && (
            <div className="space-y-3">
              <section className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex items-center gap-1.5 text-[13px] font-bold text-slate-800 mr-1"><FileText size={15} className="text-[#1B3A6B]" /> Formatos</span>
                  {[...formatosEntrega, ...anexos].map(p => {
                    const marcado = f.plantillas_acta.includes(p.id)
                    return (
                      <label key={p.id} title={p.nombre} className={`flex items-center gap-2 max-w-[320px] px-3 h-9 rounded-full border cursor-pointer text-[12.5px] transition-colors ${marcado ? 'border-[#D81B43]/50 bg-[#D81B43]/[0.05] text-slate-800 font-semibold' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                        <input type="checkbox" checked={marcado}
                          onChange={e => { setF(x => ({ ...x, formatos_a_mano: true, plantillas_acta: e.target.checked ? [...x.plantillas_acta, p.id] : x.plantillas_acta.filter(id => id !== p.id) })); setErrores({}) }} />
                        <span className="truncate">{p.nombre}</span>
                        {p.tipo === 'anexo' && <span className="text-[11px] font-normal text-slate-400">anexo</span>}
                      </label>
                    )
                  })}
                </div>
                {errores.formatos && <div className="text-[12px] text-[#D81B43] mt-2">{errores.formatos}</div>}
              </section>

              {elegidas.length > 0 && (
                <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 md:p-6 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-bold text-slate-800">Llenar formatos</div>
                    <div className={`flex items-center gap-1.5 mt-1 text-[13px] ${faltantes ? 'text-[#B45309]' : 'text-[#0F7B55]'}`}>
                      {faltantes ? <AlertCircle size={15} /> : <Check size={15} />}
                      {faltantes ? `Faltan ${faltantes} ${faltantes === 1 ? 'dato' : 'datos'}. Lo demás es opcional.` : 'Datos completos. Solo faltan las firmas.'}
                    </div>
                  </div>
                  <button type="button" onClick={() => setLlenando(true)} className={`${ui.btnAzul} !h-11 !px-5`}>
                    <FileText size={15} /> Llenar formatos
                  </button>
                </section>
              )}
            </div>
          )}

          {/* ── PASO 5: CONFIRMACIÓN ── */}
          {paso === 4 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
              <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 md:p-6">
                <div className="flex items-center gap-2 text-[14px] font-bold text-slate-800 mb-4"><FileText size={16} className="text-[#1B3A6B]" /> Formatos</div>
                <div className="space-y-1.5 mb-4">
                  {elegidas.map(p => (
                    <div key={p.id} className="flex items-center gap-2 text-[13px] text-slate-700"><FileText size={13} className="text-slate-400 flex-shrink-0" /><span className="truncate">{p.nombre}</span></div>
                  ))}
                </div>
                {faltantes > 0 ? (
                  <div className="flex items-start gap-2 px-3 py-2.5 rounded-[10px] bg-amber-50 text-[12.5px] text-[#B45309]">
                    <AlertCircle size={15} className="flex-shrink-0 mt-px" />
                    <span className="flex-1">Faltan {faltantes} {faltantes === 1 ? 'dato' : 'datos'} en los formatos. {f.modo === 'domicilio' ? 'El repartidor puede completarlos al entregar.' : 'Quedarán en blanco.'}</span>
                    <button onClick={() => irA(3)} className="font-semibold hover:underline flex-shrink-0">Llenar</button>
                  </div>
                ) : (
                  <div className="px-3 py-2.5 rounded-[10px] bg-emerald-50 text-[12.5px] text-[#0F7B55]">Formatos completos. Solo faltan las firmas.</div>
                )}
                <button type="button" onClick={() => setPrevia(filasPrevia())} className={`${ui.btnSecundario} mt-4`}><Eye size={14} /> Ver cómo quedan</button>
              </section>

              <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 md:p-6">
                <div className="text-[14px] font-bold text-slate-800 mb-4">Resumen</div>
                <dl className="space-y-3 text-[13px]">
                  {[
                    ['Cliente', clienteSel?.nombre, 0],
                    ['Paciente', f.sinPaciente ? 'Sin paciente' : [f.paciente.nombre, f.paciente.cedula && `${f.paciente.tipo_documento} ${f.paciente.cedula}`].filter(Boolean).join(' · '), 0],
                    ['Equipos', carrito.map(e => `${e.codigo} ${nombreEquipo(e)}`).join(' · '), 1],
                    ['Entrega', f.modo === 'oficina'
                      ? `En oficina · ${f.fecha_oficina ? formatearSoloFecha(f.fecha_oficina) : '—'}`
                      : `A domicilio · ${repartidorSel?.nombre || '—'} · ${f.fecha_domicilio ? formatear(f.fecha_domicilio, { hour: '2-digit', minute: '2-digit' }) : '—'}`, 2],
                    ['Vigencia', f.fecha_vigencia ? `Hasta el ${formatearSoloFecha(f.fecha_vigencia)}` : 'Indefinida', 2],
                    ['Formatos', `${elegidas.length} ${elegidas.length === 1 ? 'formato' : 'formatos'}`, 3],
                  ].map(([k, v, p]) => (
                    <div key={k} className="flex gap-3">
                      <dt className="w-[78px] flex-shrink-0 text-slate-400">{k}</dt>
                      <dd className="flex-1 min-w-0 font-medium text-slate-700 break-words">{v || '—'}</dd>
                      <button onClick={() => irA(p)} className="text-[12px] font-semibold text-[#1B3A6B] hover:underline flex-shrink-0">Editar</button>
                    </div>
                  ))}
                </dl>
              </section>
            </div>
          )}
        </div>
      </div>

      {/* Barra de acciones: siempre visible */}
      <div className="flex-shrink-0 bg-white border-t border-slate-200 px-3 md:px-6 py-3">
        <div className="max-w-[1100px] mx-auto flex items-center gap-2">
          {paso === 1 && carrito.length > 0 && (
            <div className="lg:hidden flex-1 min-w-0 flex gap-1.5 overflow-x-auto">
              {carrito.map(e => (
                <button key={e.id} onClick={() => alternarEquipo(e.id)} className="flex items-center gap-1 px-2 py-1 bg-[#D81B43]/10 text-[#D81B43] rounded-full text-[11.5px] font-mono font-bold whitespace-nowrap" aria-label={`Quitar ${e.codigo}`}>
                  {e.codigo} <X size={11} />
                </button>
              ))}
            </div>
          )}
          {paso === 0 && tieneDatos(f) && (
            <button onClick={() => setConfirmarDescarte(true)} className="text-[12.5px] font-medium text-slate-400 hover:text-[#D81B43]">Descartar</button>
          )}
          <div className="ml-auto flex gap-2 flex-shrink-0">
            {paso > 0 && (
              <button onClick={() => irA(paso - 1)} disabled={guardando}
                className={ui.btnSecundario}>Atrás</button>
            )}
            {paso < PASOS.length - 1 ? (
              <button onClick={() => irA(paso + 1)}
                className={ui.btnAzul}>
                Siguiente{paso === 1 && carrito.length > 0 ? ` (${carrito.length})` : ''} →
              </button>
            ) : (
              <button onClick={crear} disabled={guardando}
                className={ui.btnPrimario}>
                {guardando ? 'Creando…' : '✓ Crear préstamo'}
              </button>
            )}
          </div>
        </div>
      </div>

      {llenando && elegidas.length > 0 && (
        <VentanaLlenarFormatos subtitulo={[clienteSel?.nombre, conPaciente && f.paciente.nombre].filter(Boolean).join(' · ')}
          onCerrar={() => setLlenando(false)}
          pie={<button onClick={() => setLlenando(false)} className={ui.btnPrimario}>Listo</button>}>
          <LlenarFormatos plantillas={elegidas} valores={valoresFormatos} conPaciente={conPaciente} nombrePaciente={f.paciente.nombre}
            base={baseFormatos}
            onPaciente={setPac} onDiagnostico={v => set('diagnostico', v)} onActa={v => set('datos_acta', v)} />
        </VentanaLlenarFormatos>
      )}

      {previa && (
        <PreviaActas actas={previa} titulo="Vista previa de los formatos" onCerrar={() => setPrevia(null)} />
      )}

      <ConfirmDialog
        abierto={confirmarDescarte}
        titulo="¿Descartar este préstamo?"
        mensaje="Se borra lo que llevas escrito, también el borrador guardado."
        textoConfirmar="Descartar"
        textoCancelar="Seguir"
        tipo="peligro"
        onConfirmar={() => { borrarBorrador(); setConfirmarDescarte(false); setF({ ...FORM_VACIO, fecha_oficina: hoyBogota() }); setPaso(0); setErrores({}) }}
        onCancelar={() => setConfirmarDescarte(false)}
      />
    </div>
  )
}
