// Arma el contexto que consume lib/actas/render.js: las {{variables}} de texto,
// las filas de equipos e insumos y las firmas. Todo lo que una plantilla puede
// mostrar sale de aquí; VARIABLES documenta cada una para el editor.

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

export const VARIABLES = {
  'Fecha y lugar': {
    fecha: 'Fecha de entrega (dd/mm/aaaa)', hora: 'Hora de entrega', dia: 'Día', mes: 'Mes en letras',
    anio: 'Año', ciudad: 'Ciudad de la entrega', orden_codigo: 'Código del préstamo',
  },
  Empresa: {
    empresa_nombre: 'Razón social', empresa_nit: 'NIT', empresa_dir: 'Dirección', empresa_tel: 'Teléfono',
    empresa_email: 'Correo', empresa_rep: 'Representante legal',
  },
  Cliente: { cliente_nombre: 'Cliente (EPS / IPS)', cliente_nit: 'NIT del cliente' },
  Paciente: {
    paciente_nombre: 'Nombre', paciente_tipo_doc: 'Tipo de documento', paciente_documento: 'Número de documento',
    paciente_direccion: 'Dirección', paciente_barrio: 'Barrio', paciente_ciudad: 'Ciudad', paciente_telefono: 'Teléfono',
    paciente_correo: 'Correo', paciente_eps: 'EPS', paciente_edad: 'Edad', diagnostico: 'Diagnóstico (Dx)',
    doc_cc: 'X si es CC', doc_ti: 'X si es TI', doc_rc: 'X si es RC', doc_ce: 'X si es CE',
  },
  'Quien recibe': {
    recibe_nombre: 'Nombre', recibe_documento: 'Documento', recibe_parentesco: 'Parentesco',
    recibe_telefono: 'Teléfono', recibe_correo: 'Correo',
    responsable_nombre: 'Nombre, solo si quien recibe no es el paciente', responsable_documento: 'Documento, ídem',
  },
  'Quien entrega': { entrega_nombre: 'Nombre', entrega_cargo: 'Cargo', entrega_tipo_doc: 'Tipo de documento', entrega_documento: 'Documento' },
  Equipos: {
    equipo_descripcion: 'Equipo principal', equipo_marca: 'Marca', equipo_modelo: 'Modelo', equipo_serie: 'Serie',
    equipo_codigo: 'Código interno', cilindro_tamano: 'Cilindro: tamaño', cilindro_serie: 'Cilindro: serie',
    regulador_marca: 'Regulador: marca', regulador_serie: 'Regulador: serie',
    otros_equipos: 'Los demás equipos (sin el principal)', equipos_adicionales: 'Equipos que no caben en el recuadro (sin principal, cilindro ni regulador)', equipos_resumen: 'Todos los equipos en una línea', insumos_resumen: 'Todos los insumos en una línea',
    observaciones: 'Observaciones de la entrega', motivo_cambio: 'Motivo del cambio de equipo',
  },
  'Máscara (de los insumos)': {
    mascara_descripcion: 'Máscara entregada', mascara_marca: 'Marca', mascara_modelo: 'Modelo', mascara_invima: 'Registro INVIMA',
  },
}

const t = v => (v == null ? '' : String(v).trim())

// Una fila de la tabla de equipos a partir de una unidad del inventario
export function filaEquipo(eq) {
  const tipo = eq?.tipo_equipo || {}
  const atr = eq?.atributos || {}
  // En los tipos, atributos.nombre a veces es el nombre genérico ("Cilindro de
  // Oxígeno", tipo "Cilindro 3.5 M3") y a veces repite la marca ("O2 Tiger").
  // El tipo.nombre es la marca (o el tamaño, en cilindros).
  // La unidad trae su nombre genérico en atributos.nombre ("Aspirador de Secreciones",
  // en 1.700 de 1.709 equipos): es el más confiable; el del tipo a veces es el
  // modelo ("GMR-SM") o la marca ("Long Fian")
  const generico = atr.nombre || (tipo.atributos?.nombre && tipo.atributos.nombre !== tipo.nombre ? tipo.atributos.nombre : null)
  // Si el tipo repite la palabra del genérico ("Cilindro 3.5 M3" / "Cilindro de
  // Oxígeno") no es una marca sino el modelo o tamaño
  const primera = generico?.split(/\s+/)[0]?.toLowerCase()
  const esModelo = primera && (tipo.nombre || '').toLowerCase().startsWith(primera)
  return {
    descripcion: t(generico || tipo.categoria?.nombre || tipo.nombre),
    marca: esModelo ? '' : t(tipo.nombre),
    modelo: t(atr.modelo || tipo.atributos?.modelo || (esModelo ? tipo.nombre : '')),
    serie: t(atr.serie),
    codigo: t(eq?.codigo),
    categoria: t(tipo.categoria?.nombre),
    categoria_id: tipo.categoria?.id || tipo.categoria_id || null,
    estado: 'Bueno',
    cantidad: 1,
    // Para la tabla estándar (render.js → tablaEstandar): de qué tipo es (las unidades del
    // mismo tipo van en una fila) y los datos que su categoría define en el inventario
    // (campos_tipo en el tipo, campos_unidad en la unidad)
    tipo_id: eq?.tipo_equipo_id || tipo.id || null,
    atributos: Object.fromEntries(Object.entries({ ...(tipo.atributos || {}), ...atr })
      .filter(([, v]) => (typeof v === 'string' || typeof v === 'number') && String(v).trim())),
  }
}

