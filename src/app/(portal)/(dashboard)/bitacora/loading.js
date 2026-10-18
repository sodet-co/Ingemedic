import { Pantalla, Topbar, Contenido, Box, Cifra, Buscador, Filas } from '@/components/ui/Skeleton'

// Igual que BitacoraClient: barra de filtros, 4 cifras y la tabla
export default function Loading() {
  return (
    <Pantalla>
      <Topbar acciones={1} />
      <Contenido className="flex flex-col gap-3 md:gap-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-3 flex-wrap flex-shrink-0">
          <Buscador className="flex-1 min-w-[160px] md:max-w-[280px]" />
          <Box className="h-[38px] w-40 rounded-[9px]" />
          <Box className="h-[38px] w-36 rounded-[9px]" />
        </div>
        <div className="hidden md:grid md:grid-cols-4 gap-3 flex-shrink-0">{Array.from({ length: 4 }).map((_, i) => <Cifra key={i} />)}</div>
        <div className="flex-1 min-h-0 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"><Filas rows={10} cols={5} /></div>
      </Contenido>
    </Pantalla>
  )
}
