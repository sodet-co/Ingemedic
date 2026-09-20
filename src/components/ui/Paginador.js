'use client'

// Controles de paginación reutilizables — mismo lenguaje visual que ya usaba
// la paginación de unidades en el wizard de Préstamos (OrdenesClient).
export default function Paginador({ paginaActual, totalPaginas, setPagina, porPagina, setPorPagina, total, opcionesPorPagina = [15, 20, 50] }) {
  if (total === 0) return null

  const inicio = (paginaActual - 1) * porPagina + 1
  const fin = Math.min(paginaActual * porPagina, total)

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-200 text-[12.5px] text-slate-500">
      <div className="flex items-center gap-2">
        <span>Mostrando {inicio}–{fin} de {total}</span>
        <select value={porPagina} onChange={e => setPorPagina(Number(e.target.value))}
          className="border border-slate-200 rounded-[7px] text-[12px] px-2 py-1 text-slate-600 outline-none focus:border-[#D81B43] bg-white">
          {opcionesPorPagina.map(n => <option key={n} value={n}>{n} / pág.</option>)}
        </select>
      </div>

      {totalPaginas > 1 && (
        <div className="flex items-center gap-2">
          <button type="button" disabled={paginaActual === 1} onClick={() => setPagina(p => Math.max(1, p - 1))}
            className="px-2.5 py-1.5 border border-slate-200 rounded-[7px] disabled:opacity-40 disabled:cursor-not-allowed hover:border-slate-300">
            ‹ Anterior
          </button>
          <span className="font-medium text-slate-600">{paginaActual} / {totalPaginas}</span>
          <button type="button" disabled={paginaActual === totalPaginas} onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
            className="px-2.5 py-1.5 border border-slate-200 rounded-[7px] disabled:opacity-40 disabled:cursor-not-allowed hover:border-slate-300">
            Siguiente ›
          </button>
        </div>
      )}
    </div>
  )
}
