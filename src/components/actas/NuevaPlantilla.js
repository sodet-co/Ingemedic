'use client'
import { useMemo, useState } from 'react'
import { FileUp, FilePlus2, Copy, Loader2, ChevronDown, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { importarWord } from '@/lib/actas/importarWord'
import { subirImagenesImportadas } from '@/lib/actas/imagenesPlantilla'
import { NOMBRES, NOMBRE_FIRMA } from '@/lib/actas/nombres'
import { RECUADRO_INICIAL } from '@/components/actas/EditorPlantilla'
import Modal from '@/components/ui/Modal'
import { ui } from '@/lib/ui'
import { ACCIONES } from '@/lib/actas/acciones'

// Punto de partida de una plantilla nueva: un Word, una copia o en blanco.
// Devuelve { inicial: { nombre, descripcion, bloques }, avisos } para el editor.
export default function NuevaPlantilla({ plantillas, onCerrar, onListo }) {
  const supabase = useMemo(() => createClient(), [])
  const [leyendo, setLeyendo] = useState(false)
  const [error, setError] = useState(null)
  const [copiaDe, setCopiaDe] = useState('')
  const [verNombres, setVerNombres] = useState(false)
  const [copiado, setCopiado] = useState(null)
  // Para qué acción es: se elige antes de empezar (en el editor se puede cambiar)
  const [accion, setAccion] = useState('prestamo')
  const listo = r => onListo({ ...r, inicial: { ...r.inicial, accion } })

  async function desdeWord(archivo) {
    if (!/\.docx$/i.test(archivo.name)) { setError('Sube un archivo .docx (en Word: Archivo → Guardar como → Documento de Word).'); return }
    setLeyendo(true); setError(null)
    try {
      const { bloques, imagenes, avisos } = await importarWord(archivo)
      if (!bloques.length) throw new Error('El documento está vacío')
      const conUrls = await subirImagenesImportadas(supabase, bloques, imagenes)
      listo({ inicial: { nombre: archivo.name.replace(/\.docx$/i, ''), bloques: conUrls }, avisos })
    } catch (e) {
      setError('No se pudo leer el Word: ' + (e.message || e))
      setLeyendo(false)
    }
  }

  function copiar(nombre) {
    navigator.clipboard?.writeText(`[${nombre}]`).then(() => { setCopiado(nombre); setTimeout(() => setCopiado(null), 1200) }).catch(() => {})
  }

  const opcion = 'w-full flex items-start gap-3 p-4 rounded-xl border border-slate-200 text-left hover:border-[#1B3A6B]/40 hover:bg-slate-50 transition-colors'
  return (
    <Modal onCerrar={onCerrar} bloqueado={leyendo} titulo="Nueva plantilla" tamano="md">
      <div className="space-y-3">
        <div>
          <div className="text-[12px] font-semibold text-slate-600 mb-1.5">¿Para qué es?</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {Object.entries(ACCIONES).map(([a, l]) => (
              <button key={a} type="button" onClick={() => setAccion(a)} aria-pressed={accion === a}
                className={`px-2 py-2 rounded-[9px] border text-[12.5px] font-semibold transition-colors ${accion === a ? 'bg-[#1B3A6B] border-[#1B3A6B] text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}>{l}</button>
            ))}
          </div>
        </div>
        <label className={`${opcion} cursor-pointer ${leyendo ? 'pointer-events-none opacity-60' : ''}`}>
          <span className="w-9 h-9 rounded-[9px] bg-[#1B3A6B]/10 text-[#1B3A6B] flex items-center justify-center flex-shrink-0">
            {leyendo ? <Loader2 size={17} className="animate-spin" /> : <FileUp size={17} />}
          </span>
          <span className="min-w-0">
            <span className="block text-[14px] font-semibold text-slate-800">{leyendo ? 'Leyendo el Word…' : 'Importar desde Word'}</span>
            <span className="block text-[12.5px] text-slate-500 mt-0.5">Escribe los datos entre corchetes, p. ej. [Nombre del paciente]. Después lo ajustas en el editor.</span>
          </span>
          <input type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden"
            onChange={e => { const f = e.target.files[0]; e.target.value = ''; if (f) desdeWord(f) }} />
        </label>

        <div className={opcion}>
          <span className="w-9 h-9 rounded-[9px] bg-[#1B3A6B]/10 text-[#1B3A6B] flex items-center justify-center flex-shrink-0"><Copy size={17} /></span>
          <span className="flex-1 min-w-0">
            <span className="block text-[14px] font-semibold text-slate-800">Copiar una existente</span>
            <span className="flex gap-2 mt-2">
              <select value={copiaDe} onChange={e => setCopiaDe(e.target.value)} className={`${ui.input} flex-1 min-w-0`}>
                <option value="">Elige una plantilla…</option>
                {plantillas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
              <button type="button" disabled={!copiaDe} className={ui.btnAzul} onClick={() => {
                const p = plantillas.find(x => x.id === copiaDe)
                listo({ inicial: { nombre: `${p.nombre} (copia)`, descripcion: p.descripcion, bloques: structuredClone(p.bloques) } })
              }}>Copiar</button>
            </span>
          </span>
        </div>

        <button type="button" onClick={() => listo({ inicial: { nombre: '', bloques: [{ tipo: 'encabezado', logos: [], ancho_logo: 22, centro: [{ texto: 'TÍTULO DEL FORMATO', estilo: 'titulo' }], derecha: RECUADRO_INICIAL() }] } })} className={opcion}>
          <span className="w-9 h-9 rounded-[9px] bg-[#1B3A6B]/10 text-[#1B3A6B] flex items-center justify-center flex-shrink-0"><FilePlus2 size={17} /></span>
          <span>
            <span className="block text-[14px] font-semibold text-slate-800">En blanco</span>
            <span className="block text-[12.5px] text-slate-500 mt-0.5">Armarla por bloques en el editor.</span>
          </span>
        </button>

        {error && <div className="px-3 py-2.5 rounded-[10px] bg-red-50 border border-red-200 text-[12.5px] text-red-700">{error}</div>}

        {/* Nombres de los datos para escribir en el Word */}
        <div className="pt-1">
          <button type="button" onClick={() => setVerNombres(v => !v)} className="flex items-center gap-1.5 text-[12.5px] font-semibold text-slate-600">
            <ChevronDown size={14} className={`transition-transform ${verNombres ? 'rotate-180' : ''}`} /> Nombres de los datos
          </button>
          {verNombres && (
            <div className="mt-3 space-y-3 text-[12.5px]">
              <p className="text-slate-500">Toca uno para copiarlo. Si escribes un nombre que no está aquí, se pide al crear el préstamo.</p>
              {[...Object.entries(NOMBRES).map(([g, v]) => [g, Object.values(v)]),
                ['Tablas y firmas', ['Equipos', 'Insumos', 'Equipos e insumos', ...Object.values(NOMBRE_FIRMA)]]].map(([g, lista]) => (
                <div key={g}>
                  <div className={`${ui.tituloSeccion} mb-1.5`}>{g}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {lista.map(n => (
                      <button key={n} type="button" onClick={() => copiar(n)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-[7px] bg-slate-100 text-slate-700 hover:bg-[#1B3A6B]/10 font-mono text-[11.5px]">
                        {copiado === n && <Check size={11} className="text-[#0F7B55]" />}[{n}]
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <p className="text-slate-400">[Equipos] o [Insumos] dentro de una tabla de Word la convierte en la lista del préstamo.</p>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
