'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, Globe, Star, X, PencilRuler, Trash2, Settings2, ArrowUpRight, ArrowDownLeft, RefreshCw, ArrowLeftRight, Boxes, Tags, Check, Users } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { ui } from '@/lib/ui'
import { createClient } from '@/lib/supabase'
import { ACCIONES, accionDe } from '@/lib/actas/acciones'
import { categoriasDe, esRenovable } from '@/lib/actas/contexto'

// Configuración de una plantilla (Configuración → Plantillas → Configuración): todo lo
// que no es el contenido de la hoja. El contenido se edita con "Editar plantilla".
//  - Nombre y descripción; para qué acción es (préstamo, devolución, recarga, cambio).
//  - Equipos: todos o solo algunas categorías (bloque para_equipos; contexto.js → paraPlantilla).
//  - Renovable: sus actas firmadas se renuevan en el préstamo (bloque renovable).
//  - Quién la usa: de Ingemedic (la de su acción si el cliente no tiene una propia; una
//    por acción), uso general (cualquier cliente) y los clientes asignados.
// Las dos marcas de equipos y renovable viven en los bloques (no se dibujan): no hace falta SQL.
// En PC, dos columnas: lo general a la izquierda y quién la usa a la derecha.
const OCULTOS = ['para_equipos', 'renovable']
const ICONO_ACCION = { prestamo: ArrowUpRight, devolucion: ArrowDownLeft, recarga: RefreshCw, cambio: ArrowLeftRight }

