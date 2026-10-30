'use client'
import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronLeft, Truck, Store, FileText, Eye, AlertCircle, ArrowRight, Loader2, Package, PenLine, RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { registrarBitacora } from '@/lib/bitacora'
import { hoyBogota, formatear, formatearSoloFecha, paraGuardar } from '@/lib/fechas'
import { ACCIONES, sugeridasDe, ofrecidasDe, seRecarga } from '@/lib/actas/acciones'
import { cargarParaFirma, guardarActas } from '@/lib/actas/firmar'
import { leerDatosActa, camposPedidos, camposVacios } from '@/lib/actas/campos'
import { construirContexto, paraPlantilla } from '@/lib/actas/contexto'
import { programarAccion, registrarEnOficina, copiaEquipo, NOMBRE_ACCION } from '@/lib/accionesPrestamo'
import LlenarFormatos, { VentanaLlenarFormatos } from '@/components/actas/LlenarFormatos'
import PreviaActas from '@/components/actas/PreviaActas'
import FirmaActas from '@/components/actas/FirmaActas'
import ModalCambioEquipo from '@/components/prestamos/ModalCambioEquipo'
import { IconoTipo } from '@/components/inventario/IconoTipo'
import { ui } from '@/lib/ui'

// Asistente para recoger o cambiar equipos de un préstamo ya entregado.
//
// La recarga es un cambio de equipo con motivo "Recarga": se lleva un equipo
// recargado, el paciente se queda con él y el vacío vuelve a la bodega
// (Disponible). Ese motivo usa los formatos de recarga y deja la fecha de última
// recarga en el préstamo (lib/accionesPrestamo.js → aplicarAccion). Si se pide
// accion="recarga" (avisos, Clientes) se abre el cambio con ese motivo.
//
// Lo primero es si se crea una entrega a domicilio:
//  - No (en oficina): 1 Cómo · 2 Equipos. Siempre queda acta: "Firmar formatos"
//    la firma ahí mismo; el botón de hacer la deja llena con los datos que hay y
//    sin firmas, para firmarla después (Actas del préstamo o del equipo).
//  - Sí: 1 Cómo · 2 Equipos · 3 Confirmación (formatos y datos que se adelantan);
//    queda programada para el repartidor, que recoge las firmas.

const inputCls = 'w-full px-3 py-2.5 border border-slate-200 rounded-[9px] text-[16px] md:text-[13.5px] text-slate-800 outline-none focus:border-[#D81B43] bg-white transition-colors placeholder:text-slate-400'
const labelCls = 'block text-[11px] font-bold uppercase tracking-[0.07em] text-slate-500 mb-1.5'
const PASOS_DOMICILIO = ['Cómo', 'Equipos', 'Confirmación']
const PASOS_OFICINA = ['Cómo', 'Equipos']
// Motivos de un cambio de equipo. "Recarga" cambia los formatos a los de recarga.
const MOTIVOS = [['recarga', 'Recarga'], ['falla', 'Falla o daño'], ['otro', 'Otro']]
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

