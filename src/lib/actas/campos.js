// Qué datos hay que llenar para los formatos elegidos de un préstamo. Se mira
// qué {{variables}} usan sus plantillas y se pide solo lo que no sale solo
// (fecha, empresa, equipos, quien entrega). Lo usan el asistente de préstamo
// nuevo, el detalle del préstamo y el paso de firma (components/actas/LlenarFormatos.js).
//
// Los valores viven en ordenes_servicio.datos_acta:
//   { recibe: { esPaciente, nombre, documento, parentesco, telefono, correo },
//     ciudad, observaciones, insumos: [{ descripcion, cantidad, lote, invima, estado }], extra: { clave: valor },
//     valores: { variable: valor }        reemplaza lo que el sistema llena solo (fecha, marca…)
//     estados: { codigo_equipo: 'Bueno' } estado de cada equipo en la tabla
//     manuales: { plantilla_id: { 'bloque.campo': valor } }  renglones en blanco del formato }
// Los del paciente se guardan en el paciente (y el diagnóstico en el préstamo).
// Todo lo que no está en CAMPOS es opcional (ver camposDelFormato).

import { VARIABLES } from './contexto'
import { propiosDe, NOMBRES } from './nombres'

export const DATOS_ACTA_VACIO = {
  recibe: { esPaciente: true, nombre: '', documento: '', parentesco: '', telefono: '', correo: '' },
  ciudad: '', observaciones: '', insumos: [], extra: {}, valores: {}, estados: {}, manuales: {},
}

// Normaliza lo que venga de la base (préstamos viejos traen {})
export const leerDatosActa = d => ({
  ...DATOS_ACTA_VACIO, ...(d || {}),
  recibe: { ...DATOS_ACTA_VACIO.recibe, ...(d?.recibe || {}) },
  insumos: Array.isArray(d?.insumos) ? d.insumos : [],
  extra: d?.extra || {}, valores: d?.valores || {}, estados: d?.estados || {}, manuales: d?.manuales || {},
})

// Cada campo que se puede pedir: de qué variables depende y dónde se guarda.
// `en`: 'paciente' (pacientes), 'orden' (ordenes_servicio) o 'acta' (datos_acta)
export const CAMPOS = [
  { id: 'pac_documento', grupo: 'Paciente', label: 'Documento', en: 'paciente', clave: 'cedula', vars: ['paciente_documento', 'paciente_tipo_doc', 'doc_cc', 'doc_ti', 'doc_rc', 'doc_ce'] },
  { id: 'pac_direccion', grupo: 'Paciente', label: 'Dirección', en: 'paciente', clave: 'direccion', vars: ['paciente_direccion'] },
  { id: 'pac_barrio', grupo: 'Paciente', label: 'Barrio', en: 'paciente', clave: 'barrio', vars: ['paciente_barrio'] },
  { id: 'pac_ciudad', grupo: 'Paciente', label: 'Ciudad', en: 'paciente', clave: 'ciudad', vars: ['paciente_ciudad'] },
  { id: 'pac_telefono', grupo: 'Paciente', label: 'Teléfono', en: 'paciente', clave: 'telefono', vars: ['paciente_telefono'] },
  { id: 'pac_correo', grupo: 'Paciente', label: 'Correo', en: 'paciente', clave: 'correo', vars: ['paciente_correo'], tipo: 'email' },
  { id: 'pac_eps', grupo: 'Paciente', label: 'EPS', en: 'paciente', clave: 'eps', vars: ['paciente_eps'] },
  { id: 'pac_nacimiento', grupo: 'Paciente', label: 'Fecha de nacimiento', en: 'paciente', clave: 'fecha_nacimiento', vars: ['paciente_edad'], tipo: 'date' },
  { id: 'diagnostico', grupo: 'Paciente', label: 'Diagnóstico (Dx)', en: 'orden', clave: 'diagnostico', vars: ['diagnostico'], ancho: true },
  { id: 'rec_nombre', grupo: 'Quien recibe', label: 'Nombre', en: 'acta', clave: 'recibe.nombre', vars: ['recibe_nombre', 'responsable_nombre'], siRecibeOtro: true },
  { id: 'rec_documento', grupo: 'Quien recibe', label: 'Documento', en: 'acta', clave: 'recibe.documento', vars: ['recibe_documento', 'responsable_documento'], siRecibeOtro: true },
  { id: 'rec_parentesco', grupo: 'Quien recibe', label: 'Parentesco', en: 'acta', clave: 'recibe.parentesco', vars: ['recibe_parentesco'], siRecibeOtro: true },
  { id: 'rec_telefono', grupo: 'Quien recibe', label: 'Teléfono', en: 'acta', clave: 'recibe.telefono', vars: ['recibe_telefono'], respaldo: 'telefono' },
  { id: 'rec_correo', grupo: 'Quien recibe', label: 'Correo', en: 'acta', clave: 'recibe.correo', vars: ['recibe_correo'], tipo: 'email' },
  { id: 'ciudad', grupo: 'Entrega', label: 'Ciudad de la entrega', en: 'acta', clave: 'ciudad', vars: ['ciudad'], respaldo: 'ciudad' },
  { id: 'observaciones', grupo: 'Entrega', label: 'Observaciones (estado del equipo)', en: 'acta', clave: 'observaciones', vars: ['observaciones'], ancho: true },
]

