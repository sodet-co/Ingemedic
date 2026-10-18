import { Pantalla, Topbar, Contenido, Box, Cifra, Panel } from '@/components/ui/Skeleton'

// Igual que DashboardClient: resumen (celular) o 5 cifras (PC), dos gráficos,
// mapa por municipio y actividad reciente
export default function Loading() {
  return (
    <Pantalla>
      <Topbar />
      <Contenido className="!overflow-y-auto space-y-5">
        <div className="md:hidden bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3">
          <div className="flex justify-between pb-2 mb-2.5 border-b border-slate-100"><Box className="h-3 w-32" /><Box className="h-5 w-20 rounded-full" /></div>
          <div className="flex gap-4">{[0, 1, 2].map(i => <Box key={i} className="h-4 w-20" />)}</div>
        </div>
        <div className="hidden md:grid md:grid-cols-5 gap-3">{Array.from({ length: 5 }).map((_, i) => <Cifra key={i} icono />)}</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><Panel /><Panel /></div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <Box className="h-4 w-52" />
          <Box className="h-3 w-44 mt-1.5 mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-[38%_1fr] gap-4">
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Box key={i} className="h-3.5 w-full" />)}</div>
            <Box className="h-[240px] rounded-lg hidden md:block" />
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">
          <Box className="h-4 w-36 mb-1" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Box className="w-7 h-7 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-1.5"><Box className="h-3 w-2/3" /><Box className="h-2.5 w-1/3" /></div>
            </div>
          ))}
        </div>
      </Contenido>
    </Pantalla>
  )
}
