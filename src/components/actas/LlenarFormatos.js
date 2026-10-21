'use client'
import { useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, CheckCircle2, AlertCircle, Plus, Trash2, X } from 'lucide-react'
import { camposDelFormato, valorCampo, conValor, CLAVES_HOJA } from '@/lib/actas/campos'
import { construirContexto, conManuales, filaEquipo } from '@/lib/actas/contexto'
import { renderPaginas, ANCHO_PAGINA } from '@/lib/actas/render'
import { NOMBRES } from '@/lib/actas/nombres'
import { ui } from '@/lib/ui'

// Llenar los formatos de un préstamo mirando la hoja. Una pestaña por formato;
// a la izquierda la hoja (se actualiza mientras se escribe, con los espacios
// para llenar marcados), a la derecha los campos de ese formato en el orden de
// la hoja (lib/actas/campos.js → camposDelFormato). Tocar un campo resalta su
// lugar en la hoja; tocar un espacio en la hoja lleva a su campo.
// Controlado: valores = { paciente, diagnostico, acta } (acta = datos_acta).
// base = { empresa, orden: { cliente, codigo }, equipos (unidades), fecha }.

const ALTO_A4 = Math.round(ANCHO_PAGINA * 297 / 210)
const TIPOS_DOC = ['CC', 'TI', 'RC', 'CE', 'PA']
const ESTADOS = ['Bueno', 'Regular', 'Malo', 'Nuevo', 'Usado']
const INSUMOS_COMUNES = ['Máscara oronasal', 'Máscara nasal', 'Manguera corrugada para CPAP y/o BPAP',
  'Kit venturi adulto', 'Kit venturi pediátrico', 'Cánula nasal adulto', 'Cánula nasal pediátrico', 'Acople',
  'Vaso humidificador', 'Manguera de succión', 'Circuito ventilatorio']
const NOMBRE_DE = Object.fromEntries(Object.values(NOMBRES).flatMap(g => Object.entries(g)))
const vacioCls = '!border-amber-300 !bg-amber-50/60'
const activoCls = '!border-[#F59E0B] ring-2 ring-[#F59E0B]/25'

const armarContexto = (base, valores, conPaciente, datos) => construirContexto({
  empresa: base.empresa, equipos: base.equipos || [],
  orden: { ...(base.orden || {}), paciente: conPaciente ? valores.paciente : null, diagnostico: valores.diagnostico },
  datos: { ...datos, fecha: base.fecha },
})