// Interruptor con título y explicación (toda la fila se toca)
function Interruptor({ activo, onCambiar, icono: Icono, titulo, detalle }) {
  return (
    <button type="button" role="switch" aria-checked={activo} onClick={() => onCambiar(!activo)}
      className="w-full flex items-start gap-3 py-2.5 text-left">
      {Icono && <Icono size={16} className={`mt-0.5 flex-shrink-0 ${activo ? 'text-[#1B3A6B]' : 'text-slate-400'}`} />}
      <span className="flex-1 min-w-0">
        <span className="block text-[13.5px] font-semibold text-slate-800">{titulo}</span>
        <span className="block text-[12px] text-slate-500 mt-0.5 leading-snug">{detalle}</span>
      </span>
      <span className={`mt-0.5 w-10 h-6 rounded-full p-0.5 flex-shrink-0 transition-colors ${activo ? 'bg-[#1B3A6B]' : 'bg-slate-300'}`}>
        <span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${activo ? 'translate-x-4' : ''}`} />
      </span>
    </button>
  )
}

const Rotulo = ({ children }) => <div className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-slate-400 mb-2">{children}</div>

export default function ConfigPlantilla({ plantilla, clientes, onCerrar, onGuardado, onEditar, onDesactivada }) {
  const supabase = useMemo(() => createClient(), [])
  const actuales = (plantilla.clientes || []).map(c => c.cliente_id || c.cliente?.id).filter(Boolean)
  const [nombre, setNombre] = useState(plantilla.nombre || '')
  const [descripcion, setDescripcion] = useState(plantilla.descripcion || '')
  const [accion, setAccion] = useState(accionDe(plantilla))
  const [categorias, setCategorias] = useState(() => categoriasDe(plantilla.bloques))
  const [soloAlgunos, setSoloAlgunos] = useState(() => categoriasDe(plantilla.bloques).length > 0)
  const [renovable, setRenovable] = useState(() => esRenovable(plantilla.bloques))
  const [general, setGeneral] = useState(!!plantilla.uso_general)
  const [estandar, setEstandar] = useState(!!plantilla.es_estandar)
  const [elegidos, setElegidos] = useState(actuales)
  const [buscar, setBuscar] = useState('')
  const [todasCategorias, setTodasCategorias] = useState([])
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)
  const [errorNombre, setErrorNombre] = useState(false)
  const [errorCategorias, setErrorCategorias] = useState(false)
  const [confirmarDesactivar, setConfirmarDesactivar] = useState(false)
  const nombreRef = useRef(null)

  useEffect(() => {
    supabase.from('categorias_equipo').select('id, nombre').order('nombre').then(({ data }) => setTodasCategorias(data || []))
  }, [supabase])

  const accionTxt = ACCIONES[accion].toLowerCase()
  const filtrados = clientes.filter(c => !buscar.trim() || c.nombre.toLowerCase().includes(buscar.trim().toLowerCase()))
  const alternar = id => setElegidos(l => l.includes(id) ? l.filter(x => x !== id) : [...l, id])
  const nombreCliente = id => clientes.find(c => c.id === id)?.nombre || 'Cliente'

  // Guarda y devuelve lo guardado (o false si no se pudo)
  async function guardar() {
    if (!nombre.trim()) { setErrorNombre(true); nombreRef.current?.focus(); return false }
    if (soloAlgunos && !categorias.length) { setErrorCategorias(true); return false }
    setGuardando(true); setError(null)
    const falla = msg => { setError(msg); setGuardando(false); return false }
    const quitar = actuales.filter(id => !elegidos.includes(id))
    const agregar = elegidos.filter(id => !actuales.includes(id))
    if (quitar.length) {
      const { error } = await supabase.from('cliente_plantillas_acta').delete().eq('plantilla_id', plantilla.id).in('cliente_id', quitar)
      if (error) return falla(error.message)
    }
    if (agregar.length) {
      // Va al final de los documentos que ya tenga cada cliente
      const { data: existentes } = await supabase.from('cliente_plantillas_acta').select('cliente_id, orden').in('cliente_id', agregar)
      const filas = agregar.map(id => ({
        cliente_id: id, plantilla_id: plantilla.id,
        orden: Math.max(-1, ...(existentes || []).filter(e => e.cliente_id === id).map(e => e.orden)) + 1,
      }))
      const { error } = await supabase.from('cliente_plantillas_acta').insert(filas)
      if (error) return falla(error.message)
    }
    if (estandar) {
      // Solo una de Ingemedic por acción
      const { error } = await supabase.from('plantillas_acta').update({ es_estandar: false }).eq('accion', accion).neq('id', plantilla.id)
      if (error) return falla(error.message)
    }
    const bloques = [
      ...(plantilla.bloques || []).filter(b => !OCULTOS.includes(b.tipo)),
      ...(soloAlgunos && categorias.length ? [{ tipo: 'para_equipos', categorias }] : []),
      ...(renovable ? [{ tipo: 'renovable' }] : []),
    ]
    const cambios = { nombre: nombre.trim(), descripcion: descripcion.trim() || null, accion, bloques, uso_general: general, es_estandar: estandar }
    const { data, error } = await supabase.from('plantillas_acta').update(cambios).eq('id', plantilla.id).select('id').maybeSingle()
    if (error) return falla(error.message)
    // RLS no avisa: si no volvió la fila, no se guardó
    if (!data) return falla('No se guardaron los cambios (permisos de la tabla plantillas_acta).')
    setGuardando(false)
    const guardado = { ...cambios, clientes: elegidos.map((id, i) => ({ cliente_id: id, orden: i, cliente: clientes.find(c => c.id === id) })) }
    onGuardado(guardado)
    return guardado
  }

  async function desactivar() {
    setGuardando(true)
    const { error: err } = await supabase.from('plantillas_acta').update({ activo: false }).eq('id', plantilla.id)
    if (!err) await supabase.from('cliente_plantillas_acta').delete().eq('plantilla_id', plantilla.id)
    setGuardando(false); setConfirmarDesactivar(false)
    if (err) { setError('No se desactivó: ' + err.message); return }
    onDesactivada()
  }

  const opcion = activo => `flex items-center gap-2.5 p-3 rounded-[10px] border text-left transition-colors ${activo ? 'border-[#1B3A6B] bg-[#1B3A6B]/[0.05] ring-1 ring-[#1B3A6B]' : 'border-slate-200 bg-white hover:border-slate-300'}`

  return (
    <Modal onCerrar={onCerrar} icono={<Settings2 size={16} />} titulo="Configuración de la plantilla" subtitulo={plantilla.nombre}
      z="z-[60]" tamano="xl" bloqueado={guardando}
      pie={<>
        {!plantilla.es_estandar && (
          <button onClick={() => setConfirmarDesactivar(true)} disabled={guardando}
            className="mr-auto inline-flex items-center gap-1.5 h-[38px] px-2.5 rounded-[9px] text-[13px] font-semibold text-[#D81B43] hover:bg-red-50">
            <Trash2 size={14} /> <span className="max-sm:hidden">Desactivar</span>
          </button>
        )}
        <button onClick={onCerrar} disabled={guardando} className={`${ui.btnSecundario} max-sm:hidden`}>Cancelar</button>
        <button onClick={async () => { const g = await guardar(); if (g) onEditar(g) }} disabled={guardando} className={ui.btnAzul}>
          <PencilRuler size={14} /> Editar plantilla
        </button>
        <button onClick={guardar} disabled={guardando} className={ui.btnPrimario}>{guardando ? 'Guardando…' : 'Guardar'}</button>
      </>}>
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)] lg:gap-7">
        {/* ── Lo general ── */}
        <div className="space-y-6 min-w-0">
          <section>
            <Rotulo>Información general</Rotulo>
            <div className="space-y-3">
              <div>
                <label className={ui.label}>Nombre</label>
                <input ref={nombreRef} value={nombre} onChange={e => { setNombre(e.target.value); setErrorNombre(false) }} aria-invalid={errorNombre || undefined}
                  className={`${ui.input} ${errorNombre ? '!border-[#D81B43] ring-2 ring-[#D81B43]/15' : ''}`} />
                {errorNombre && <div className="text-[12px] font-medium text-[#D81B43] mt-1">Escribe el nombre de la plantilla</div>}
              </div>
              <div>
                <label className={ui.label}>Descripción <span className="normal-case tracking-normal font-normal text-slate-400">(opcional)</span></label>
                <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} rows={2} className={`${ui.input} resize-none`} />
              </div>
            </div>
          </section>

          <section>
            <Rotulo>Se usa para</Rotulo>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {Object.entries(ACCIONES).map(([a, l]) => {
                const Icono = ICONO_ACCION[a] || ArrowUpRight
                return (
                  <button key={a} type="button" aria-pressed={accion === a} onClick={() => setAccion(a)} className={`${opcion(accion === a)} flex-col !items-start sm:!items-center sm:text-center`}>
                    <Icono size={17} className={accion === a ? 'text-[#1B3A6B]' : 'text-slate-400'} />
                    <span className={`text-[12.5px] font-semibold leading-tight ${accion === a ? 'text-[#1B3A6B]' : 'text-slate-600'}`}>{l}</span>
                  </button>
                )
              })}
            </div>
          </section>

          <section>
            <Rotulo>Equipos</Rotulo>
            <div className="grid sm:grid-cols-2 gap-2">
              <button type="button" aria-pressed={!soloAlgunos} onClick={() => { setSoloAlgunos(false); setCategorias([]); setErrorCategorias(false) }} className={opcion(!soloAlgunos)}>
                <Boxes size={17} className={!soloAlgunos ? 'text-[#1B3A6B]' : 'text-slate-400'} />
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-slate-700">Todos los equipos</span>
                  <span className="block text-[11.5px] text-slate-400">Toma todo lo del préstamo</span>
                </span>
              </button>
              <button type="button" aria-pressed={soloAlgunos} onClick={() => setSoloAlgunos(true)} className={opcion(soloAlgunos)}>
                <Tags size={17} className={soloAlgunos ? 'text-[#1B3A6B]' : 'text-slate-400'} />
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-slate-700">Solo algunas categorías</span>
                  <span className="block text-[11.5px] text-slate-400">Y se sugiere solo con ellas</span>
                </span>
              </button>
            </div>
            {soloAlgunos && (
              <div className={`mt-2 p-2.5 rounded-[10px] border ${errorCategorias ? 'border-[#D81B43] bg-red-50/40' : 'border-slate-200 bg-slate-50'}`}>
                <div className="flex flex-wrap items-center gap-1.5">
                  {categorias.map(c => (
                    <span key={c.id || c.nombre} className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full bg-white border border-[#2EB5D4]/40 text-[12.5px] font-semibold text-[#0E7490]">
                      {c.nombre}
                      <button type="button" aria-label={`Quitar ${c.nombre}`} onClick={() => setCategorias(l => l.filter(x => x !== c))}
                        className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-[#0E7490]/10"><X size={11} /></button>
                    </span>
                  ))}
                  <select value="" onChange={e => { const c = todasCategorias.find(x => x.id === e.target.value); if (c) { setCategorias(l => [...l, { id: c.id, nombre: c.nombre }]); setErrorCategorias(false) } }}
                    className="h-8 rounded-full border border-dashed border-slate-300 bg-white px-3 text-[12.5px] font-semibold text-[#1B3A6B] cursor-pointer">
                    <option value="">+ Agregar categoría</option>
                    {todasCategorias.filter(c => !categorias.some(x => x.id === c.id)).map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
                {errorCategorias && <div className="text-[12px] font-medium text-[#D81B43] mt-1.5">Elige al menos una categoría</div>}
              </div>
            )}
          </section>

          <section>
            <Rotulo>Renovación</Rotulo>
            <div className="px-3 rounded-[10px] border border-slate-200">
              <Interruptor activo={renovable} onCambiar={setRenovable} icono={RefreshCw} titulo="Renovable"
                detalle="El acta firmada se puede renovar en el préstamo, con fecha nueva y la misma firma." />
            </div>
          </section>
        </div>

        {/* ── Quién la usa ── */}
        <section className="mt-6 lg:mt-0 min-w-0 lg:p-4 lg:rounded-xl lg:bg-slate-50 lg:border lg:border-slate-200 flex flex-col">
          <Rotulo>Quién la usa</Rotulo>
          <div className="px-3 rounded-[10px] border border-slate-200 bg-white divide-y divide-slate-100 mb-4">
            <Interruptor activo={estandar} onCambiar={setEstandar} icono={Star} titulo={`De Ingemedic para ${accionTxt}`}
              detalle="Cuando el cliente no tiene una propia. Solo una por acción." />
            <Interruptor activo={general} onCambiar={setGeneral} icono={Globe} titulo="Uso general" detalle="Se puede elegir con cualquier cliente." />
          </div>

          <div className="flex items-center gap-2 mb-2">
            <Users size={15} className="text-slate-400" />
            <span className="text-[13px] font-semibold text-slate-700">Clientes asignados</span>
            <span className="ml-auto px-2 py-0.5 rounded-full bg-[#1B3A6B]/10 text-[11.5px] font-bold text-[#1B3A6B]">{elegidos.length}</span>
          </div>
          {elegidos.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2.5">
              {elegidos.map(id => (
                <span key={id} className="inline-flex items-center gap-1 max-w-full pl-2.5 pr-1 py-1 rounded-full bg-white border border-slate-200 text-[12px] font-medium text-slate-700">
                  <span className="truncate">{nombreCliente(id)}</span>
                  <button type="button" aria-label={`Quitar ${nombreCliente(id)}`} onClick={() => alternar(id)}
                    className="w-5 h-5 rounded-full flex items-center justify-center text-slate-400 hover:text-[#D81B43] hover:bg-red-50 flex-shrink-0"><X size={11} /></button>
                </span>
              ))}
            </div>
          )}
          <div className="relative mb-2">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={buscar} onChange={e => setBuscar(e.target.value)} placeholder="Buscar cliente…" className={`${ui.input} pl-9`} />
          </div>
          <div className="flex-1 min-h-[160px] max-h-[300px] lg:max-h-[340px] overflow-y-auto rounded-[10px] border border-slate-200 bg-white divide-y divide-slate-100">
            {filtrados.map(c => {
              const marcado = elegidos.includes(c.id)
              return (
                <button key={c.id} type="button" onClick={() => alternar(c.id)} aria-pressed={marcado}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left text-[13px] ${marcado ? 'bg-[#1B3A6B]/[0.04] text-slate-800 font-semibold' : 'text-slate-600 hover:bg-slate-50'}`}>
                  <span className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 ${marcado ? 'bg-[#1B3A6B] border-[#1B3A6B] text-white' : 'border-slate-300'}`}>
                    {marcado && <Check size={12} strokeWidth={3} />}
                  </span>
                  <span className="truncate">{c.nombre}</span>
                </button>
              )
            })}
            {filtrados.length === 0 && <div className="px-3 py-3 text-[12.5px] text-slate-400">Ningún cliente coincide.</div>}
          </div>
        </section>
      </div>

      {error && <div className="mt-4 px-3 py-2.5 bg-red-50 border border-red-200 rounded-[8px] text-[12.5px] text-red-700">{error}</div>}

      <ConfirmDialog abierto={confirmarDesactivar} titulo="¿Desactivar esta plantilla?" mensaje="Deja de ofrecerse en los préstamos nuevos. Las actas firmadas no cambian."
        textoConfirmar="Desactivar" tipo="peligro" onConfirmar={desactivar} onCancelar={() => setConfirmarDesactivar(false)} />
    </Modal>
  )
}
