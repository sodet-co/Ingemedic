import { Pantalla, Topbar, Contenido, TarjetaLista } from '@/components/ui/Skeleton'

// Igual que OrdenesClient: una tarjeta con buscador, Todos / En curso / Historial,
// los 5 filtros y la lista
export default function Loading() {
  return (
    <Pantalla>
      <Topbar acciones={1} />
      <Contenido className="flex flex-col">
        <TarjetaLista chips={3} filtros={5} rows={9} cols={6} />
      </Contenido>
    </Pantalla>
  )
}
