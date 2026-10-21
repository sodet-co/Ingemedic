// Nombres de los datos tal como los escribe una persona: [Nombre del paciente].
// En Word y en el editor de plantillas los datos van entre corchetes; aquí se
// traducen a las {{variables}} del motor (contexto.js) y de vuelta.
// Un nombre que no está en la lista es un "campo propio" de la plantilla: se
// guarda como {{numero_de_contrato}} y se pide al crear el préstamo.

export const NOMBRES = {
  'Fecha y lugar': {
    fecha: 'Fecha', hora: 'Hora', dia: 'Día', mes: 'Mes', anio: 'Año', ciudad: 'Ciudad', orden_codigo: 'Código del préstamo',
  },
  Empresa: {
    empresa_nombre: 'Nombre de la empresa', empresa_nit: 'NIT de la empresa', empresa_dir: 'Dirección de la empresa',
    empresa_tel: 'Teléfono de la empresa', empresa_email: 'Correo de la empresa', empresa_rep: 'Representante legal',
  },
  Cliente: { cliente_nombre: 'Cliente', cliente_nit: 'NIT del cliente' },
  Paciente: {
    paciente_nombre: 'Nombre del paciente', paciente_tipo_doc: 'Tipo de documento del paciente',
    paciente_documento: 'Documento del paciente', paciente_direccion: 'Dirección del paciente', paciente_barrio: 'Barrio',
    paciente_ciudad: 'Ciudad del paciente', paciente_telefono: 'Teléfono del paciente', paciente_correo: 'Correo del paciente',
    paciente_eps: 'EPS', paciente_edad: 'Edad', diagnostico: 'Diagnóstico',
    doc_cc: 'X si es CC', doc_ti: 'X si es TI', doc_rc: 'X si es RC', doc_ce: 'X si es CE',
  },
  'Quien recibe': {
    recibe_nombre: 'Nombre de quien recibe', recibe_documento: 'Documento de quien recibe', recibe_parentesco: 'Parentesco',
    recibe_telefono: 'Teléfono de quien recibe', recibe_correo: 'Correo de quien recibe',
    responsable_nombre: 'Nombre del responsable', responsable_documento: 'Documento del responsable',
  },
  'Quien entrega': {
    entrega_nombre: 'Nombre de quien entrega', entrega_cargo: 'Cargo de quien entrega',
    entrega_tipo_doc: 'Tipo de documento de quien entrega', entrega_documento: 'Documento de quien entrega',
  },
  Equipos: {
    equipo_descripcion: 'Equipo', equipo_marca: 'Marca del equipo', equipo_modelo: 'Modelo del equipo',
    equipo_serie: 'Serie del equipo', equipo_codigo: 'Código del equipo', cilindro_tamano: 'Tamaño del cilindro',
    cilindro_serie: 'Serie del cilindro', regulador_marca: 'Marca del regulador', regulador_serie: 'Serie del regulador',
    otros_equipos: 'Otros equipos', equipos_adicionales: 'Equipos adicionales', equipos_resumen: 'Lista de equipos', insumos_resumen: 'Lista de insumos',
    observaciones: 'Observaciones',
  },
}

// Otras formas de escribir lo mismo
const ALIAS = {
  paciente: 'paciente_nombre', 'nombre paciente': 'paciente_nombre',
  'cedula paciente': 'paciente_documento', 'identificacion paciente': 'paciente_documento', identificacion: 'paciente_documento',
  cedula: 'paciente_documento', 'documento identidad': 'paciente_documento',
  direccion: 'paciente_direccion', telefono: 'paciente_telefono', correo: 'paciente_correo', 'fecha entrega': 'fecha',
  'quien recibe': 'recibe_nombre', 'cedula quien recibe': 'recibe_documento', 'quien entrega': 'entrega_nombre',
  'cedula quien entrega': 'entrega_documento', 'cargo': 'entrega_cargo', dx: 'diagnostico', 'serial equipo': 'equipo_serie',
  'marca': 'equipo_marca', 'modelo': 'equipo_modelo', 'serial': 'equipo_serie', 'serie': 'equipo_serie',
  'empresa': 'empresa_nombre', 'nit': 'empresa_nit', insumos_texto: 'insumos_resumen',
}