function edad(fechaNacimiento, hoy) {
  if (!fechaNacimiento) return ''
  const n = new Date(fechaNacimiento)
  let e = hoy.getFullYear() - n.getFullYear()
  if (hoy.getMonth() < n.getMonth() || (hoy.getMonth() === n.getMonth() && hoy.getDate() < n.getDate())) e--
  return e >= 0 ? String(e) : ''
}

// { empresa, orden: { codigo, diagnostico, cliente, paciente }, equipos: [unidades], datos, firmas }
// datos = { fecha (ISO), ciudad, recibe: {...}, entrega: {...}, insumos: [...], observaciones, extra: {...} }
// (lo que se llena al crear el préstamo vive en ordenes_servicio.datos_acta; ver campos.js)
// retirados: en un cambio de equipo, los que salen (equipos = los que entran)
export function construirContexto({ empresa = {}, orden = {}, equipos = [], retirados = [], datos = {}, firmas = {} }) {
  const p = orden.paciente || {}
  const c = orden.cliente || {}
  // "Recibe el mismo paciente": nombre y documento salen del paciente
  const r = datos.recibe?.esPaciente && p.nombre
    ? { ...datos.recibe, nombre: p.nombre, documento: p.cedula, parentesco: '' }
    : datos.recibe || {}
  const en = datos.entrega || {}
  const f = datos.fecha ? new Date(datos.fecha) : new Date()
  const bog = new Date(f.toLocaleString('en-US', { timeZone: 'America/Bogota' }))
  // Estado de cada equipo: "Bueno" salvo que se haya escrito otro (datos_acta.estados)
  const filas = equipos.map(filaEquipo).map(f => ({ ...f, estado: t(datos.estados?.[f.codigo]) || f.estado }))
  const insumos =(datos.insumos || []).map(i => ({
    descripcion: t(i.descripcion), cantidad: t(i.cantidad), lote: t(i.lote), invima: t(i.invima),
    marca: t(i.marca), modelo: t(i.modelo), estado: t(i.estado) || 'Nuevo',
  }))
  // La máscara de un CPAP / BPAP (acta de máscara de Family): el primer insumo que lo sea
  const mascara = insumos.find(i => /m[aá]scara/i.test(i.descripcion)) || {}
  const tipoDoc = t(p.tipo_documento || 'CC').toUpperCase()
  // ¿Firma un responsable o el mismo paciente? Los formatos tienen renglón para cada uno
  const esResponsable = !!t(r.nombre) && t(r.nombre).toLowerCase() !== t(p.nombre).toLowerCase()

  const variables = {
    // Campos propios de la plantilla ({{numero_contrato}}…); los del sistema van encima
    ...Object.fromEntries(Object.entries(datos.extra || {}).map(([k, v]) => [k, t(v)])),
    fecha: bog.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    hora: bog.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', hour12: true }),
    dia: String(bog.getDate()), mes: MESES[bog.getMonth()], anio: String(bog.getFullYear()),
    ciudad: t(datos.ciudad || p.ciudad),
    orden_codigo: t(orden.codigo),
    empresa_nombre: t(empresa.razon_social), empresa_nit: t(empresa.nit), empresa_dir: t(empresa.dir),
    empresa_tel: t(empresa.tel), empresa_email: t(empresa.email), empresa_rep: t(empresa.rep),
    cliente_nombre: t(c.nombre), cliente_nit: t(c.nit_cc),
    paciente_nombre: t(p.nombre), paciente_tipo_doc: tipoDoc, paciente_documento: t(p.cedula),
    paciente_direccion: t(p.direccion), paciente_barrio: t(p.barrio), paciente_ciudad: t(p.ciudad),
    paciente_telefono: t(p.telefono), paciente_correo: t(p.correo), paciente_eps: t(p.eps),
    paciente_edad: edad(p.fecha_nacimiento, bog), diagnostico: t(orden.diagnostico),
    doc_cc: tipoDoc === 'CC' ? 'X' : '', doc_ti: tipoDoc === 'TI' ? 'X' : '',
    doc_rc: tipoDoc === 'RC' ? 'X' : '', doc_ce: tipoDoc === 'CE' ? 'X' : '',
    recibe_nombre: t(r.nombre), recibe_documento: t(r.documento), recibe_parentesco: t(r.parentesco),
    recibe_telefono: t(r.telefono || p.telefono), recibe_correo: t(r.correo),
    responsable_nombre: esResponsable ? t(r.nombre) : '', responsable_documento: esResponsable ? t(r.documento) : '',
    entrega_nombre: t(en.nombre), entrega_cargo: t(en.cargo), entrega_tipo_doc: t(en.tipo_documento || 'CC'), entrega_documento: t(en.documento),
    ...variablesDeEquipos(filas),
    insumos_resumen: insumos.map(i => [i.cantidad, i.descripcion].filter(Boolean).join(' ')).join(', '),
    observaciones: t(datos.observaciones),
    motivo_cambio: t(datos.motivo),
    mascara_descripcion: mascara.descripcion || '', mascara_marca: mascara.marca || '',
    mascara_modelo: mascara.modelo || '', mascara_invima: mascara.invima || '',
  }

  // Lo que la persona escribió encima de lo automático (datos_acta.valores)
  const escritos = Object.fromEntries(Object.entries(datos.valores || {}).filter(([, v]) => t(v)).map(([k, v]) => [k, t(v)]))
  Object.assign(variables, escritos)

  // Además de 'recibe' y 'entrega', la firma de quien recibe va en el renglón
  // del paciente o en el del responsable, según quién sea
  const todas = { ...firmas, [esResponsable ? 'responsable' : 'paciente']: firmas.recibe }
  // manuales: renglones en blanco de cada plantilla ({ plantilla_id: { 'bloque.campo': valor } });
  // quien pinta una plantilla pasa los suyos como ctx.manuales (ver paraPlantilla)
  return { variables, escritos, equipos: filas, retirados: retirados.map(filaEquipo), insumos, firmas: todas, manualesPorPlantilla: datos.manuales || {} }
}

