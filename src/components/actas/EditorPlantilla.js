'use client'
import { createContext, useContext, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import {
  X, ChevronUp, ChevronDown, Copy, Trash2, Plus, Loader2, Heading, Type, AlignLeft, LayoutGrid, Table2,
  PenLine, Image as IconoImagen, MoveVertical, PanelBottom, FileStack, Upload, Undo2, Redo2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { NOMBRES, aTexto, aVariables, mapearTextos, propiosDe, variableDe } from '@/lib/actas/nombres'
import { contextoEjemplo } from '@/lib/actas/ejemplo'
import { categoriasDe } from '@/lib/actas/contexto'
import { COLUMNAS_ESTANDAR, columnasEstandar, ANCHO_PAGINA } from '@/lib/actas/render'
import { subirImagen } from '@/lib/actas/imagenesPlantilla'
import { registrarBitacora } from '@/lib/bitacora'
import VistaActa from '@/components/actas/VistaActa'
import { accionDe } from '@/lib/actas/acciones'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import FirmaPad from '@/components/entregas/FirmaPad'
import { ui } from '@/lib/ui'

// Editor de plantillas de actas (Configuración → Plantillas). La plantilla es una
// lista de bloques (lib/actas/render.js); cada uno se edita en su tarjeta y a la
// derecha se ve el acta con datos de ejemplo. Los datos se escriben entre
// corchetes, igual que en Word: [Nombre del paciente] (lib/actas/nombres.js).

const TIPOS = {
  encabezado: { label: 'Encabezado', icono: Heading, nuevo: () => ({ logos: [], ancho_logo: 22, centro: [{ texto: 'TÍTULO DEL FORMATO', estilo: 'titulo' }], derecha: RECUADRO_INICIAL() }) },
  titulo: { label: 'Título', icono: Type, nuevo: () => ({ texto: 'TÍTULO', alineacion: 'centro' }) },
  texto: { label: 'Texto', icono: AlignLeft, nuevo: () => ({ texto: '', alineacion: 'justificado' }) },
  campos: { label: 'Campos', icono: LayoutGrid, nuevo: () => ({ columnas: 2, estilo: 'lineas', campos: [{ etiqueta: 'Nombre:', valor: '[Nombre del paciente]' }, { etiqueta: 'Documento:', valor: '[Documento del paciente]' }] }) },
  // Las tablas nuevas son la estándar: una fila por tipo, con cantidad (render.js → tablaEstandar)
  tabla: { label: 'Tabla de equipos', icono: Table2, nuevo: () => ({ fuente: 'equipos', agrupar: 'tipo_equipo', filas_minimas: 1, columnas: [{ clave: 'descripcion' }, { clave: 'cantidad' }, { clave: 'marca' }, { clave: 'modelo' }, { clave: 'serie' }] }) },
  firmas: { label: 'Firmas', icono: PenLine, nuevo: () => ({ firmas: [{ rol: 'recibe', titulo: 'Quien recibe', lineas: [{ etiqueta: 'C.C.', valor: '[Documento de quien recibe]' }] }, { rol: 'entrega', titulo: 'Quien entrega', lineas: [] }] }) },
  imagen: { label: 'Imagen', icono: IconoImagen, nuevo: () => ({ url: '', alto: 60, alineacion: 'centro' }) },
  espacio: { label: 'Espacio', icono: MoveVertical, nuevo: () => ({ alto: 16 }) },
  pie: { label: 'Pie de página', icono: PanelBottom, nuevo: () => ({ texto: '' }) },
  salto_pagina: { label: 'Hoja nueva', icono: FileStack, nuevo: () => ({}) },
  // Se pone con doble clic en la vista previa (Firma fija), no desde "Agregar bloque"
  firma_libre: { label: 'Firma fija', icono: PenLine, oculto: true },
}
// Recuadro derecho del encabezado con las filas de siempre
export const RECUADRO_INICIAL = () => [{ etiqueta: 'Código:', valor: '' }, { etiqueta: 'Versión:', valor: '' }, { etiqueta: 'Fecha:', valor: '' }]

const COLUMNAS = { item: 'Ítem', descripcion: 'Descripción', cantidad: 'Cantidad', marca: 'Marca', modelo: 'Modelo', serie: 'Serie', codigo: 'Código', estado: 'Estado', lote: 'Lote', invima: 'Reg. INVIMA' }
const ROLES = { recibe: 'Quien recibe', entrega: 'Quien entrega', responsable: 'Responsable', paciente: 'Paciente' }
const ALINEAR = { izquierda: 'Izquierda', centro: 'Centro', derecha: 'Derecha', justificado: 'Justificado' }

let siguienteClave = 1
const conClave = b => ({ ...b, _k: siguienteClave++ })

// Bloques guardados → bloques para editar ([Nombres] en vez de {{variables}})
function paraEditar(bloques) {
  const propios = propiosDe(bloques)
  // campos_propios se rehace al guardar; para_equipos y renovable se eligen en Configuración
  return (bloques || []).filter(b => !['campos_propios', 'para_equipos', 'renovable'].includes(b.tipo)).map(b => conClave(mapearTextos(b, s => aTexto(s, propios))))
}
// …y de vuelta, con el bloque de campos propios si hay datos que el sistema no conoce
function paraGuardar(bloques) {
  const propios = {}
  const out = bloques.map(({ _k, ...b }) => mapearTextos(b, s => aVariables(s, propios)))
  return Object.keys(propios).length ? [...out, { tipo: 'campos_propios', etiquetas: propios }] : out
}

// Campos propios de la plantilla que se edita ([Ciudad de expedición]…): el "+ Dato"
// los ofrece para no escribirlos otra vez
const PropiosCtx = createContext([])
const NOMBRE_DE = Object.fromEntries(Object.values(NOMBRES).flatMap(g => Object.entries(g)))

// ── Espacios puestos sobre la hoja (doble clic en la vista previa) ──
// Tres tipos: lo llena el sistema ({{variable}}), se escribe al prestar (un campo
// propio, [Nombre]) o en blanco para llenar a mano en el papel (una raya ____).
const ANCHOS = { corto: 8, medio: 15, largo: 25 }
const anchoDe = len => len <= 10 ? 'corto' : len <= 19 ? 'medio' : 'largo'
const leerRuta = (obj, partes) => partes.reduce((o, k) => o?.[k], obj)
const ponerRuta = (obj, [k, ...resto], v) => {
  const copia = Array.isArray(obj) ? [...obj] : { ...(obj || {}) }
  copia[k] = resto.length ? ponerRuta(obj?.[k], resto, v) : v
  return copia
}
// Un renglón sin texto (se tocó la raya de un campo vacío): dónde está su valor
function rutaDe({ ruta, ed }) {
  if (ruta) return ruta
  let m
  if ((m = /^(\d+)\.(\d+)$/.exec(ed || ''))) return `${m[1]}.campos.${m[2]}.valor`
  if ((m = /^(\d+)\.a(\d+)$/.exec(ed || ''))) return `${m[1]}.accesorios.${m[2]}.valor`
  if ((m = /^(\d+)\.f(\d+)\.(\d+)$/.exec(ed || ''))) return `${m[1]}.firmas.${m[2]}.lineas.${m[3]}.valor`
  return null
}

// Raya para llenar a mano (____) donde está el cursor: un dato puesto ahí la reemplaza
const RAYA = /_{2,}/g
function rayaEn(v, i) {
  for (const m of v.matchAll(RAYA)) if (i >= m.index && i <= m.index + m[0].length) return [m.index, m.index + m[0].length]
  return null
}
// Selecciona la primera raya del campo (al llegar desde la vista previa)
export function seleccionarRaya(el) {
  const m = [...(el.value || '').matchAll(RAYA)][0]
  if (m) el.setSelectionRange(m.index, m.index + m[0].length)
}

// Campo de texto con "+ Dato" que inserta [Nombre] donde está el cursor (o en la
// raya ____ que lo tenga). Los espacios nuevos se ponen con doble clic en la hoja.
function CampoTexto({ value, onChange, multilinea, filas = 3, placeholder, className = '', ed }) {
  const ref = useRef(null)
  const propios = useContext(PropiosCtx)
  function insertar(nombre) {
    if (!nombre) return
    const el = ref.current
    const v = value || ''
    let i = el?.selectionStart ?? v.length, j = el?.selectionEnd ?? v.length
    if (i === j) [i, j] = rayaEn(v, i) || [i, j]
    onChange(`${v.slice(0, i)}[${nombre}]${v.slice(j)}`)
    requestAnimationFrame(() => { if (el) { el.focus(); const p = i + nombre.length + 2; el.setSelectionRange(p, p) } })
  }
  const Comp = multilinea ? 'textarea' : 'input'
  return (
    <div className={className} data-ed-campo={ed}>
      <div className="relative">
        <Comp ref={ref} value={value || ''} rows={multilinea ? filas : undefined} placeholder={placeholder}
          onChange={e => onChange(e.target.value)} className={`${ui.input} pr-[74px] ${multilinea ? 'resize-y leading-relaxed' : ''}`} />
        <select value="" onChange={e => insertar(e.target.value)} title="Insertar un dato"
          className="absolute right-1.5 top-1.5 h-7 w-[64px] rounded-[7px] border border-slate-200 bg-slate-50 text-[11.5px] font-semibold text-[#1B3A6B] cursor-pointer">
          <option value="">+ Dato</option>
          {propios.length > 0 && <optgroup label="De esta plantilla">{propios.map(n => <option key={n} value={n}>{n}</option>)}</optgroup>}
          {Object.entries(NOMBRES).map(([g, vars]) => (
            <optgroup key={g} label={g}>{Object.values(vars).map(n => <option key={n} value={n}>{n}</option>)}</optgroup>
          ))}
        </select>
      </div>
    </div>
  )
}

const Sel = ({ value, onChange, opciones, className = '' }) => (
  <select value={value ?? ''} onChange={e => onChange(e.target.value)} className={`${ui.input} ${className}`}>
    {Object.entries(opciones).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
  </select>
)
const Numero = ({ value, onChange, min = 0, max = 400 }) => (
  <input type="number" min={min} max={max} value={value ?? ''} onChange={e => onChange(e.target.value === '' ? undefined : Number(e.target.value))} className={ui.input} />
)
const Etiqueta = ({ children }) => <label className={ui.label}>{children}</label>

// Lista con agregar, quitar y mover (filas de campos, columnas, firmas…)
function Lista({ items, onChange, nuevo, render, textoAgregar }) {
  const mover = (i, d) => { const l = [...items]; const [x] = l.splice(i, 1); l.splice(i + d, 0, x); onChange(l) }
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i} className="p-2.5 rounded-[10px] bg-slate-50 border border-slate-200">
          <div>{render(it, v => onChange(items.map((x, j) => j === i ? v : x)), i)}</div>
          <div className="flex justify-end gap-0.5 mt-1 -mb-1">
            <button type="button" disabled={i === 0} onClick={() => mover(i, -1)} className={`${ui.btnIcono} !w-7 !h-7 disabled:opacity-30`} aria-label="Subir"><ChevronUp size={14} /></button>
            <button type="button" disabled={i === items.length - 1} onClick={() => mover(i, 1)} className={`${ui.btnIcono} !w-7 !h-7 disabled:opacity-30`} aria-label="Bajar"><ChevronDown size={14} /></button>
            <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} className={`${ui.btnIcono} !w-7 !h-7 hover:!text-[#D81B43]`} aria-label="Quitar"><Trash2 size={13} /></button>
          </div>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, nuevo()])} className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[#1B3A6B] hover:underline">
        <Plus size={13} /> {textoAgregar}
      </button>
    </div>
  )
}

