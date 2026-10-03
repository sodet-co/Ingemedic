'use client'
import { useEffect, useMemo, useState } from 'react'
import { Search, Check, ArrowRight, ArrowDown, ArrowLeft, X, PackageSearch, Loader2, ChevronRight } from 'lucide-react'
import { hoyBogota } from '@/lib/fechas'
import { IconoTipo } from '@/components/inventario/IconoTipo'

const inputCls = 'w-full px-3.5 py-2.5 border border-slate-200 rounded-[10px] text-[14px] text-slate-800 outline-none focus:border-[#2EB5D4] focus:ring-4 focus:ring-[#2EB5D4]/15 bg-white transition-shadow placeholder:text-slate-400'
const labelCls = 'block text-[11px] font-bold uppercase tracking-[0.07em] text-slate-500 mb-1.5'
const MAX_VISIBLES = 90 // con tipos de cientos de unidades, se pide afinar la búsqueda

function datos(eq) {
  const a = eq?.atributos || {}
  return [a.serie && `Serie ${a.serie}`, a.modelo && `Modelo ${a.modelo}`, a.marca && a.marca].filter(Boolean)
}

function nombreTipo(tipo) {
  return tipo?.atributos?.nombre || tipo?.nombre || '—'
}

function coincide(eq, q) {
  return [eq.codigo, ...Object.values(eq.atributos || {})].some(v => String(v ?? '').toLowerCase().includes(q))
}

// Tarjeta del equipo que sale / entra en la franja superior
function TarjetaEquipo({ etiqueta, eq, categorias, vacio, resaltada }) {
  return (
    <div className={`flex-1 min-w-0 flex items-center gap-3 p-3 rounded-[12px] border ${
      vacio ? 'border-dashed border-slate-300 bg-white' : resaltada ? 'border-[#D81B43]/40 bg-[#D81B43]/[0.04]' : 'border-slate-200 bg-white'
    }`}>
      <div className="w-11 h-11 rounded-[10px] bg-slate-50 border border-slate-200 flex items-center justify-center flex-shrink-0">
        {vacio ? <PackageSearch size={20} className="text-slate-300" /> : <IconoTipo tipo={eq.tipo_equipo} categorias={categorias} size={26} />}
      </div>
      <div className="min-w-0">
        <div className={`text-[10px] font-bold uppercase tracking-[0.08em] ${resaltada ? 'text-[#D81B43]' : 'text-slate-400'}`}>{etiqueta}</div>
        {vacio
          ? <div className="text-[13px] text-slate-400">Elige un equipo de la lista</div>
          : <>
              <div className="text-[14px] font-bold text-slate-800 truncate">
                {eq.codigo} <span className="font-medium text-slate-500">· {nombreTipo(eq.tipo_equipo)}</span>
              </div>
              <div className="text-[12px] text-slate-500 truncate">{datos(eq).join(' · ') || 'Sin serie registrada'}</div>
            </>}
      </div>
    </div>
  )
}

// Tarjeta de categoría o de tipo en los niveles de navegación
function TarjetaGrupo({ icono, titulo, cantidad, onClick }) {
  return (
    <button type="button" onClick={onClick}
      className="flex items-center gap-3 p-3 rounded-[12px] border border-slate-200 bg-white text-left hover:border-slate-300 hover:shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2EB5D4]">
      <span className="w-11 h-11 rounded-[10px] bg-slate-50 border border-slate-200 flex items-center justify-center flex-shrink-0">{icono}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-bold text-slate-800 truncate">{titulo}</span>
        <span className="block text-[12px] text-slate-500">{cantidad} disponible{cantidad === 1 ? '' : 's'}</span>
      </span>
      <ChevronRight size={16} className="text-slate-300 flex-shrink-0" />
    </button>
  )
}

