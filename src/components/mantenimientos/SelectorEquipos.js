'use client'
import { useState, useMemo } from 'react'
import { Search, ChevronLeft, ChevronRight, Check, X, Layers } from 'lucide-react'
import { IconoTipo } from '@/components/inventario/IconoTipo'

// Selector de equipos para abrir mantenimientos: mini-inventario
// (categorías → tipos → unidades) como el wizard de Préstamos, con selección
// múltiple, más un buscador global por código, serie, modelo, equipo o
// paciente que permite marcar directo sin navegar nivel por nivel.
// Los equipos con un mantenimiento abierto se ven pero no se pueden marcar.

export const ESTADO_EQUIPO_STYLES = {
  'Disponible':       { bg: '#ECFDF5', color: '#0F7B55', dot: '#0F7B55' },
  'Reservado':        { bg: '#FFFBEB', color: '#B45309', dot: '#F59E0B' },
  'En préstamo':      { bg: '#E8F7FB', color: '#0E86A0', dot: '#2EB5D4' },
  'En mantenimiento': { bg: '#FFFBEB', color: '#B45309', dot: '#F59E0B' },
  'Baja':             { bg: '#F1F5F9', color: '#64748B', dot: '#94A3B8' },
}

export const nombreEquipo = eq => eq?.tipo_equipo?.atributos?.nombre || eq?.tipo_equipo?.nombre || '—'
const normalizar = s => (s || '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const POR_PAGINA = 25
const ORDEN_ESTADOS = ['Disponible', 'En préstamo', 'Reservado', 'Baja', 'En mantenimiento']

export function EstadoEquipoBadge({ nombre }) {
  const s = ESTADO_EQUIPO_STYLES[nombre] || ESTADO_EQUIPO_STYLES.Baja
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10.5px] font-bold whitespace-nowrap"
      style={{ background: s.bg, color: s.color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.dot }} />
      {nombre || '—'}
    </span>
  )
}

