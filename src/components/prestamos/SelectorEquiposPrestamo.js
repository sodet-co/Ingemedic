'use client'
import { useEffect, useMemo, useState } from 'react'
import { Search, Package, ChevronRight, ChevronLeft, Check, Plus, Trash2 } from 'lucide-react'
import { IconoTipo } from '@/components/inventario/IconoTipo'

// Selector de equipos del préstamo: categorías → tipos → unidades, con filtros por
// los campos de la categoría y el carrito al lado. Es el de siempre (pedido del
// cliente); se sacó de OrdenesClient para usarlo en el asistente por pasos.
const labelCls = 'block text-[11px] font-bold uppercase tracking-[0.07em] text-slate-500 mb-1.5'
const FILAS_POR_PAGINA = 10
const nombreEquipo = eq => eq?.tipo_equipo?.atributos?.nombre || eq?.tipo_equipo?.nombre || '—'
const nombreTipo = tipo => tipo?.nombre || '—'

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


export default function SelectorEquiposPrestamo({ equipos, categorias, tiposEquipo, seleccionados, onAgregar, onQuitar }) {
  const [miniVista, setMiniVista] = useState('categorias')
  const [miniCategoria, setMiniCategoria] = useState(null)
  const [miniTipo, setMiniTipo] = useState(null)
  const [buscarCodigoMini, setBuscarCodigoMini] = useState('')
  const [filtrosCamposMini, setFiltrosCamposMini] = useState({})
  const [paginaUnidades, setPaginaUnidades] = useState(1)

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

  return (
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
                              const seleccionado = seleccionados.includes(eq.id)
                              return (
                                <tr key={eq.id}
                                  onClick={() => seleccionado ? onQuitar(eq.id) : onAgregar(eq.id)}
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
                                      onClick={e => { e.stopPropagation(); seleccionado ? onQuitar(eq.id) : onAgregar(eq.id) }}
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
                  <div className={labelCls}>Carrito ({seleccionados.length})</div>
                  {seleccionados.length === 0 ? (
                    <div className="text-[12.5px] text-slate-400 text-center py-8 border border-dashed border-slate-200 rounded-[9px]">
                      Agrega equipos desde el panel de la izquierda
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {seleccionados.map(id => {
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
                            <button type="button" onClick={() => onQuitar(id)}
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
  )
}