// Datos de equipo de las {{variables}}: el principal, cilindro, regulador y listas
function variablesDeEquipos(filas) {
  const cat = (re) => filas.find(x => re.test(x.categoria) || re.test(x.descripcion))
  const cilindro = cat(/cilindro/i), regulador = cat(/regulador/i)
  // El principal es el equipo (concentrador, aspirador, CPAP…), no un segundo
  // cilindro o regulador: con dos cilindros, el segundo quedaba como "EQUIPO"
  const accesorio = x => /cilindro|regulador/i.test(`${x.categoria} ${x.descripcion}`)
  const principal = filas.find(x => !accesorio(x)) || filas.find(x => x !== cilindro && x !== regulador) || filas[0] || {}
  const linea = x => [x.descripcion, x.marca || x.modelo, x.serie && `serie ${x.serie}`].filter(Boolean).join(' ')
  return {
    equipo_descripcion: t(principal.descripcion), equipo_marca: t(principal.marca),
    equipo_modelo: t(principal.modelo), equipo_serie: t(principal.serie), equipo_codigo: t(principal.codigo),
    cilindro_tamano: t((cilindro?.modelo || '').match(/\d+([.,]\d+)?\s*m3/i)?.[0] || cilindro?.modelo),
    cilindro_serie: t(cilindro?.serie),
    regulador_marca: t(regulador?.marca), regulador_serie: t(regulador?.serie),
    otros_equipos: filas.filter(x => x !== principal).map(linea).join('; '),
    // Los que no caben en las casillas de equipo, cilindro y regulador del recuadro
    equipos_adicionales: filas.filter(x => x !== principal && x !== cilindro && x !== regulador).map(linea).join('; '),
    equipos_resumen: filas.map(x => [x.descripcion, x.marca, x.serie && `serie ${x.serie}`].filter(Boolean).join(' ')).join('; '),
  }
}

// ── Equipos a los que aplica una plantilla ──
// Bloque que no se dibuja: { tipo: 'para_equipos', categorias: [{ id, nombre }] }. Sin él
// (o vacío) la plantilla es para todos los equipos. Se elige en el editor (Equipos: Solo algunos).
export const categoriasDe = bloques => (bloques || []).find(b => b.tipo === 'para_equipos')?.categorias || []
// ¿Se renueva? (editor → Renovable). Bloque que no se dibuja: { tipo: 'renovable' }.
// Un acta firmada de esta plantilla se puede renovar en el préstamo: misma firma, fecha nueva
export const esRenovable = bloques => (bloques || []).some(b => b.tipo === 'renovable')
// ¿El equipo (fila de filaEquipo) es de una de esas categorías? Por id; si la fila no lo
// trae (actas viejas), por nombre
export const deCategorias = (fila, categorias) => categorias.some(c =>
  (c.id && fila.categoria_id === c.id) || (c.nombre && t(fila.categoria).toLowerCase() === t(c.nombre).toLowerCase()))

// Contexto para pintar una plantilla: sus renglones en blanco llenos y, si la plantilla
// es solo para algunas categorías, solo esos equipos (tabla y datos de equipo; lo que
// la persona escribió encima se respeta). plantilla: { id, bloques }
export function paraPlantilla(ctx, plantilla) {
  const conSusManuales = { ...ctx, manuales: ctx?.manualesPorPlantilla?.[plantilla?.id] || {} }
  const categorias = categoriasDe(plantilla?.bloques)
  if (!categorias.length || !ctx) return conSusManuales
  const equipos = (ctx.equipos || []).filter(f => deCategorias(f, categorias))
  const retirados = (ctx.retirados || []).filter(f => deCategorias(f, categorias))
  return { ...conSusManuales, equipos, retirados, variables: { ...ctx.variables, ...variablesDeEquipos(equipos), ...(ctx.escritos || {}) } }
}