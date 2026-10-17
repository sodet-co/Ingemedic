// ── SISTEMA DE DISEÑO DEL PANEL ─────────────────────────────────────────────
// Clases compartidas para que todos los módulos se vean igual. Antes cada
// archivo definía su propio inputCls/labelCls y sus botones con tamaños,
// radios y hovers distintos. La guía completa está en docs/diseno.md.
//
// Medidas base:
//  - Encabezado de módulo: h-14 md:h-16, px-4 md:px-7 (EncabezadoModulo)
//  - Contenido: p-3 md:p-6, pb-28 md:pb-6 (despeja la navegación móvil)
//  - Tarjetas: rounded-xl, borde slate-200, sombra sm; padding interno p-4 md:p-5
//  - Ventanas emergentes: Modal (rounded-2xl, encabezado / cuerpo / pie)
//  - Controles: alto 38px, radio 9px, texto 13px (16px en celular: evita el zoom de iPhone)

export const ROJO = '#D81B43'
export const ROJO_HOVER = '#B0172F'
export const AZUL = '#1B3A6B'
export const AZUL_HOVER = '#152D54'

export const ui = {
  input: 'w-full px-3 py-2.5 border border-slate-200 rounded-[9px] text-[16px] md:text-[13.5px] text-slate-800 bg-white outline-none focus:border-[#D81B43] focus:ring-2 focus:ring-[#D81B43]/10 transition-colors placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-slate-400',
  label: 'block text-[11px] font-bold uppercase tracking-[0.07em] text-slate-500 mb-1.5',
  ayudaCampo: 'text-[11.5px] text-slate-400 mt-1',

  btnPrimario: 'inline-flex items-center justify-center gap-1.5 h-[38px] px-4 rounded-[9px] bg-[#D81B43] text-white text-[13px] font-semibold hover:bg-[#B0172F] disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap flex-shrink-0',
  btnAzul: 'inline-flex items-center justify-center gap-1.5 h-[38px] px-4 rounded-[9px] bg-[#1B3A6B] text-white text-[13px] font-semibold hover:bg-[#152D54] disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap flex-shrink-0',
  btnSecundario: 'inline-flex items-center justify-center gap-1.5 h-[38px] px-4 rounded-[9px] bg-white border border-slate-200 text-slate-600 text-[13px] font-medium hover:border-slate-300 hover:text-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap flex-shrink-0',
  btnPeligro: 'inline-flex items-center justify-center gap-1.5 h-[38px] px-4 rounded-[9px] bg-white border border-red-200 text-red-500 text-[13px] font-medium hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap flex-shrink-0',
  // Botón chico para encabezados de detalle (PDF, Excel…)
  btnChico: 'inline-flex items-center justify-center gap-1.5 h-8 px-2.5 rounded-[8px] bg-white border border-slate-200 text-slate-600 text-[12px] font-semibold hover:border-slate-300 hover:text-slate-800 disabled:opacity-50 transition-colors whitespace-nowrap flex-shrink-0',
  btnIcono: 'w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors flex-shrink-0',

  tarjeta: 'bg-white rounded-xl border border-slate-200 shadow-sm',
  tituloSeccion: 'text-[10.5px] font-bold uppercase tracking-[0.1em] text-slate-400',
  tituloPagina: 'text-[18px] font-bold text-slate-800',
  subtituloPagina: 'text-[12px] text-slate-400',
  // Título dentro del contenido (secciones de Configuración, encabezados de tarjeta grandes)
  tituloBloque: 'text-[17px] md:text-[18px] font-bold text-slate-800',
  subtituloBloque: 'text-[13px] text-slate-400 mt-0.5',

  chip: 'px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors whitespace-nowrap',
  chipActivo: 'bg-[#D81B43] text-white',
  chipInactivo: 'bg-white border border-slate-200 text-slate-500 hover:border-[#D81B43] hover:text-[#D81B43]',

  th: 'px-4 py-3 text-left text-[10.5px] font-bold uppercase tracking-[0.07em] text-slate-400 bg-slate-50',
  toast: 'fixed bottom-28 md:bottom-6 right-4 md:right-6 z-[80] px-4 py-3 rounded-[10px] text-[13px] font-medium text-white shadow-lg max-w-[calc(100vw-2rem)]',
}

// Estados (equipos, préstamos, acciones de bitácora…) como clases, no colores
// en style={{}}: así el modo oscuro también los ajusta. Mismo color = mismo
// significado en todo el sistema: verde = disponible/hecho, cian = en uso,
// ámbar = espera/atención, rojo = problema, gris = cerrado/inactivo.
export const TONOS = {
  verde: { pill: 'bg-emerald-50 text-[#0F7B55]', punto: 'bg-[#0F7B55]' },
  cian: { pill: 'bg-[#E8F7FB] text-[#0E86A0]', punto: 'bg-[#2EB5D4]' },
  ambar: { pill: 'bg-amber-50 text-[#B45309]', punto: 'bg-[#F59E0B]' },
  rojo: { pill: 'bg-red-50 text-[#D81B43]', punto: 'bg-[#D81B43]' },
  azul: { pill: 'bg-[#E8EEF7] text-[#1B3A6B]', punto: 'bg-[#1B3A6B]' },
  violeta: { pill: 'bg-violet-50 text-[#6D28D9]', punto: 'bg-[#6D28D9]' },
  gris: { pill: 'bg-slate-100 text-slate-500', punto: 'bg-slate-400' },
}
