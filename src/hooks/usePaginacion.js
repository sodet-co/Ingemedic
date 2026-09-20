import { useState, useMemo, useEffect } from 'react'

// Pagina un array YA filtrado/ordenado — el caller decide qué le pasa.
// Se resetea a la página 1 solo cuando cambia el total de items o el tamaño
// de página, para no quedar "varado" en una página vacía tras buscar/filtrar,
// pero sin resetear al cambiar de columna de orden (eso no afecta items.length).
export function usePaginacion(items, porPaginaInicial = 20) {
  const [pagina, setPagina] = useState(1)
  const [porPagina, setPorPagina] = useState(porPaginaInicial)

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setPagina(1) }, [items.length, porPagina])

  const totalPaginas = Math.max(1, Math.ceil(items.length / porPagina))
  const paginaActual = Math.min(pagina, totalPaginas)

  const itemsPagina = useMemo(() => {
    const inicio = (paginaActual - 1) * porPagina
    return items.slice(inicio, inicio + porPagina)
  }, [items, paginaActual, porPagina])

  return { itemsPagina, paginaActual, totalPaginas, setPagina, porPagina, setPorPagina, total: items.length }
}
