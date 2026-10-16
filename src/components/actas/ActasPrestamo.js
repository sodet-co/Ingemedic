'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileText, Download, Loader2, PenLine } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { formatear } from '@/lib/fechas'
import { descargarActasPDF } from '@/lib/actas/pdf'
import FirmaActas from '@/components/actas/FirmaActas'

// Actas firmadas de un préstamo (detalle de Préstamos / Entregas): las lista, las
// descarga en un solo PDF y, si `puedeFirmar` y aún no hay ninguna, abre el paso
// de firma (préstamos en oficina que no se firmaron al crearlos, o préstamos viejos).
export default function ActasPrestamo({ ordenId, ordenCodigo, puedeFirmar = false, onToast }) {
  const supabase = useMemo(() => createClient(), [])
  const [actas, setActas] = useState(null)
  const [descargando, setDescargando] = useState(false)
  const [firmando, setFirmando] = useState(false)

  const cargar = useCallback(() => {
    supabase.from('actas')
      .select('id, nombre, fecha_firma, bloques, datos, firma_recibe, firma_entrega')
      .eq('orden_id', ordenId).order('fecha_firma')
      .then(({ data }) => setActas(data || []))
  }, [supabase, ordenId])

  useEffect(() => { cargar() }, [cargar])

  async function descargar() {
    setDescargando(true)
    try { await descargarActasPDF(actas, `Actas_${ordenCodigo || 'prestamo'}.pdf`) }
    catch (e) { onToast?.('No se pudo generar el PDF: ' + e.message, 'error') }
    finally { setDescargando(false) }
  }

  if (actas === null) return <div className="flex items-center gap-2 text-[12.5px] text-slate-400"><Loader2 size={13} className="animate-spin" /> Cargando actas…</div>

  return (
    <div>
      {actas.length === 0 ? (
        <div className="text-[12.5px] text-slate-400">Sin actas firmadas.</div>
      ) : (
        <div className="space-y-1.5">
          {actas.map(a => (
            <div key={a.id} className="flex items-center gap-2 text-[13px] text-slate-700">
              <FileText size={13} className="text-[#D81B43] flex-shrink-0" />
              <span className="flex-1 min-w-0 truncate">{a.nombre}</span>
              <span className="text-[11px] text-slate-400 flex-shrink-0">{formatear(a.fecha_firma, { year: undefined })}</span>
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2 mt-3">
        {actas.length > 0 && (
          <button onClick={descargar} disabled={descargando}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#1B3A6B] text-white rounded-[8px] text-[12.5px] font-semibold hover:bg-[#152d55] disabled:opacity-60">
            {descargando ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
            {descargando ? 'Generando PDF…' : 'Descargar actas (PDF)'}
          </button>
        )}
        {puedeFirmar && actas.length === 0 && (
          <button onClick={() => setFirmando(true)}
            className="flex items-center gap-1.5 px-3 py-2 border border-[#D81B43] text-[#D81B43] rounded-[8px] text-[12.5px] font-semibold hover:bg-red-50">
            <PenLine size={13} /> Firmar acta
          </button>
        )}
      </div>
      {firmando && (
        <FirmaActas ordenId={ordenId} onCancelar={() => setFirmando(false)}
          onHecho={() => { setFirmando(false); onToast?.('Acta firmada'); cargar() }} />
      )}
    </div>
  )
}