// Cambiar un equipo de un préstamo por otro disponible (la lógica vive en
// cambiarEquipo() de lib/prestamos.js). Abre en las unidades del MISMO tipo;
// con "Volver" se sube a los otros tipos de la categoría y luego a todas las
// categorías — mismo esquema categorías → tipos → unidades del wizard de
// Préstamos. El buscador, fuera del nivel de unidades, busca en todo.
// La fecha y el motivo solo aplican si el préstamo ya se entregó.
// Se monta solo mientras está abierto, así el formulario arranca limpio cada vez.
export default function ModalCambioEquipo({ equipoActual, disponibles, categorias, tiposEquipo, entregada, guardando, onConfirmar, onCancelar }) {
  const tipoActual = equipoActual?.tipo_equipo
  const [vista, setVista]               = useState('unidades') // 'categorias' | 'tipos' | 'unidades'
  const [categoriaId, setCategoriaId]   = useState(tipoActual?.categoria?.id || tipoActual?.categoria_id || null)
  const [tipoId, setTipoId]             = useState(equipoActual?.tipo_equipo_id || tipoActual?.id || null)
  const [buscar, setBuscar]             = useState('')
  const [seleccionado, setSeleccionado] = useState(null)
  const [fecha, setFecha]               = useState(hoyBogota())
  const [motivo, setMotivo]             = useState('')

  // ESC cierra solo este modal: en captura y sin propagar, para que el drawer
  // del préstamo (que también escucha ESC) no se cierre detrás
  useEffect(() => {
    const onEsc = e => {
      if (e.key !== 'Escape') return
      e.stopImmediatePropagation()
      if (!guardando) onCancelar()
    }
    window.addEventListener('keydown', onEsc, true)
    return () => window.removeEventListener('keydown', onEsc, true)
  }, [guardando, onCancelar])

  const tipoPorId = useMemo(() => new Map((tiposEquipo || []).map(t => [t.id, t])), [tiposEquipo])
  const porTipo = useMemo(() => {
    const m = new Map()
    for (const eq of disponibles) m.set(eq.tipo_equipo_id, (m.get(eq.tipo_equipo_id) || 0) + 1)
    return m
  }, [disponibles])
  const categoriaDe = id => tipoPorId.get(id)?.categoria_id

  const categoria = categorias.find(c => c.id === categoriaId) || null
  const tipo = tipoPorId.get(tipoId) || (tipoActual?.id === tipoId ? tipoActual : null)

  // Solo categorías y tipos con al menos una unidad disponible
  const categoriasConDisp = useMemo(() => categorias
    .map(c => ({ c, n: disponibles.filter(eq => categoriaDe(eq.tipo_equipo_id) === c.id).length }))
    .filter(x => x.n > 0),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [categorias, disponibles, tipoPorId])
  const tiposConDisp = useMemo(() => (tiposEquipo || [])
    .filter(t => t.categoria_id === categoriaId && porTipo.get(t.id))
    .map(t => ({ t, n: porTipo.get(t.id) })),
  [tiposEquipo, categoriaId, porTipo])

  const q = buscar.trim().toLowerCase()
  const busquedaGlobal = q && vista !== 'unidades'
  const unidades = useMemo(() => {
    if (busquedaGlobal) return disponibles.filter(eq => coincide(eq, q))
    if (vista !== 'unidades') return []
    const delTipo = disponibles.filter(eq => eq.tipo_equipo_id === tipoId)
    return q ? delTipo.filter(eq => coincide(eq, q)) : delTipo
  }, [disponibles, vista, tipoId, q, busquedaGlobal])
  const totalDelTipo = porTipo.get(tipoId) || 0
  const visibles = unidades.slice(0, MAX_VISIBLES)
  const verUnidades = vista === 'unidades' || busquedaGlobal

  function irA(nuevaVista, { cat, tip } = {}) {
    if (cat !== undefined) setCategoriaId(cat)
    if (tip !== undefined) setTipoId(tip)
    setVista(nuevaVista)
    setBuscar('')
  }
  function volver() {
    if (vista === 'unidades') irA('tipos')
    else if (vista === 'tipos') irA('categorias')
  }

  const puedeConfirmar = seleccionado && (!entregada || fecha) && !guardando
  const migas = [
    { label: 'Categorías', onClick: () => irA('categorias'), visible: true },
    { label: categoria?.nombre, onClick: () => irA('tipos'), visible: vista !== 'categorias' && categoria },
    { label: nombreTipo(tipo), onClick: null, visible: vista === 'unidades' },
  ].filter(m => m.visible)

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/50 z-[75] backdrop-blur-sm" onClick={() => !guardando && onCancelar()} />
      <div className="fixed inset-x-0 bottom-0 h-[92vh] md:inset-0 md:h-auto z-[75] flex md:items-center justify-center md:p-6 pointer-events-none">
        <div role="dialog" aria-modal="true" aria-labelledby="cambio-equipo-titulo"
          className="pointer-events-auto bg-[#F8FAFC] w-full h-full md:h-[min(88vh,820px)] md:max-w-[920px] rounded-t-2xl md:rounded-2xl flex flex-col shadow-2xl overflow-hidden">

          {/* Encabezado */}
          <div className="bg-white px-5 md:px-7 py-4 border-b border-slate-200 flex items-start justify-between gap-4 flex-shrink-0">
            <div className="min-w-0">
              <h3 id="cambio-equipo-titulo" className="text-[18px] font-bold text-[#1B3A6B]">Cambiar equipo</h3>
              <p className="text-[13px] text-slate-500 mt-0.5">
                {entregada
                  ? 'El equipo actual queda como devuelto y el nuevo entra al préstamo con el mismo cliente y paciente.'
                  : 'El préstamo aún no se entrega: el equipo se reemplaza directamente y el actual vuelve a Disponible.'}
              </p>
            </div>
            <button type="button" onClick={onCancelar} disabled={guardando} aria-label="Cerrar"
              className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex-shrink-0">
              <X size={18} />
            </button>
          </div>

          {/* Sale → Entra */}
          <div className="bg-white px-5 md:px-7 py-4 border-b border-slate-200 flex flex-col md:flex-row items-stretch md:items-center gap-2 md:gap-3 flex-shrink-0">
            <TarjetaEquipo etiqueta="Sale" eq={equipoActual} categorias={categorias} />
            <div className="flex justify-center text-slate-300 flex-shrink-0">
              <ArrowRight size={20} className="hidden md:block" />
              <ArrowDown size={18} className="md:hidden" />
            </div>
            <TarjetaEquipo etiqueta="Entra" eq={seleccionado} categorias={categorias} vacio={!seleccionado} resaltada />
          </div>

          {/* Navegación + buscador */}
          <div className="px-5 md:px-7 pt-4 flex-shrink-0">
            <div className="flex items-center gap-2 mb-3 min-w-0">
              {vista !== 'categorias' && (
                <button type="button" onClick={volver}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[8px] border border-slate-200 bg-white text-[12.5px] font-semibold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2EB5D4]">
                  <ArrowLeft size={14} /> {vista === 'unidades' ? 'Otros tipos' : 'Otras categorías'}
                </button>
              )}
              <nav aria-label="Ubicación" className="flex items-center gap-1 text-[12.5px] min-w-0 overflow-hidden">
                {migas.map((m, i) => (
                  <span key={i} className="flex items-center gap-1 min-w-0">
                    {i > 0 && <ChevronRight size={13} className="text-slate-300 flex-shrink-0" />}
                    {m.onClick && i < migas.length - 1
                      ? <button type="button" onClick={m.onClick} className="text-slate-500 hover:text-[#1B3A6B] hover:underline truncate">{m.label}</button>
                      : <span className="font-semibold text-slate-700 truncate">{m.label}</span>}
                  </span>
                ))}
              </nav>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-3">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={buscar} onChange={e => setBuscar(e.target.value)} autoFocus
                  placeholder={vista === 'unidades' ? `Buscar ${nombreTipo(tipo)} por código, serie o modelo` : 'Buscar cualquier equipo disponible por código o serie'}
                  className={`${inputCls} pl-10`} />
              </div>
              {vista === 'unidades' && !busquedaGlobal && (
                <div className="text-[12.5px] text-slate-500 whitespace-nowrap">
                  <span className="font-bold text-slate-700">{unidades.length}</span> de {totalDelTipo} disponibles
                </div>
              )}
            </div>
          </div>

          {/* Contenido del nivel */}
          <div className="flex-1 min-h-0 overflow-y-auto px-5 md:px-7 pb-4">
            {vista === 'categorias' && !busquedaGlobal && (
              categoriasConDisp.length === 0
                ? <Vacio titulo="No hay equipos disponibles" />
                : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {categoriasConDisp.map(({ c, n }) => (
                      <TarjetaGrupo key={c.id} titulo={c.nombre} cantidad={n}
                        icono={c.imagen_url && !c.imagen_url.startsWith('icono:')
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={c.imagen_url} alt="" className="w-7 h-7 object-contain" />
                          : <IconoTipo tipo={{ nombre: c.nombre, categoria_id: c.id }} categorias={categorias} size={26} />}
                        onClick={() => irA('tipos', { cat: c.id })} />
                    ))}
                  </div>
            )}

            {vista === 'tipos' && !busquedaGlobal && (
              tiposConDisp.length === 0
                ? <Vacio titulo={`No hay equipos disponibles en ${categoria?.nombre || 'esta categoría'}`} />
                : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {tiposConDisp.map(({ t, n }) => (
                      <TarjetaGrupo key={t.id} titulo={nombreTipo(t)} cantidad={n}
                        icono={<IconoTipo tipo={t} categorias={categorias} size={26} />}
                        onClick={() => irA('unidades', { tip: t.id })} />
                    ))}
                  </div>
            )}

            {verUnidades && (
              unidades.length === 0 ? (
                q ? <Vacio titulo={`Ningún equipo coincide con “${buscar}”`} />
                  : <Vacio titulo={`No hay otro ${nombreTipo(tipo)} disponible`}
                      texto="Usa “Otros tipos” para buscar en el resto de la categoría." />
              ) : (
                <div role="radiogroup" aria-label="Equipos disponibles"
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {visibles.map(eq => {
                    const activo = seleccionado?.id === eq.id
                    const info = datos(eq)
                    return (
                      <button key={eq.id} type="button" role="radio" aria-checked={activo}
                        onClick={() => setSeleccionado(eq)}
                        className={`flex items-center gap-3 p-3 rounded-[12px] border text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2EB5D4] ${
                          activo ? 'border-[#D81B43] bg-white ring-2 ring-[#D81B43]/20 shadow-sm'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                        }`}>
                        <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                          activo ? 'border-[#D81B43] bg-[#D81B43]' : 'border-slate-300'
                        }`}>
                          {activo && <Check size={12} strokeWidth={3} className="text-white" />}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[14px] font-bold text-slate-800 truncate">{eq.codigo}</span>
                          <span className="block text-[12px] text-slate-500 truncate">
                            {(busquedaGlobal ? [nombreTipo(eq.tipo_equipo), ...info] : info).join(' · ') || 'Sin serie registrada'}
                          </span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              )
            )}
            {verUnidades && unidades.length > MAX_VISIBLES && (
              <div className="mt-3 text-center text-[12.5px] text-slate-400">
                Se muestran {MAX_VISIBLES} de {unidades.length}. Escribe el código o la serie para encontrar el que buscas.
              </div>
            )}
          </div>

          {/* Pie: fecha/motivo (solo entregado) + acciones */}
          <div className="bg-white border-t border-slate-200 px-5 md:px-7 py-4 flex-shrink-0">
            {entregada && (
              <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-3 mb-4">
                <div>
                  <label htmlFor="cambio-fecha" className={labelCls}>Fecha del cambio <span className="text-[#D81B43]">*</span></label>
                  <input id="cambio-fecha" type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label htmlFor="cambio-motivo" className={labelCls}>Motivo (opcional)</label>
                  <input id="cambio-motivo" value={motivo} onChange={e => setMotivo(e.target.value)}
                    placeholder="Ej. falla en el regulador" className={inputCls} />
                </div>
              </div>
            )}
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <button type="button" onClick={onCancelar} disabled={guardando}
                className="px-5 py-2.5 bg-slate-100 text-slate-600 rounded-[10px] text-[14px] font-semibold hover:bg-slate-200 transition-colors">
                Cancelar
              </button>
              <button type="button" disabled={!puedeConfirmar}
                onClick={() => onConfirmar({ equipoNuevo: seleccionado, fecha, motivo: motivo.trim() })}
                className="px-6 py-2.5 bg-[#D81B43] text-white rounded-[10px] text-[14px] font-semibold hover:bg-[#B0172F] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {guardando
                  ? <><Loader2 size={16} className="animate-spin" /> Cambiando…</>
                  : seleccionado ? <>Cambiar por {seleccionado.codigo}</> : 'Cambiar equipo'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

function Vacio({ titulo, texto }) {
  return (
    <div className="h-full min-h-[180px] flex flex-col items-center justify-center text-center gap-2">
      <PackageSearch size={36} className="text-slate-300" />
      <div className="text-[15px] font-semibold text-slate-600">{titulo}</div>
      {texto && <div className="text-[13px] text-slate-400 max-w-[360px]">{texto}</div>}
    </div>
  )
}