// Subir una imagen (logo, sello) y devolver su URL
function SubirImagen({ onUrl, texto = 'Subir imagen' }) {
  const supabase = useMemo(() => createClient(), [])
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState(null)
  return (
    <div>
      <label className={`${ui.btnChico} cursor-pointer ${subiendo ? 'opacity-50 pointer-events-none' : ''}`}>
        {subiendo ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />} {subiendo ? 'Subiendo…' : texto}
        <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={async e => {
          const f = e.target.files[0]; e.target.value = ''
          if (!f) return
          setSubiendo(true); setError(null)
          try { onUrl(await subirImagen(supabase, f)) } catch (err) { setError(err.message) }
          setSubiendo(false)
        }} />
      </label>
      {error && <div className="text-[11.5px] text-[#D81B43] mt-1">{error}</div>}
    </div>
  )
}

// Formulario de cada tipo de bloque
const LISTAS_TABLA = { estandar: 'Equipos: tabla estándar (una fila por tipo, con cantidad)', equipos: 'Equipos (una fila por unidad)', tipo: 'Equipos por tipo (una tabla por tipo)', retirados: 'Equipos que se retiran, por tipo (cambio)', insumos: 'Insumos', ambos: 'Equipos e insumos' }
// Qué lista es una tabla, y cómo queda al cambiarla
const listaDe = b => b.agrupar === 'tipo_equipo' ? 'estandar' : b.agrupar === 'tipo' ? listaTipo(b) : b.fuente || 'equipos'
function conLista(b, v) {
  if (v === 'estandar') return { ...b, agrupar: 'tipo_equipo', fuente: 'equipos', accesorios: undefined, filas_minimas: b.filas_minimas ?? 1,
    columnas: columnasEstandar((b.columnas || []).filter(c => COLUMNAS_ESTANDAR[c.clave])) }
  if (v === 'tipo' || v === 'retirados') return { ...b, agrupar: 'tipo', fuente: v === 'retirados' ? 'retirados' : 'equipos', accesorios: b.accesorios || [] }
  return { ...b, agrupar: undefined, accesorios: undefined, fuente: v, filas_minimas: b.filas_minimas ?? 3,
    columnas: (b.columnas || []).filter(c => COLUMNAS[c.clave]).length ? b.columnas.filter(c => COLUMNAS[c.clave]) : [{ clave: 'item' }, { clave: 'descripcion' }, { clave: 'marca' }, { clave: 'modelo' }, { clave: 'serie' }] }
}
// Datos que las categorías definen en el inventario (Configuración → Categorías), para
// columnas de la tabla estándar: [{ clave: 'attr:x', nombre }]
const CamposCategoriasCtx = createContext([])
const BASICOS = new Set(['serie', 'modelo', 'marca', 'nombre', 'codigo', 'codigo_inventario'])
const nombreColumna = (c, extra) => c.etiqueta || COLUMNAS_ESTANDAR[c.clave] || extra.find(x => x.clave === c.clave)?.nombre || c.clave.replace(/^attr:/, '').replace(/_/g, ' ')

// Columnas de la tabla estándar: las elegidas en orden (subir, bajar, quitar, renombrar)
// y "+ Columna" con las que faltan. La cantidad va siempre.
function ColumnasEstandar({ columnas, onChange }) {
  const extra = useContext(CamposCategoriasCtx)
  const cols = columnasEstandar(columnas)
  const disponibles = [...Object.keys(COLUMNAS_ESTANDAR).map(clave => ({ clave, nombre: COLUMNAS_ESTANDAR[clave] })), ...extra]
    .filter(d => !cols.some(c => c.clave === d.clave))
  const mover = (i, d) => { const l = [...cols]; const [x] = l.splice(i, 1); l.splice(i + d, 0, x); onChange(l) }
  return (
    <div>
      <div className="space-y-1.5">
        {cols.map((c, i) => (
          <div key={c.clave} className="flex items-center gap-1.5 p-1.5 pl-2.5 rounded-[9px] bg-slate-50 border border-slate-200">
            <span className="w-[42%] sm:w-[38%] flex-shrink-0 text-[12.5px] font-semibold text-slate-600 truncate" title={nombreColumna({ clave: c.clave }, extra)}>
              {nombreColumna({ clave: c.clave }, extra)}{c.clave === 'cantidad' && <span className="font-normal text-slate-400"> · siempre</span>}
            </span>
            <input value={c.etiqueta || ''} placeholder="Título en el acta" onChange={e => onChange(cols.map((x, j) => j === i ? { ...x, etiqueta: e.target.value || undefined } : x))}
              className={`${ui.input} !py-1.5 min-w-0`} />
            <button type="button" disabled={i === 0} onClick={() => mover(i, -1)} className={`${ui.btnIcono} !w-7 !h-7 disabled:opacity-30`} aria-label="Subir"><ChevronUp size={14} /></button>
            <button type="button" disabled={i === cols.length - 1} onClick={() => mover(i, 1)} className={`${ui.btnIcono} !w-7 !h-7 disabled:opacity-30`} aria-label="Bajar"><ChevronDown size={14} /></button>
            <button type="button" disabled={c.clave === 'cantidad'} onClick={() => onChange(cols.filter((_, j) => j !== i))}
              className={`${ui.btnIcono} !w-7 !h-7 hover:!text-[#D81B43] disabled:opacity-0`} aria-label="Quitar columna"><Trash2 size={13} /></button>
          </div>
        ))}
      </div>
      {disponibles.length > 0 && (
        <select value="" onChange={e => { if (e.target.value) onChange([...cols, { clave: e.target.value }]) }}
          className={`${ui.input} mt-2 !text-[#1B3A6B] font-semibold`}>
          <option value="">+ Columna</option>
          <optgroup label="Básicas">{disponibles.filter(d => COLUMNAS_ESTANDAR[d.clave]).map(d => <option key={d.clave} value={d.clave}>{d.nombre}</option>)}</optgroup>
          {disponibles.some(d => !COLUMNAS_ESTANDAR[d.clave]) && (
            <optgroup label="De las categorías">{disponibles.filter(d => !COLUMNAS_ESTANDAR[d.clave]).map(d => <option key={d.clave} value={d.clave}>{d.nombre}</option>)}</optgroup>
          )}
        </select>
      )}
    </div>
  )
}
// Tabla por tipo: la lista de equipos o la de los que se retiran en un cambio
const listaTipo = b => (b.fuente === 'retirados' ? 'retirados' : 'tipo')

