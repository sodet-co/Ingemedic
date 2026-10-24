'use client'
import { useState } from 'react'
import { HelpCircle, PlayCircle, BookOpen } from 'lucide-react'
import Modal from './Modal'
import { AYUDA } from '@/lib/ayuda'
import { TONOS } from '@/lib/ui'

// Botón "?" del encabezado: abre la guía corta del módulo (lib/ayuda.js).
export default function Ayuda({ modulo }) {
  const [abierta, setAbierta] = useState(false)
  const a = AYUDA[modulo]
  if (!a) return null
  return (
    <>
      <button type="button" onClick={() => setAbierta(true)} aria-label={`Ayuda de ${a.titulo}`} title="¿Cómo funciona?"
        className="w-9 h-9 flex items-center justify-center rounded-full text-slate-400 hover:text-[#1B3A6B] hover:bg-slate-100 transition-colors flex-shrink-0">
        <HelpCircle size={19} />
      </button>
      {abierta && (
        <Modal onCerrar={() => setAbierta(false)} titulo={a.titulo} subtitulo="Ayuda"
          icono={<HelpCircle size={18} />} tamano="lg"
          pie={<>
            <div className="mr-auto flex flex-wrap items-center gap-x-4 gap-y-1">
              <a href="/api/manual" download
                className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#1B3A6B] hover:underline">
                <BookOpen size={16} /> Manual completo (PDF)
              </a>
              {a.video && (
                <a href={a.video} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#1B3A6B] hover:underline">
                  <PlayCircle size={16} /> Ver video
                </a>
              )}
            </div>
            <button type="button" onClick={() => setAbierta(false)}
              className="inline-flex items-center justify-center h-[38px] px-4 rounded-[9px] bg-[#1B3A6B] text-white text-[13px] font-semibold hover:bg-[#152D54]">
              Entendido
            </button>
          </>}>
          <p className="text-[14px] text-slate-600 leading-relaxed">{a.resumen}</p>
          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
            {a.tareas.map(t => (
              <div key={t.titulo} className="rounded-xl border border-slate-200 p-4">
                <div className="text-[13.5px] font-bold text-slate-800 mb-2">{t.titulo}</div>
                <ol className="space-y-1.5">
                  {t.pasos.map((p, i) => (
                    <li key={i} className="flex gap-2 text-[13px] text-slate-600 leading-snug">
                      <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-px">{i + 1}</span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
          {a.estados && (
            <div className="mt-5">
              <div className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-slate-400 mb-2">Estados</div>
              <div className="space-y-1.5">
                {a.estados.map(([nombre, tono, desc]) => (
                  <div key={nombre} className="flex items-center gap-3 text-[13px]">
                    <span className={`px-2.5 py-0.5 rounded-full text-[11.5px] font-bold whitespace-nowrap ${TONOS[tono]?.pill}`}>{nombre}</span>
                    <span className="text-slate-500">{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Modal>
      )}
    </>
  )
}
