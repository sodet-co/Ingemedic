'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { X, Type, PenLine, Table2, Trash2, Copy, Loader2, FileUp, MousePointerClick, Plus, Minus, Eye } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { NOMBRES, NOMBRE_FIRMA, aTexto, aVariables, propiosDe } from '@/lib/actas/nombres'
import { contextoEjemplo } from '@/lib/actas/ejemplo'
import { cajaHojaFija, filasHojaFija, letraHojaFija, esRenglonHojaFija, BAJAR_BASE, COLUMNAS_ESTANDAR } from '@/lib/actas/render'
import { bloquesDesdePdf } from '@/lib/actas/pdfPaginas'
import { accionDe } from '@/lib/actas/acciones'
import { registrarBitacora } from '@/lib/bitacora'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import PreviaActas from '@/components/actas/PreviaActas'
import { ui } from '@/lib/ui'

// Editor de una plantilla desde PDF (bloques hoja_fija, render.js → hojaFija). La hoja
// se ve tal cual y encima se marcan los recuadros: se elige qué agregar (dato, firma,
// tabla de equipos) y se arrastra sobre la hoja donde va. Cada recuadro se mueve, se
// agranda desde la esquina y se configura en el panel. No se lee nada del PDF: lo que
// el sistema escribe es solo lo que se ubica aquí. Posiciones en % de la hoja.

const HERRAMIENTAS = {
  texto: { label: 'Dato o texto', icono: Type, nuevo: { tipo: 'texto', w: 26, h: 2.2, texto: '' } },
  firma: { label: 'Firma', icono: PenLine, nuevo: { tipo: 'firma', w: 24, h: 6, rol: 'recibe' } },
  tabla: {
    label: 'Tabla de equipos', icono: Table2, nuevo: {
      tipo: 'tabla', w: 86, h: 14, fuente: 'equipos', filas: 5,
      columnas: [{ clave: 'descripcion', w: 40 }, { clave: 'cantidad', w: 10 }, { clave: 'marca', w: 16 }, { clave: 'modelo', w: 16 }, { clave: 'serie', w: 18 }],
    },
  },
}
const ROLES = { recibe: 'Quien recibe', entrega: 'Quien entrega', responsable: 'Responsable del paciente', otra: 'Otra persona (escribe quién)' }
const FUENTES = { equipos: 'Equipos del préstamo', insumos: 'Insumos', ambos: 'Equipos e insumos', retirados: 'Equipos que se retiran (cambio)' }
const COLUMNAS = { ...COLUMNAS_ESTANDAR, lote: 'LOTE', invima: 'REG. INVIMA' }
const COLOR = { texto: '#2563EB', firma: '#7C3AED', tabla: '#0F7B55' }
const NOMBRE_DE = Object.fromEntries(Object.values(NOMBRES).flatMap(g => Object.entries(g)))
const conX = cols => { let x = 0; return cols.map(c => { const r = { ...c, x }; x += c.w; return r }) }
const limitar = (v, a, b) => Math.min(Math.max(v, a), b)
const redondo = n => Math.round(n * 100) / 100
let siguiente = 1

// Bloques guardados → hojas para editar (los datos como [Nombre], igual que en Word)
function paraEditar(bloques) {
  const propios = propiosDe(bloques)
  return (bloques || []).filter(b => b.tipo === 'hoja_fija').map(h => ({
    ...h, campos: (h.campos || []).map(({ valor, ...c }) => ({ ...c, _k: siguiente++, ...(c.tipo === 'texto' ? { texto: aTexto(valor || '', propios) } : {}) })),
  }))
}

// Texto del recuadro con datos de ejemplo (los propios con su nombre)
function ejemploDe(texto, vars) {
  return aVariables(texto || '', {}).replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_, k) => vars[k] || `[${NOMBRE_DE[k] || k.replace(/_/g, ' ')}]`)
}