// bi: posición del bloque; con ella cada renglón lleva la misma clave que en la hoja
// (render.js → data-ed) para llegar a él al tocar la vista previa
function FormBloque({ b, set, bi }) {
  const campo = (k, v) => set({ ...b, [k]: v })
  switch (b.tipo) {
    case 'encabezado': return (
      <div className="space-y-4">
        <div>
          <Etiqueta>Logos</Etiqueta>
          <div className="flex flex-wrap gap-2 items-center">
            {(b.logos || []).map((l, i) => (
              <div key={i} className="relative w-[88px] h-[56px] rounded-[8px] border border-slate-200 bg-white flex items-center justify-center p-1">
                {l.url
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={l.url} alt="" className="max-w-full max-h-full object-contain" />
                  : <span className="text-[10px] text-slate-400 text-center leading-tight">{l.texto || 'Sin imagen'}</span>}
                <button type="button" onClick={() => campo('logos', b.logos.filter((_, j) => j !== i))} aria-label="Quitar logo"
                  className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-white border border-slate-200 text-slate-500 flex items-center justify-center hover:text-[#D81B43]"><X size={11} /></button>
              </div>
            ))}
            <SubirImagen texto="Agregar logo" onUrl={url => campo('logos', [...(b.logos || []), { url, alto: 50 }])} />
          </div>
        </div>
        <div>
          <Etiqueta>Títulos del centro</Etiqueta>
          <Lista items={b.centro || []} onChange={v => campo('centro', v)} textoAgregar="Agregar línea" nuevo={() => ({ texto: '', estilo: 'subtitulo' })}
            render={(c, setC) => (
              <div className="grid grid-cols-[1fr_120px] gap-2">
                <CampoTexto multilinea filas={Math.min(4, (c.texto || '').split('\n').length)} value={c.texto} onChange={v => setC({ ...c, texto: v })} />
                <Sel value={c.estilo || 'normal'} onChange={v => setC({ ...c, estilo: v })} opciones={{ titulo: 'Grande', subtitulo: 'Mediano', normal: 'Pequeño' }} />
              </div>
            )} />
        </div>
        <div>
          <Etiqueta>Recuadro derecho (código, versión, fecha)</Etiqueta>
          {/* Sin filas no hay recuadro: la primera lo crea como una columna nueva del encabezado */}
          {!(b.derecha || []).length ? (
            <button type="button" onClick={() => campo('derecha', RECUADRO_INICIAL())} className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[#1B3A6B] hover:underline">
              <Plus size={13} /> Agregar recuadro derecho <span className="font-normal text-slate-400">· va a la derecha del título</span>
            </button>
          ) : (
          <Lista items={b.derecha || []} onChange={v => campo('derecha', v)} textoAgregar="Agregar fila al recuadro" nuevo={() => ({ etiqueta: '', valor: '' })}
            render={(c, setC) => (
              <div className="grid grid-cols-2 gap-2">
                <input value={c.etiqueta || ''} placeholder="Código:" onChange={e => setC({ ...c, etiqueta: e.target.value })} className={ui.input} />
                <input value={c.valor || ''} placeholder="FT-001" onChange={e => setC({ ...c, valor: e.target.value })} className={ui.input} />
              </div>
            )} />
          )}
        </div>
      </div>
    )
    case 'titulo': return (
      <div className="grid grid-cols-[1fr_130px] gap-2">
        <CampoTexto value={b.texto} onChange={v => campo('texto', v)} />
        <Sel value={b.alineacion || 'centro'} onChange={v => campo('alineacion', v)} opciones={ALINEAR} />
      </div>
    )
    case 'texto': case 'pie': return (
      <div className="space-y-3">
        <CampoTexto multilinea filas={b.tipo === 'pie' ? 2 : 6} value={b.texto} onChange={v => campo('texto', v)}
          placeholder="Escribe el texto. Usa **negrita** y [Nombre del paciente] para los datos." />
        {b.tipo === 'texto' && (
          <div className="grid grid-cols-3 gap-2">
            <div><Etiqueta>Alineación</Etiqueta><Sel value={b.alineacion || 'justificado'} onChange={v => campo('alineacion', v)} opciones={ALINEAR} /></div>
            <div><Etiqueta>Letra</Etiqueta><Sel value={String(b.tamano || 12)} onChange={v => campo('tamano', Number(v))} opciones={{ 10: 'Pequeña', 11: 'Mediana', 12: 'Normal', 13: 'Grande' }} /></div>
            <label className="flex items-end gap-2 pb-2.5 text-[13px] text-slate-600 cursor-pointer">
              <input type="checkbox" checked={!!b.borde} onChange={e => campo('borde', e.target.checked)} /> Recuadro
            </label>
          </div>
        )}
      </div>
    )
    case 'campos': return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="col-span-2"><Etiqueta>Título (opcional)</Etiqueta><input value={b.titulo || ''} onChange={e => campo('titulo', e.target.value)} className={ui.input} /></div>
          <div><Etiqueta>Columnas</Etiqueta><Sel value={String(b.columnas || 1)} onChange={v => campo('columnas', Number(v))} opciones={{ 1: '1', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6' }} /></div>
          <div><Etiqueta>Estilo</Etiqueta><Sel value={b.estilo || 'lineas'} onChange={v => campo('estilo', v)} opciones={{ lineas: 'Rayas', tabla: 'Cuadrícula' }} /></div>
        </div>
        {(b.columnas || 1) > 1 && <p className={ui.ayudaCampo}>Los campos se acomodan de izquierda a derecha: cada {b.columnas} empieza una fila nueva.</p>}
        <Lista items={b.campos || []} onChange={v => campo('campos', v)} textoAgregar="Agregar campo" nuevo={() => ({ etiqueta: '', valor: '' })}
          render={(c, setC, ci) => (
            <div className="space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input value={c.etiqueta || ''} placeholder="Etiqueta (Nombre:)" onChange={e => setC({ ...c, etiqueta: e.target.value })} className={ui.input} />
                <CampoTexto ed={`${bi}.${ci}`} value={c.valor} placeholder="Vacío = raya para llenar" onChange={v => setC({ ...c, valor: v })} />
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-2 items-center text-[12.5px] text-slate-600">
                <label className="flex items-center gap-1.5">Firma
                  <select value={c.firma || ''} onChange={e => setC({ ...c, firma: e.target.value || undefined })} className="h-8 rounded-[7px] border border-slate-200 bg-white px-1.5 text-[12.5px]">
                    <option value="">Sin firma</option>
                    {Object.entries(ROLES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </label>
                {(b.columnas || 1) > 1 && (
                  <label className="flex items-center gap-1.5">Ocupa
                    <select value={c.span || 1} onChange={e => setC({ ...c, span: Number(e.target.value) > 1 ? Number(e.target.value) : undefined })} className="h-8 rounded-[7px] border border-slate-200 bg-white px-1.5 text-[12.5px]">
                      {Array.from({ length: b.columnas }, (_, i) => <option key={i} value={i + 1}>{i + 1} col.</option>)}
                    </select>
                  </label>
                )}
                <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={!!c.arriba} onChange={e => setC({ ...c, arriba: e.target.checked || undefined })} /> Etiqueta arriba</label>
              </div>
            </div>
          )} />
      </div>
    )
    case 'tabla': return b.agrupar === 'tipo_equipo' ? (
      <div className="space-y-3">
        <p className="px-3 py-2 rounded-[9px] bg-[#E8F7FB] text-[12.5px] text-[#0E7490]">Una fila por tipo de equipo del préstamo. Si van varios del mismo tipo, se suma la cantidad y sus seriales (y lo demás que cambie) van separados por comas.</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="col-span-2"><Etiqueta>Título (opcional)</Etiqueta><input value={b.titulo || ''} onChange={e => campo('titulo', e.target.value)} className={ui.input} /></div>
          <div><Etiqueta>Lista</Etiqueta><Sel value={listaDe(b)} onChange={v => set(conLista(b, v))} opciones={LISTAS_TABLA} /></div>
          <div><Etiqueta>Filas mínimas</Etiqueta><Numero value={b.filas_minimas} max={30} onChange={v => campo('filas_minimas', v)} /></div>
        </div>
        <Etiqueta>Columnas</Etiqueta>
        <ColumnasEstandar columnas={b.columnas} onChange={v => campo('columnas', v)} />
      </div>
    ) : b.agrupar === 'tipo' ? (
      <div className="space-y-3">
        <p className="px-3 py-2 rounded-[9px] bg-[#E8F7FB] text-[12.5px] text-[#0E7490]">Una tabla por cada tipo de equipo del préstamo (cilindros, reguladores…), con las columnas que esos equipos tengan. Debajo, una fila de accesorios para marcar.</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="col-span-2"><Etiqueta>Título (opcional)</Etiqueta><input value={b.titulo || ''} onChange={e => campo('titulo', e.target.value)} className={ui.input} /></div>
          <div className="col-span-2"><Etiqueta>Lista</Etiqueta><Sel value={listaDe(b)} onChange={v => set(conLista(b, v))} opciones={LISTAS_TABLA} /></div>
        </div>
        <Etiqueta>Accesorios (fila para marcar)</Etiqueta>
        <Lista items={b.accesorios || []} onChange={v => campo('accesorios', v)} textoAgregar="Agregar accesorio" nuevo={() => ({ etiqueta: '' })}
          render={(c, setC, ci) => (
            <div className="grid grid-cols-2 gap-2">
              <input value={c.etiqueta || ''} placeholder="HUMIDIFICADOR" onChange={e => setC({ ...c, etiqueta: e.target.value })} className={ui.input} />
              <CampoTexto ed={`${bi}.a${ci}`} value={c.valor} placeholder="Vacío: se marca a mano" onChange={v => setC({ ...c, valor: v || undefined })} />
            </div>
          )} />
      </div>
    ) : (
      <div className="space-y-3">
        <p className="px-3 py-2 rounded-[9px] bg-[#E8F7FB] text-[12.5px] text-[#0E7490]">Se llena sola con los equipos (o insumos) del préstamo. Si son menos que las filas mínimas, quedan renglones en blanco.</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="col-span-2"><Etiqueta>Título (opcional)</Etiqueta><input value={b.titulo || ''} onChange={e => campo('titulo', e.target.value)} className={ui.input} /></div>
          <div><Etiqueta>Lista</Etiqueta><Sel value={listaDe(b)} onChange={v => set(conLista(b, v))} opciones={LISTAS_TABLA} /></div>
          <div><Etiqueta>Filas mínimas</Etiqueta><Numero value={b.filas_minimas} max={30} onChange={v => campo('filas_minimas', v)} /></div>
        </div>
        <Etiqueta>Columnas</Etiqueta>
        <Lista items={b.columnas || []} onChange={v => campo('columnas', v)} textoAgregar="Agregar columna" nuevo={() => ({ clave: 'descripcion' })}
          render={(c, setC) => (
            <div className="grid grid-cols-2 gap-2">
              <Sel value={c.clave} onChange={v => setC({ ...c, clave: v })} opciones={COLUMNAS} />
              <input value={c.etiqueta || ''} placeholder={`Título: ${COLUMNAS[c.clave] || ''}`} onChange={e => setC({ ...c, etiqueta: e.target.value || undefined })} className={ui.input} />
            </div>
          )} />
      </div>
    )
    case 'firmas': return (
      <Lista items={b.firmas || []} onChange={v => campo('firmas', v)} textoAgregar="Agregar firma" nuevo={() => ({ rol: 'recibe', titulo: '', lineas: [] })}
        render={(f, setF, fi) => (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Sel value={f.rol} onChange={v => setF({ ...f, rol: v })} opciones={{ ...ROLES, vacia: 'Sin firma (solo raya)' }} />
              <input value={f.titulo || ''} placeholder="Título bajo la raya" onChange={e => setF({ ...f, titulo: e.target.value })} className={ui.input} />
            </div>
            {/* Firma fija (doble clic en la raya de la vista previa → Firma fija) */}
            {f.imagen && (
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.imagen} alt="Firma fija" className="h-12 max-w-[160px] object-contain rounded border border-slate-200 bg-white p-1" />
                <span className="text-[12px] text-slate-500 flex-1">Firma fija: sale en todas las actas</span>
                <button type="button" onClick={() => { const { imagen, ...resto } = f; setF(resto) }} className="text-[12px] font-semibold text-[#D81B43] hover:underline">Quitar</button>
              </div>
            )}
            {(f.lineas || []).map((l, i) => (
              <div key={i} className="grid grid-cols-[90px_1fr_32px] gap-2">
                <input value={l.etiqueta || ''} placeholder="C.C." onChange={e => setF({ ...f, lineas: f.lineas.map((x, j) => j === i ? { ...x, etiqueta: e.target.value } : x) })} className={ui.input} />
                <CampoTexto ed={`${bi}.f${fi}.${i}`} value={l.valor} onChange={v => setF({ ...f, lineas: f.lineas.map((x, j) => j === i ? { ...x, valor: v } : x) })} />
                <button type="button" onClick={() => setF({ ...f, lineas: f.lineas.filter((_, j) => j !== i) })} className={ui.btnIcono} aria-label="Quitar línea"><X size={14} /></button>
              </div>
            ))}
            <button type="button" onClick={() => setF({ ...f, lineas: [...(f.lineas || []), { etiqueta: '', valor: '' }] })} className="text-[12px] font-semibold text-slate-500 hover:text-[#1B3A6B]">+ Línea bajo la firma</button>
          </div>
        )} />
    )
    case 'imagen': return (
      <div className="flex flex-wrap items-end gap-3">
        {b.url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={b.url} alt="" className="h-14 max-w-[140px] object-contain rounded border border-slate-200 bg-white p-1" />
        )}
        <SubirImagen texto={b.url ? 'Cambiar' : 'Subir imagen'} onUrl={url => campo('url', url)} />
        <div className="w-[90px]"><Etiqueta>Alto</Etiqueta><Numero value={b.alto} min={10} max={300} onChange={v => campo('alto', v)} /></div>
        <div className="w-[130px]"><Etiqueta>Posición</Etiqueta><Sel value={b.alineacion || 'centro'} onChange={v => campo('alineacion', v)} opciones={{ izquierda: 'Izquierda', centro: 'Centro', derecha: 'Derecha' }} /></div>
      </div>
    )
    case 'espacio': return <div className="w-[120px]"><Etiqueta>Alto (px)</Etiqueta><Numero value={b.alto} max={300} onChange={v => campo('alto', v)} /></div>
    case 'salto_pagina': return <div className="text-[12.5px] text-slate-400">Lo que sigue empieza en una hoja nueva.</div>
    case 'firma_libre': return (
      <div className="flex flex-wrap items-end gap-3">
        {b.url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={b.url} alt="Firma fija" className="h-14 max-w-[160px] object-contain rounded border border-slate-200 bg-white p-1" />
        )}
        <SubirImagen texto="Cambiar imagen" onUrl={url => campo('url', url)} />
        <div className="w-[100px]"><Etiqueta>Ancho (px)</Etiqueta><Numero value={b.ancho} min={40} max={760} onChange={v => campo('ancho', v)} /></div>
        <p className="w-full text-[12px] text-slate-400">Tócala en la vista previa para moverla o cambiarle el tamaño.</p>
      </div>
    )
    default: return <div className="text-[12.5px] text-slate-400">Este bloque no se puede editar aquí.</div>
  }
}

function resumen(b) {
  const quitar = s => String(s || '').replace(/\*\*/g, '').slice(0, 70)
  switch (b.tipo) {
    case 'encabezado': return quitar(b.centro?.[0]?.texto)
    case 'titulo': case 'texto': case 'pie': return quitar(b.texto) || 'Vacío'
    case 'campos': return `${b.titulo ? b.titulo + ' · ' : ''}${(b.campos || []).length} campos`
    case 'tabla': return LISTAS_TABLA[listaDe(b)].replace(/ \(.*\)$/, '') + (b.titulo ? ` · ${b.titulo}` : '')
    case 'firmas': return (b.firmas || []).map(f => f.titulo || ROLES[f.rol] || 'Raya').join(' · ')
    case 'imagen': return b.url ? 'Con imagen' : 'Sin imagen'
    case 'espacio': return `${b.alto || 16} px`
    case 'firma_libre': return 'Encima de la hoja'
    default: return ''
  }
}

export default function EditorPlantilla({ plantilla, inicial, empresa, avisos = [], onCerrar, onGuardado }) {
  const supabase = useMemo(() => createClient(), [])
  const origen = plantilla || inicial || {}
  const [nombre, setNombre] = useState(origen.nombre || '')
  // Acción, descripción, equipos (para_equipos) y renovable se eligen en Configuración
  // (ConfigPlantilla.js); aquí se conservan tal cual al guardar
  const categorias = useMemo(() => categoriasDe(origen.bloques), [origen.bloques])
  const ajustesOcultos = useMemo(() => (origen.bloques || []).filter(b => ['para_equipos', 'renovable'].includes(b.tipo)), [origen.bloques])
  const [todasCategorias, setTodasCategorias] = useState([])
  useEffect(() => {
    supabase.from('categorias_equipo').select('id, nombre, atributos_extra').order('nombre').then(({ data }) => setTodasCategorias(data || []))
  }, [supabase])
  // Columnas que se pueden agregar a la tabla estándar: los datos de las categorías de la
  // plantilla (o de todas, si es para todos los equipos), sin repetir ni los básicos
  const camposCategorias = useMemo(() => {
    const cats = categorias.length ? todasCategorias.filter(c => categorias.some(x => x.id === c.id)) : todasCategorias
    const vistos = new Map()
    for (const c of cats) for (const f of [...(c.atributos_extra?.campos_tipo || []), ...(c.atributos_extra?.campos_unidad || [])]) {
      if (f?.clave && !BASICOS.has(f.clave) && !vistos.has(f.clave)) vistos.set(f.clave, { clave: `attr:${f.clave}`, nombre: f.nombre || f.clave })
    }
    return [...vistos.values()].sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [todasCategorias, categorias])
  const [bloques, setBloques] = useState(() => paraEditar(origen.bloques))
  const [abierto, setAbierto] = useState(null) // bloque desplegado
  const [menuAgregar, setMenuAgregar] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)
  const [errorNombre, setErrorNombre] = useState(false)
  const nombreRef = useRef(null)
  const errorRef = useRef(null)
  const [vistaMovil, setVistaMovil] = useState('bloques')
  const [confirmar, setConfirmar] = useState(null) // 'salir'
  const [cambios, setCambios] = useState(!plantilla) // una importada o nueva cuenta como cambio

  const diferidos = useDeferredValue(bloques)
  const ctx = useMemo(() => contextoEjemplo(empresa), [empresa])
  const vista = useMemo(() => paraGuardar(diferidos), [diferidos])

  // Deshacer / rehacer: cada cambio guarda cómo estaba antes. Lo que se escribe
  // seguido en un mismo bloque cuenta como un solo paso (no letra por letra).
  const [historial, setHistorial] = useState({ pasado: [], futuro: [] })
  const ultimoBloque = useRef(null)
  const [eliminado, setEliminado] = useState(null) // aviso "Bloque eliminado · Deshacer" (el texto)
  const avisoRef = useRef(null)
  const panelRef = useRef(null)
  // Campos propios de la plantilla, para ofrecerlos en "+ Dato"
  const propios = useMemo(() => Object.values(propiosDe(vista)), [vista])
  // La vista previa del editor muestra los espacios como cuadros (render.js → interpolarEditor)
  const ctxVista = useMemo(() => ({ ...ctx, editor: { propios: propiosDe(vista), nombres: NOMBRE_DE } }), [ctx, vista])
  const [espacio, setEspacio] = useState(null) // { ruta, o, len, var, tipo, x, y } mientras se elige qué va

  // Pone, cambia o quita un espacio en el texto tocado. Se arma sobre el texto con
  // {{variables}} (donde están las posiciones) y se pasa a [Nombres] para el editor.
  // ✓ en una firma fija de la vista previa: su posición y ancho nuevos (null = quitarla)
  // Con ancla (VistaActa → anclaEn), la firma pasa a ir justo después de ese bloque en la
  // lista y guarda su distancia a él (dy): render.js la dibuja dentro de ese bloque
  function moverFirma(bi, pos) {
    const b = bloques[bi]
    if (!b || b.tipo !== 'firma_libre') return
    if (!pos) { quitar(b._k); return }
    const { ancla, ...datos } = pos
    cambiar(l => {
      const { y, ...sinY } = b
      const nueva = ancla != null ? { ...sinY, ...datos } : { ...b, ...datos }
      const sin = l.filter(x => x._k !== b._k)
      if (ancla == null || !l[ancla]) return l.map(x => x._k === b._k ? nueva : x)
      const i = sin.findIndex(x => x._k === l[ancla]._k)
      sin.splice(i + 1, 0, nueva)
      return sin
    })
  }
  // Un bloque nuevo justo después del bloque tocado
  const agregarDespues = (bi, nuevo) => {
    const b = conClave(nuevo)
    cambiar(l => { const c = [...l]; c.splice(bi + 1, 0, b); return c })
    setAbierto(b._k)
  }
  async function aplicarEspacio(info, eleccion) {
    // Firma fija: se sube la imagen y va sobre la raya de firma tocada, o debajo del bloque
    // Firma fija (dibujada o subida): se sube la imagen y queda encima de la hoja en el
    // punto tocado (bloque firma_libre); después se mueve y se agranda sobre la vista previa
    if (eleccion.tipo === 'firma') {
      let url
      try {
        const img = await (await fetch(eleccion.firma)).blob()
        const ext = (img.type.split('/')[1] || 'png').replace('jpeg', 'jpg').replace('svg+xml', 'svg')
        url = await subirImagen(supabase, new File([img], `firma.${ext}`, { type: img.type || 'image/png' }))
      } catch (e) { setError('No se pudo guardar la firma: ' + (e.message || e)); setEspacio(null); return }
      setEspacio(null)
      const ancho = 170
      const x = Math.max(0, Math.min(ANCHO_PAGINA - ancho, Math.round((info.px ?? 300) - ancho / 2)))
      const y = Math.max(0, Math.round((info.py ?? 200) - 30))
      // Anclada al bloque que tiene encima (render.js → paginaHtml): va en la lista justo
      // después de él y guarda la distancia; así sigue a su bloque en el acta real
      const ancla = info.ancla
      const nueva = conClave(ancla
        ? { tipo: 'firma_libre', url, x, dy: y - Math.round(ancla.top), ancho }
        : { tipo: 'firma_libre', url, x, y, ancho })
      const despues = ancla ? ancla.bi : info.bi
      cambiar(l => { const c = [...l]; c.splice(despues + 1, 0, nueva); return c })
      return
    }
    const ruta = rutaDe(info)
    setEspacio(null)
    // Texto donde no hay un renglón de texto: un bloque de texto nuevo debajo
    if (!ruta) { if (eleccion.tipo === 'texto' && bloques[info.bi]) agregarDespues(info.bi, { tipo: 'texto', texto: eleccion.texto.trim(), alineacion: 'izquierda' }); return }
    const [bi, ...camino] = ruta.split('.')
    const b = bloques[Number(bi)]
    if (!b) return
    const guardado = paraGuardar(bloques)[Number(bi)]
    const s = String(leerRuta(guardado, camino) ?? '')
    const o = Math.min(info.o, s.length)
    const nombres = { ...propiosDe(paraGuardar(bloques)) }
    let dato = ''
    if (eleccion.tipo === 'sis') dato = `{{${eleccion.variable}}}`
    else if (eleccion.tipo === 'libre') {
      const { variable, propio } = variableDe(eleccion.nombre)
      if (propio) nombres[variable] = eleccion.nombre.trim()
      dato = `{{${variable}}}`
    } else if (eleccion.tipo === 'blanco') dato = '_'.repeat(ANCHOS[eleccion.ancho] || ANCHOS.medio)
    else if (eleccion.tipo === 'texto') dato = eleccion.texto.trim()
    let antes = s.slice(0, o), despues = s.slice(o + (info.len || 0))
    // Uno nuevo en medio del texto: con espacios alrededor para que no quede pegado
    if (dato && !info.len) {
      if (antes && !/\s$/.test(antes)) antes += ' '
      if (despues && !/^[\s.,;:)]/.test(despues)) despues = ' ' + despues
    }
    if (!dato) despues = antes.endsWith(' ') ? despues.replace(/^ /, '') : despues
    const texto = aTexto(antes + dato + despues, nombres)
    cambiar(l => l.map(x => x._k === b._k ? ponerRuta(x, camino, texto) : x))
    setAbierto(b._k)
  }

  function cambiar(fn, agruparEn = null) {
    const nuevoPaso = !agruparEn || agruparEn !== ultimoBloque.current
    ultimoBloque.current = agruparEn
    setHistorial(h => ({ pasado: nuevoPaso ? [...h.pasado.slice(-99), bloques] : h.pasado, futuro: [] }))
    setBloques(fn(bloques)); setCambios(true)
  }
  function deshacer() {
    if (!historial.pasado.length) return
    setBloques(historial.pasado[historial.pasado.length - 1])
    setHistorial(h => ({ pasado: h.pasado.slice(0, -1), futuro: [bloques, ...h.futuro] }))
    ultimoBloque.current = null; setEliminado(null)
  }
  function rehacer() {
    if (!historial.futuro.length) return
    setBloques(historial.futuro[0])
    setHistorial(h => ({ pasado: [...h.pasado, bloques], futuro: h.futuro.slice(1) }))
    ultimoBloque.current = null
  }
  // Ctrl+Z / Ctrl+Y (Cmd en Mac). Dentro de un campo de texto se deja el deshacer del texto.
  const atajos = useRef(null)
  useEffect(() => { atajos.current = { deshacer, rehacer } })
  useEffect(() => {
    const onTecla = e => {
      if (!(e.ctrlKey || e.metaKey)) return
      if (e.target.closest?.('input, textarea, select, [contenteditable]')) return
      const k = e.key.toLowerCase()
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); atajos.current?.deshacer() }
      else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); atajos.current?.rehacer() }
    }
    window.addEventListener('keydown', onTecla)
    return () => { window.removeEventListener('keydown', onTecla); clearTimeout(avisoRef.current) }
  }, [])

  const setBloque = (k, v) => cambiar(l => l.map(b => b._k === k ? { ...v, _k: k } : b), k)
  const mover = (i, d) => cambiar(l => { const c = [...l]; const [x] = c.splice(i, 1); c.splice(i + d, 0, x); return c })
  function avisarEliminado(texto) {
    setEliminado(texto)
    clearTimeout(avisoRef.current)
    avisoRef.current = setTimeout(() => setEliminado(null), 6000)
  }
  const quitar = k => {
    cambiar(l => l.filter(b => b._k !== k))
    avisarEliminado('Bloque eliminado')
  }
  // Hoja n (0 = la primera): sus bloques y el salto que la separa de la vecina
  function quitarHoja(n) {
    const saltos = bloques.map((b, i) => b.tipo === 'salto_pagina' ? i : -1).filter(i => i >= 0)
    const desde = n === 0 ? 0 : saltos[n - 1]          // incluye el salto que la abre
    const hasta = n < saltos.length ? saltos[n] : bloques.length
    // La primera hoja se lleva el salto que la sigue (si no, la siguiente empezaría con una hoja vacía)
    const fin = n === 0 && saltos.length ? hasta + 1 : hasta
    cambiar(l => l.filter((_, i) => i < desde || i >= fin))
    setAbierto(null)
    avisarEliminado(`Hoja ${n + 1} eliminada`)
  }

  // Toque en la vista previa: abre ese bloque y va al renglón (si tiene raya ____, la selecciona)
  function irA({ bi, ed }) {
    const b = bloques[bi]
    // En el celular un toque no cambia de pestaña: el doble toque pone un espacio
    if (!b || window.matchMedia('(max-width: 767px)').matches) return
    setAbierto(b._k)
    setTimeout(() => {
      const tarjeta = panelRef.current?.querySelector(`[data-bloque="${b._k}"]`)
      if (!tarjeta) return
      const sitio = (ed && tarjeta.querySelector(`[data-ed-campo="${CSS.escape(ed)}"]`)) || tarjeta
      sitio.scrollIntoView({ behavior: 'smooth', block: 'center' })
      const el = sitio.querySelector('textarea, input:not([type=checkbox])')
      if (el) { el.focus({ preventScroll: true }); seleccionarRaya(el) }
      if (sitio !== tarjeta) {
        sitio.classList.add('ring-2', 'ring-[#2EB5D4]', 'rounded-[9px]')
        setTimeout(() => sitio.classList.remove('ring-2', 'ring-[#2EB5D4]', 'rounded-[9px]'), 1600)
      }
    }, 60)
  }
  const duplicar = (i) => cambiar(l => { const c = [...l]; const { _k, ...b } = l[i]; c.splice(i + 1, 0, conClave(structuredClone(b))); return c })
  function agregar(tipo) {
    const b = conClave({ tipo, ...TIPOS[tipo].nuevo() })
    cambiar(l => [...l, b]); setAbierto(b._k); setMenuAgregar(false)
  }

  async function guardar() {
    // El error va junto a lo que falta, con el cursor ahí
    if (!nombre.trim()) { setErrorNombre(true); nombreRef.current?.focus(); return }
    if (!bloques.length) {
      setError('La plantilla está vacía: agrega al menos un bloque.'); setVistaMovil('bloques'); setMenuAgregar(true)
      setTimeout(() => errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0)
      return
    }
    setGuardando(true); setError(null)
    const datos = { nombre: nombre.trim(), descripcion: origen.descripcion || null, accion: accionDe(origen),
      bloques: [...paraGuardar(bloques), ...ajustesOcultos] }
    const res = plantilla?.id
      ? await supabase.from('plantillas_acta').update(datos).eq('id', plantilla.id).select('*').single()
      : await supabase.from('plantillas_acta').insert({ ...datos, tipo: 'entrega', es_estandar: false, uso_general: false, activo: true }).select('*').single()
    setGuardando(false)
    if (res.error) { setError('No se guardó: ' + res.error.message); return }
    registrarBitacora({ modulo: 'configuracion', accion: plantilla?.id ? 'editar' : 'crear', entidad: 'plantilla de acta', entidad_id: res.data.id, detalle: { nombre: datos.nombre } })
    onGuardado(res.data, !plantilla?.id)
  }

  const salir = () => (cambios ? setConfirmar('salir') : onCerrar())
  const totalHojas = 1 + bloques.filter(b => b.tipo === 'salto_pagina').length

  return (
    <PropiosCtx.Provider value={propios}>
    <CamposCategoriasCtx.Provider value={camposCategorias}>
    <div className="fixed inset-0 z-[60] bg-[#F8FAFC] flex flex-col">
      {/* Encabezado: nombre y acciones */}
      <div className="flex-shrink-0 bg-white border-b border-slate-200 px-3 md:px-6 py-3 flex items-center gap-3">
        <button onClick={salir} className={ui.btnIcono} aria-label="Cerrar"><X size={18} /></button>
        <div className="flex-1 min-w-0 grid gap-1">
          <input ref={nombreRef} value={nombre} onChange={e => { setNombre(e.target.value); setCambios(true); setErrorNombre(false) }} placeholder="Nombre de la plantilla"
            aria-invalid={errorNombre || undefined}
            className={`w-full text-[16px] md:text-[17px] font-bold text-slate-800 outline-none rounded-[7px] ${errorNombre ? 'bg-red-50 ring-2 ring-[#D81B43]/60 px-2 py-0.5 placeholder:text-[#D81B43]/60' : 'bg-transparent placeholder:text-slate-300'}`} />
          {errorNombre && <div className="text-[12px] font-medium text-[#D81B43]">Escribe el nombre de la plantilla</div>}
        </div>
        <div className="flex gap-0.5 flex-shrink-0">
          <button onClick={deshacer} disabled={!historial.pasado.length} className={`${ui.btnIcono} disabled:opacity-30`} aria-label="Deshacer" title="Deshacer (Ctrl+Z)"><Undo2 size={16} /></button>
          <button onClick={rehacer} disabled={!historial.futuro.length} className={`${ui.btnIcono} disabled:opacity-30`} aria-label="Rehacer" title="Rehacer (Ctrl+Y)"><Redo2 size={16} /></button>
        </div>
        <button onClick={guardar} disabled={guardando} className={ui.btnPrimario}>{guardando ? 'Guardando…' : 'Guardar'}</button>
      </div>

      {/* Celular: bloques o vista previa */}
      <div className="md:hidden flex-shrink-0 grid grid-cols-2 gap-1 p-1 mx-3 mt-3 bg-slate-100 rounded-[10px]">
        {[['bloques', 'Bloques'], ['vista', 'Vista previa']].map(([v, l]) => (
          <button key={v} onClick={() => setVistaMovil(v)} className={`py-2 rounded-[8px] text-[13px] font-semibold ${vistaMovil === v ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}>{l}</button>
        ))}
      </div>

      <div className="flex-1 min-h-0 md:grid md:grid-cols-[minmax(0,560px)_minmax(0,1fr)]">
        {/* Bloques */}
        <div ref={panelRef} className={`h-full overflow-y-auto p-3 md:p-5 md:border-r border-slate-200 ${vistaMovil === 'bloques' ? '' : 'max-md:hidden'}`}>
          {avisos.length > 0 && (
            <div className="mb-3 px-3 py-2.5 rounded-[10px] bg-amber-50 text-[12.5px] text-[#B45309] space-y-1">
              {avisos.map(a => <div key={a}>{a}</div>)}
            </div>
          )}
          {error && <div ref={errorRef} className="mb-3 px-3 py-2.5 rounded-[10px] bg-red-50 border border-red-200 text-[12.5px] text-red-700">{error}</div>}

          <div className="space-y-2">
            {totalHojas > 1 && <EncabezadoHoja n={0} onQuitar={() => quitarHoja(0)} />}
            {bloques.map((b, i) => {
              // Un salto de página es el comienzo de la hoja siguiente: se muestra como su encabezado
              if (b.tipo === 'salto_pagina') {
                const n = bloques.slice(0, i + 1).filter(x => x.tipo === 'salto_pagina').length
                return <EncabezadoHoja key={b._k} n={n} onQuitar={() => quitarHoja(n)} onUnir={() => quitar(b._k)} />
              }
              const T = TIPOS[b.tipo] || { label: b.tipo, icono: AlignLeft }
              const Icono = T.icono
              const esAbierto = abierto === b._k
              return (
                <div key={b._k} data-bloque={b._k} className={`${ui.tarjeta} overflow-hidden ${esAbierto ? 'ring-2 ring-[#1B3A6B]/15' : ''}`}>
                  <div className="flex items-center gap-2 pl-3 pr-1.5 py-1.5">
                    <button type="button" onClick={() => setAbierto(esAbierto ? null : b._k)} className="flex-1 min-w-0 flex items-center gap-2.5 py-1.5 text-left">
                      <Icono size={15} className="text-[#1B3A6B] flex-shrink-0" />
                      <span className="text-[13px] font-semibold text-slate-700 flex-shrink-0">{T.label}</span>
                      <span className="text-[12px] text-slate-400 truncate">{resumen(b)}</span>
                    </button>
                    <button type="button" disabled={i === 0} onClick={() => mover(i, -1)} className={`${ui.btnIcono} disabled:opacity-30`} aria-label="Subir"><ChevronUp size={15} /></button>
                    <button type="button" disabled={i === bloques.length - 1} onClick={() => mover(i, 1)} className={`${ui.btnIcono} disabled:opacity-30`} aria-label="Bajar"><ChevronDown size={15} /></button>
                    <button type="button" onClick={() => duplicar(i)} className={`${ui.btnIcono} max-sm:hidden`} aria-label="Duplicar"><Copy size={14} /></button>
                    <button type="button" onClick={() => quitar(b._k)} className={`${ui.btnIcono} hover:!text-[#D81B43]`} aria-label="Eliminar bloque"><Trash2 size={14} /></button>
                  </div>
                  {esAbierto && <div className="px-3 pb-3 pt-1 border-t border-slate-100"><div className="pt-3"><FormBloque b={b} bi={i} set={v => setBloque(b._k, v)} /></div></div>}
                </div>
              )
            })}
          </div>

          <div className="mt-3">
            {menuAgregar ? (
              <div className={`${ui.tarjeta} p-2 grid grid-cols-2 sm:grid-cols-3 gap-1`}>
                {Object.entries(TIPOS).filter(([, d]) => !d.oculto).map(([t, d]) => {
                  const Icono = d.icono
                  return (
                    <button key={t} type="button" onClick={() => agregar(t)} className="flex items-center gap-2 px-2.5 py-2 rounded-[8px] text-[12.5px] font-medium text-slate-600 hover:bg-slate-50 text-left">
                      <Icono size={14} className="text-[#1B3A6B]" /> {d.label}
                    </button>
                  )
                })}
              </div>
            ) : (
              <button type="button" onClick={() => setMenuAgregar(true)}
                className="w-full flex items-center justify-center gap-1.5 py-3 rounded-xl border-2 border-dashed border-slate-200 text-[13px] font-semibold text-slate-500 hover:border-[#1B3A6B]/40 hover:text-[#1B3A6B]">
                <Plus size={15} /> Agregar bloque
              </button>
            )}
          </div>

          <p className="mt-4 text-[12px] text-slate-400">Haz doble clic en la vista previa donde quieras un espacio; toca un cuadro para cambiarlo. También puedes escribir los datos entre corchetes: [Nombre del paciente].</p>

        </div>

        {/* Vista previa con datos de ejemplo */}
        <div className={`h-full overflow-y-auto bg-slate-100 p-3 md:p-6 ${vistaMovil === 'vista' ? '' : 'max-md:hidden'}`}>
          <LeyendaEspacios />
          <div className="max-w-[780px] mx-auto"><VistaActa bloques={vista} ctx={ctxVista} onElegir={irA} onEspacio={setEspacio} onFirma={moverFirma} /></div>
        </div>
      </div>

      {espacio && (
        <VentanaEspacio key={`${espacio.ruta}-${espacio.o}-${espacio.x}`} info={espacio} propios={ctxVista.editor.propios}
          onGuardar={e => aplicarEspacio(espacio, e)} onCerrar={() => setEspacio(null)} />
      )}

      {eliminado && (
        <div className={`${ui.toast} bg-slate-800 flex items-center gap-4`}>
          {eliminado}
          <button onClick={deshacer} className="font-semibold text-[#7DD3FC] hover:underline">Deshacer</button>
        </div>
      )}

      <ConfirmDialog abierto={confirmar === 'salir'} titulo="¿Salir sin guardar?" mensaje="Se pierden los cambios."
        textoConfirmar="Salir" textoCancelar="Seguir editando" tipo="peligro" onConfirmar={onCerrar} onCancelar={() => setConfirmar(null)} />
    </div>
    </CamposCategoriasCtx.Provider>
    </PropiosCtx.Provider>
  )
}

