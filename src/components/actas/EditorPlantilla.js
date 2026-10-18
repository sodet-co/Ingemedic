'use client'
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import {
  X, ChevronUp, ChevronDown, Copy, Trash2, Plus, Loader2, Heading, Type, AlignLeft, LayoutGrid, Table2,
  PenLine, Image as IconoImagen, MoveVertical, PanelBottom, FileStack, Upload, Undo2, Redo2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { NOMBRES, aTexto, aVariables, mapearTextos, propiosDe } from '@/lib/actas/nombres'
import { contextoEjemplo } from '@/lib/actas/ejemplo'
import { subirImagen } from '@/lib/actas/imagenesPlantilla'
import { registrarBitacora } from '@/lib/bitacora'
import VistaActa from '@/components/actas/VistaActa'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
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
  tabla: { label: 'Tabla de equipos', icono: Table2, nuevo: () => ({ fuente: 'equipos', filas_minimas: 3, columnas: [{ clave: 'item' }, { clave: 'descripcion' }, { clave: 'marca' }, { clave: 'modelo' }, { clave: 'serie' }] }) },
  firmas: { label: 'Firmas', icono: PenLine, nuevo: () => ({ firmas: [{ rol: 'recibe', titulo: 'Quien recibe', lineas: [{ etiqueta: 'C.C.', valor: '[Documento de quien recibe]' }] }, { rol: 'entrega', titulo: 'Quien entrega', lineas: [] }] }) },
  imagen: { label: 'Imagen', icono: IconoImagen, nuevo: () => ({ url: '', alto: 60, alineacion: 'centro' }) },
  espacio: { label: 'Espacio', icono: MoveVertical, nuevo: () => ({ alto: 16 }) },
  pie: { label: 'Pie de página', icono: PanelBottom, nuevo: () => ({ texto: '' }) },
  salto_pagina: { label: 'Salto de página', icono: FileStack, nuevo: () => ({}) },
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
  return (bloques || []).filter(b => b.tipo !== 'campos_propios').map(b => conClave(mapearTextos(b, s => aTexto(s, propios))))
}
// …y de vuelta, con el bloque de campos propios si hay datos que el sistema no conoce
function paraGuardar(bloques) {
  const propios = {}
  const out = bloques.map(({ _k, ...b }) => mapearTextos(b, s => aVariables(s, propios)))
  return Object.keys(propios).length ? [...out, { tipo: 'campos_propios', etiquetas: propios }] : out
}

