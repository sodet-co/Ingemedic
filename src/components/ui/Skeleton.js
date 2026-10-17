// Piezas base para pantallas de carga (skeletons).
// Usan animate-pulse de Tailwind — no requieren configuración extra.
// Reutilizables desde cualquier loading.js del dashboard.

export function Box({ className = '' }) {
  return <div className={`bg-slate-200/70 rounded-md animate-pulse ${className}`} />
}

export function Topbar({ withSubtitle = true }) {
  return (
    <div className="h-auto md:h-16 bg-transparent md:bg-white border-b-0 md:border-b border-slate-200 flex items-center px-4 md:px-7 py-4 md:py-0 flex-shrink-0">
      <div>
        <Box className="h-5 md:h-4 w-40 mb-2 bg-slate-300/70" />
        {withSubtitle && <Box className="h-3 w-56" />}
      </div>
    </div>
  )
}

export function KPICard() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <Box className="h-3 w-20" />
        <Box className="h-8 w-8 rounded-lg" />
      </div>
      <Box className="h-6 w-16" />
    </div>
  )
}

export function KPIRow({ count = 4 }) {
  return (
    <div className={`hidden md:grid md:grid-cols-${count} gap-3 md:gap-4`}>
      {Array.from({ length: count }).map((_, i) => <KPICard key={i} />)}
    </div>
  )
}

// Chips compactos con scroll horizontal — para móvil en Entregas/Mantenimientos
// (ahí los "KPIs" son filtros clicables, no cards decorativas, así que en vez de
// ocultarlos del todo se muestran como chips, igual que en el componente real)
export function ChipsRow({ count = 4 }) {
  return (
    <div className="flex md:hidden gap-2 overflow-x-auto pb-1 -mx-1 px-1">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full border border-slate-200 bg-white">
          <Box className="h-3.5 w-6" />
          <Box className="h-3 w-12" />
        </div>
      ))}
    </div>
  )
}

// Fila de tabla (desktop)
export function TableRow({ cols = 4 }) {
  return (
    <div className="hidden md:flex items-center gap-4 px-4 py-3.5 border-b border-slate-100">
      {Array.from({ length: cols }).map((_, i) => (
        <Box key={i} className={`h-3.5 ${i === 0 ? 'w-40' : 'flex-1 max-w-[140px]'}`} />
      ))}
    </div>
  )
}

// Card equivalente (móvil)
export function ListCard() {
  return (
    <div className="md:hidden bg-white rounded-xl border border-slate-200 p-4 space-y-2.5">
      <div className="flex items-center justify-between">
        <Box className="h-3.5 w-28" />
        <Box className="h-5 w-16 rounded-full" />
      </div>
      <Box className="h-3 w-40" />
      <Box className="h-3 w-24" />
    </div>
  )
}

// Bloque completo: N filas de tabla + N cards móviles equivalentes
export function ListaFilas({ rows = 6, cols = 4 }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="hidden md:block">
        {Array.from({ length: rows }).map((_, i) => <TableRow key={i} cols={cols} />)}
      </div>
      <div className="md:hidden p-3 space-y-2">
        {Array.from({ length: rows }).map((_, i) => <ListCard key={i} />)}
      </div>
    </div>
  )
}

// Panel de lista con header (título + badge "ver todas") + N filas —
// para las secciones del Dashboard: "Órdenes activas", "Mantenimientos", etc.
export function ListPanel({ rows = 3 }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <Box className="h-4 w-32 mb-1.5" />
          <Box className="h-3 w-16" />
        </div>
        <Box className="h-3 w-16" />
      </div>
      <div className="space-y-3 divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className={`flex items-center justify-between ${i > 0 ? 'pt-3' : ''}`}>
            <div>
              <Box className="h-3.5 w-24 mb-1.5" />
              <Box className="h-3 w-32" />
            </div>
            <Box className="h-5 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

// Skeleton genérico de página de módulo: topbar + (KPIs opcional) + lista
// chips=true → módulos donde el "KPI" es en realidad un filtro clicable
// (Entregas, Mantenimientos): en móvil se ve como chips, no se oculta.
// chips=false → módulos con KPIs puramente decorativos (Dashboard, Inventario):
// se ocultan del todo en móvil.
export default function PageSkeleton({ kpis = 0, rows = 6, cols = 4, chips = false }) {
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <Topbar />
      <div className="flex-1 overflow-hidden p-3 md:p-6 pb-20 md:pb-6 space-y-4">
        {kpis > 0 && chips && <ChipsRow count={kpis} />}
        {kpis > 0 && <KPIRow count={kpis} />}
        <ListaFilas rows={rows} cols={cols} />
      </div>
    </div>
  )
}