export default function AccionPrestamo({ orden, accion: accionPedida, preseleccion = [], plantillas, disponibles, categorias, tiposEquipo, repartidores, onSalir, onListo }) {
  // La recarga se hace como cambio de equipo con motivo "Recarga"
  const accion = accionPedida === 'recarga' ? 'cambio' : accionPedida
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
      const nombre = v.datos?.recarga ? 'Recarga' : NOMBRE_ACCION[{ retiro: 'devolucion', recarga: 'recarga', cambio: 'cambio' }[v.tipo]]
      for (const x of [...(v.datos?.equipos || []), ...(v.datos?.cambios || [])]) m.set(x.orden_equipo_id, nombre)
    }
    return m
  }, [orden])

  const [sel, setSel] = useState(() => {
    const libres = activos.filter(oe => !ocupados.has(oe.id)).map(oe => oe.id)
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
  const [motivoTipo, setMotivoTipo] = useState(accionPedida === 'recarga' ? 'recarga' : '')
  const [motivoDetalle, setMotivoDetalle] = useState('')
  const PASOS = modo === 'domicilio' ? PASOS_DOMICILIO : PASOS_OFICINA
  const esRecarga = accion === 'cambio' && motivoTipo === 'recarga'
  // Formatos: una recarga lleva el acta de cambio (para el préstamo) y la de recarga (para el equipo)
  const formatos = useMemo(() => esRecarga ? ['cambio', 'recarga'] : [accion], [esRecarga, accion])
  const formato = formatos.join('+')
  const nombre = esRecarga ? 'Recarga' : ACCIONES[accion]
  const motivo = accion === 'cambio'
    ? [MOTIVOS.find(([v]) => v === motivoTipo && v !== 'otro')?.[1], motivoDetalle.trim()].filter(Boolean).join(' — ')
    : ''
  // Formatos elegidos por acción de formato (si cambia el motivo, cambian los sugeridos)
  const [elegidasPor, setElegidasPor] = useState({})
  const elegidasIds = useMemo(() => elegidasPor[formato] ?? sugeridasDe(plantillas, orden.cliente_id, formatos), [elegidasPor, formato, formatos, plantillas, orden.cliente_id])
  const setElegidasIds = f => setElegidasPor(m => ({ ...m, [formato]: f(elegidasIds) }))
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
  const ofrecidas = ofrecidasDe(plantillas, orden.cliente_id, formatos, elegidasIds)
  const conPaciente = !!base?.orden.paciente
  const fecha = modo === 'oficina' ? fechaOficina && fechaOficina + 'T12:00:00' : fechaDomicilio || undefined
  const repartidorSel = repartidores.find(r => r.id === repartidor)
  const datosActa = valores ? { ...valores.acta, motivo } : null
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
      motivo: motivo || null, recarga: esRecarga, observaciones: valores?.acta?.observaciones || null,
      plantillas: elegidasIds, datos_acta: datosActa,
    }
  }

  function validar(p) {
    const e = {}
    if (p === 0) {
      if (modo === 'oficina' && !fechaOficina) e.fecha = 'Elige la fecha'
      if (modo === 'domicilio') {
        if (!repartidor) e.repartidor = 'Elige el repartidor'
        if (!fechaDomicilio) e.fecha = 'Elige la fecha y hora'
      }
    }
    if (p === 1) {
      if (!sel.length) e.equipos = 'Elige al menos un equipo'
      else if (accion === 'cambio' && seleccionados.some(oe => !nuevos[oe.id])) e.equipos = 'Elige el equipo que entra en cada cambio'
      if (accion === 'cambio' && !motivoTipo) e.motivo = 'Elige el motivo'
      if (accion === 'cambio' && motivoTipo === 'otro' && !motivoDetalle.trim()) e.motivo = 'Escribe el motivo'
    }
    // A domicilio el repartidor firma con el paciente: necesita al menos un formato
    if (p === 2 && !elegidas.length) e.formatos = `Elige el formato de ${nombre.toLowerCase()}`
    return e
  }
  function validarHasta(ultimo) {
    for (let p = 0; p <= ultimo; p++) {
      const e = validar(p)
      if (Object.keys(e).length) { setErrores(e); setPaso(p); return false }
    }
    return true
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

  const textoListo = esRecarga ? 'Recarga' : { devolucion: 'Recogida', cambio: 'Cambio de equipo' }[accion]
  const bitacora = (id, detalle) => registrarBitacora({ modulo: 'ordenes', accion: modo === 'domicilio' ? 'crear' : 'editar', entidad: textoListo.toLowerCase(), entidad_id: id,
    detalle: { codigo: orden.codigo, modo, motivo: motivo || undefined, equipos: seleccionados.map(oe => oe.equipo.codigo), ...detalle } })

  async function programar() {
    if (!validarHasta(2)) return
    setGuardando(true); setErrorGeneral(null)
    const errPac = await guardarPaciente()
    if (errPac) { setErrorGeneral(errPac); setGuardando(false); return }
    const { data, error } = await programarAccion(supabase, { orden, accion, repartidorId: repartidor, fecha: paraGuardar(fechaDomicilio), datos: datosAccion() })
    setGuardando(false)
    if (error) { setErrorGeneral('No se programó: ' + error.message); return }
    bitacora(data.id)
    onListo({ mensaje: `${textoListo} programada para ${repartidorSel?.nombre || 'el repartidor'}` })
  }

  // En oficina, sin firmar ahora: se aplica y el acta queda llena con los datos que
  // hay y sin firmas; se firma después desde las Actas del préstamo o del equipo.
  async function hacerAhora() {
    if (!validarHasta(1)) return
    setGuardando(true); setErrorGeneral(null)
    const r = await registrarEnOficina(supabase, { orden, accion, fecha: fechaRegistro, datos: datosAccion() })
    if (r.error) { setErrorGeneral('No se registró: ' + r.error.message); setGuardando(false); return }
    const { error } = elegidas.length
      ? await guardarActas(supabase, { ordenId: orden.id, entregaId: r.data.id, accion, plantillas: elegidas, ctx: contexto(), firmas: {} })
      : { error: null }
    setGuardando(false)
    bitacora(r.data.id, { firmada: false })
    onListo({
      mensaje: error ? `${textoListo} registrada, pero no se guardó el acta: ${error.message}`
        : elegidas.length ? `${textoListo} registrada · acta sin firmas en el préstamo` : `${textoListo} registrada · este cliente no tiene formatos para esto`,
      error: !!error, todosDevueltos: r.todosDevueltos,
    })
  }

  // En oficina, con formatos firmados ahí mismo (FirmaActas: datos, revisión y firmas)
  function firmarAhora() {
    if (!validarHasta(1)) return
    if (!elegidas.length) { setErrorGeneral(`Este cliente no tiene formatos de ${nombre.toLowerCase()}. Créalos en Configuración → Plantillas.`); return }
    setErrorGeneral(null); setFirmando(true)
  }

  const ocupadoCls = 'opacity-50 pointer-events-none'
  if (errorCarga) return <div className="p-6 text-[13px] text-red-600">{errorCarga} <button onClick={onSalir} className="underline ml-2">Volver</button></div>

  const hacer = { devolucion: 'Recoger equipos', cambio: esRecarga ? 'Hacer la recarga' : 'Hacer el cambio' }[accion]
  const programarTxt = { devolucion: 'Programar recogida', cambio: esRecarga ? 'Programar recarga' : 'Programar cambio' }[accion]

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Pasos */}
      <div className="flex-shrink-0 bg-white border-b border-slate-200 px-3 md:px-6 py-3">
        <div className="flex items-center gap-3 max-w-[1100px] mx-auto">
          <button onClick={onSalir} className="flex items-center gap-1 text-[12.5px] font-medium text-slate-500 hover:text-slate-700 flex-shrink-0">
            <ChevronLeft size={15} /> <span className="hidden sm:inline">Salir</span>
          </button>
          <div className="min-w-0 flex-shrink-0 hidden md:block">
            <div className="text-[13.5px] font-bold text-slate-800 leading-tight">{nombre}</div>
            <div className="text-[11.5px] text-slate-400 font-mono">{orden.codigo}</div>
          </div>
          <ol className="flex-1 flex items-center gap-1.5 md:gap-2 min-w-0">
            {PASOS.map((n, i) => (
              <li key={n} className="flex items-center gap-1.5 md:gap-2 min-w-0 flex-1 last:flex-none">
                <button type="button" onClick={() => irA(i)} disabled={guardando} className="flex items-center gap-2 min-w-0" aria-current={i === paso ? 'step' : undefined}>
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${
                    i < paso ? 'bg-[#0F7B55] text-white' : i === paso ? 'bg-[#D81B43] text-white' : 'bg-slate-100 text-slate-400'}`}>
                    {i < paso ? <Check size={12} strokeWidth={3} /> : i + 1}
                  </span>
                  <span className={`text-[12.5px] font-semibold truncate ${i === paso ? 'text-slate-800' : 'text-slate-400 hidden lg:inline'}`}>{n}</span>
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

          {/* ── PASO 1: CÓMO (lo primero: ¿se crea una entrega a domicilio?) ── */}
          {paso === 0 && (
            <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 md:p-6 space-y-5 max-w-[760px]">
              <div>
                <div className="text-[15px] font-bold text-slate-800">¿Se crea una entrega a domicilio?</div>
                <div className="text-[12.5px] text-slate-400 mt-0.5">Si no, se hace ahora en oficina.</div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-label="¿Se crea una entrega a domicilio?">
                {[['oficina', 'No, se hace ahora', Store, 'En oficina. Las firmas son opcionales.'], ['domicilio', 'Sí, a domicilio', Truck, 'Lo hace un repartidor y recoge las firmas.']].map(([v, l, Icono, sub]) => (
                  <button key={v} type="button" role="radio" aria-checked={modo === v} onClick={() => { setModo(v); setErrores({}) }}
                    className={`flex items-center gap-3 px-4 py-4 rounded-[12px] border-2 text-left transition-all ${modo === v ? 'border-[#D81B43] bg-[#D81B43]/[0.03]' : 'border-slate-200 hover:border-slate-300'}`}>
                    <Icono size={22} className={modo === v ? 'text-[#D81B43]' : 'text-slate-400'} />
                    <span className="min-w-0">
                      <span className={`block text-[14.5px] font-bold ${modo === v ? 'text-slate-800' : 'text-slate-600'}`}>{l}</span>
                      <span className="block text-[12px] text-slate-400">{sub}</span>
                    </span>
                  </button>
                ))}
              </div>
              {modo === 'oficina' ? (
                <Campo label="Fecha" requerido error={errores.fecha} className="max-w-[260px]">
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

          {/* ── PASO 2: EQUIPOS (y en un cambio, el motivo) ── */}
          {paso === 1 && (
            <>
              <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 md:p-6">
                <div className="text-[15px] font-bold text-slate-800 mb-1">
                  {accion === 'devolucion' ? '¿Qué equipos se recogen?' : '¿Qué equipos se cambian?'}
                </div>
                <div className="text-[12.5px] text-slate-400 mb-4">
                  {accion === 'cambio' ? `Marca el equipo que sale y luego elige el que entra en su lugar. ${esRecarga ? 'El que sale queda «Por recargar» hasta que lo marquen recargado en Inventario.' : 'El que sale vuelve a quedar disponible.'}` : 'Los equipos recogidos vuelven a quedar disponibles.'}
                </div>
                {errores.equipos && <div className="text-[12px] text-[#D81B43] mb-3">{errores.equipos}</div>}
                {activos.length === 0 ? (
                  <div className="py-8 text-center text-[13px] text-slate-400">Este préstamo no tiene equipos activos.</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {activos.map(oe => {
                      const marcado = sel.includes(oe.id)
                      const ocupado = ocupados.get(oe.id)
                      const nuevo = nuevos[oe.id]
                      return (
                        <div key={oe.id} className={`rounded-[12px] border p-3 ${marcado ? 'border-[#D81B43]/50 bg-[#D81B43]/[0.03]' : 'border-slate-200 bg-white'} ${ocupado ? ocupadoCls : ''}`}>
                          <label className="flex items-center gap-3 cursor-pointer">
                            <input type="checkbox" checked={marcado} disabled={!!ocupado}
                              onChange={e => {
                                setSel(l => e.target.checked ? [...l, oe.id] : l.filter(x => x !== oe.id)); setErrores({})
                                // En un cambio, al marcar el que sale se abre de una vez para elegir el que entra
                                if (accion === 'cambio' && e.target.checked && !nuevos[oe.id]) setEligiendo(oe)
                              }} />
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
                            nuevo ? (
                              <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center gap-2">
                                <ArrowRight size={14} className="text-[#0F7B55] flex-shrink-0" />
                                <span className="flex-1 min-w-0 text-[12.5px] text-slate-700 truncate"><span className="text-slate-400">Entra:</span> <b className="font-mono">{nuevo.codigo}</b> · {nombreEquipo(nuevo)}</span>
                                <button type="button" onClick={() => setEligiendo(oe)} className={ui.btnChico}>Cambiar</button>
                              </div>
                            ) : (
                              <button type="button" onClick={() => setEligiendo(oe)}
                                className="mt-2.5 w-full flex items-center justify-center gap-2 h-11 rounded-[10px] border-2 border-dashed border-[#D81B43]/50 bg-white text-[13px] font-bold text-[#D81B43] hover:bg-[#D81B43]/[0.04]">
                                <ArrowRight size={15} /> Elegir el equipo que entra
                              </button>
                            )
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>

              {accion === 'cambio' && (
                <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 md:p-6">
                  <div className="text-[15px] font-bold text-slate-800 mb-1">Motivo del cambio <span className="text-[#D81B43]">*</span></div>
                  <div className="text-[12.5px] text-slate-400 mb-3">Si es una recarga, se firman el acta de cambio de equipo y la de recarga, y el equipo que sale queda «Por recargar».</div>
                  <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Motivo del cambio">
                    {MOTIVOS.map(([v, l]) => (
                      <button key={v} type="button" role="radio" aria-checked={motivoTipo === v} onClick={() => { setMotivoTipo(v); setErrores({}) }}
                        className={`flex items-center gap-2 px-4 h-10 rounded-full border-2 text-[13px] font-semibold transition-colors ${motivoTipo === v ? 'border-[#D81B43] bg-[#D81B43]/[0.05] text-slate-800' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                        {v === 'recarga' && <RefreshCw size={14} className={motivoTipo === v ? 'text-[#D81B43]' : ''} />} {l}
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 max-w-[560px]">
                    <input value={motivoDetalle} onChange={e => { setMotivoDetalle(e.target.value); setErrores({}) }}
                      placeholder={motivoTipo === 'otro' ? 'Escribe el motivo' : 'Detalle (opcional). Ej.: falla en el regulador'} className={inputCls} />
                  </div>
                  {errores.motivo && <div className="text-[12px] text-[#D81B43] mt-2">{errores.motivo}</div>}
                  {esRecarga && seleccionados.some(oe => !seRecarga(oe.equipo.tipo_equipo)) && (
                    <div className="mt-3 flex items-start gap-2 text-[12px] text-[#B45309]">
                      <AlertCircle size={14} className="flex-shrink-0 mt-px" /> Algún equipo marcado no es de los que se recargan (Configuración → Tipos → &quot;Se recarga&quot;).
                    </div>
                  )}
                </section>
              )}

              {modo === 'oficina' && (
                <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-[#1B3A6B]/[0.04] border border-[#1B3A6B]/10 text-[12.5px] text-slate-600">
                  <FileText size={15} className="text-[#1B3A6B] flex-shrink-0 mt-px" />
                  <span><b className="text-slate-700">Siempre queda el acta{elegidas.length ? ` (${elegidas.map(p => p.nombre).join(' · ')})` : ''}.</b> Toca <b>Firmar formatos</b> para firmarla ahora, o <b>{hacer}</b> para dejarla con los datos que hay y sin firmas; se firma después desde las Actas del préstamo o del equipo.</span>
                </div>
              )}
            </>
          )}

          {/* ── PASO 3 (a domicilio): CONFIRMACIÓN, con los formatos ── */}
          {paso === 2 && valores && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
              <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 md:p-6">
                <div className="text-[14px] font-bold text-slate-800 mb-4">Resumen</div>
                <dl className="space-y-3 text-[13px]">
                  {[
                    ['Acción', nombre, 1],
                    ['Equipos', accion === 'cambio'
                      ? seleccionados.map(oe => `${oe.equipo.codigo} → ${nuevos[oe.id]?.codigo || '—'}`).join(' · ')
                      : seleccionados.map(oe => `${oe.equipo.codigo} ${nombreEquipo(oe.equipo)}`).join(' · '), 1],
                    accion === 'cambio' && ['Motivo', motivo || '—', 1],
                    ['Cómo', modo === 'oficina'
                      ? `En oficina · ${fechaOficina ? formatearSoloFecha(fechaOficina) : '—'}`
                      : `A domicilio · ${repartidorSel?.nombre || '—'} · ${fechaDomicilio ? formatear(fechaDomicilio, { hour: '2-digit', minute: '2-digit' }) : '—'}`, 0],
                  ].filter(Boolean).map(([k, v, p]) => (
                    <div key={k} className="flex gap-3">
                      <dt className="w-[78px] flex-shrink-0 text-slate-400">{k}</dt>
                      <dd className="flex-1 min-w-0 font-medium text-slate-700 break-words">{v || '—'}</dd>
                      <button onClick={() => irA(p)} className="text-[12px] font-semibold text-[#1B3A6B] hover:underline flex-shrink-0">Editar</button>
                    </div>
                  ))}
                </dl>
                <div className="mt-4 pt-4 border-t border-slate-100 text-[12.5px] text-slate-500">
                  Queda en la lista de {repartidorSel?.nombre || 'el repartidor'}: la inicia, completa lo que falte y firma con el paciente.
                </div>
              </section>
              <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 md:p-6">
                <div className="flex items-center gap-2 text-[14px] font-bold text-slate-800 mb-3"><FileText size={16} className="text-[#1B3A6B]" /> Formatos que firma el repartidor</div>
                <div className="flex flex-wrap gap-2">
                  {ofrecidas.map(p => {
                    const marcado = elegidasIds.includes(p.id)
                    return (
                      <label key={p.id} title={p.nombre} className={`flex items-center gap-2 max-w-full px-3 h-9 rounded-full border cursor-pointer text-[12.5px] transition-colors ${marcado ? 'border-[#D81B43]/50 bg-[#D81B43]/[0.05] text-slate-800 font-semibold' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                        <input type="checkbox" checked={marcado}
                          onChange={e => { setElegidasIds(l => e.target.checked ? [...l, p.id] : l.filter(id => id !== p.id)); setErrores({}) }} />
                        <span className="truncate">{p.nombre}</span>
                      </label>
                    )
                  })}
                  {ofrecidas.length === 0 && <span className="text-[12.5px] text-[#B45309]">No hay plantillas de {nombre.toLowerCase()}. Créala en Configuración → Plantillas.</span>}
                </div>
                {errores.formatos && <div className="text-[12px] text-[#D81B43] mt-2">{errores.formatos}</div>}
                {elegidas.length > 0 && (
                  <>
                    <div className={`flex items-center gap-1.5 mt-4 text-[12.5px] ${faltantes ? 'text-[#B45309]' : 'text-[#0F7B55]'}`}>
                      {faltantes ? <AlertCircle size={14} /> : <Check size={14} />}
                      {faltantes ? `Faltan ${faltantes} ${faltantes === 1 ? 'dato' : 'datos'}: el repartidor puede completarlos, o adelántalos aquí.` : 'Datos completos. Solo faltan las firmas.'}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" onClick={() => setLlenando(true)} className={ui.btnSecundario}><PenLine size={14} /> Llenar datos (opcional)</button>
                      <button type="button" onClick={() => setPrevia(elegidas.map(p => ({ id: p.id, nombre: p.nombre, bloques: p.bloques, datos: paraPlantilla(contexto(), p), firma_recibe: null, firma_entrega: null })))}
                        className={ui.btnSecundario}><Eye size={14} /> Ver cómo queda</button>
                    </div>
                  </>
                )}
              </section>
            </div>
          )}
          {paso === 2 && !valores && <div className="flex items-center gap-2 text-[13px] text-slate-400"><Loader2 size={14} className="animate-spin" /> Cargando…</div>}
        </div>
      </div>

      {/* Barra de acciones */}
      <div className="flex-shrink-0 bg-white border-t border-slate-200 px-3 md:px-6 py-3">
        <div className="max-w-[1100px] mx-auto flex items-center gap-2 flex-wrap">
          {paso === 1 && sel.length > 0 && <div className="text-[12.5px] text-slate-500"><Package size={13} className="inline -mt-0.5" /> {sel.length} equipo{sel.length !== 1 ? 's' : ''}</div>}
          <div className="ml-auto flex gap-2 flex-shrink-0 flex-wrap justify-end">
            {paso > 0 && <button onClick={() => irA(paso - 1)} disabled={guardando} className={ui.btnSecundario}>Atrás</button>}
            {paso < PASOS.length - 1 ? (
              <button onClick={() => irA(paso + 1)} disabled={!base} className={ui.btnAzul}>Siguiente →</button>
            ) : modo === 'domicilio' ? (
              <button onClick={programar} disabled={guardando || !valores} className={ui.btnPrimario}>
                {guardando ? 'Programando…' : <><Truck size={14} /> {programarTxt}</>}
              </button>
            ) : (
              <>
                <button onClick={firmarAhora} disabled={guardando || !valores} className={ui.btnSecundario}><PenLine size={14} /> Firmar formatos</button>
                <button onClick={hacerAhora} disabled={guardando || !valores} className={ui.btnPrimario}>
                  {guardando ? 'Guardando…' : <><Check size={14} /> {hacer}</>}
                </button>
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

      {previa && <PreviaActas actas={previa} titulo={`Vista previa · ${nombre}`} onCerrar={() => setPrevia(null)} />}

      {firmando && (
        <FirmaActas ordenId={orden.id} accion={accion} plantillaIds={elegidasIds} equipos={equiposActa} retirados={retirados}
          datosIniciales={datosActa} titulo={`Firmar · ${nombre}`}
          alFirmar={async ({ recibidoPor, firma, observaciones, datosActa: escrito }) => {
            const r = await registrarEnOficina(supabase, { orden, accion, fecha: fechaRegistro, datos: { ...datosAccion(), observaciones: observaciones || null, datos_acta: escrito }, recibidoPor, firma })
            if (r.error) return r.error
            bitacora(r.data.id, { formatos: true, recibido_por: recibidoPor })
            return { entregaId: r.data.id }
          }}
          onCancelar={() => setFirmando(false)}
          onHecho={() => { setFirmando(false); onListo({ mensaje: `${textoListo} firmada y registrada` }) }} />
      )}
    </div>
  )
}
