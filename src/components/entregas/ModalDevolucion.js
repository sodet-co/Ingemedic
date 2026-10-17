'use client'
import { ArrowDownLeft } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import { ui } from '@/lib/ui'

// Fecha + observaciones para marcar un equipo como devuelto. Compartido entre
// Préstamos (OrdenesClient) y los detalles de Cliente/Paciente (ClientesClient).
// z-75: por encima de cualquier ventana desde la que se abra (detalle z-50,
// pop-up de atención del dashboard z-65).
export default function ModalDevolucion({ abierto, form, onChangeFecha, onChangeObservaciones, onConfirmar, onCancelar }) {
  if (!abierto) return null

  return (
    <Modal onCerrar={onCancelar} titulo="Marcar como devuelto" subtitulo="El equipo vuelve a quedar disponible"
      icono={<ArrowDownLeft size={17} />} tamano="sm" z="z-[75]"
      pie={<>
        <button type="button" onClick={onCancelar} className={ui.btnSecundario}>Cancelar</button>
        <button type="button" disabled={!form.fecha} onClick={onConfirmar} className={ui.btnPrimario}>Confirmar devolución</button>
      </>}>
      <div className="space-y-4">
        <div>
          <label className={ui.label}>Fecha de devolución <span className="text-[#D81B43]">*</span></label>
          <input type="date" value={form.fecha} onChange={e => onChangeFecha(e.target.value)} className={ui.input} />
        </div>
        <div>
          <label className={ui.label}>Observaciones <span className="text-slate-300 font-normal normal-case">(opcional)</span></label>
          <textarea value={form.observaciones} onChange={e => onChangeObservaciones(e.target.value)}
            placeholder="Estado del equipo, novedades, etc." rows={3} className={`${ui.input} resize-none`} />
        </div>
      </div>
    </Modal>
  )
}
