'use client'
import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronLeft, Truck, Store, FileText, Eye, AlertCircle, ArrowRight, Loader2, Package, PenLine } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { registrarBitacora } from '@/lib/bitacora'
import { hoyBogota, formatear, formatearSoloFecha, paraGuardar } from '@/lib/fechas'
import { ACCIONES, plantillasSugeridas, plantillasOfrecidas, seRecarga } from '@/lib/actas/acciones'
import { cargarParaFirma, guardarActas } from '@/lib/actas/firmar'
import { leerDatosActa, camposPedidos, camposVacios } from '@/lib/actas/campos'
import { construirContexto, conManuales } from '@/lib/actas/contexto'
import { programarAccion, registrarEnOficina, copiaEquipo, NOMBRE_ACCION } from '@/lib/accionesPrestamo'
import LlenarFormatos, { VentanaLlenarFormatos } from '@/components/actas/LlenarFormatos'
import PreviaActas from '@/components/actas/PreviaActas'
import FirmaActas from '@/components/actas/FirmaActas'
import ModalCambioEquipo from '@/components/prestamos/ModalCambioEquipo'
import { IconoTipo } from '@/components/inventario/IconoTipo'
import { ui } from '@/lib/ui'

// Asistente para recoger, recargar o cambiar equipos de un préstamo, igual al de
// préstamo nuevo: 1 Equipos · 2 Cómo (oficina o domicilio) · 3 Formatos (llenar
// mirando la hoja) · 4 Confirmación. En oficina se firma ahí mismo (o se registra
// sin firmas); a domicilio queda programado para el repartidor
// (lib/accionesPrestamo.js). Sirve para cualquier préstamo entregado, también los
// que ya existían.

const inputCls = 'w-full px-3 py-2.5 border border-slate-200 rounded-[9px] text-[16px] md:text-[13.5px] text-slate-800 outline-none focus:border-[#D81B43] bg-white transition-colors placeholder:text-slate-400'
const labelCls = 'block text-[11px] font-bold uppercase tracking-[0.07em] text-slate-500 mb-1.5'
const PASOS = ['Equipos', 'Cómo', 'Formatos', 'Confirmación']
const PROGRAMAR = { devolucion: 'recogida', recarga: 'recarga', cambio: 'cambio' }
const nombreEquipo = eq => eq?.tipo_equipo?.atributos?.nombre || eq?.tipo_equipo?.nombre || 'Equipo'
const serie = eq => eq?.atributos?.serie

function Campo({ label, requerido, error, children, className = '' }) {
  return (
    <div className={className}>
      <label className={labelCls}>{label}{requerido && <span className="text-[#D81B43] ml-0.5">*</span>}</label>
      {children}
      {error && <div className="text-[12px] text-[#D81B43] mt-1">{error}</div>}
    </div>
  )
}

