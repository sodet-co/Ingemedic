import { Pantalla, Topbar, Contenido, Box } from '@/components/ui/Skeleton'

// Igual que ConfiguracionClient: menú en tarjeta de 224px a la izquierda y la
// sección a la derecha; en celular, la lista de secciones agrupada
const GRUPOS = [3, 4, 3]

export default function Loading() {
  return (
    <Pantalla>
      <Topbar />
      <Contenido className="!overflow-y-auto">
        <div className="md:hidden space-y-4">
          {GRUPOS.map((n, g) => (
            <div key={g}>
              <Box className="h-2.5 w-20 mb-2 ml-1" />
              <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                {Array.from({ length: n }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3.5"><Box className="w-8 h-8 rounded-lg" /><Box className="h-3.5 w-40" /></div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="hidden md:flex gap-5 items-start">
          <div className="w-[224px] flex-shrink-0 bg-white rounded-xl border border-slate-200 shadow-sm py-2">
            {GRUPOS.map((n, g) => (
              <div key={g} className={g ? 'mt-1 pt-1 border-t border-slate-100' : ''}>
                <Box className="h-2.5 w-16 mx-4 mt-2.5 mb-2" />
                {Array.from({ length: n }).map((_, i) => (
                  <div key={i} className="flex items-center gap-2.5 mx-1.5 px-2.5 py-2"><Box className="w-4 h-4 rounded" /><Box className="h-3 w-28" /></div>
                ))}
              </div>
            ))}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-5">
              <div><Box className="h-[18px] w-44 bg-slate-300/70" /><Box className="h-3 w-64 mt-2" /></div>
              <Box className="h-[38px] w-32 rounded-[9px]" />
            </div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm divide-y divide-slate-100 overflow-hidden">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-4">
                  <Box className="w-9 h-9 rounded-full" />
                  <div className="flex-1 space-y-1.5"><Box className="h-3.5 w-48" /><Box className="h-3 w-32" /></div>
                  <Box className="h-5 w-20 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </Contenido>
    </Pantalla>
  )
}
