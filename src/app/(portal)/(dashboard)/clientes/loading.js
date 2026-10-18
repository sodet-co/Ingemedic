import { Pantalla, Topbar, Contenido, Box, TarjetaLista } from '@/components/ui/Skeleton'

// Igual que ClientesClient: pestañas Clientes / Pacientes y la tarjeta de lista
export default function Loading() {
  return (
    <Pantalla>
      <Topbar acciones={2} />
      <div className="px-3 md:px-6 pt-3 md:pt-5 flex-shrink-0">
        <div className="inline-flex bg-slate-200/70 rounded-[10px] p-1 gap-1">
          <div className="h-8 w-28 rounded-[8px] bg-white" />
          <div className="h-8 w-28 rounded-[8px] flex items-center justify-center"><Box className="h-3 w-16" /></div>
        </div>
      </div>
      <Contenido className="flex flex-col !pt-3 md:!pt-4">
        <TarjetaLista chips={3} rows={9} cols={5} />
      </Contenido>
    </Pantalla>
  )
}