const TIPOS_ESPACIO = [
  { tipo: 'sis', titulo: 'Lo llena el sistema', detalle: 'Nombre del paciente, fecha, equipo…', color: 'bg-[#DBEAFE] ring-[#93C5FD]' },
  { tipo: 'libre', titulo: 'Se escribe al prestar', detalle: 'Se pide al llenar los datos del préstamo', color: 'bg-[#FEF3C7] ring-[#FCD34D]' },
  { tipo: 'blanco', titulo: 'En blanco', detalle: 'Raya para llenar a mano en el papel', color: 'bg-slate-100 ring-slate-400' },
]
// Lo que se agrega fijo en la plantilla (solo al poner algo nuevo, no al cambiar un espacio)
const TIPOS_FIJOS = [
  { tipo: 'texto', titulo: 'Texto', detalle: 'Queda escrito en la plantilla', icono: Type },
  { tipo: 'firma', titulo: 'Firma fija', detalle: 'Dibujada o en imagen; se mueve y se agranda', icono: PenLine },
]

// Encima de la vista previa: qué es cada color y cómo se pone un espacio
function LeyendaEspacios() {
  return (
    <div className="max-w-[780px] mx-auto mb-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[11.5px] text-slate-500">
      {TIPOS_ESPACIO.map(t => (
        <span key={t.tipo} className="inline-flex items-center gap-1.5"><span className={`w-3 h-3 rounded-[3px] ring-1 ${t.color}`} /> {t.titulo}</span>
      ))}
      <span className="w-full text-center text-slate-400">Doble clic (doble toque en el celular) donde va un espacio · toca un cuadro para cambiarlo</span>
    </div>
  )
}

