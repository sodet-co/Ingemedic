import { Topbar, KPIRow, ListPanel } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <Topbar />
      <div className="flex-1 overflow-auto p-3 md:p-6 pb-28 md:pb-6 space-y-4">
        {/* KPIs — solo visibles en desktop, igual que el Dashboard real */}
        <KPIRow count={6} />
        {/* Paneles: Órdenes activas / Mantenimientos — apilados en móvil, 2 columnas en desktop */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ListPanel rows={3} />
          <ListPanel rows={2} />
        </div>
      </div>
    </div>
  )
}