export default function SelectorEquipos({ equipos, categorias, tiposEquipo, seleccionados, onToggle, onToggleVarios }) {
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [vista, setVista] = useState('categorias') // 'categorias' | 'tipos' | 'unidades'
  const [categoria, setCategoria] = useState(null)
  const [tipo, setTipo] = useState(null)
  const [filtrosCampos, setFiltrosCampos] = useState({})
  const [pagina, setPagina] = useState(1)

  const sel = useMemo(() => new Set(seleccionados), [seleccionados])
  const bloqueado = eq => eq.estado?.nombre === 'En mantenimiento'

  // Conteo por estado (para los chips) y la base filtrada por estado
  const conteoEstados = useMemo(() => {
    const c = {}
    for (const e of equipos) c[e.estado?.nombre || '—'] = (c[e.estado?.nombre || '—'] || 0) + 1
    return c
  }, [equipos])
  const base = useMemo(
    () => filtroEstado ? equipos.filter(e => e.estado?.nombre === filtroEstado) : equipos,
    [equipos, filtroEstado]
  )

  const tipoPorId = useMemo(() => Object.fromEntries(tiposEquipo.map(t => [t.id, t])), [tiposEquipo])
  const porTipo = useMemo(() => {
    const m = {}
    for (const e of base) (m[e.tipo_equipo_id] ||= []).push(e)
    return m
  }, [base])
  const porCategoria = useMemo(() => {
    const m = {}
    for (const e of base) {
      const cat = e.tipo_equipo?.categoria_id || tipoPorId[e.tipo_equipo_id]?.categoria_id
      if (cat) m[cat] = (m[cat] || 0) + 1
    }
    return m
  }, [base, tipoPorId])

  // ── Búsqueda global ──
  const q = normalizar(busqueda.trim())
  const resultados = useMemo(() => {
    if (!q) return []
    const palabras = q.split(/\s+/)
    return base.filter(e => {
      const texto = normalizar([
        e.codigo, e.atributos?.codigo_inventario, e.atributos?.serie, e.atributos?.modelo,
        nombreEquipo(e), e.tipo_equipo?.nombre, e.tipo_equipo?.categoria?.nombre,
        e.paciente_actual?.nombre, e.cliente_actual?.nombre,
      ].filter(Boolean).join(' '))
      return palabras.every(p => texto.includes(p))
    })
  }, [q, base])

  // ── Unidades del tipo elegido ──
  const camposUnidad = (categoria?.atributos_extra?.campos_unidad || [])
    .filter(c => c.clave !== 'codigo' && c.clave !== 'codigo_inventario' && c.clave !== 'nombre')
  const unidadesTipo = useMemo(() => tipo ? (porTipo[tipo.id] || []) : [], [tipo, porTipo])
  const unidadesFiltradas = useMemo(() => unidadesTipo.filter(e =>
    Object.entries(filtrosCampos).every(([clave, valor]) =>
      !valor || normalizar(e.atributos?.[clave] ?? e[clave]).includes(normalizar(valor)))
  ), [unidadesTipo, filtrosCampos])
  const valoresUnicos = useMemo(() => {
    const m = {}
    for (const c of camposUnidad) {
      m[c.clave] = [...new Set(unidadesTipo.map(e => e.atributos?.[c.clave]).filter(v => v != null && v !== ''))].sort()
    }
    return m
  }, [unidadesTipo, camposUnidad])

  const lista = q ? resultados : vista === 'unidades' ? unidadesFiltradas : []
  const totalPaginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA))
  const paginaActual = Math.min(pagina, totalPaginas)
  const listaPagina = lista.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA)

  const seleccionablesLista = lista.filter(e => !bloqueado(e))
  const todosMarcados = seleccionablesLista.length > 0 && seleccionablesLista.every(e => sel.has(e.id))

  function irCategoria(cat) { setCategoria(cat); setVista('tipos'); setPagina(1) }
  function irTipo(t) { setTipo(t); setVista('unidades'); setFiltrosCampos({}); setPagina(1) }
  function volver() {
    if (vista === 'unidades') { setVista('tipos'); setTipo(null); setFiltrosCampos({}) }
    else { setVista('categorias'); setCategoria(null) }
    setPagina(1)
  }

  const tiposDeCategoria = categoria
    ? tiposEquipo.filter(t => t.categoria_id === categoria.id && (porTipo[t.id]?.length || 0) > 0)
    : []
  const categoriasConEquipos = categorias.filter(c => (porCategoria[c.id] || 0) > 0)

  return (
    <div className="flex flex-col gap-3 min-w-0">
      {/* Buscador global */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
        <input value={busqueda} onChange={e => { setBusqueda(e.target.value); setPagina(1) }}
          aria-label="Buscar equipo"
          placeholder="Buscar por código, serie, modelo, equipo o paciente…"
          className="w-full pl-9 pr-9 py-2.5 border border-slate-200 rounded-[9px] text-[16px] md:text-[13.5px] outline-none focus:border-[#D81B43] bg-white placeholder:text-slate-400" />
        {busqueda && (
          <button type="button" onClick={() => setBusqueda('')} aria-label="Limpiar búsqueda"
            className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Filtro por estado del equipo */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]">
        {[['', 'Todos', equipos.length], ...ORDEN_ESTADOS.filter(e => conteoEstados[e]).map(e => [e, e, conteoEstados[e]])].map(([v, l, n]) => (
          <button key={l} type="button" onClick={() => { setFiltroEstado(v); setPagina(1) }} aria-pressed={filtroEstado === v}
            className={`px-3 h-8 rounded-full text-[12px] whitespace-nowrap flex-shrink-0 border transition-colors ${
              filtroEstado === v ? 'bg-[#1B3A6B] border-[#1B3A6B] text-white font-bold' : 'bg-white border-slate-200 text-slate-600 font-medium hover:border-slate-300'
            }`}>
            {l} <span className="opacity-70 tabular-nums">{n}</span>
          </button>
        ))}
      </div>

      {/* Migas / volver */}
      {!q && vista !== 'categorias' && (
        <div className="flex items-center gap-1.5 text-[12px] min-w-0">
          <button type="button" onClick={volver} className="flex items-center gap-1 text-slate-500 hover:text-[#D81B43] font-medium flex-shrink-0">
            <ChevronLeft size={13} /> Volver
          </button>
          <span className="text-slate-300">/</span>
          <button type="button" onClick={() => { setVista('categorias'); setCategoria(null); setTipo(null) }}
            className="text-slate-400 hover:text-slate-600">Categorías</button>
          <span className="text-slate-300">/</span>
          <span className={`truncate ${vista === 'tipos' ? 'font-bold text-slate-800' : 'text-slate-400'}`}>{categoria?.nombre}</span>
          {vista === 'unidades' && <><span className="text-slate-300">/</span><span className="font-bold text-slate-800 truncate">{tipo?.nombre}</span></>}
        </div>
      )}

      {/* ── CATEGORÍAS ── */}
      {!q && vista === 'categorias' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {categoriasConEquipos.map(cat => (
            <button key={cat.id} type="button" onClick={() => irCategoria(cat)}
              className="text-left bg-slate-50 rounded-[9px] border border-slate-200 p-3 hover:border-[#D81B43]/40 hover:bg-white transition-all">
              <div className="text-[12.5px] font-bold text-slate-700 leading-tight">{cat.nombre}</div>
              <div className="text-[10.5px] text-slate-400 mt-0.5">{porCategoria[cat.id]} equipo{porCategoria[cat.id] !== 1 ? 's' : ''}</div>
            </button>
          ))}
          {categoriasConEquipos.length === 0 && (
            <div className="col-span-full text-[12.5px] text-slate-400 text-center py-6">Ningún equipo con este estado</div>
          )}
        </div>
      )}

      {/* ── TIPOS ── */}
      {!q && vista === 'tipos' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {tiposDeCategoria.map(t => {
            const unidades = porTipo[t.id] || []
            const marcados = unidades.filter(e => sel.has(e.id)).length
            return (
              <button key={t.id} type="button" onClick={() => irTipo(t)}
                className="text-left bg-white rounded-[9px] border border-slate-200 overflow-hidden hover:border-[#D81B43]/40 hover:shadow-sm transition-all flex">
                <div className="w-[48px] flex-shrink-0 bg-slate-50 flex items-center justify-center border-r border-slate-100">
                  <IconoTipo tipo={t} categorias={categorias} size={26} />
                </div>
                <div className="p-2.5 flex-1 min-w-0">
                  <div className="text-[12px] font-bold text-slate-800 truncate">{t.atributos?.nombre || t.nombre}</div>
                  <div className="text-[10.5px] text-slate-400 truncate">
                    {t.atributos?.nombre && t.atributos.nombre !== t.nombre ? `${t.nombre} · ` : ''}{unidades.length} unidad{unidades.length !== 1 ? 'es' : ''}
                    {marcados > 0 && <span className="text-[#D81B43] font-bold"> · {marcados} marcada{marcados !== 1 ? 's' : ''}</span>}
                  </div>
                </div>
                <ChevronRight size={14} className="self-center mr-2 text-slate-300 flex-shrink-0" />
              </button>
            )
          })}
          {tiposDeCategoria.length === 0 && (
            <div className="col-span-full text-[12.5px] text-slate-400 text-center py-6">Sin tipos con equipos en esta categoría</div>
          )}
        </div>
      )}

      {/* Filtros por columna de la unidad */}
      {!q && vista === 'unidades' && camposUnidad.length > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-[9px] p-2.5 grid grid-cols-2 md:grid-cols-3 gap-2">
          {camposUnidad.map(c => {
            const valores = valoresUnicos[c.clave] || []
            const dropdown = valores.length > 0 && valores.length <= 8
            const cls = 'w-full px-2 py-1.5 border border-slate-200 rounded-[7px] text-[16px] md:text-[12px] outline-none focus:border-[#D81B43] bg-white'
            return (
              <div key={c.clave} className="min-w-0">
                <label className="text-[10px] font-bold uppercase text-slate-500 mb-1 block truncate">{c.nombre}</label>
                {dropdown ? (
                  <select value={filtrosCampos[c.clave] || ''} onChange={e => { setFiltrosCampos(f => ({ ...f, [c.clave]: e.target.value })); setPagina(1) }} className={cls}>
                    <option value="">Todos</option>
                    {valores.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                ) : (
                  <input value={filtrosCampos[c.clave] || ''} onChange={e => { setFiltrosCampos(f => ({ ...f, [c.clave]: e.target.value })); setPagina(1) }}
                    placeholder="Filtrar…" className={`${cls} placeholder:text-slate-400`} />
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── LISTA (resultados de búsqueda o unidades del tipo) ── */}
      {(q || vista === 'unidades') && (
        <div className="border border-slate-200 rounded-[10px] overflow-hidden bg-white">
          <div className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200">
            <span className="text-[11.5px] font-semibold text-slate-500">
              {q ? `${lista.length} resultado${lista.length !== 1 ? 's' : ''}` : `${lista.length} unidad${lista.length !== 1 ? 'es' : ''}`}
            </span>
            {seleccionablesLista.length > 0 && (
              <button type="button" onClick={() => onToggleVarios(seleccionablesLista.map(e => e.id), !todosMarcados)}
                className="flex items-center gap-1.5 text-[11.5px] font-bold text-[#1B3A6B] hover:underline">
                <Layers size={12} /> {todosMarcados ? 'Quitar todos' : `Marcar todos (${seleccionablesLista.length})`}
              </button>
            )}
          </div>
          {listaPagina.length === 0 ? (
            <div className="text-center py-8 text-[12.5px] text-slate-400">Ningún equipo coincide</div>
          ) : listaPagina.map(e => (
            <FilaEquipo key={e.id} eq={e} marcado={sel.has(e.id)} bloqueado={bloqueado(e)}
              mostrarTipo={!!q} camposExtra={q ? [] : camposUnidad.filter(c => c.clave !== 'serie' && c.clave !== 'modelo')}
              onToggle={() => onToggle(e.id)} />
          ))}
          {totalPaginas > 1 && (
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-slate-100 text-[12px] text-slate-500">
              <button type="button" disabled={paginaActual === 1} onClick={() => setPagina(paginaActual - 1)}
                className="px-2.5 py-1.5 border border-slate-200 rounded-[7px] disabled:opacity-40 hover:border-slate-300">‹ Anterior</button>
              <span>Página {paginaActual} de {totalPaginas}</span>
              <button type="button" disabled={paginaActual === totalPaginas} onClick={() => setPagina(paginaActual + 1)}
                className="px-2.5 py-1.5 border border-slate-200 rounded-[7px] disabled:opacity-40 hover:border-slate-300">Siguiente ›</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Fila seleccionable — misma forma en celular y escritorio
function FilaEquipo({ eq, marcado, bloqueado, mostrarTipo, camposExtra, onToggle }) {
  const detalles = [
    eq.atributos?.serie && `Serie ${eq.atributos.serie}`,
    eq.atributos?.modelo && `Modelo ${eq.atributos.modelo}`,
    ...camposExtra.map(c => eq.atributos?.[c.clave] && `${c.nombre} ${eq.atributos[c.clave]}`),
    mostrarTipo && eq.tipo_equipo?.categoria?.nombre,
  ].filter(Boolean)
  const persona = eq.paciente_actual?.nombre || eq.cliente_actual?.nombre
  return (
    <button type="button" onClick={onToggle} disabled={bloqueado} aria-pressed={marcado}
      title={bloqueado ? 'Ya tiene un mantenimiento abierto' : undefined}
      className={`w-full text-left flex items-center gap-3 px-3 py-2.5 border-b border-slate-100 last:border-0 transition-colors ${
        bloqueado ? 'opacity-50 cursor-not-allowed' : marcado ? 'bg-[#FFF0F3]' : 'hover:bg-slate-50'
      }`}>
      <span className={`w-5 h-5 flex-shrink-0 rounded-[6px] border-2 flex items-center justify-center ${
        marcado ? 'bg-[#D81B43] border-[#D81B43] text-white' : 'border-slate-300 bg-white'
      }`} aria-hidden>
        {marcado && <Check size={12} strokeWidth={3} />}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-[12px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded flex-shrink-0">{eq.codigo || '—'}</span>
          {mostrarTipo && <span className="text-[12.5px] font-semibold text-slate-700 truncate">{nombreEquipo(eq)}</span>}
        </div>
        {detalles.length > 0 && <div className="text-[11.5px] text-slate-500 mt-1 truncate">{detalles.join(' · ')}</div>}
        {persona && <div className="sm:hidden text-[11px] text-slate-400 mt-0.5 truncate">{persona}</div>}
      </div>
      <div className="hidden sm:block text-right min-w-0 max-w-[40%]">
        <EstadoEquipoBadge nombre={eq.estado?.nombre} />
        {persona && <div className="text-[11px] text-slate-400 mt-1 truncate">{persona}</div>}
      </div>
      <div className="sm:hidden flex-shrink-0"><EstadoEquipoBadge nombre={eq.estado?.nombre} /></div>
    </button>
  )
}
