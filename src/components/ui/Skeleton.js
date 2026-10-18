// Piezas de las pantallas de carga (loading.js de cada módulo). Copian las
// medidas reales de la interfaz homologada (docs/diseno.md): mismo encabezado
// que EncabezadoModulo, tarjetas rounded-xl con borde y sombra, controles de
// 38px, contenido p-3 md:p-6. Si cambia la estructura de un módulo, su
// esqueleto debe cambiar con él.

export function Box({ className = '', style }) {
  return <div className={`bg-slate-200/70 rounded-md animate-pulse ${className}`} style={style} />
}

const tarjeta = 'bg-white rounded-xl border border-slate-200 shadow-sm'
export const Contenido = ({ className = '', children }) => (
  <div className={`flex-1 min-h-0 overflow-hidden p-3 md:p-6 pb-20 md:pb-6 ${className}`}>{children}</div>
)
export const Pantalla = ({ children }) => <div className="flex flex-col flex-1 min-h-0">{children}</div>

// Igual que EncabezadoModulo: título + subtítulo; a la derecha las acciones, ayuda (?) y novedades
export function Topbar({ acciones = 0 }) {
  return (
    <div className="h-14 md:h-16 md:bg-white md:border-b md:border-slate-200 flex items-center gap-3 px-4 md:px-7 flex-shrink-0">
      <div className="flex-1 min-w-0">
        <Box className="h-[18px] w-36 bg-slate-300/70" />
        <Box className="h-3 w-52 mt-1.5" />
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {Array.from({ length: acciones }).map((_, i) => <Box key={i} className={`hidden md:block h-[38px] rounded-[9px] ${i === acciones - 1 ? 'w-36' : 'w-28'}`} />)}
        <Box className="w-8 h-8 rounded-full" />
        <Box className="w-8 h-8 rounded-full" />
      </div>
    </div>
  )
}

export const Buscador = ({ className = 'w-full md:w-[340px]' }) => <Box className={`h-[38px] rounded-[9px] ${className}`} />
export const Chips = ({ n = 3 }) => (
  <div className="flex items-center gap-2 overflow-hidden">
    {Array.from({ length: n }).map((_, i) => <Box key={i} className={`h-8 rounded-full flex-shrink-0 ${i === 0 ? 'w-20' : 'w-28'}`} />)}
  </div>
)

// Tarjeta de cifra (número grande + rótulo), como en Inventario y Bitácora
export function Cifra({ icono = false }) {
  return (
    <div className={`${tarjeta} p-4`}>
      {icono && <div className="flex items-center justify-between mb-2"><Box className="h-8 w-8 rounded-lg" /><Box className="h-7 w-12" /></div>}
      {!icono && <Box className="h-7 w-14" />}
      <Box className={`h-3 ${icono ? 'w-24' : 'w-20 mt-2'}`} />
    </div>
  )
}

// Filas de una lista: tabla en PC, tarjetas en celular
export function Filas({ rows = 8, cols = 5 }) {
  return (
    <>
      <div className="hidden md:block">
        <div className="flex items-center gap-4 px-4 py-3 bg-slate-50 border-b border-slate-100">
          {Array.from({ length: cols }).map((_, i) => <Box key={i} className={`h-2.5 ${i === 0 ? 'w-24' : 'flex-1 max-w-[90px]'}`} />)}
        </div>
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center gap-4 px-4 py-3.5 border-b border-slate-100 last:border-0">
            {Array.from({ length: cols }).map((_, i) => (
              <Box key={i} className={`h-3.5 ${i === 0 ? 'w-28' : i === cols - 1 ? 'w-20 rounded-full h-5' : 'flex-1 max-w-[150px]'}`} />
            ))}
          </div>
        ))}
      </div>
      <div className="md:hidden p-3 space-y-2">
        {Array.from({ length: Math.min(rows, 6) }).map((_, i) => (
          <div key={i} className="rounded-xl border border-slate-200 p-3.5 space-y-2">
            <div className="flex items-center justify-between"><Box className="h-3.5 w-28" /><Box className="h-5 w-16 rounded-full" /></div>
            <Box className="h-3 w-44" />
            <Box className="h-3 w-24" />
          </div>
        ))}
      </div>
    </>
  )
}

// Tarjeta de lista con su cabecera de búsqueda y filtros (Préstamos, Clientes)
export function TarjetaLista({ chips = 3, filtros = 0, rows = 8, cols = 5 }) {
  return (
    <div className={`${tarjeta} overflow-hidden flex flex-col flex-1 min-h-0`}>
      <div className="p-3 md:p-6 pb-3 md:pb-4 flex-shrink-0 border-b border-slate-200 space-y-2 md:space-y-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
          <Buscador />
          <div className="flex items-center gap-2 md:flex-1 min-w-0">
            <Chips n={chips} />
            <Box className="hidden md:block h-3 w-20 ml-auto" />
          </div>
        </div>
        {filtros > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {Array.from({ length: filtros }).map((_, i) => <Box key={i} className="h-[38px] rounded-[9px]" />)}
          </div>
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-hidden"><Filas rows={rows} cols={cols} /></div>
    </div>
  )
}

// Tarjeta con título y contenido (paneles del Dashboard)
export function Panel({ alto = 160, className = '' }) {
  return (
    <div className={`${tarjeta} p-5 ${className}`}>
      <Box className="h-4 w-44" />
      <Box className="h-3 w-56 mt-1.5 mb-4" />
      <Box className="w-full rounded-lg" style={{ height: alto }} />
    </div>
  )
}

// Genérico (módulos sin esqueleto propio): encabezado + cifras + lista
export default function PageSkeleton({ kpis = 0, rows = 6, cols = 4 }) {
  return (
    <Pantalla>
      <Topbar acciones={1} />
      <Contenido className="space-y-4">
        {kpis > 0 && <div className="hidden md:grid gap-4" style={{ gridTemplateColumns: `repeat(${kpis}, minmax(0, 1fr))` }}>{Array.from({ length: kpis }).map((_, i) => <Cifra key={i} />)}</div>}
        <div className={`${tarjeta} overflow-hidden`}><Filas rows={rows} cols={cols} /></div>
      </Contenido>
    </Pantalla>
  )
}
