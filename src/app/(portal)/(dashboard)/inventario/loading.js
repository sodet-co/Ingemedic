import { Pantalla, Topbar, Contenido, Box, Cifra, Buscador } from '@/components/ui/Skeleton'

// Igual que InventarioClient: 4 cifras (2 en celular), buscador y tarjetas de categoría
export default function Loading() {
  return (
    <Pantalla>
      <Topbar acciones={3} />
      <Contenido className="!overflow-y-auto">
        <div className="hidden md:grid md:grid-cols-4 gap-4 mb-6">{Array.from({ length: 4 }).map((_, i) => <Cifra key={i} />)}</div>
        <div className="md:hidden grid grid-cols-2 gap-2 mb-4">{[0, 1].map(i => <Cifra key={i} />)}</div>
        <div className="flex items-center gap-3 mb-4">
          <Buscador className="flex-1 md:flex-none md:w-[340px]" />
          <Box className="hidden md:block h-3 w-24 ml-auto" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-3 flex items-center gap-3">
              <Box className="w-8 h-8 rounded-lg flex-shrink-0" />
              <div className="flex-1 space-y-1.5"><Box className="h-3.5 w-3/4" /><Box className="h-3 w-1/2" /></div>
            </div>
          ))}
        </div>
      </Contenido>
    </Pantalla>
  )
}