// Qué va en el espacio tocado. En la pantalla grande sale junto al punto tocado; en el
// celular, desde abajo. propios: { variable: 'Nombre' } de la plantilla.
function VentanaEspacio({ info, propios, onGuardar, onCerrar }) {
  const existe = !!info.len
  const [tipo, setTipo] = useState(info.tipo || 'libre')
  const [variable, setVariable] = useState(info.tipo === 'sis' ? info.var : '')
  const [nombre, setNombre] = useState(info.tipo === 'libre' ? propios[info.var] || '' : '')
  const [ancho, setAncho] = useState(info.tipo === 'blanco' ? anchoDe(info.len) : 'medio')
  const [texto, setTexto] = useState('')
  const [firma, setFirma] = useState(null) // imagen (data URL) dibujada en el pad o subida
  const [modoFirma, setModoFirma] = useState('dibujar')
  const [guardando, setGuardando] = useState(false)
  const [movil] = useState(() => window.matchMedia('(max-width: 767px)').matches)
  useEffect(() => {
    const onTecla = e => { if (e.key === 'Escape') { e.stopPropagation(); onCerrar() } }
    window.addEventListener('keydown', onTecla)
    return () => window.removeEventListener('keydown', onTecla)
  }, [onCerrar])
  const listo = tipo === 'sis' ? !!variable : tipo === 'libre' ? !!nombre.trim() : tipo === 'texto' ? !!texto.trim() : tipo === 'firma' ? !!firma : true
  async function guardar() {
    if (!listo || guardando) return
    setGuardando(true)
    try { await onGuardar({ tipo, variable, nombre, ancho, texto, firma }) } finally { setGuardando(false) }
  }
  // Junto al punto tocado, sin salirse de la pantalla
  const ANCHO = 320
  const pos = movil ? {} : {
    left: Math.max(12, Math.min(info.x - 24, window.innerWidth - ANCHO - 12)),
    ...(info.y > window.innerHeight - 380 ? { bottom: Math.max(12, window.innerHeight - info.y + 12) } : { top: info.y + 14 }),
  }
  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label="Espacio">
      <div className={`absolute inset-0 ${movil ? 'bg-black/45' : ''}`} onClick={onCerrar} />
      <div className={movil ? 'absolute inset-x-0 bottom-0 bg-white rounded-t-2xl shadow-2xl px-4 pt-3' : 'absolute bg-white rounded-xl border border-slate-200 shadow-2xl p-3'}
        style={movil ? { paddingBottom: 'max(16px, env(safe-area-inset-bottom))' } : { ...pos, width: ANCHO }}>
        {movil && <div className="mx-auto w-10 h-1 rounded-full bg-slate-200 mb-3" />}
        <div className="flex items-center mb-2.5">
          <div className="flex-1 text-[14px] font-bold text-slate-800">{existe ? 'Este espacio' : '¿Qué va aquí?'}</div>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className={`${ui.btnIcono} -mr-1`}><X size={16} /></button>
        </div>
        <div className="space-y-1.5">
          {TIPOS_ESPACIO.map(t => (
            <label key={t.tipo} className={`flex items-start gap-2.5 p-2.5 rounded-[10px] border cursor-pointer ${tipo === t.tipo ? 'border-[#1B3A6B] bg-[#1B3A6B]/[0.04]' : 'border-slate-200 hover:border-slate-300'}`}>
              <input type="radio" name="tipo-espacio" checked={tipo === t.tipo} onChange={() => setTipo(t.tipo)} className="mt-1" />
              <span className={`mt-0.5 w-3.5 h-3.5 rounded-[3px] ring-1 flex-shrink-0 ${t.color}`} />
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold text-slate-700">{t.titulo}</span>
                <span className="block text-[11.5px] text-slate-400">{t.detalle}</span>
              </span>
            </label>
          ))}
          {!existe && (
            <div className="grid grid-cols-2 gap-1.5 pt-1">
              {TIPOS_FIJOS.map(t => (
                <button key={t.tipo} type="button" onClick={() => setTipo(t.tipo)} aria-pressed={tipo === t.tipo}
                  className={`flex items-center gap-2 p-2.5 rounded-[10px] border text-left ${tipo === t.tipo ? 'border-[#1B3A6B] bg-[#1B3A6B]/[0.04]' : 'border-slate-200 hover:border-slate-300'}`}>
                  <t.icono size={15} className="text-[#1B3A6B] flex-shrink-0" />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold text-slate-700">{t.titulo}</span>
                    <span className="block text-[11px] text-slate-400 leading-tight">{t.detalle}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="mt-3">
          {tipo === 'texto' && (
            <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={2} placeholder="Escribe el texto" className={`${ui.input} resize-none`} autoFocus={!movil} />
          )}
          {tipo === 'firma' && (
            <div>
              {/* Dibujarla aquí o subir una imagen (foto o escaneo de la firma, sello…) */}
              <div className="grid grid-cols-2 gap-1 p-1 mb-2 bg-slate-100 rounded-[10px]">
                {[['dibujar', 'Dibujar'], ['subir', 'Subir imagen']].map(([m, l]) => (
                  <button key={m} type="button" onClick={() => { setModoFirma(m); setFirma(null) }}
                    className={`py-1.5 rounded-[8px] text-[12.5px] font-semibold ${modoFirma === m ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}>{l}</button>
                ))}
              </div>
              {modoFirma === 'dibujar' ? <FirmaPad onFirma={setFirma} onLimpiar={() => setFirma(null)} /> : (
                <label className="block cursor-pointer">
                  <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={e => {
                    const f = e.target.files[0]; e.target.value = ''
                    if (!f) return
                    const lector = new FileReader()
                    lector.onload = () => setFirma(lector.result)
                    lector.readAsDataURL(f)
                  }} />
                  <span className="flex flex-col items-center justify-center gap-1.5 h-[140px] rounded-[10px] border-2 border-dashed border-slate-300 bg-white hover:border-[#1B3A6B]/40">
                    {firma
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={firma} alt="Firma" className="max-h-[110px] max-w-[90%] object-contain" />
                      : <><Upload size={18} className="text-slate-400" /><span className="text-[12.5px] font-semibold text-[#1B3A6B]">Elegir imagen</span><span className="text-[11px] text-slate-400">PNG con fondo transparente se ve mejor</span></>}
                  </span>
                  {firma && <span className="block mt-1.5 text-[12px] font-semibold text-[#1B3A6B]">Cambiar imagen</span>}
                </label>
              )}
            </div>
          )}
          {tipo === 'sis' && (
            <select value={variable} onChange={e => setVariable(e.target.value)} className={ui.input} autoFocus={!movil}>
              <option value="">Elige el dato…</option>
              {Object.entries(NOMBRES).map(([g, vars]) => (
                <optgroup key={g} label={g}>{Object.entries(vars).map(([v, n]) => <option key={v} value={v}>{n}</option>)}</optgroup>
              ))}
            </select>
          )}
          {tipo === 'libre' && (
            <>
              <input value={nombre} onChange={e => setNombre(e.target.value.replace(/[[\]]/g, ''))} placeholder="Nombre: Ciudad de expedición" list="propios-plantilla"
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); guardar() } }} className={ui.input} autoFocus={!movil} />
              <datalist id="propios-plantilla">{Object.values(propios).map(n => <option key={n} value={n} />)}</datalist>
            </>
          )}
          {tipo === 'blanco' && (
            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-[10px]">
              {Object.keys(ANCHOS).map(a => (
                <button key={a} type="button" onClick={() => setAncho(a)}
                  className={`py-1.5 rounded-[8px] text-[12.5px] font-semibold capitalize ${ancho === a ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}>{a}</button>
              ))}
            </div>
          )}
        </div>
        <div className="mt-3 flex items-center gap-2">
          {existe && (
            <button type="button" onClick={() => onGuardar({ tipo: null })} className="inline-flex items-center gap-1 h-[38px] px-2.5 rounded-[9px] text-[13px] font-semibold text-[#D81B43] hover:bg-red-50">
              <Trash2 size={14} /> Quitar
            </button>
          )}
          <div className="flex-1" />
          <button type="button" onClick={onCerrar} className={ui.btnSecundario}>Cancelar</button>
          <button type="button" onClick={guardar} disabled={!listo || guardando} className={ui.btnAzul}>{guardando ? 'Guardando…' : existe ? 'Guardar' : 'Poner'}</button>
        </div>
      </div>
    </div>
  )
}

// Comienzo de cada hoja en la lista de bloques. "Eliminar hoja" quita la hoja con todo
// lo que tiene; "Unir con la anterior" solo quita el salto (se deshace con Deshacer).
function EncabezadoHoja({ n, onQuitar, onUnir }) {
  return (
    <div className={`flex items-center gap-2 flex-wrap ${n ? 'pt-3' : ''}`}>
      <FileStack size={14} className="text-slate-400" />
      <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">Hoja {n + 1}</span>
      <span className="flex-1 h-px bg-slate-200 min-w-[24px]" />
      {onUnir && (
        <button type="button" onClick={onUnir} className="h-8 px-2 rounded-[8px] text-[12px] font-semibold text-slate-500 hover:bg-slate-100">Unir con la anterior</button>
      )}
      <button type="button" onClick={onQuitar} className="inline-flex items-center gap-1 h-8 px-2 rounded-[8px] text-[12px] font-semibold text-[#D81B43] hover:bg-red-50">
        <Trash2 size={13} /> Eliminar hoja
      </button>
    </div>
  )
}
