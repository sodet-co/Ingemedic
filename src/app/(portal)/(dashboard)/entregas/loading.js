import { Pantalla, Topbar, Contenido, Box, Buscador } from '@/components/ui/Skeleton'

// Igual que EntregasClient: buscador + filtros y el tablero Por iniciar → En ruta → Completadas
export default function Loading() {
  return (
    <Pantalla>
      <Topbar />
      <Contenido className="flex flex-col gap-4">
        <div className="flex items-center gap-3 flex-shrink-0">
          <Buscador className="flex-1 md:flex-none md:w-[300px]" />
          <Box className="h-[38px] w-24 rounded-[9px]" />
        </div>
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-5">
          {[3, 2, 2].map((n, c) => (
            <div key={c} className={`flex flex-col lg:bg-slate-100/60 lg:rounded-2xl lg:p-3 ${c > 0 ? 'max-lg:hidden' : ''}`}>
              <div className="flex items-center gap-2 mb-2.5 px-1"><Box className="w-2 h-2 rounded-full" /><Box className="h-3.5 w-24" /><Box className="h-4 w-6 rounded-full" /></div>
              <div className="space-y-2.5">
                {Array.from({ length: n }).map((_, i) => (
                  <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm p-3.5 space-y-2">
                    <div className="flex items-center gap-2"><Box className="h-5 w-24 rounded" /><Box className="h-3 w-12 ml-auto" /></div>
                    <Box className="h-3.5 w-3/4" />
                    <Box className="h-3 w-1/2" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Contenido>
    </Pantalla>
  )
}