export default function LlenarFormatos({ plantillas, valores, conPaciente = true, nombrePaciente = '', base = {}, onPaciente, onDiagnostico, onActa }) {
  const [actual, setActual] = useState(0)
  const [activo, setActivo] = useState(null)
  const [pagina, setPagina] = useState(0)
  const [vistaMovil, setVistaMovil] = useState('campos')
  const panelRef = useRef(null)
  const acta = valores.acta
  const plantilla = plantillas[Math.min(actual, plantillas.length - 1)]
  const recibeOtro = !conPaciente || !acta.recibe?.esPaciente

  // Contexto: lo que se lleva escrito y, aparte, lo que pondría el sistema solo
  const diferidos = useDeferredValue(valores)
  const ctx = useMemo(() => armarContexto(base, diferidos, conPaciente, diferidos.acta), [base, diferidos, conPaciente])
  const automaticos = useMemo(() => armarContexto(base, valores, conPaciente, { ...valores.acta, valores: {} }).variables, [base, valores, conPaciente])

  const camposPorPlantilla = useMemo(() => plantillas.map(p => camposDelFormato(p, { conPaciente })), [plantillas, conPaciente])
  const campos = camposPorPlantilla[Math.min(actual, plantillas.length - 1)] || []

  // ── Valor de cada campo ──
  const delPlantilla = id => acta.manuales?.[id] || {}
  function valor(c, pid = plantilla?.id) {
    if (c.tipo === 'manual') return delPlantilla(pid)[c.manual] || ''
    if (c.tipo !== 'var') return ''
    if (c.campo) return c.campo.siRecibeOtro && !recibeOtro ? '' : valorCampo(c.campo, valores)
    if (!c.pedido) return acta.valores?.[c.variable] || ''
    return acta.extra?.[c.variable] || ''
  }
  function cambiar(c, v) {
    if (c.tipo === 'manual') return onActa({ ...acta, manuales: { ...acta.manuales, [plantilla.id]: { ...delPlantilla(plantilla.id), [c.manual]: v } } })
    if (c.campo) {
      if (c.campo.en === 'paciente') return onPaciente(c.campo.clave, v)
      if (c.campo.en === 'orden') return onDiagnostico(v)
      return onActa(conValor(acta, c.campo, v))
    }
    if (!c.pedido) return onActa({ ...acta, valores: { ...acta.valores, [c.variable]: v } })
    onActa({ ...acta, extra: { ...acta.extra, [c.variable]: v } })
  }
  // Pedidos sin llenar (los de quien recibe no cuentan si recibe el mismo paciente)
  const vaciosEn = (lista, pid) => lista.filter(c => c.tipo === 'var' && c.pedido && !(c.campo?.siRecibeOtro && !recibeOtro) && !String(valor(c, pid)).trim())
  const faltanEn = (lista, pid) => vaciosEn(lista, pid).length
  // Un dato que está en dos formatos (la dirección, p. ej.) se llena una vez: cuenta una
  const faltanTotal = new Set(plantillas.flatMap((p, i) => vaciosEn(camposPorPlantilla[i], p.id).map(c => c.campo?.id || c.clave))).size

  // ── Hoja ──
  const hojas = useMemo(() => plantilla ? renderPaginas(plantilla.bloques, { ...conManuales(ctx, plantilla.id), marcar: CLAVES_HOJA }) : [], [plantilla, ctx])
  const hoja = Math.min(pagina, Math.max(0, hojas.length - 1))

  function elegir(c) {
    setActivo(c.clave)
    if (c.pagina != null) setPagina(c.pagina)
  }
  // Toque en la hoja: va al campo (en celular, a la pestaña de campos)
  function elegirDesdeHoja(clave) {
    setActivo(clave)
    setVistaMovil('campos')
    requestAnimationFrame(() => {
      const el = panelRef.current?.querySelector(`[data-clave="${CSS.escape(clave)}"]`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el?.querySelector('input, textarea, select')?.focus({ preventScroll: true })
    })
  }
  function cambiarPlantilla(i) { setActual(i); setPagina(0); setActivo(null) }

  if (!plantilla) return <div className="text-[13px] text-slate-400 p-4">Elige al menos un formato.</div>

  // Campos agrupados por sección, en el orden de la hoja
  const grupos = []
  for (const c of campos) {
    const ultimo = grupos[grupos.length - 1]
    if (ultimo && ultimo.seccion === c.seccion) ultimo.campos.push(c)
    else grupos.push({ seccion: c.seccion, campos: [c] })
  }
  const usaRecibe = campos.some(c => c.campo?.siRecibeOtro)

  return (
    <div className="h-full min-h-0 flex flex-col">
      {/* Formatos */}
      <div className="flex-shrink-0 flex items-center gap-2 pb-3 overflow-x-auto">
        {plantillas.map((p, i) => {
          const f = faltanEn(camposPorPlantilla[i], p.id)
          return (
            <button key={p.id} type="button" onClick={() => cambiarPlantilla(i)} title={p.nombre}
              className={`flex items-center gap-2 max-w-[280px] px-3 h-9 rounded-full border text-[12.5px] font-semibold whitespace-nowrap transition-colors ${i === actual ? 'bg-[#1B3A6B] border-[#1B3A6B] text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}>
              <span className="truncate">{p.nombre}</span>
              {f > 0
                ? <span className={`px-1.5 rounded-full text-[11px] ${i === actual ? 'bg-white/20' : 'bg-amber-100 text-[#B45309]'}`}>{f}</span>
                : <CheckCircle2 size={13} className={i === actual ? 'text-white' : 'text-[#0F7B55]'} />}
            </button>
          )
        })}
        <span className={`ml-auto flex-shrink-0 hidden sm:flex items-center gap-1.5 text-[12px] font-medium ${faltanTotal ? 'text-[#B45309]' : 'text-[#0F7B55]'}`}>
          {faltanTotal ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
          {faltanTotal ? `Faltan ${faltanTotal} ${faltanTotal === 1 ? 'dato' : 'datos'}` : 'Datos completos'}
        </span>
      </div>

      {/* Celular: campos u hoja */}
      <div className="lg:hidden flex-shrink-0 grid grid-cols-2 gap-1 p-1 mb-3 bg-slate-100 rounded-[10px]">
        {[['campos', 'Campos'], ['hoja', 'Ver hoja']].map(([v, l]) => (
          <button key={v} type="button" onClick={() => setVistaMovil(v)} className={`py-2 rounded-[8px] text-[13px] font-semibold ${vistaMovil === v ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}>{l}</button>
        ))}
      </div>

      <div className="flex-1 min-h-0 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)] rounded-xl border border-slate-200 overflow-hidden bg-white">
        {/* Hoja */}
        <div className={`h-full min-h-0 flex flex-col bg-slate-100 ${vistaMovil === 'hoja' ? '' : 'max-lg:hidden'}`}>
          <div className="flex-shrink-0 flex items-center justify-center gap-3 py-2 border-b border-slate-200 bg-white/70">
            <button type="button" disabled={hoja === 0} onClick={() => setPagina(hoja - 1)} className={`${ui.btnIcono} disabled:opacity-30`} aria-label="Hoja anterior"><ChevronLeft size={16} /></button>
            <span className="text-[12px] font-semibold text-slate-500">Hoja {hoja + 1} de {hojas.length}</span>
            <button type="button" disabled={hoja >= hojas.length - 1} onClick={() => setPagina(hoja + 1)} className={`${ui.btnIcono} disabled:opacity-30`} aria-label="Hoja siguiente"><ChevronRight size={16} /></button>
          </div>
          <HojaMarcada html={hojas[hoja]} activo={activo} onElegir={elegirDesdeHoja} />
        </div>

        {/* Campos del formato */}
        <div ref={panelRef} className={`h-full min-h-0 overflow-y-auto lg:border-l border-slate-200 ${vistaMovil === 'campos' ? '' : 'max-lg:hidden'}`}>
          {campos.length === 0 && <div className="p-5 text-[13px] text-slate-400">Este formato no tiene campos para llenar.</div>}
          {usaRecibe && conPaciente && (
            <label className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 cursor-pointer text-[13px] text-slate-700">
              <input type="checkbox" checked={!!acta.recibe?.esPaciente} onChange={e => onActa({ ...acta, recibe: { ...acta.recibe, esPaciente: e.target.checked } })} />
              Recibe el mismo paciente{nombrePaciente ? ` (${nombrePaciente})` : ''}
            </label>
          )}
          {grupos.map((g, gi) => (
            <section key={gi} className="border-b border-slate-100 last:border-0">
              {g.seccion && <div className="sticky top-0 z-10 px-4 py-2 bg-slate-50/95 backdrop-blur-sm text-[10.5px] font-bold uppercase tracking-[0.08em] text-slate-500 border-b border-slate-100 truncate">{g.seccion}</div>}
              <div className="px-4 py-3 space-y-3">
                {g.campos.map(c => (
                  <div key={c.clave} data-clave={c.clave} onFocus={() => elegir(c)} onClick={() => elegir(c)}>
                    <Campo c={c} valor={valor(c)} cambiar={v => cambiar(c, v)} activo={activo === c.clave}
                      auto={c.tipo === 'var' && !c.campo && !c.pedido ? automaticos[c.variable] : null}
                      bloqueado={c.campo?.siRecibeOtro && !recibeOtro}
                      valores={valores} acta={acta} onActa={onActa} onPaciente={onPaciente} equipos={base.equipos || []} />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
      <datalist id="estados-equipo">{ESTADOS.map(x => <option key={x} value={x} />)}</datalist>
    </div>
  )
}

function Campo({ c, valor, cambiar, activo, auto, bloqueado, valores, acta, onActa, onPaciente, equipos }) {
  const etiqueta = c.etiqueta || (c.campo ? c.campo.label : NOMBRE_DE[c.variable] || c.variable)
  const vacio = !String(valor).trim()
  const cls = `${ui.input} ${activo ? activoCls : c.pedido && vacio && !bloqueado ? vacioCls : ''}`
  const label = (
    <label className="flex items-baseline gap-1.5 mb-1.5 text-[12px] font-semibold text-slate-600">
      <span className="truncate" title={etiqueta}>{etiqueta}</span>
      {c.pedido && !bloqueado && <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 self-center ${vacio ? 'bg-amber-400' : 'bg-[#0F7B55]'}`} />}
    </label>
  )

  if (c.tipo === 'estados') {
    const filas = equipos.map(filaEquipo)
    return (
      <div className={`rounded-[10px] p-2 -m-2 ${activo ? 'bg-amber-50' : ''}`}>
        {label}
        {filas.length === 0 ? <div className="text-[12.5px] text-slate-400">Sin equipos.</div> : (
          <div className="space-y-2">
            {filas.map(f => (
              <div key={f.codigo} className="grid grid-cols-[1fr_120px] gap-2 items-center">
                <span className="text-[12.5px] text-slate-600 truncate"><b className="font-mono">{f.codigo}</b> · {f.descripcion}</span>
                <input value={acta.estados?.[f.codigo] || ''} list="estados-equipo" placeholder="Bueno"
                  onChange={e => onActa({ ...acta, estados: { ...acta.estados, [f.codigo]: e.target.value } })} className={ui.input} />
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }
  if (c.tipo === 'insumos') {
    return (
      <div className={`rounded-[10px] p-2 -m-2 ${activo ? 'bg-amber-50' : ''}`}>
        <EditorInsumos insumos={acta.insumos || []} conEstado={c.conEstado} titulo={etiqueta} onChange={l => onActa({ ...acta, insumos: l })} />
      </div>
    )
  }
  if (bloqueado) {
    return <div>{label}<input value="El mismo paciente" disabled className={ui.input} /></div>
  }
  if (c.campo?.id === 'pac_documento') {
    return (
      <div>{label}
        <div className="flex gap-2">
          <select value={valores.paciente?.tipo_documento || 'CC'} onChange={e => onPaciente('tipo_documento', e.target.value)} className={`${ui.input} !w-[78px] flex-shrink-0`}>
            {TIPOS_DOC.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <input value={valor} inputMode="numeric" onChange={e => cambiar(e.target.value.replace(/[^0-9]/g, ''))} className={cls} />
        </div>
      </div>
    )
  }
  if (c.campo?.id === 'observaciones' || (c.tipo === 'manual' && /observaci/i.test(etiqueta))) {
    return <div>{label}<textarea value={valor} rows={2} onChange={e => cambiar(e.target.value)} className={`${cls} resize-none`} /></div>
  }
  return (
    <div>{label}
      <input value={valor} type={c.campo?.tipo || 'text'} placeholder={auto || ''} onChange={e => cambiar(e.target.value)}
        inputMode={/telefono/.test(c.campo?.id || c.variable || '') ? 'tel' : undefined} className={cls} />
    </div>
  )
}

// La hoja dentro de un iframe (el CSS del acta no choca con el de la app). Se
// carga una vez y después solo se cambia su contenido: escribir no la hace parpadear.
function HojaMarcada({ html, activo, onElegir }) {
  const caja = useRef(null)
  const marco = useRef(null)
  const elegirRef = useRef(onElegir)
  const [ancho, setAncho] = useState(0)
  const [cargas, setCargas] = useState(0) // cada vez que el iframe (re)carga
  const [inicial] = useState(html)
  // Alto real de la hoja: si el contenido pasa de A4 (en el PDF sigue en otra hoja), aquí se ve entero
  const [alto, setAlto] = useState(ALTO_A4)
  useEffect(() => { elegirRef.current = onElegir })

  useLayoutEffect(() => {
    if (!caja.current) return
    setAncho(caja.current.clientWidth)
    const obs = new ResizeObserver(([e]) => setAncho(e.contentRect.width))
    obs.observe(caja.current)
    return () => obs.disconnect()
  }, [])

  // Contenido nuevo (al escribir o al cambiar de hoja) y resaltado del campo activo
  useEffect(() => {
    const doc = marco.current?.contentDocument
    if (!cargas || !doc?.body || !html) return
    const cuerpo = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? ''
    if (doc.body.innerHTML !== cuerpo) doc.body.innerHTML = cuerpo
    const medido = Math.max(ALTO_A4, doc.body.scrollHeight)
    requestAnimationFrame(() => setAlto(medido))
    const marcados = activo ? [...doc.querySelectorAll(`[data-campo~="${CSS.escape(activo)}"]`)] : []
    doc.querySelectorAll('.activo').forEach(el => { if (!marcados.includes(el)) el.classList.remove('activo') })
    marcados.forEach(el => el.classList.add('activo'))
    const el = marcados[0]
    if (el && caja.current) {
      const escala = Math.min(1, (caja.current.clientWidth - 24) / ANCHO_PAGINA)
      const y = el.getBoundingClientRect().top * escala
      const visible = caja.current.clientHeight
      if (y < caja.current.scrollTop || y > caja.current.scrollTop + visible - 60) caja.current.scrollTo({ top: Math.max(0, y - visible / 3), behavior: 'smooth' })
    }
  }, [html, activo, cargas])

  function alCargar() {
    const doc = marco.current?.contentDocument
    if (!doc) return
    doc.addEventListener('click', e => {
      const el = e.target.closest?.('[data-campo]')
      if (el) elegirRef.current(el.dataset.campo.split(' ')[0])
    })
    setCargas(n => n + 1)
  }

  const escala = ancho ? Math.min(1, (ancho - 24) / ANCHO_PAGINA) : 0
  return (
    <div ref={caja} className="flex-1 min-h-0 overflow-auto p-3">
      {escala > 0 && (
        <div className="siempre-claro mx-auto bg-white shadow-md ring-1 ring-slate-200 overflow-hidden" style={{ width: ANCHO_PAGINA * escala, height: alto * escala }}>
          <iframe ref={marco} srcDoc={inicial} onLoad={alCargar} title="Hoja del formato"
            style={{ width: ANCHO_PAGINA, height: alto, border: 0, transform: `scale(${escala})`, transformOrigin: 'top left' }} />
        </div>
      )}
    </div>
  )
}

// Ventana casi a pantalla completa para llenar formatos: la hoja necesita espacio.
export function VentanaLlenarFormatos({ titulo = 'Llenar formatos', subtitulo, onCerrar, bloqueado = false, pie, children }) {
  useEffect(() => {
    const onTecla = e => { if (e.key === 'Escape' && !bloqueado) { e.stopImmediatePropagation(); onCerrar() } }
    window.addEventListener('keydown', onTecla, true)
    const antes = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onTecla, true); document.body.style.overflow = antes }
  }, [onCerrar, bloqueado])
  return (
    <div className="fixed inset-0 z-[70] bg-black/55 flex md:p-4" role="dialog" aria-modal="true" aria-label={titulo}>
      <div className="w-full h-full bg-white md:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="flex-shrink-0 flex items-center gap-3 px-4 md:px-5 py-3 border-b border-slate-200">
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-bold text-slate-800 truncate">{titulo}</div>
            {subtitulo && <div className="text-[12px] text-slate-400 truncate">{subtitulo}</div>}
          </div>
          <button type="button" onClick={onCerrar} disabled={bloqueado} className={ui.btnIcono} aria-label="Cerrar"><X size={18} /></button>
        </div>
        <div className="flex-1 min-h-0 p-3 md:p-4">{children}</div>
        {pie && (
          <div className="flex-shrink-0 flex justify-end gap-2 px-4 md:px-5 py-3 border-t border-slate-200"
            style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom, 12px))' }}>{pie}</div>
        )}
      </div>
    </div>
  )
}

// Insumos: complementos que no están en el inventario (máscaras, mangueras…). Libres.
export function EditorInsumos({ insumos, onChange, conEstado = false, titulo = 'Insumos' }) {
  const set = (i, k, v) => onChange(insumos.map((x, j) => j === i ? { ...x, [k]: v } : x))
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[12px] font-semibold text-slate-600">{titulo}</span>
        <button type="button" onClick={() => onChange([...insumos, { descripcion: '', cantidad: '1', lote: '', invima: '' }])}
          className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[#1B3A6B] hover:underline">
          <Plus size={13} /> Agregar
        </button>
      </div>
      {insumos.length === 0 ? (
        <div className="text-[12.5px] text-slate-400">Sin insumos.</div>
      ) : (
        <div className="space-y-2">
          <datalist id="insumos-comunes">{INSUMOS_COMUNES.map(x => <option key={x} value={x} />)}</datalist>
          {insumos.map((x, i) => (
            <div key={i} className="grid grid-cols-[1fr_60px_32px] gap-2 p-2 border border-slate-200 rounded-[10px]">
              <input value={x.descripcion} list="insumos-comunes" placeholder="Insumo" onChange={e => set(i, 'descripcion', e.target.value)} className={ui.input} />
              <input value={x.cantidad} inputMode="numeric" placeholder="Cant." onChange={e => set(i, 'cantidad', e.target.value.replace(/[^0-9]/g, ''))} className={`${ui.input} text-center`} />
              <button type="button" onClick={() => onChange(insumos.filter((_, j) => j !== i))} aria-label="Quitar insumo" className={`${ui.btnIcono} hover:!text-[#D81B43]`}><Trash2 size={14} /></button>
              <input value={x.lote} placeholder="Lote" onChange={e => set(i, 'lote', e.target.value)} className={ui.input} />
              <input value={x.invima} placeholder="Reg. INVIMA" onChange={e => set(i, 'invima', e.target.value)} className={`${ui.input} col-span-2`} />
              {conEstado && <input value={x.estado || ''} placeholder="Estado: Nuevo" list="estados-equipo" onChange={e => set(i, 'estado', e.target.value)} className={`${ui.input} col-span-3`} />}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