// Marcadores especiales (no son texto): tablas y firmas
export const TABLAS = { equipos: 'equipos', insumos: 'insumos', 'equipos insumos': 'ambos', 'equipos y insumos': 'ambos' }
export const FIRMAS = {
  'firma quien recibe': 'recibe', 'firma recibe': 'recibe', 'firma paciente': 'recibe', 'firma quien recibe paciente': 'recibe',
  'firma quien entrega': 'entrega', 'firma entrega': 'entrega', 'firma responsable': 'responsable',
}
export const NOMBRE_FIRMA = { recibe: 'Firma de quien recibe', entrega: 'Firma de quien entrega', responsable: 'Firma del responsable' }

const PALABRAS_VACIAS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'y', 'e', 'a'])
// "Nombre del Paciente:" → "nombre paciente"
export const normalizar = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[^a-z0-9ñ ]+/g, ' ').split(/\s+/).filter(w => w && !PALABRAS_VACIAS.has(w)).join(' ')

const NOMBRE_DE = Object.fromEntries(Object.values(NOMBRES).flatMap(g => Object.entries(g)))
const VARIABLE_DE = {
  ...Object.fromEntries(Object.entries(NOMBRE_DE).map(([v, n]) => [normalizar(n), v])),
  ...Object.fromEntries(Object.keys(NOMBRE_DE).map(v => [normalizar(v.replace(/_/g, ' ')), v])),
  ...ALIAS,
}

// "Número de contrato" → "numero_contrato"
export const slug = s => normalizar(s).replace(/ /g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 40) || 'dato'

// Variable de un nombre escrito; si no se conoce, un campo propio
export function variableDe(nombre) {
  const k = normalizar(nombre)
  return VARIABLE_DE[k] ? { variable: VARIABLE_DE[k], propio: false } : { variable: slug(nombre), propio: true }
}

// "Hola [Nombre del paciente]" → "Hola {{paciente_nombre}}" (anota los campos propios)
export function aVariables(texto, propios = {}) {
  if (typeof texto !== 'string' || !texto.includes('[')) return texto
  return texto.replace(/\[([^\[\]\n]{1,60})\]/g, (todo, nombre) => {
    const n = normalizar(nombre)
    if (!n || TABLAS[n] || FIRMAS[n]) return todo
    const { variable, propio } = variableDe(nombre)
    if (propio) propios[variable] = propios[variable] || nombre.trim()
    return `{{${variable}}}`
  })
}

// "Hola {{paciente_nombre}}" → "Hola [Nombre del paciente]"
export function aTexto(texto, propios = {}) {
  if (typeof texto !== 'string' || !texto.includes('{{')) return texto
  return texto.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_, v) => `[${NOMBRE_DE[v] || propios[v] || v.replace(/_/g, ' ')}]`)
}

// Campos estructurales: no son texto para la persona
const NO_TEXTO = new Set(['tipo', 'estilo', 'alineacion', 'rol', 'fuente', 'clave', 'url', 'coincide', 'firma', 'imagen'])

// Aplica fn a cada texto de los bloques (para pasar todo a [Nombres] o a {{variables}})
export function mapearTextos(valor, fn, clave = null) {
  if (Array.isArray(valor)) return valor.map(v => mapearTextos(v, fn, clave))
  if (valor && typeof valor === 'object') return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, mapearTextos(v, fn, k)]))
  return typeof valor === 'string' && !NO_TEXTO.has(clave) ? fn(valor) : valor
}

// Bloque oculto con las etiquetas de los campos propios ({ numero_contrato: 'Número de contrato' })
export const propiosDe = bloques => (bloques || []).find(b => b.tipo === 'campos_propios')?.etiquetas || {}