// Campo de texto con "+ Dato" que inserta [Nombre] donde está el cursor
function CampoTexto({ value, onChange, multilinea, filas = 3, placeholder, className = '' }) {
  const ref = useRef(null)
  function insertar(nombre) {
    if (!nombre) return
    const el = ref.current
    const v = value || ''
    const i = el?.selectionStart ?? v.length, j = el?.selectionEnd ?? v.length
    const nuevo = `${v.slice(0, i)}[${nombre}]${v.slice(j)}`
    onChange(nuevo)
    requestAnimationFrame(() => { if (el) { el.focus(); const p = i + nombre.length + 2; el.setSelectionRange(p, p) } })
  }
  const Comp = multilinea ? 'textarea' : 'input'
  return (
    <div className={`relative ${className}`}>
      <Comp ref={ref} value={value || ''} rows={multilinea ? filas : undefined} placeholder={placeholder}
        onChange={e => onChange(e.target.value)} className={`${ui.input} pr-[74px] ${multilinea ? 'resize-y leading-relaxed' : ''}`} />
      <select value="" onChange={e => insertar(e.target.value)} title="Insertar un dato"
        className="absolute right-1.5 top-1.5 h-7 w-[64px] rounded-[7px] border border-slate-200 bg-slate-50 text-[11.5px] font-semibold text-[#1B3A6B] cursor-pointer">
        <option value="">+ Dato</option>
        {Object.entries(NOMBRES).map(([g, vars]) => (
          <optgroup key={g} label={g}>{Object.values(vars).map(n => <option key={n} value={n}>{n}</option>)}</optgroup>
        ))}
      </select>
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
          <div>{render(it, v => onChange(items.map((x, j) => j === i ? v : x)))}</div>
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
function FormBloque({ b, set }) {
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
          render={(c, setC) => (
            <div className="space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input value={c.etiqueta || ''} placeholder="Etiqueta (Nombre:)" onChange={e => setC({ ...c, etiqueta: e.target.value })} className={ui.input} />
                <CampoTexto value={c.valor} placeholder="Vacío = raya para llenar" onChange={v => setC({ ...c, valor: v })} />
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
    case 'tabla': return (
      <div className="space-y-3">
        <p className="px-3 py-2 rounded-[9px] bg-[#E8F7FB] text-[12.5px] text-[#0E7490]">Se llena sola con los equipos (o insumos) del préstamo. Si son menos que las filas mínimas, quedan renglones en blanco.</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="col-span-2"><Etiqueta>Título (opcional)</Etiqueta><input value={b.titulo || ''} onChange={e => campo('titulo', e.target.value)} className={ui.input} /></div>
          <div><Etiqueta>Lista</Etiqueta><Sel value={b.fuente || 'equipos'} onChange={v => campo('fuente', v)} opciones={{ equipos: 'Equipos', insumos: 'Insumos', ambos: 'Equipos e insumos' }} /></div>
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
        render={(f, setF) => (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Sel value={f.rol} onChange={v => setF({ ...f, rol: v })} opciones={{ ...ROLES, vacia: 'Sin firma (solo raya)' }} />
              <input value={f.titulo || ''} placeholder="Título bajo la raya" onChange={e => setF({ ...f, titulo: e.target.value })} className={ui.input} />
            </div>
            {(f.lineas || []).map((l, i) => (
              <div key={i} className="grid grid-cols-[90px_1fr_32px] gap-2">
                <input value={l.etiqueta || ''} placeholder="C.C." onChange={e => setF({ ...f, lineas: f.lineas.map((x, j) => j === i ? { ...x, etiqueta: e.target.value } : x) })} className={ui.input} />
                <CampoTexto value={l.valor} onChange={v => setF({ ...f, lineas: f.lineas.map((x, j) => j === i ? { ...x, valor: v } : x) })} />
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
    default: return <div className="text-[12.5px] text-slate-400">Este bloque no se puede editar aquí.</div>
  }
}

function resumen(b) {
  const quitar = s => String(s || '').replace(/\*\*/g, '').slice(0, 70)
  switch (b.tipo) {
    case 'encabezado': return quitar(b.centro?.[0]?.texto)
    case 'titulo': case 'texto': case 'pie': return quitar(b.texto) || 'Vacío'
    case 'campos': return `${b.titulo ? b.titulo + ' · ' : ''}${(b.campos || []).length} campos`
    case 'tabla': return { equipos: 'Equipos', insumos: 'Insumos', ambos: 'Equipos e insumos' }[b.fuente || 'equipos'] + (b.titulo ? ` · ${b.titulo}` : '')
    case 'firmas': return (b.firmas || []).map(f => f.titulo || ROLES[f.rol] || 'Raya').join(' · ')
    case 'imagen': return b.url ? 'Con imagen' : 'Sin imagen'
    case 'espacio': return `${b.alto || 16} px`
    default: return ''
  }
}

export default function EditorPlantilla({ plantilla, inicial, empresa, avisos = [], onCerrar, onGuardado }) {
  const supabase = useMemo(() => createClient(), [])
  const origen = plantilla || inicial || {}
  const [nombre, setNombre] = useState(origen.nombre || '')
  const [descripcion, setDescripcion] = useState(origen.descripcion || '')
  const [bloques, setBloques] = useState(() => paraEditar(origen.bloques))
  const [abierto, setAbierto] = useState(null) // bloque desplegado
  const [menuAgregar, setMenuAgregar] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)
  const [errorNombre, setErrorNombre] = useState(false)
  const nombreRef = useRef(null)
  const errorRef = useRef(null)
  const [vistaMovil, setVistaMovil] = useState('bloques')
  const [confirmar, setConfirmar] = useState(null) // 'salir' | 'desactivar'
  const [cambios, setCambios] = useState(!plantilla) // una importada o nueva cuenta como cambio

  const diferidos = useDeferredValue(bloques)
  const ctx = useMemo(() => contextoEjemplo(empresa), [empresa])
  const vista = useMemo(() => paraGuardar(diferidos), [diferidos])

  // Deshacer / rehacer: cada cambio guarda cómo estaba antes. Lo que se escribe
  // seguido en un mismo bloque cuenta como un solo paso (no letra por letra).
  const [historial, setHistorial] = useState({ pasado: [], futuro: [] })
  const ultimoBloque = useRef(null)
  const [eliminado, setEliminado] = useState(false) // aviso "Bloque eliminado · Deshacer"
  const avisoRef = useRef(null)

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
    ultimoBloque.current = null; setEliminado(false)
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
  const quitar = k => {
    cambiar(l => l.filter(b => b._k !== k))
    setEliminado(true)
    clearTimeout(avisoRef.current)
    avisoRef.current = setTimeout(() => setEliminado(false), 6000)
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
    const datos = { nombre: nombre.trim(), descripcion: descripcion.trim() || null, bloques: paraGuardar(bloques) }
    const res = plantilla?.id
      ? await supabase.from('plantillas_acta').update(datos).eq('id', plantilla.id).select('*').single()
      : await supabase.from('plantillas_acta').insert({ ...datos, tipo: 'entrega', es_estandar: false, uso_general: false, activo: true }).select('*').single()
    setGuardando(false)
    if (res.error) { setError('No se guardó: ' + res.error.message); return }
    registrarBitacora({ modulo: 'configuracion', accion: plantilla?.id ? 'editar' : 'crear', entidad: 'plantilla de acta', entidad_id: res.data.id, detalle: { nombre: datos.nombre } })
    onGuardado(res.data, !plantilla?.id)
  }

  async function desactivar() {
    setGuardando(true)
    const { error: err } = await supabase.from('plantillas_acta').update({ activo: false }).eq('id', plantilla.id)
    if (!err) await supabase.from('cliente_plantillas_acta').delete().eq('plantilla_id', plantilla.id)
    setGuardando(false); setConfirmar(null)
    if (err) { setError('No se desactivó: ' + err.message); return }
    registrarBitacora({ modulo: 'configuracion', accion: 'desactivar', entidad: 'plantilla de acta', entidad_id: plantilla.id, detalle: { nombre: plantilla.nombre } })
    onGuardado({ ...plantilla, activo: false }, false)
  }

  const salir = () => (cambios ? setConfirmar('salir') : onCerrar())

  return (
    <div className="fixed inset-0 z-[60] bg-[#F8FAFC] flex flex-col">
      {/* Encabezado: nombre y acciones */}
      <div className="flex-shrink-0 bg-white border-b border-slate-200 px-3 md:px-6 py-3 flex items-center gap-3">
        <button onClick={salir} className={ui.btnIcono} aria-label="Cerrar"><X size={18} /></button>
        <div className="flex-1 min-w-0 grid gap-1">
          <input ref={nombreRef} value={nombre} onChange={e => { setNombre(e.target.value); setCambios(true); setErrorNombre(false) }} placeholder="Nombre de la plantilla"
            aria-invalid={errorNombre || undefined}
            className={`w-full text-[16px] md:text-[17px] font-bold text-slate-800 outline-none rounded-[7px] ${errorNombre ? 'bg-red-50 ring-2 ring-[#D81B43]/60 px-2 py-0.5 placeholder:text-[#D81B43]/60' : 'bg-transparent placeholder:text-slate-300'}`} />
          {errorNombre && <div className="text-[12px] font-medium text-[#D81B43]">Escribe el nombre de la plantilla</div>}
          <input value={descripcion} onChange={e => { setDescripcion(e.target.value); setCambios(true) }} placeholder="Descripción (opcional)"
            className="w-full text-[16px] md:text-[12.5px] text-slate-500 bg-transparent outline-none placeholder:text-slate-300" />
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
        <div className={`h-full overflow-y-auto p-3 md:p-5 md:border-r border-slate-200 ${vistaMovil === 'bloques' ? '' : 'max-md:hidden'}`}>
          {avisos.length > 0 && (
            <div className="mb-3 px-3 py-2.5 rounded-[10px] bg-amber-50 text-[12.5px] text-[#B45309] space-y-1">
              {avisos.map(a => <div key={a}>{a}</div>)}
            </div>
          )}
          {error && <div ref={errorRef} className="mb-3 px-3 py-2.5 rounded-[10px] bg-red-50 border border-red-200 text-[12.5px] text-red-700">{error}</div>}

          <div className="space-y-2">
            {bloques.map((b, i) => {
              const T = TIPOS[b.tipo] || { label: b.tipo, icono: AlignLeft }
              const Icono = T.icono
              const esAbierto = abierto === b._k
              return (
                <div key={b._k} className={`${ui.tarjeta} overflow-hidden ${esAbierto ? 'ring-2 ring-[#1B3A6B]/15' : ''}`}>
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
                  {esAbierto && <div className="px-3 pb-3 pt-1 border-t border-slate-100"><div className="pt-3"><FormBloque b={b} set={v => setBloque(b._k, v)} /></div></div>}
                </div>
              )
            })}
          </div>

          <div className="mt-3">
            {menuAgregar ? (
              <div className={`${ui.tarjeta} p-2 grid grid-cols-2 sm:grid-cols-3 gap-1`}>
                {Object.entries(TIPOS).map(([t, d]) => {
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

          <p className="mt-4 text-[12px] text-slate-400">Los datos van entre corchetes: [Nombre del paciente]. Un nombre que el sistema no conoce se pide al crear el préstamo.</p>

          {plantilla?.id && !plantilla.es_estandar && (
            <div className="mt-6 pt-4 border-t border-slate-200">
              <button onClick={() => setConfirmar('desactivar')} className={ui.btnPeligro}><Trash2 size={13} /> Desactivar plantilla</button>
            </div>
          )}
        </div>

        {/* Vista previa con datos de ejemplo */}
        <div className={`h-full overflow-y-auto bg-slate-100 p-3 md:p-6 ${vistaMovil === 'vista' ? '' : 'max-md:hidden'}`}>
          <div className="text-[11.5px] text-slate-400 mb-3 text-center">Vista previa con datos de ejemplo</div>
          <div className="max-w-[780px] mx-auto"><VistaActa bloques={vista} ctx={ctx} /></div>
        </div>
      </div>

      {eliminado && (
        <div className={`${ui.toast} bg-slate-800 flex items-center gap-4`}>
          Bloque eliminado
          <button onClick={deshacer} className="font-semibold text-[#7DD3FC] hover:underline">Deshacer</button>
        </div>
      )}

      <ConfirmDialog abierto={confirmar === 'salir'} titulo="¿Salir sin guardar?" mensaje="Se pierden los cambios."
        textoConfirmar="Salir" textoCancelar="Seguir editando" tipo="peligro" onConfirmar={onCerrar} onCancelar={() => setConfirmar(null)} />
      <ConfirmDialog abierto={confirmar === 'desactivar'} titulo="¿Desactivar esta plantilla?" mensaje="Deja de ofrecerse en los préstamos nuevos. Las actas firmadas no cambian."
        textoConfirmar="Desactivar" tipo="peligro" onConfirmar={desactivar} onCancelar={() => setConfirmar(null)} />
    </div>
  )
}
