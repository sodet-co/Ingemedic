import { ULTIMA_ACTUALIZACION } from '@/lib/ultima-actualizacion'

// Pie del panel (solo md+): derechos, fecha de la versión y crédito de SODET.
// Vivían al fondo del Sidebar, debajo del usuario, donde ya no cabían.
export default function PiePanel() {
  const actualizado = new Date(ULTIMA_ACTUALIZACION).toLocaleDateString('es-CO', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Bogota',
  })
  return (
    <footer className="hidden md:flex flex-shrink-0 items-center justify-between gap-4 h-8 px-7 border-t border-slate-200 bg-white text-[11px] text-slate-400">
      <span className="truncate">
        © {new Date().getFullYear()} Ingemedic de Colombia S.A.S. · Todos los derechos reservados
      </span>
      <span className="flex-shrink-0 whitespace-nowrap">
        Actualizado: {actualizado}
        <span className="mx-2 text-slate-300">·</span>
        Desarrollado por{' '}
        <a href="https://sodet.vercel.app" target="_blank" rel="noopener noreferrer"
          className="font-semibold text-slate-500 hover:text-[#D81B43] transition-colors">
          SODET
        </a>
      </span>
    </footer>
  )
}