const CONOCIDAS = new Set(Object.values(VARIABLES).flatMap(g => Object.keys(g)))

// Variables {{x}} que usan los bloques de las plantillas
export function variablesUsadas(plantillas) {
  const usadas = new Set()
  for (const p of plantillas || []) {
    for (const m of JSON.stringify(p.bloques || []).matchAll(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi)) usadas.add(m[1])
  }
  return usadas
}

const usaInsumos = plantillas => (plantillas || []).some(p =>
  (p.bloques || []).some(b => b.tipo === 'tabla' && (b.fuente === 'insumos' || b.fuente === 'ambos'))
  || JSON.stringify(p.bloques || []).includes('insumos_resumen'))

// Lo que piden las plantillas: campos conocidos, insumos y campos propios
// (variables que el sistema no conoce, p. ej. {{numero_contrato}} de una plantilla importada)
export function camposPedidos(plantillas, { conPaciente = true } = {}) {
  const usadas = variablesUsadas(plantillas)
  const campos = CAMPOS.filter(c => (conPaciente || c.en !== 'paciente') && c.vars.some(v => usadas.has(v)))
  const etiquetas = Object.assign({}, ...(plantillas || []).map(p => propiosDe(p.bloques)))
  const extra = [...usadas].filter(v => !CONOCIDAS.has(v)).map(v => ({
    id: `extra_${v}`, grupo: 'Otros datos', label: etiquetas[v] || etiquetaExtra(v), en: 'acta', clave: `extra.${v}`, vars: [v],
  }))
  return { campos: [...campos, ...extra], insumos: usaInsumos(plantillas) }
}

// numero_contrato → "Número contrato"
const etiquetaExtra = v => {
  const t = v.replace(/_/g, ' ').trim()
  return t.charAt(0).toUpperCase() + t.slice(1)
}

// Valor de un campo dentro de { paciente, diagnostico, acta }. Teléfono de quien
// recibe y ciudad toman el del paciente si no se escribió otro (igual que contexto.js)
export function valorCampo(c, { paciente = {}, diagnostico = '', acta = DATOS_ACTA_VACIO }) {
  if (c.en === 'paciente') return paciente[c.clave] || ''
  if (c.en === 'orden') return diagnostico || ''
  const [a, b] = c.clave.split('.')
  return (b ? acta[a]?.[b] : acta[a]) || (c.respaldo ? paciente[c.respaldo] : '') || ''
}

// Copia de `acta` con el valor de un campo cambiado
export function conValor(acta, c, v) {
  const [a, b] = c.clave.split('.')
  return b ? { ...acta, [a]: { ...(acta[a] || {}), [b]: v } } : { ...acta, [a]: v }
}

// Campos que siguen vacíos (los de quien recibe no cuentan si recibe el mismo paciente)
export function camposVacios(campos, valores) {
  const recibeOtro = !valores.acta?.recibe?.esPaciente
  return campos.filter(c => (recibeOtro || !c.siRecibeOtro) && !String(valorCampo(c, valores)).trim())
}

// ── Campos de cada formato, en el orden en que aparecen en la hoja ──
// Para llenar mirando el formato (components/actas/LlenarFormatos.js). Cada
// campo tiene una clave que render.js marca en la hoja (ctx.marcar) para
// resaltarlo y para que un toque en la hoja lleve a su campo:
//   c:campo         un dato de los que se piden (CAMPOS; cuentan en "Faltan")
//   v:variable      un dato automático (fecha, marca…) o propio de la plantilla
//   m:bloque.campo  renglón en blanco del formato (datos_acta.manuales)
//   estados         columna Estado de la tabla de equipos (datos_acta.estados)
//   insumos         tabla de insumos (datos_acta.insumos)

// Datos que salen de otros (X del tipo de documento, tipo de documento): no se llenan aparte
const DERIVADAS = new Set(['doc_cc', 'doc_ti', 'doc_rc', 'doc_ce', 'paciente_tipo_doc'])
const CAMPO_DE = Object.fromEntries(CAMPOS.flatMap(c => c.vars.map(v => [v, c])))

// Clave en la hoja de cada variable: las de un mismo campo comparten la del
// campo (recibe_nombre y responsable_nombre, documento y sus X de CC/TI…).
// render.js la usa con ctx.marcar = CLAVES_HOJA.
export const CLAVES_HOJA = {
  ...Object.fromEntries(CAMPOS.flatMap(c => c.vars.map(v => [v, `c:${c.id}`]))),
  insumos_resumen: 'insumos',
}
export const limpio = t => String(t || '').replace(/\*\*/g, '').replace(/\{\{[^}]*\}\}/g, '').replace(/\s+/g, ' ').trim()
const sinDosPuntos = t => limpio(t).replace(/[:\s]+$/, '')

