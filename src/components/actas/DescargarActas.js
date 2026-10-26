'use client'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FileText, Files, FileStack, X } from 'lucide-react'
import { descargarActasPDF, descargarActasSeparadas, nombreDeArchivo } from '@/lib/actas/pdf'

// Botón de descarga de actas. Con una sola acta baja el PDF de una vez; con
// varias abre un menú: todas en un PDF o cada una en su propio archivo (y, si se
// pasa `actual`, solo la que se está viendo). El menú va en un portal al body:
// dentro de ventanas centradas con transform (PreviaActas) un `fixed` se descuadra.
// En el celular es una hoja desde abajo con botones grandes.
//  - actas: las filas ya cargadas, o cargar: async () => filas (se piden al tocar)
//  - nombre: base del archivo, sin .pdf (Actas_ORD-2026-520)
//  - children: (ocupado) => contenido del botón
//  - onSinActas: si al cargar no hay ninguna
export default function DescargarActas({ actas, cargar, nombre, actual, className, children, onError, onListo, onSinActas, etiqueta = 'Descargar actas en PDF' }) {
  const [ocupado, setOcupado] = useState(false)
  const [menu, setMenu] = useState(null) // { filas, movil, top|bottom, right }
  const boton = useRef(null)
  const caja = useRef(null)

  // Escritorio: cerrar el menú al tocar fuera, al hacer scroll o al cambiar el
  // tamaño (en el celular lo cierran el fondo oscuro o "Cancelar")
  useEffect(() => {
    if (!menu || menu.movil) return
    const fuera = e => { if (!caja.current?.contains(e.target) && !boton.current?.contains(e.target)) setMenu(null) }
    const cerrar = () => setMenu(null)
    document.addEventListener('mousedown', fuera)
    window.addEventListener('scroll', cerrar, true)
    window.addEventListener('resize', cerrar)
    return () => {
      document.removeEventListener('mousedown', fuera)
      window.removeEventListener('scroll', cerrar, true)
      window.removeEventListener('resize', cerrar)
    }
  }, [menu])

  async function correr(fn) {
    setMenu(null)
    setOcupado(true)
    try { await fn(); onListo?.() }
    catch (e) { onError?.('No se pudo generar el PDF: ' + (e?.message || e)) }
    finally { setOcupado(false) }
  }

  async function tocar() {
    if (menu) { setMenu(null); return }
    let filas = actas
    if (!filas && cargar) {
      setOcupado(true)
      try { filas = await cargar() }
      catch (e) { onError?.('No se pudieron cargar las actas: ' + (e?.message || e)); return }
      finally { setOcupado(false) }
    }
    if (!filas?.length) { onSinActas?.(); return }
    if (filas.length === 1) return correr(() => descargarActasPDF(filas, `${nombre}.pdf`))
    if (window.matchMedia('(max-width: 767px)').matches) { setMenu({ filas, movil: true }); return }
    const r = boton.current.getBoundingClientRect()
    const abajo = window.innerHeight - r.bottom > 200
    setMenu({ filas, right: Math.max(8, window.innerWidth - r.right), ...(abajo ? { top: r.bottom + 6 } : { bottom: window.innerHeight - r.top + 6 }) })
  }

  const opciones = menu && [
    actual && { Icono: FileText, color: 'text-[#D81B43]', titulo: 'Solo esta acta', detalle: actual.nombre,
      fn: () => descargarActasPDF([actual], `${nombre}_${nombreDeArchivo(actual.nombre)}.pdf`) },
    { Icono: FileStack, color: 'text-[#1B3A6B]', titulo: 'Todas en un PDF', detalle: `${menu.filas.length} actas en un solo archivo`,
      fn: () => descargarActasPDF(menu.filas, `${nombre}.pdf`) },
    { Icono: Files, color: 'text-[#1B3A6B]', titulo: 'Cada una por separado', detalle: `${menu.filas.length} archivos PDF`,
      fn: () => descargarActasSeparadas(menu.filas, nombre) },
  ].filter(Boolean)

  const lista = movil => opciones.map(({ Icono, color, titulo, detalle, fn }) => (
    <button key={titulo} type="button" role="menuitem" onClick={() => correr(fn)}
      className={`w-full flex items-center text-left text-slate-700 ${movil
        ? 'gap-3.5 px-4 py-3.5 rounded-xl border border-slate-200 active:bg-slate-50'
        : 'gap-3 px-3 py-2.5 rounded-[8px] hover:bg-slate-50'}`}>
      <span className={`${movil ? 'w-10 h-10' : 'w-8 h-8'} rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icono size={movil ? 18 : 15} />
      </span>
      <span className="min-w-0">
        <span className={`block font-semibold ${movil ? 'text-[15px]' : 'text-[13px]'}`}>{titulo}</span>
        <span className={`block text-slate-400 truncate ${movil ? 'text-[13px]' : 'text-[11.5px]'}`}>{detalle}</span>
      </span>
    </button>
  ))

  return (
    <>
      <button ref={boton} type="button" onClick={tocar} disabled={ocupado} className={className}
        aria-label={etiqueta} aria-haspopup="menu" aria-expanded={!!menu}>
        {children(ocupado)}
      </button>
      {menu && createPortal(menu.movil ? (
        <div className="fixed inset-0 z-[90] flex items-end" role="dialog" aria-modal="true" aria-label="Descargar actas">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMenu(null)} />
          <div ref={caja} role="menu" className="relative w-full bg-white rounded-t-2xl shadow-2xl px-4 pt-3"
            style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
            <div className="mx-auto w-10 h-1 rounded-full bg-slate-200 mb-3" />
            <div className="flex items-center mb-3">
              <div className="text-[16px] font-bold text-slate-800 flex-1">¿Cómo quieres descargar?</div>
              <button type="button" onClick={() => setMenu(null)} aria-label="Cerrar" className="w-9 h-9 -mr-2 flex items-center justify-center rounded-lg text-slate-400"><X size={18} /></button>
            </div>
            <div className="space-y-2">{lista(true)}</div>
            <button type="button" onClick={() => setMenu(null)} className="w-full h-11 mt-3 rounded-xl text-[14px] font-semibold text-slate-500">Cancelar</button>
          </div>
        </div>
      ) : (
        <div ref={caja} role="menu" className="fixed z-[90] w-[280px] bg-white rounded-xl border border-slate-200 shadow-xl p-1.5"
          style={{ top: menu.top, bottom: menu.bottom, right: menu.right }}>
          <div className="px-3 pt-1.5 pb-1 text-[10.5px] font-bold uppercase tracking-[0.1em] text-slate-400">Descargar</div>
          {lista(false)}
        </div>
      ), document.body)}
    </>
  )
}