export default function EditorHojaFija({ plantilla, inicial, empresa, avisos = [], onCerrar, onGuardado }) {
  const supabase = useMemo(() => createClient(), [])
  const origen = plantilla || inicial || {}
  const [nombre, setNombre] = useState(origen.nombre || '')
  const [errorNombre, setErrorNombre] = useState(false)
  const [hojas, setHojas] = useState(() => paraEditar(origen.bloques))
  const [sel, setSel] = useState(null)            // { h, k }
  const [herramienta, setHerramienta] = useState(null)
  const [cambios, setCambios] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [cambiandoPdf, setCambiandoPdf] = useState(false)
  const [error, setError] = useState(null)
  const [confirmar, setConfirmar] = useState(false)
  const [previa, setPrevia] = useState(null)        // bloques para la vista previa
  const nombreRef = useRef(null)
  const ctx = useMemo(() => contextoEjemplo(empresa), [empresa])
  const ocultos = useMemo(() => (origen.bloques || []).filter(b => ['para_equipos', 'renovable'].includes(b.tipo)), [origen.bloques])

  const campoSel = sel && hojas[sel.h]?.campos.find(c => c._k === sel.k)
  const cambiarHojas = fn => { setHojas(fn); setCambios(true) }
  const cambiarCampo = (h, k, cambio) => cambiarHojas(l => l.map((hoja, hi) => hi !== h ? hoja
    : { ...hoja, campos: hoja.campos.map(c => c._k === k ? { ...c, ...(typeof cambio === 'function' ? cambio(c) : cambio) } : c) }))
  const quitar = (h, k) => { cambiarHojas(l => l.map((hoja, hi) => hi !== h ? hoja : { ...hoja, campos: hoja.campos.filter(c => c._k !== k) })); setSel(null) }
  const agregar = (h, campo) => {
    const nuevo = { ...structuredClone(campo), _k: siguiente++ }
    cambiarHojas(l => l.map((hoja, hi) => hi !== h ? hoja : { ...hoja, campos: [...hoja.campos, nuevo] }))
    setSel({ h, k: nuevo._k })
  }

  // Supr borra el recuadro elegido; las flechas lo corren un poco (Shift: más)
  useEffect(() => {
    const onTecla = e => {
      if (!campoSel || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); quitar(sel.h, sel.k); return }
      if (e.key === 'Escape') { setSel(null); return }
      const paso = e.shiftKey ? 1 : 0.15
      const d = { ArrowLeft: [-paso, 0], ArrowRight: [paso, 0], ArrowUp: [0, -paso], ArrowDown: [0, paso] }[e.key]
      if (!d) return
      e.preventDefault()
      cambiarCampo(sel.h, sel.k, c => ({ x: redondo(limitar(c.x + d[0], 0, 100 - c.w)), y: redondo(limitar(c.y + d[1], 0, 100 - c.h)) }))
    }
    window.addEventListener('keydown', onTecla)
    return () => window.removeEventListener('keydown', onTecla)
  })

  // Otra versión del mismo formato: se cambian las hojas y se quedan los recuadros
  async function cambiarPdf(archivo) {
    if (!/\.pdf$/i.test(archivo.name)) { setError('Sube un archivo .pdf'); return }
    setCambiandoPdf(true); setError(null)
    try {
      const nuevas = (await bloquesDesdePdf(supabase, archivo)).filter(b => b.tipo === 'hoja_fija')
      cambiarHojas(l => nuevas.map((n, i) => ({ ...n, campos: l[i]?.campos || [] })))
      setSel(null)
    } catch (e) { setError('No se pudo leer el PDF: ' + (e.message || e)) }
    setCambiandoPdf(false)
  }

  // Bloques tal como se guardan (también para la vista previa, sin guardar)
  function armarBloques() {
    const propios = {}
    const bloques = []
    hojas.forEach((h, i) => {
      if (i) bloques.push({ tipo: 'salto_pagina' })
      bloques.push({
        ...h, campos: h.campos.map(({ _k, texto, ...c }) => ({ ...c, ...(c.tipo === 'texto' ? { valor: aVariables(texto || '', propios) } : {}) })),
      })
    })
    if (Object.keys(propios).length) bloques.push({ tipo: 'campos_propios', etiquetas: propios })
    return [...bloques, ...ocultos]
  }

  async function guardar() {
    if (!nombre.trim()) { setErrorNombre(true); nombreRef.current?.focus(); return }
    setGuardando(true); setError(null)
    const datos = { nombre: nombre.trim(), descripcion: origen.descripcion || null, accion: accionDe(origen), bloques: armarBloques() }
    const res = plantilla?.id
      ? await supabase.from('plantillas_acta').update(datos).eq('id', plantilla.id).select('*').single()
      : await supabase.from('plantillas_acta').insert({ ...datos, tipo: 'entrega', es_estandar: false, uso_general: false, activo: true }).select('*').single()
    setGuardando(false)
    if (res.error) { setError('No se guardó: ' + res.error.message); return }
    registrarBitacora({ modulo: 'configuracion', accion: plantilla?.id ? 'editar' : 'crear', entidad: 'plantilla de acta', entidad_id: res.data.id, detalle: { nombre: datos.nombre } })
    onGuardado(res.data, !plantilla?.id)
  }

  const total = hojas.reduce((s, h) => s + h.campos.length, 0)
  const sinFirma = !hojas.some(h => h.campos.some(c => c.tipo === 'firma'))

  return (
    <div className="fixed inset-0 z-[60] bg-[#F8FAFC] flex flex-col">
      <div className="flex-shrink-0 bg-white border-b border-slate-200 px-3 md:px-6 py-3 flex items-center gap-3">
        <button onClick={() => (cambios ? setConfirmar(true) : onCerrar())} className={ui.btnIcono} aria-label="Cerrar"><X size={18} /></button>
        <div className="flex-1 min-w-0 grid gap-1">
          <input ref={nombreRef} value={nombre} onChange={e => { setNombre(e.target.value); setCambios(true); setErrorNombre(false) }} placeholder="Nombre de la plantilla"
            aria-invalid={errorNombre || undefined}
            className={`w-full text-[16px] md:text-[17px] font-bold text-slate-800 outline-none rounded-[7px] ${errorNombre ? 'bg-red-50 ring-2 ring-[#D81B43]/60 px-2 py-0.5 placeholder:text-[#D81B43]/60' : 'bg-transparent placeholder:text-slate-300'}`} />
          {errorNombre && <div className="text-[12px] font-medium text-[#D81B43]">Escribe el nombre de la plantilla</div>}
        </div>
        <label className={`${ui.btnSecundario} cursor-pointer hidden sm:inline-flex ${cambiandoPdf ? 'pointer-events-none opacity-60' : ''}`} title="Otra versión del formato: se quedan los recuadros">
          {cambiandoPdf ? <Loader2 size={14} className="animate-spin" /> : <FileUp size={14} />} Cambiar PDF
          <input type="file" accept=".pdf,application/pdf" className="hidden" onChange={e => { const f = e.target.files[0]; e.target.value = ''; if (f) cambiarPdf(f) }} />
        </label>
        {/* Como queda el acta, con datos de ejemplo: ahí mismo se baja el PDF de prueba */}
        <button onClick={() => setPrevia(armarBloques())} className={ui.btnSecundario} title="Ver el acta con datos de ejemplo y bajar el PDF de prueba">
          <Eye size={14} /> <span className="max-sm:hidden">Vista previa</span>
        </button>
        <button onClick={guardar} disabled={guardando} className={ui.btnPrimario}>{guardando ? 'Guardando…' : 'Guardar'}</button>
      </div>

      <div className="flex-1 min-h-0 flex flex-col md:flex-row">
        {/* Panel: qué agregar y el recuadro elegido */}
        <div className="md:w-[340px] flex-shrink-0 md:h-full overflow-y-auto p-3 md:p-5 md:border-r border-slate-200 bg-white max-md:border-b max-md:max-h-[45dvh]">
          {avisos.map(a => <div key={a} className="mb-3 px-3 py-2.5 rounded-[10px] bg-amber-50 text-[12.5px] text-[#B45309]">{a}</div>)}
          {error && <div className="mb-3 px-3 py-2.5 rounded-[10px] bg-red-50 border border-red-200 text-[12.5px] text-red-700">{error}</div>}

          <div className={`${ui.tituloSeccion} mb-2`}>Agregar</div>
          <div className="grid grid-cols-3 gap-1.5">
            {Object.entries(HERRAMIENTAS).map(([t, h]) => {
              const Icono = h.icono
              return (
                <button key={t} type="button" onClick={() => setHerramienta(x => x === t ? null : t)} aria-pressed={herramienta === t}
                  className={`flex flex-col items-center gap-1 px-1.5 py-2.5 rounded-[10px] border text-[11.5px] font-semibold transition-colors ${herramienta === t ? 'bg-[#1B3A6B] border-[#1B3A6B] text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                  <Icono size={16} />{h.label}
                </button>
              )
            })}
          </div>
          <p className="text-[12px] text-slate-500 mt-2 flex gap-1.5">
            <MousePointerClick size={14} className="flex-shrink-0 mt-px text-slate-400" />
            {herramienta ? 'Ahora arrastra sobre la hoja donde va.' : 'Elige qué agregar y arrastra sobre la hoja. Toca un recuadro para cambiarlo.'}
          </p>

          <div className="mt-5">
            {campoSel ? (
              <PanelCampo key={campoSel._k} c={campoSel} letra={letraHojaFija(campoSel, cajaHojaFija(hojas[sel.h].proporcion))} onCambio={x => cambiarCampo(sel.h, sel.k, x)}
                onDuplicar={() => agregar(sel.h, { ...campoSel, y: limitar(campoSel.y + campoSel.h + 0.5, 0, 100 - campoSel.h) })}
                onQuitar={() => quitar(sel.h, sel.k)} />
            ) : (
              <div className="text-[12.5px] text-slate-500 space-y-2">
                <div>{total ? `${total} recuadro${total === 1 ? '' : 's'} en ${hojas.length} hoja${hojas.length === 1 ? '' : 's'}.` : 'Aún no hay recuadros.'}</div>
                {sinFirma && <div className="px-3 py-2 rounded-[10px] bg-amber-50 text-[#B45309]">Falta ubicar la firma de quien recibe.</div>}
              </div>
            )}
          </div>
        </div>

        {/* Hojas */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3 md:p-6" onPointerDown={e => { if (e.target === e.currentTarget) setSel(null) }}>
          <div className="max-w-[820px] mx-auto space-y-5">
            {hojas.map((hoja, h) => (
              <div key={h}>
                {hojas.length > 1 && <div className={`${ui.tituloSeccion} mb-1.5`}>Hoja {h + 1}</div>}
                <Hoja hoja={hoja} ctx={ctx} herramienta={herramienta} sel={sel?.h === h ? sel.k : null}
                  onElegir={k => { setSel(k == null ? null : { h, k }) }}
                  onCrear={pos => { agregar(h, { ...HERRAMIENTAS[herramienta].nuevo, ...pos }); setHerramienta(null) }}
                  onCambio={(k, x) => cambiarCampo(h, k, x)} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {previa && (
        <PreviaActas titulo="Vista previa con datos de ejemplo" nombreArchivo={`Prueba_${(nombre || 'plantilla').replace(/\s+/g, '_')}`}
          onError={setError} onCerrar={() => setPrevia(null)}
          actas={[{ id: 'previa', nombre: nombre || 'Plantilla', bloques: previa, datos: ctx, firma_recibe: ctx.firmas?.recibe, firma_entrega: ctx.firmas?.entrega }]} />
      )}
      <ConfirmDialog abierto={confirmar} titulo="¿Salir sin guardar?" mensaje="Los cambios se pierden."
        textoConfirmar="Salir" tipo="peligro" onConfirmar={onCerrar} onCancelar={() => setConfirmar(false)} />
    </div>
  )
}

// Una hoja: la imagen del PDF y los recuadros encima. Con una herramienta elegida,
// arrastrar dibuja el recuadro nuevo (un toque lo pone con el tamaño de siempre).
function Hoja({ hoja, ctx, herramienta, sel, onElegir, onCrear, onCambio }) {
  const ref = useRef(null)
  const [ancho, setAncho] = useState(760)
  const [dibujo, setDibujo] = useState(null)   // { x0, y0, x, y } en %
  const arrastre = useRef(null)
  const caja = cajaHojaFija(hoja.proporcion)
  const escala = ancho / caja.ancho             // px en pantalla por px de render

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setAncho(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const enPct = e => {
    const r = ref.current.getBoundingClientRect()
    return { x: limitar((e.clientX - r.left) / r.width * 100, 0, 100), y: limitar((e.clientY - r.top) / r.height * 100, 0, 100) }
  }

  // Dibujar uno nuevo
  const empezarDibujo = e => {
    if (!herramienta) { onElegir(null); return }
    e.preventDefault()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    const p = enPct(e)
    setDibujo({ x0: p.x, y0: p.y, x: p.x, y: p.y })
  }
  const moverDibujo = e => { if (dibujo) { const p = enPct(e); setDibujo(d => ({ ...d, x: p.x, y: p.y })) } }
  const soltarDibujo = () => {
    if (!dibujo) return
    const base = HERRAMIENTAS[herramienta].nuevo
    const w = Math.abs(dibujo.x - dibujo.x0), h = Math.abs(dibujo.y - dibujo.y0)
    // Un toque (casi sin arrastrar): tamaño de siempre, empezando ahí
    const pos = w < 1.5 && h < 0.8
      ? { x: limitar(dibujo.x0, 0, 100 - base.w), y: limitar(dibujo.y0 - base.h / 2, 0, 100 - base.h), w: base.w, h: base.h }
      : { x: Math.min(dibujo.x, dibujo.x0), y: Math.min(dibujo.y, dibujo.y0), w: Math.max(w, 2), h: Math.max(h, 1) }
    setDibujo(null)
    onCrear({ x: redondo(pos.x), y: redondo(pos.y), w: redondo(pos.w), h: redondo(pos.h) })
  }

  // Mover o agrandar uno que ya está
  const empezar = (c, modo, e) => {
    if (herramienta) return
    e.preventDefault(); e.stopPropagation()
    onElegir(c._k)
    e.currentTarget.setPointerCapture?.(e.pointerId)
    arrastre.current = { k: c._k, modo, p: enPct(e), c: { ...c } }
  }
  const mover = e => {
    const a = arrastre.current
    if (!a) return
    const p = enPct(e), dx = p.x - a.p.x, dy = p.y - a.p.y
    if (a.modo === 'mover') onCambio(a.k, { x: redondo(limitar(a.c.x + dx, 0, 100 - a.c.w)), y: redondo(limitar(a.c.y + dy, 0, 100 - a.c.h)) })
    else if (a.modo === 'tamano') onCambio(a.k, { w: redondo(limitar(a.c.w + dx, 2, 100 - a.c.x)), h: redondo(limitar(a.c.h + dy, 0.8, 100 - a.c.y)) })
    else {
      // Raya entre dos columnas de una tabla: pasa ancho de una a la otra
      const i = a.modo, cols = a.c.columnas
      const d = dx / a.c.w * 100
      const izq = limitar(cols[i].w + d, 4, cols[i].w + cols[i + 1].w - 4)
      onCambio(a.k, { columnas: cols.map((col, j) => j === i ? { ...col, w: redondo(izq) } : j === i + 1 ? { ...col, w: redondo(cols[i].w + cols[i + 1].w - izq) } : col) })
    }
  }
  const soltar = () => { arrastre.current = null }

  return (
    <div ref={ref} className={`relative bg-white shadow-sm ring-1 ring-slate-200 select-none ${herramienta ? 'cursor-crosshair touch-none' : ''}`}
      style={{ aspectRatio: `1 / ${caja.alto / caja.ancho}` }}
      onPointerDown={empezarDibujo} onPointerMove={e => { moverDibujo(e); mover(e) }} onPointerUp={() => { soltarDibujo(); soltar() }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={hoja.url} alt="" draggable={false} className="absolute inset-0 w-full h-full pointer-events-none" />
      {hoja.campos.map(c => (
        <Recuadro key={c._k} c={c} ctx={ctx} escala={escala} caja={caja} elegido={sel === c._k} bloqueado={!!herramienta}
          onEmpezar={(modo, e) => empezar(c, modo, e)} />
      ))}
      {dibujo && (
        <div className="absolute border-2 border-dashed border-[#1B3A6B] bg-[#1B3A6B]/10 pointer-events-none"
          style={{ left: `${Math.min(dibujo.x, dibujo.x0)}%`, top: `${Math.min(dibujo.y, dibujo.y0)}%`, width: `${Math.abs(dibujo.x - dibujo.x0)}%`, height: `${Math.abs(dibujo.y - dibujo.y0)}%` }} />
      )}
    </div>
  )
}

function Recuadro({ c, ctx, escala, caja, elegido, bloqueado, onEmpezar }) {
  const color = COLOR[c.tipo]
  const letra = letraHojaFija(c, caja)
  const tam = letra * escala
  const renglon = esRenglonHojaFija(c, caja, letra)
  let contenido
  if (c.tipo === 'firma') {
    contenido = <span className="text-[11px] font-bold opacity-80" style={{ color }}>✍ {c.rol === 'otra' ? `Firma: ${c.quien || 'otra persona'}` : NOMBRE_FIRMA[c.rol] || 'Firma'}</span>
  } else if (c.tipo === 'tabla') {
    const filas = filasHojaFija(c, ctx).slice(0, c.filas || 1)
    const alto = 100 / (c.filas || 1)
    const cols = conX(c.columnas || [])
    contenido = (
      <>
        {Array.from({ length: (c.filas || 1) - 1 }, (_, i) => <div key={i} className="absolute inset-x-0 border-t border-dashed border-[#0F7B55]/40" style={{ top: `${(i + 1) * alto}%` }} />)}
        {cols.map((col, j) => (
          <div key={j} className="absolute inset-y-0" style={{ left: `${col.x}%`, width: `${col.w}%` }}>
            {filas.map((get, ri) => (
              <div key={ri} className="absolute inset-x-0 px-[2px] flex items-end overflow-hidden whitespace-nowrap leading-[1.1]" style={{ top: `${ri * alto}%`, height: `${alto}%`, fontSize: tam }}>{get(col.clave)}</div>
            ))}
            {elegido && <div className="absolute -top-4 left-0 text-[9.5px] font-bold text-[#0F7B55] whitespace-nowrap">{COLUMNAS[col.clave] || col.clave}</div>}
            {j < cols.length - 1 && (
              <div onPointerDown={e => onEmpezar(j, e)} className={`absolute -right-[3px] inset-y-0 w-[6px] cursor-col-resize ${elegido ? 'bg-[#0F7B55]/50' : 'bg-[#0F7B55]/20'}`} title="Arrastra para cambiar el ancho de la columna" />
            )}
          </div>
        ))}
      </>
    )
  } else {
    // Igual que en el acta (render.js → hf-base): Arial, y en un renglón la base de la
    // letra cae justo en el borde de abajo del recuadro
    const estilo = { fontSize: tam, fontFamily: 'Arial, Helvetica, sans-serif', fontWeight: c.negrita ? 700 : 400, textAlign: c.alineacion === 'centro' ? 'center' : c.alineacion === 'derecha' ? 'right' : 'left' }
    contenido = <span className={renglon ? 'absolute left-[2px] right-[2px] whitespace-nowrap' : 'w-full'}
      style={renglon ? { ...estilo, lineHeight: 1, bottom: `-${BAJAR_BASE}em` } : estilo}>
      {c.texto ? ejemploDe(c.texto, ctx.variables) : <span className="opacity-60 text-[11px]">Elige qué va aquí</span>}
    </span>
  }
  return (
    <div onPointerDown={e => onEmpezar('mover', e)}
      className={`absolute flex overflow-visible leading-[1.15] text-[#0a0a0a] ${bloqueado ? 'pointer-events-none' : 'cursor-move touch-none'} ${c.tipo === 'firma' ? 'items-end justify-center' : renglon ? 'items-end' : 'items-start'}`}
      style={{ left: `${c.x}%`, top: `${c.y}%`, width: `${c.w}%`, height: `${c.h}%`, background: `${color}1A`, outline: `${elegido ? 2 : 1}px solid ${color}${elegido ? '' : '99'}`, zIndex: elegido ? 2 : 1 }}>
      <div className={`relative w-full h-full flex ${renglon && c.tipo === 'texto' ? 'overflow-visible whitespace-nowrap' : 'overflow-hidden'}`} style={{ alignItems: 'inherit', justifyContent: 'inherit' }}>{contenido}</div>
      {/* Línea donde se apoya el texto: el borde de abajo del recuadro */}
      {c.tipo === 'texto' && renglon && <div className="absolute inset-x-0 bottom-0 border-b-2 pointer-events-none" style={{ borderColor: color }} title="Aquí se apoya el texto" />}
      {elegido && !bloqueado && (
        <div onPointerDown={e => onEmpezar('tamano', e)} className="absolute -right-1.5 -bottom-1.5 w-3.5 h-3.5 rounded-sm border-2 border-white shadow cursor-nwse-resize" style={{ background: color }} title="Arrastra para cambiar el tamaño" />
      )}
    </div>
  )
}

// Panel del recuadro elegido
function PanelCampo({ c, letra, onCambio, onDuplicar, onQuitar }) {
  const titulo = { texto: 'Dato o texto', firma: 'Firma', tabla: 'Tabla de equipos' }[c.tipo]
  const tamano = (
    <div>
      <label className={ui.label}>Tamaño de letra</label>
      <div className="flex items-center gap-2">
        <button type="button" className={ui.btnChico} onClick={() => onCambio({ tamano: Math.max(6, Math.round(letra) - 1) })} aria-label="Letra más pequeña"><Minus size={13} /></button>
        <span className="w-8 text-center text-[13px] font-semibold text-slate-700">{Math.round(letra)}</span>
        <button type="button" className={ui.btnChico} onClick={() => onCambio({ tamano: Math.min(28, Math.round(letra) + 1) })} aria-label="Letra más grande"><Plus size={13} /></button>
        <button type="button" onClick={() => onCambio({ tamano: undefined })} aria-pressed={!c.tamano}
          className={`h-8 px-2.5 rounded-[8px] text-[12px] font-semibold border transition-colors ${!c.tamano ? 'bg-[#1B3A6B] border-[#1B3A6B] text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}>Automático</button>
      </div>
      <p className={ui.ayudaCampo}>{c.tamano ? 'Fijo.' : 'Crece y se achica con el alto del recuadro.'}</p>
    </div>
  )
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-sm" style={{ background: COLOR[c.tipo] }} />
        <div className="flex-1 text-[14px] font-bold text-slate-800">{titulo}</div>
        <button type="button" onClick={onDuplicar} className={ui.btnIcono} title="Duplicar" aria-label="Duplicar"><Copy size={15} /></button>
        <button type="button" onClick={onQuitar} className={`${ui.btnIcono} hover:!text-[#D81B43] hover:!bg-red-50`} title="Quitar" aria-label="Quitar"><Trash2 size={15} /></button>
      </div>

      {c.tipo === 'texto' && <>
        <div>
          <label className={ui.label}>¿Qué va aquí?</label>
          <select className={ui.input} value="" onChange={e => {
            const v = e.target.value
            if (v === '__propio') onCambio({ texto: '[Nuevo dato]' })
            else if (v) onCambio({ texto: `[${v}]` })
          }}>
            <option value="">Elegir un dato…</option>
            {Object.entries(NOMBRES).map(([g, vars]) => (
              <optgroup key={g} label={g}>{Object.values(vars).map(n => <option key={n} value={n}>{n}</option>)}</optgroup>
            ))}
            <option value="__propio">Otro dato (se escribe al prestar)</option>
          </select>
        </div>
        <div>
          <label className={ui.label}>Contenido</label>
          <textarea rows={2} className={ui.input} value={c.texto || ''} onChange={e => onCambio({ texto: e.target.value })} placeholder="[Nombre del paciente] o un texto fijo, como X" />
          <p className={ui.ayudaCampo}>Lo que va entre corchetes es un dato. Con un nombre que no está en la lista, se pide al crear el préstamo.</p>
        </div>
        {tamano}
        <div>
          <label className={ui.label}>Alineación</label>
          <div className="grid grid-cols-3 gap-1 p-0.5 rounded-[9px] bg-slate-100">
            {[['izquierda', 'Izquierda'], ['centro', 'Centro'], ['derecha', 'Derecha']].map(([v, l]) => (
              <button key={v} type="button" onClick={() => onCambio({ alineacion: v })}
                className={`h-8 rounded-[7px] text-[12px] font-semibold ${(c.alineacion || 'izquierda') === v ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}>{l}</button>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-[13px] text-slate-700">
          <input type="checkbox" checked={!!c.negrita} onChange={e => onCambio({ negrita: e.target.checked })} /> Negrita
        </label>
      </>}

      {c.tipo === 'firma' && (
        <div>
          <label className={ui.label}>¿De quién es?</label>
          <select className={ui.input} value={c.rol} onChange={e => onCambio({ rol: e.target.value })}>
            {Object.entries(ROLES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          {c.rol === 'otra' && (
            <div className="mt-3">
              <label className={ui.label}>¿Quién firma?</label>
              <input className={ui.input} value={c.quien || ''} onChange={e => onCambio({ quien: e.target.value })} placeholder="Funcionario Dusakawi IPSI" />
              <p className={ui.ayudaCampo}>Al firmar, el repartidor ve este nombre y le pide la firma. Si no la consigue, queda en blanco para firmar en papel.</p>
            </div>
          )}
        </div>
      )}

      {c.tipo === 'tabla' && <>
        <div>
          <label className={ui.label}>Lista</label>
          <select className={ui.input} value={c.fuente || 'equipos'} onChange={e => onCambio({ fuente: e.target.value })}>
            {Object.entries(FUENTES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className={ui.label}>Renglones</label>
          <input type="number" min={1} max={40} className={ui.input} value={c.filas || 1}
            onChange={e => onCambio({ filas: limitar(Math.round(Number(e.target.value) || 1), 1, 40) })} />
          <p className={ui.ayudaCampo}>Los renglones del formato. Si hay más equipos, se agrega una hoja de anexo con todos.</p>
        </div>
        {tamano}
        <div>
          <label className={ui.label}>Columnas</label>
          <div className="space-y-1.5">
            {(c.columnas || []).map((col, j) => (
              <div key={j} className="flex items-center gap-1.5">
                <select className={`${ui.input} flex-1`} value={col.clave} onChange={e => onCambio({ columnas: c.columnas.map((x, i) => i === j ? { ...x, clave: e.target.value } : x) })}>
                  {Object.entries(COLUMNAS).map(([v, l]) => <option key={v} value={v}>{l.charAt(0) + l.slice(1).toLowerCase()}</option>)}
                </select>
                <button type="button" className={ui.btnIcono} disabled={c.columnas.length < 2} aria-label="Quitar columna"
                  onClick={() => {
                    const resto = c.columnas.filter((_, i) => i !== j)
                    const suma = resto.reduce((s, x) => s + x.w, 0)
                    onCambio({ columnas: resto.map(x => ({ ...x, w: redondo(x.w / suma * 100) })) })
                  }}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
          <button type="button" className={`${ui.btnChico} mt-2`} onClick={() => {
            const n = c.columnas.length + 1
            onCambio({ columnas: [...c.columnas.map(x => ({ ...x, w: redondo(x.w * (n - 1) / n) })), { clave: 'codigo', w: redondo(100 / n) }] })
          }}><Plus size={13} /> Columna</button>
          <p className={ui.ayudaCampo}>Arrastra las rayas verdes sobre la hoja para que cada columna caiga en la del formato.</p>
        </div>
      </>}
    </div>
  )
}