export function camposDelFormato(plantilla, { conPaciente = true } = {}) {
  const out = []
  const vistos = new Set()
  const propios = propiosDe(plantilla?.bloques)
  let seccion = '', pagina = 0
  const agregarVars = (texto, etiqueta) => {
    const vars = [...String(texto || '').matchAll(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi)].map(m => m[1])
    for (const v of vars) {
      // "OTROS: 1 máscara…" ({{insumos_resumen}}) se llena con la lista de insumos
      if (v === 'insumos_resumen') {
        if (!vistos.has('insumos')) { vistos.add('insumos'); out.push({ clave: 'insumos', tipo: 'insumos', etiqueta: etiqueta || 'Insumos', seccion, pagina }) }
        continue
      }
      if (DERIVADAS.has(v) || vistos.has(`v:${v}`)) continue
      const campo = CAMPO_DE[v] || null
      if (campo && !conPaciente && campo.en === 'paciente') continue
      // Un campo de CAMPOS que ya salió por otra variable (responsable / recibe) no se repite
      if (campo && out.some(x => x.campo?.id === campo.id)) continue
      vistos.add(`v:${v}`)
      const conocida = CONOCIDAS.has(v)
      out.push({
        clave: CLAVES_HOJA[v] || `v:${v}`, tipo: 'var', variable: v, campo, seccion, pagina,
        etiqueta: (vars.length === 1 && etiqueta) || (conocida ? null : propios[v] || etiquetaExtra(v)),
        pedido: !!campo || !conocida,
      })
    }
  }
  ;(plantilla?.bloques || []).forEach((b, bi) => {
    if (b.tipo === 'salto_pagina') { pagina++; return }
    if (b.tipo === 'titulo') { seccion = limpio(b.texto); agregarVars(b.texto); return }
    if (b.tipo === 'encabezado') {
      if (pagina === 0 || !seccion) seccion = limpio(b.centro?.[0]?.texto)
      ;[...(b.centro || []).map(c => c.texto), ...(b.derecha || []).map(c => c.valor), ...(b.pie || []).map(c => c.valor)].forEach(t => agregarVars(t))
      return
    }
    if (b.tipo === 'texto' || b.tipo === 'pie') { agregarVars(b.texto); return }
    if (b.tipo === 'campos') {
      const sec = limpio(b.titulo) || seccion
      const antes = seccion; seccion = sec
      ;(b.campos || []).forEach((c, ci) => {
        if (c.valor) agregarVars(c.valor, sinDosPuntos(c.etiqueta))
        else if (!c.firma && limpio(c.etiqueta) && !/^firma/i.test(limpio(c.etiqueta))) {
          out.push({ clave: `m:${bi}.${ci}`, tipo: 'manual', manual: `${bi}.${ci}`, etiqueta: sinDosPuntos(c.etiqueta), seccion: sec, pagina })
        }
      })
      seccion = limpio(b.titulo) ? antes : sec
      return
    }
    if (b.tipo === 'tabla') {
      const sec = limpio(b.titulo) || seccion
      if ((b.columnas || []).some(c => c.clave === 'estado') && b.fuente !== 'insumos' && !vistos.has('estados')) {
        vistos.add('estados'); out.push({ clave: 'estados', tipo: 'estados', etiqueta: 'Estado de los equipos', seccion: sec, pagina })
      }
      if ((b.fuente === 'insumos' || b.fuente === 'ambos') && !vistos.has('insumos')) {
        vistos.add('insumos'); out.push({ clave: 'insumos', tipo: 'insumos', etiqueta: 'Insumos', seccion: sec, pagina, conEstado: (b.columnas || []).some(c => c.clave === 'estado') })
      }
      return
    }
    if (b.tipo === 'firmas') {
      ;(b.firmas || []).forEach((f, fi) => (f.lineas || []).forEach((l, li) => {
        const et = [limpio(f.titulo), sinDosPuntos(l.etiqueta)].filter(Boolean).join(' · ')
        if (l.valor) agregarVars(l.valor, et)
        else if (limpio(l.etiqueta)) out.push({ clave: `m:${bi}.f${fi}.${li}`, tipo: 'manual', manual: `${bi}.f${fi}.${li}`, etiqueta: et, seccion, pagina })
      }))
    }
  })
  // Etiquetas repetidas en una sección (MARCA del equipo, del regulador…): se dice de qué son
  const nombreDe = Object.fromEntries(Object.values(NOMBRES).flatMap(g => Object.entries(g)))
  for (const c of out) {
    if (c.tipo !== 'var' || !c.etiqueta) continue
    const repetida = out.filter(x => x.seccion === c.seccion && x.etiqueta === c.etiqueta).length > 1
    if (repetida && nombreDe[c.variable]) c.etiqueta = `${c.etiqueta} · ${nombreDe[c.variable]}`
  }
  return out
}
