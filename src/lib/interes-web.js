// Resumen de la tabla `eventos_sitio` (clics en WhatsApp y formularios del
// sitio público) para el módulo "Página web" del panel (solo SuperAdmin).
// Los eventos los escribe /api/evento; ver src/lib/analitica.js.

const DIA_MS = 24 * 60 * 60 * 1000
const DIAS = 30
const ZONA = 'America/Bogota'

// Nombre visible de cada botón (`origen`)
export const NOMBRE_ORIGEN = {
  flotante: 'Botón flotante',
  inicio_hero: 'Inicio · Consultar catálogo',
  footer: 'Pie de página',
  contacto: 'Página de contacto',
  contacto_error_formulario: 'Contacto · tras error del formulario',
  portafolio_equipo: 'Portafolio · tarjeta de equipo',
  portafolio_asesoria: 'Portafolio · asesoría',
}

const NOMBRE_PAGINA = {
  '/': 'Inicio',
  '/portafolio': 'Portafolio',
  '/quienes-somos': 'Quiénes somos',
  '/contacto': 'Contacto',
  '/politica-de-datos': 'Política de datos',
  '/terminos': 'Términos y condiciones',
}

// AAAA-MM-DD en hora de Colombia
const diaBogota = fecha => new Date(fecha).toLocaleDateString('en-CA', { timeZone: ZONA })

function agrupar(filas, campo, nombres = {}) {
  const conteo = {}
  filas.forEach(f => {
    const clave = f[campo]
    if (clave) conteo[clave] = (conteo[clave] || 0) + 1
  })
  return Object.entries(conteo)
    .map(([clave, cantidad]) => ({ nombre: nombres[clave] || clave, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad)
}

// `supabase` debe ser un cliente service_role: la tabla no tiene política de
// lectura, así que con la sesión de un usuario devuelve vacío.
export async function resumenInteresWeb(supabase) {
  const ahora = Date.now()
  const desde = new Date(ahora - DIAS * DIA_MS).toISOString()

  // Supabase corta en 1000 filas por consulta: se pagina hasta traerlas todas.
  const filas = []
  let error = null
  for (let pagina = 0; pagina < 50; pagina++) {
    const { data, error: e } = await supabase.from('eventos_sitio')
      .select('evento, origen, pagina, detalle, creado_en')
      .gte('creado_en', desde)
      .order('creado_en', { ascending: false })
      .range(pagina * 1000, pagina * 1000 + 999)
    if (e) { error = e.message; break }
    filas.push(...(data || []))
    if (!data || data.length < 1000) break
  }

  const whatsapp    = filas.filter(f => f.evento === 'whatsapp_clic')
  const formularios = filas.filter(f => f.evento === 'contacto_enviado')
  const hace7 = ahora - 7 * DIA_MS
  const ultimos7 = lista => lista.filter(f => new Date(f.creado_en).getTime() >= hace7).length

  // Una fila por día, también los días sin actividad (para que la gráfica no salte)
  const porDia = {}
  for (let i = DIAS - 1; i >= 0; i--) {
    porDia[diaBogota(ahora - i * DIA_MS)] = { whatsapp: 0, formularios: 0 }
  }
  whatsapp.forEach(f => { const d = porDia[diaBogota(f.creado_en)]; if (d) d.whatsapp++ })
  formularios.forEach(f => { const d = porDia[diaBogota(f.creado_en)]; if (d) d.formularios++ })

  return {
    error,
    dias: DIAS,
    whatsapp7: ultimos7(whatsapp),
    whatsapp30: whatsapp.length,
    formularios7: ultimos7(formularios),
    formularios30: formularios.length,
    serie: Object.entries(porDia).map(([dia, v]) => ({ dia: dia.slice(8) + '/' + dia.slice(5, 7), ...v })),
    porBoton: agrupar(whatsapp, 'origen', NOMBRE_ORIGEN),
    porPagina: agrupar(whatsapp, 'pagina', NOMBRE_PAGINA),
    porEquipo: agrupar(whatsapp.filter(f => f.origen === 'portafolio_equipo'), 'detalle').slice(0, 8),
    porServicio: agrupar(formularios, 'detalle'),
  }
}