export default function AccionPrestamo({ orden, accion, preseleccion = [], plantillas, disponibles, categorias, tiposEquipo, repartidores, onSalir, onListo }) {
  const supabase = useMemo(() => createClient(), [])
  const [base, setBase] = useState(null)
  const [errorCarga, setErrorCarga] = useState(null)
  const [paso, setPaso] = useState(0)
  const [errores, setErrores] = useState({})
  const [errorGeneral, setErrorGeneral] = useState(null)
  const [guardando, setGuardando] = useState(false)

  // Equipos que siguen en el préstamo y los que ya tienen una acción programada
  const activos = useMemo(() => (orden.equipos || []).filter(oe => !oe.fecha_devolucion && oe.equipo), [orden])
  const ocupados = useMemo(() => {
    const m = new Map()
    for (const v of orden.visitas || []) {
      if (v.tipo === 'entrega' || ['Completada', 'Cancelada'].includes(v.estado?.nombre)) continue
      for (const x of [...(v.datos?.equipos || []), ...(v.datos?.cambios || [])]) m.set(x.orden_equipo_id, NOMBRE_ACCION[{ retiro: 'devolucion', recarga: 'recarga', cambio: 'cambio' }[v.tipo]])
    }
    return m
  }, [orden])
  const candidatos = useMemo(() => activos.filter(oe => accion !== 'recarga' || seRecarga(oe.equipo.tipo_equipo)), [activos, accion])

  const [sel, setSel] = useState(() => {
    const libres = candidatos.filter(oe => !ocupados.has(oe.id)).map(oe => oe.id)
    const pre = preseleccion.filter(id => libres.includes(id))
    if (pre.length) return pre
    return accion === 'cambio' ? [] : libres
  })
  const [nuevos, setNuevos] = useState({})            // en un cambio: orden_equipo_id → equipo que entra
  const [eligiendo, setEligiendo] = useState(null)    // orden_equipo que se está cambiando
  const [modo, setModo] = useState('oficina')
  const [fechaOficina, setFechaOficina] = useState(hoyBogota())
  const [fechaDomicilio, setFechaDomicilio] = useState('')
  const [repartidor, setRepartidor] = useState('')
  const [motivo, setMotivo] = useState('')
  const [elegidasIds, setElegidasIds] = useState(() => plantillasSugeridas(plantillas, orden.cliente_id, accion))
  const [valores, setValores] = useState(null)        // { paciente, diagnostico, acta } (LlenarFormatos)
  const [llenando, setLlenando] = useState(false)
  const [previa, setPrevia] = useState(null)
  const [firmando, setFirmando] = useState(false)

  useEffect(() => {
    let cancelado = false
    cargarParaFirma(supabase, orden.id, { plantillaIds: [] })
      .then(b => {
        if (cancelado) return
        setBase(b)
        const previo = leerDatosActa(b.orden.datos_acta)
        // De lo que se llenó al prestar se conserva quién recibe y la ciudad; lo demás va en blanco
        setValores({
          paciente: { ...(b.orden.paciente || {}) }, diagnostico: b.orden.diagnostico || '',
          acta: leerDatosActa({ recibe: previo.recibe, ciudad: previo.ciudad }),
        })
      })
      .catch(e => { if (!cancelado) setErrorCarga(e.message || 'No se pudo cargar el préstamo') })
    return () => { cancelado = true }
  }, [supabase, orden.id])

  const seleccionados = activos.filter(oe => sel.includes(oe.id))
  const equiposActa = accion === 'cambio' ? seleccionados.map(oe => nuevos[oe.id]).filter(Boolean) : seleccionados.map(oe => oe.equipo)
  const retirados = accion === 'cambio' ? seleccionados.map(oe => oe.equipo) : []
  const elegidas = useMemo(() => elegidasIds.map(id => plantillas.find(p => p.id === id)).filter(Boolean), [elegidasIds, plantillas])
  const ofrecidas = plantillasOfrecidas(plantillas, orden.cliente_id, accion, elegidasIds)
  const conPaciente = !!base?.orden.paciente
  const fecha = modo === 'oficina' ? fechaOficina && fechaOficina + 'T12:00:00' : fechaDomicilio || undefined
  const repartidorSel = repartidores.find(r => r.id === repartidor)
  const datosActa = valores ? { ...valores.acta, motivo: motivo.trim() } : null
  // En oficina se puede registrar con otro día (la devolución queda con ese día)
  const fechaRegistro = modo === 'oficina' && fechaOficina && fechaOficina !== hoyBogota() ? fechaOficina : undefined

  const baseFormatos = useMemo(() => base && ({ empresa: base.empresa, orden: { cliente: base.orden.cliente, codigo: base.orden.codigo }, equipos: equiposActa, retirados, fecha }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [base, sel, nuevos, fecha])
  const faltantes = useMemo(() => valores ? camposVacios(camposPedidos(elegidas, { conPaciente }).campos, valores).length : 0, [elegidas, conPaciente, valores])

  function contexto(firmas = {}) {
    return construirContexto({
      empresa: base.empresa,
      orden: { ...base.orden, paciente: conPaciente ? valores.paciente : null, diagnostico: valores.diagnostico },
      equipos: equiposActa, retirados, datos: { ...datosActa, fecha }, firmas,
    })
  }

  // Lo que queda guardado con la acción (entregas.datos)
  function datosAccion() {
    return {
      equipos: accion === 'cambio' ? [] : seleccionados.map(oe => ({ orden_equipo_id: oe.id, equipo: copiaEquipo(oe.equipo) })),
      cambios: accion === 'cambio' ? seleccionados.map(oe => ({ orden_equipo_id: oe.id, sale: copiaEquipo(oe.equipo), entra: copiaEquipo(nuevos[oe.id]) })) : [],
      motivo: motivo.trim() || null, observaciones: valores.acta.observaciones || null,
      plantillas: elegidasIds, datos_acta: datosActa,
    }
  }

  function validar(p) {
    const e = {}
    if (p === 0) {
      if (!sel.length) e.equipos = accion === 'recarga' ? 'Elige los equipos que se recargan' : 'Elige al menos un equipo'
      if (accion === 'cambio' && seleccionados.some(oe => !nuevos[oe.id])) e.equipos = 'Elige el equipo que entra en cada cambio'
    }
    if (p === 1) {
      if (modo === 'oficina' && !fechaOficina) e.fecha = 'Elige la fecha'
      if (modo === 'domicilio') {
        if (!repartidor) e.repartidor = 'Elige el repartidor'
        if (!fechaDomicilio) e.fecha = 'Elige la fecha y hora'
      }
    }
    if (p === 2 && !elegidas.length) e.formatos = `Elige el formato de ${ACCIONES[accion].toLowerCase()}`
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
  }

  // Lo que se corrigió del paciente al llenar los formatos queda guardado
  async function guardarPaciente() {
    const p = base.orden.paciente
    if (!p?.id) return null
    const campos = ['cedula', 'tipo_documento', 'direccion', 'barrio', 'ciudad', 'telefono', 'correo', 'eps', 'fecha_nacimiento']
    const cambios = Object.fromEntries(campos.filter(k => (valores.paciente[k] || null) !== (p[k] || null)).map(k => [k, valores.paciente[k] || null]))
    const extra = valores.diagnostico !== (base.orden.diagnostico || '')
    if (Object.keys(cambios).length) {
      const { error } = await supabase.from('pacientes').update(cambios).eq('id', p.id)
      if (error) return error.code === '23505' ? 'Esa cédula ya está registrada en otro paciente' : 'No se guardó el paciente: ' + error.message
    }
    if (extra) await supabase.from('ordenes_servicio').update({ diagnostico: valores.diagnostico || null }).eq('id', orden.id)
    return null
  }

  const textoListo = { devolucion: 'Recogida', recarga: 'Recarga', cambio: 'Cambio de equipo' }[accion]

  async function programar() {
    const e = validar(2)
    if (Object.keys(e).length) { setErrores(e); return }
    setGuardando(true); setErrorGeneral(null)
    const errPac = await guardarPaciente()
    if (errPac) { setErrorGeneral(errPac); setGuardando(false); return }
    const { data, error } = await programarAccion(supabase, { orden, accion, repartidorId: repartidor, fecha: paraGuardar(fechaDomicilio), datos: datosAccion() })
    setGuardando(false)
    if (error) { setErrorGeneral('No se programó: ' + error.message); return }
    registrarBitacora({ modulo: 'ordenes', accion: 'crear', entidad: NOMBRE_ACCION[accion].toLowerCase(), entidad_id: data.id, detalle: { codigo: orden.codigo, modo: 'domicilio', equipos: seleccionados.map(oe => oe.equipo.codigo) } })
    onListo({ mensaje: `${textoListo} programada para ${repartidorSel?.nombre || 'el repartidor'}` })
  }

  async function abrirFirmas() {
    setGuardando(true); setErrorGeneral(null)
    const errPac = await guardarPaciente()
    setGuardando(false)
    if (errPac) { setErrorGeneral(errPac); return }
    setFirmando(true)
  }

  async function registrarSinFirmas() {
    setGuardando(true); setErrorGeneral(null)
    const errPac = await guardarPaciente()
    if (errPac) { setErrorGeneral(errPac); setGuardando(false); return }
    const r = await registrarEnOficina(supabase, { orden, accion, fecha: fechaRegistro, datos: datosAccion() })
    if (r.error) { setErrorGeneral('No se registró: ' + r.error.message); setGuardando(false); return }
    const { error } = await guardarActas(supabase, { ordenId: orden.id, entregaId: r.data.id, accion, plantillas: elegidas, ctx: contexto(), firmas: {} })
    setGuardando(false)
    registrarBitacora({ modulo: 'ordenes', accion: 'editar', entidad: NOMBRE_ACCION[accion].toLowerCase(), entidad_id: r.data.id, detalle: { codigo: orden.codigo, modo: 'oficina', firmada: false, equipos: seleccionados.map(oe => oe.equipo.codigo) } })
    onListo({ mensaje: error ? `${textoListo} registrada, pero no se guardaron los formatos: ${error.message}` : `${textoListo} registrada · formatos sin firmar en el préstamo`, error: !!error, todosDevueltos: r.todosDevueltos })
  }

  const ocupadoCls = 'opacity-50 pointer-events-none'
  if (errorCarga) return <div className="p-6 text-[13px] text-red-600">{errorCarga} <button onClick={onSalir} className="underline ml-2">Volver</button></div>

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Pasos */}
      <div className="flex-shrink-0 bg-white border-b border-slate-200 px-3 md:px-6 py-3">
        <div className="flex items-center gap-3 max-w-[1100px] mx-auto">
          <button onClick={onSalir} className="flex items-center gap-1 text-[12.5px] font-medium text-slate-500 hover:text-slate-700 flex-shrink-0">
            <ChevronLeft size={15} /> <span className="hidden sm:inline">Salir</span>
          </button>
          <div className="min-w-0 flex-shrink-0 hidden md:block">
            <div className="text-[13.5px] font-bold text-slate-800 leading-tight">{ACCIONES[accion]}</div>
            <div className="text-[11.5px] text-slate-400 font-mono">{orden.codigo}</div>
          </div>
          <ol className="flex-1 flex items-center gap-1.5 md:gap-2 min-w-0">
            {PASOS.map((nombre, i) => (
              <li key={nombre} className="flex items-center gap-1.5 md:gap-2 min-w-0 flex-1 last:flex-none">
                <button type="button" onClick={() => irA(i)} disabled={guardando} className="flex items-center gap-2 min-w-0" aria-current={i === paso ? 'step' : undefined}>
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${
                    i < paso ? 'bg-[#0F7B55] text-white' : i === paso ? 'bg-[#D81B43] text-white' : 'bg-slate-100 text-slate-400'}`}>
                    {i < paso ? <Check size={12} strokeWidth={3} /> : i + 1}
                  </span>
                  <span className={`text-[12.5px] font-semibold truncate ${i === paso ? 'text-slate-800' : 'text-slate-400 hidden lg:inline'}`}>{nombre}</span>
                </button>
                {i < PASOS.length - 1 && <span className={`h-[2px] flex-1 rounded-full ${i < paso ? 'bg-[#0F7B55]/40' : 'bg-slate-100'}`} />}
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-[1100px] mx-auto p-3 md:p-6 space-y-4">
          <div className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-bold text-slate-800 truncate">{orden.paciente?.nombre || orden.cliente?.nombre}</div>
              <div className="text-[12px] text-slate-500 truncate">{orden.paciente?.nombre ? orden.cliente?.nombre : ''} · <span className="font-mono">{orden.codigo}</span></div>
            </div>
          </div>
          {errorGeneral && <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-[13px] text-red-700">{errorGeneral}</div>}

          {/* ── PASO 1: EQUIPOS ── */}
          {paso === 0 && (
            <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 md:p-6">
              <div className="text-[14px] font-bold text-slate-800 mb-1">
                {accion === 'devolucion' ? '¿Qué equipos se recogen?' : accion === 'recarga' ? '¿Qué equipos se recargan?' : '¿Qué equipos se cambian?'}
              </div>
              <div className="text-[12.5px] text-slate-400 mb-4">
                {accion === 'recarga' ? 'Salen los equipos que se recargan (Configuración → Tipos → "Se recarga").' : accion === 'cambio' ? 'Marca el que sale y elige el que entra.' : 'Los equipos recogidos vuelven a quedar disponibles.'}
              </div>
              {errores.equipos && <div className="text-[12px] text-[#D81B43] mb-3">{errores.equipos}</div>}
              {candidatos.length === 0 ? (
                <div className="py-8 text-center text-[13px] text-slate-400">
                  {accion === 'recarga' ? 'Este préstamo no tiene equipos que se recarguen.' : 'Este préstamo no tiene equipos activos.'}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {candidatos.map(oe => {
                    const marcado = sel.includes(oe.id)
                    const ocupado = ocupados.get(oe.id)
                    const nuevo = nuevos[oe.id]
                    return (
                      <div key={oe.id} className={`rounded-[12px] border p-3 ${marcado ? 'border-[#D81B43]/50 bg-[#D81B43]/[0.03]' : 'border-slate-200 bg-white'} ${ocupado ? ocupadoCls : ''}`}>
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input type="checkbox" checked={marcado} disabled={!!ocupado}
                            onChange={e => { setSel(l => e.target.checked ? [...l, oe.id] : l.filter(x => x !== oe.id)); setErrores({}) }} />
                          <span className="w-10 h-10 rounded-[9px] bg-slate-50 border border-slate-200 flex items-center justify-center flex-shrink-0">
                            <IconoTipo tipo={oe.equipo.tipo_equipo} categorias={categorias} size={24} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[13.5px] font-bold text-slate-800 truncate">{nombreEquipo(oe.equipo)}</span>
                            <span className="block text-[12px] text-slate-500 truncate">{[oe.equipo.codigo, serie(oe.equipo) && `Serie ${serie(oe.equipo)}`].filter(Boolean).join(' · ')}</span>
                            {ocupado && <span className="block text-[11.5px] font-semibold text-[#B45309]">{ocupado} ya programada</span>}
                          </span>
                        </label>
                        {accion === 'cambio' && marcado && (
                          <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center gap-2">
                            <ArrowRight size={14} className="text-slate-300 flex-shrink-0" />
                            {nuevo ? (
                              <span className="flex-1 min-w-0 text-[12.5px] text-slate-700 truncate"><b className="font-mono">{nuevo.codigo}</b> · {nombreEquipo(nuevo)}</span>
                            ) : <span className="flex-1 text-[12.5px] text-slate-400">Falta el equipo que entra</span>}
                            <button type="button" onClick={() => setEligiendo(oe)} className={ui.btnChico}>{nuevo ? 'Cambiar' : 'Elegir'}</button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
              {accion === 'cambio' && (
                <div className="mt-4 max-w-[520px]">
                  <Campo label="Motivo del cambio">
                    <input value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ej.: falla en el regulador, cilindro vacío" className={inputCls} />
                  </Campo>
                </div>
              )}
            </section>
          )}

          {/* ── PASO 2: CÓMO ── */}
          {paso === 1 && (
            <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 md:p-6 space-y-5 max-w-[720px]">
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-[12px]" role="radiogroup" aria-label="Cómo">
                {[['oficina', 'En oficina', Store, 'Se hace y se firma ahora'], ['domicilio', 'A domicilio', Truck, 'Lo hace un repartidor']].map(([v, l, Icono, sub]) => (
                  <button key={v} role="radio" aria-checked={modo === v} onClick={() => { setModo(v); setErrores({}) }}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-[9px] text-left transition-all ${modo === v ? 'bg-white shadow-sm' : 'text-slate-500'}`}>
                    <Icono size={18} className={modo === v ? 'text-[#D81B43]' : ''} />
                    <span className="min-w-0">
                      <span className={`block text-[13.5px] font-bold ${modo === v ? 'text-slate-800' : ''}`}>{l}</span>
                      <span className="block text-[11.5px] text-slate-400 truncate">{sub}</span>
                    </span>
                  </button>
                ))}
              </div>
              {modo === 'oficina' ? (
                <Campo label="Fecha" requerido error={errores.fecha}>
                  <input type="date" value={fechaOficina} onChange={e => setFechaOficina(e.target.value)} className={inputCls} />
                </Campo>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Campo label="Repartidor" requerido error={errores.repartidor}>
                    <select value={repartidor} onChange={e => setRepartidor(e.target.value)} className={inputCls}>
                      <option value="">Seleccionar…</option>
                      {repartidores.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                    </select>
                  </Campo>
                  <Campo label="Fecha y hora" requerido error={errores.fecha}>
                    <input type="datetime-local" value={fechaDomicilio} onChange={e => setFechaDomicilio(e.target.value)} className={inputCls} />
                  </Campo>
                </div>
              )}
            </section>
          )}

          {/* ── PASO 3: FORMATOS ── */}
          {paso === 2 && (
            <div className="space-y-3">
              <section className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex items-center gap-1.5 text-[13px] font-bold text-slate-800 mr-1"><FileText size={15} className="text-[#1B3A6B]" /> Formatos de {ACCIONES[accion].toLowerCase()}</span>
                  {ofrecidas.map(p => {
                    const marcado = elegidasIds.includes(p.id)
                    return (
                      <label key={p.id} title={p.nombre} className={`flex items-center gap-2 max-w-[320px] px-3 h-9 rounded-full border cursor-pointer text-[12.5px] transition-colors ${marcado ? 'border-[#D81B43]/50 bg-[#D81B43]/[0.05] text-slate-800 font-semibold' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                        <input type="checkbox" checked={marcado}
                          onChange={e => { setElegidasIds(l => e.target.checked ? [...l, p.id] : l.filter(id => id !== p.id)); setErrores({}) }} />
                        <span className="truncate">{p.nombre}</span>
                      </label>
                    )
                  })}
                  {ofrecidas.length === 0 && <span className="text-[12.5px] text-[#B45309]">No hay plantillas de {ACCIONES[accion].toLowerCase()}. Créala en Configuración → Plantillas.</span>}
                </div>
                {errores.formatos && <div className="text-[12px] text-[#D81B43] mt-2">{errores.formatos}</div>}
              </section>
              {elegidas.length > 0 && valores && (
                <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 md:p-6 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-bold text-slate-800">Llenar formatos</div>
                    <div className={`flex items-center gap-1.5 mt-1 text-[13px] ${faltantes ? 'text-[#B45309]' : 'text-[#0F7B55]'}`}>
                      {faltantes ? <AlertCircle size={15} /> : <Check size={15} />}
                      {faltantes ? `Faltan ${faltantes} ${faltantes === 1 ? 'dato' : 'datos'}. Lo demás es opcional.` : 'Datos completos. Solo faltan las firmas.'}
                    </div>
                  </div>
                  <button type="button" onClick={() => setLlenando(true)} className={`${ui.btnAzul} !h-11 !px-5`}><FileText size={15} /> Llenar formatos</button>
                </section>
              )}
            </div>
          )}

          {/* ── PASO 4: CONFIRMACIÓN ── */}
          {paso === 3 && valores && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
              <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 md:p-6">
                <div className="text-[14px] font-bold text-slate-800 mb-4">Resumen</div>
                <dl className="space-y-3 text-[13px]">
                  {[
                    ['Acción', ACCIONES[accion], 0],
                    ['Equipos', accion === 'cambio'
                      ? seleccionados.map(oe => `${oe.equipo.codigo} → ${nuevos[oe.id]?.codigo || '—'}`).join(' · ')
                      : seleccionados.map(oe => `${oe.equipo.codigo} ${nombreEquipo(oe.equipo)}`).join(' · '), 0],
                    accion === 'cambio' && ['Motivo', motivo || '—', 0],
                    ['Cómo', modo === 'oficina'
                      ? `En oficina · ${fechaOficina ? formatearSoloFecha(fechaOficina) : '—'}`
                      : `A domicilio · ${repartidorSel?.nombre || '—'} · ${fechaDomicilio ? formatear(fechaDomicilio, { hour: '2-digit', minute: '2-digit' }) : '—'}`, 1],
                    ['Formatos', elegidas.map(p => p.nombre).join(' · '), 2],
                  ].filter(Boolean).map(([k, v, p]) => (
                    <div key={k} className="flex gap-3">
                      <dt className="w-[78px] flex-shrink-0 text-slate-400">{k}</dt>
                      <dd className="flex-1 min-w-0 font-medium text-slate-700 break-words">{v || '—'}</dd>
                      <button onClick={() => irA(p)} className="text-[12px] font-semibold text-[#1B3A6B] hover:underline flex-shrink-0">Editar</button>
                    </div>
                  ))}
                </dl>
              </section>
              <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 md:p-6">
                <div className="flex items-center gap-2 text-[14px] font-bold text-slate-800 mb-3"><FileText size={16} className="text-[#1B3A6B]" /> Acta</div>
                {faltantes > 0 ? (
                  <div className="flex items-start gap-2 px-3 py-2.5 rounded-[10px] bg-amber-50 text-[12.5px] text-[#B45309]">
                    <AlertCircle size={15} className="flex-shrink-0 mt-px" />
                    <span className="flex-1">Faltan {faltantes} {faltantes === 1 ? 'dato' : 'datos'}. {modo === 'domicilio' ? 'El repartidor puede completarlos.' : 'Puedes completarlos al firmar.'}</span>
                    <button onClick={() => irA(2)} className="font-semibold hover:underline flex-shrink-0">Llenar</button>
                  </div>
                ) : <div className="px-3 py-2.5 rounded-[10px] bg-emerald-50 text-[12.5px] text-[#0F7B55]">Formatos completos. Solo faltan las firmas.</div>}
                <button type="button" onClick={() => setPrevia(elegidas.map(p => ({ id: p.id, nombre: p.nombre, bloques: p.bloques, datos: conManuales(contexto(), p.id), firma_recibe: null, firma_entrega: null })))}
                  className={`${ui.btnSecundario} mt-4`}><Eye size={14} /> Ver cómo queda</button>
                <div className="mt-4 pt-4 border-t border-slate-100 text-[12.5px] text-slate-500">
                  {modo === 'domicilio'
                    ? `Queda en la lista de ${repartidorSel?.nombre || 'el repartidor'}: la inicia, completa lo que falte y firma con el paciente.`
                    : accion === 'devolucion' ? 'Al firmar, los equipos quedan disponibles.' : accion === 'cambio' ? 'Al firmar, se hace el cambio en el préstamo.' : 'Al firmar, la recarga queda registrada.'}
                </div>
              </section>
            </div>
          )}
          {paso === 3 && !valores && <div className="flex items-center gap-2 text-[13px] text-slate-400"><Loader2 size={14} className="animate-spin" /> Cargando…</div>}
        </div>
      </div>

      {/* Barra de acciones */}
      <div className="flex-shrink-0 bg-white border-t border-slate-200 px-3 md:px-6 py-3">
        <div className="max-w-[1100px] mx-auto flex items-center gap-2 flex-wrap">
          {paso === 0 && sel.length > 0 && <div className="text-[12.5px] text-slate-500"><Package size={13} className="inline -mt-0.5" /> {sel.length} equipo{sel.length !== 1 ? 's' : ''}</div>}
          <div className="ml-auto flex gap-2 flex-shrink-0 flex-wrap justify-end">
            {paso > 0 && <button onClick={() => irA(paso - 1)} disabled={guardando} className={ui.btnSecundario}>Atrás</button>}
            {paso < PASOS.length - 1 ? (
              <button onClick={() => irA(paso + 1)} disabled={!base} className={ui.btnAzul}>Siguiente →</button>
            ) : modo === 'domicilio' ? (
              <button onClick={programar} disabled={guardando || !valores} className={ui.btnPrimario}>
                {guardando ? 'Programando…' : <><Truck size={14} /> Programar {PROGRAMAR[accion]}</>}
              </button>
            ) : (
              <>
                <button onClick={registrarSinFirmas} disabled={guardando || !valores} className={ui.btnSecundario}>Registrar sin firmas</button>
                <button onClick={abrirFirmas} disabled={guardando || !valores} className={ui.btnPrimario}><PenLine size={14} /> {guardando ? 'Guardando…' : 'Firmar ahora'}</button>
              </>
            )}
          </div>
        </div>
      </div>

      {eligiendo && (
        <ModalCambioEquipo soloElegir
          equipoActual={eligiendo.equipo}
          disponibles={disponibles.filter(eq => eq.id !== eligiendo.equipo_id && !Object.entries(nuevos).some(([k, n]) => k !== eligiendo.id && n.id === eq.id))}
          categorias={categorias} tiposEquipo={tiposEquipo}
          onConfirmar={({ equipoNuevo }) => { setNuevos(n => ({ ...n, [eligiendo.id]: equipoNuevo })); setEligiendo(null); setErrores({}) }}
          onCancelar={() => setEligiendo(null)} />
      )}

      {llenando && valores && elegidas.length > 0 && (
        <VentanaLlenarFormatos subtitulo={[orden.cliente?.nombre, orden.paciente?.nombre].filter(Boolean).join(' · ')}
          onCerrar={() => setLlenando(false)}
          pie={<button onClick={() => setLlenando(false)} className={ui.btnPrimario}>Listo</button>}>
          <LlenarFormatos plantillas={elegidas} valores={valores} conPaciente={conPaciente} nombrePaciente={valores.paciente?.nombre}
            base={baseFormatos}
            onPaciente={(k, v) => setValores(x => ({ ...x, paciente: { ...x.paciente, [k]: v } }))}
            onDiagnostico={v => setValores(x => ({ ...x, diagnostico: v }))}
            onActa={v => setValores(x => ({ ...x, acta: v }))} />
        </VentanaLlenarFormatos>
      )}

      {previa && <PreviaActas actas={previa} titulo={`Vista previa · ${ACCIONES[accion]}`} onCerrar={() => setPrevia(null)} />}

      {firmando && (
        <FirmaActas ordenId={orden.id} accion={accion} plantillaIds={elegidasIds} equipos={equiposActa} retirados={retirados}
          datosIniciales={datosActa} titulo={`Firmar · ${ACCIONES[accion]}`}
          alFirmar={async ({ recibidoPor, firma, observaciones, datosActa: escrito }) => {
            const r = await registrarEnOficina(supabase, { orden, accion, fecha: fechaRegistro, datos: { ...datosAccion(), observaciones: observaciones || null, datos_acta: escrito }, recibidoPor, firma })
            if (r.error) return r.error
            registrarBitacora({ modulo: 'ordenes', accion: 'editar', entidad: NOMBRE_ACCION[accion].toLowerCase(), entidad_id: r.data.id, detalle: { codigo: orden.codigo, modo: 'oficina', firmada: true, recibido_por: recibidoPor, equipos: seleccionados.map(oe => oe.equipo.codigo) } })
            return { entregaId: r.data.id }
          }}
          onCancelar={() => setFirmando(false)}
          onHecho={() => { setFirmando(false); onListo({ mensaje: `${textoListo} firmada y registrada` }) }} />
      )}
    </div>
  )
}
