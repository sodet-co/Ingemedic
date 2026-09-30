import { Topbar, Box } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <Topbar />
      <div className="flex-1 flex overflow-hidden">
        <aside className="hidden md:flex w-56 min-w-[224px] bg-white border-r border-slate-200 flex-col py-4 gap-2 px-4">
          {Array.from({ length: 7 }).map((_, i) => <Box key={i} className="h-8 w-full rounded-lg" />)}
        </aside>
        <div className="flex-1 p-4 md:p-8 space-y-3">
          <Box className="h-5 w-48 mb-4" />
          {Array.from({ length: 5 }).map((_, i) => <Box key={i} className="h-12 w-full rounded-lg" />)}
        </div>
      </div>
    </div>
  )
}
