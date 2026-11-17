'use client'
import { useMemo, useState } from 'react'
import { Search, FileText, Eye, Settings2, Trash2, FileDown, ArrowUpRight, ArrowDownLeft, RefreshCw, ArrowLeftRight } from 'lucide-react'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { ui } from '@/lib/ui'
import { createClient } from '@/lib/supabase'
import { registrarBitacora } from '@/lib/bitacora'
import { ACCIONES, accionDe } from '@/lib/actas/acciones'
import { categoriasDe, esRenovable } from '@/lib/actas/contexto'
import { descargarWord } from '@/lib/actas/exportarWord'

// Lista de plantillas de actas (Configuración → Plantillas). Una fila por plantilla,
// con filtros por acción y por estado, para no tener que bajar por cuatro secciones.
//  - Activa / inactiva con el interruptor. Las inactivas no se ofrecen en préstamos
//    nuevos (todas las consultas filtran activo = true); conservan sus clientes, así
//    al reactivarlas vuelven como estaban.
//  - La de Ingemedic de una acción no se desactiva: es la que se usa cuando el
//    cliente no tiene una propia. Primero se marca otra como de Ingemedic.
//  - Word: descarga la plantilla escrita como la lee "Importar desde Word" ([Nombres]
//    entre corchetes); sirve de ejemplo y, editada, se vuelve a importar (lib/actas/exportarWord.js).
//  - Borrar: solo una inactiva y que nunca se haya usado (sin actas ni préstamos que
//    la nombren). Si ya se usó, se queda inactiva: las actas firmadas la referencian.
const ORDEN_ACCION = Object.keys(ACCIONES)
const ICONO_ACCION = { prestamo: ArrowUpRight, devolucion: ArrowDownLeft, recarga: RefreshCw, cambio: ArrowLeftRight }
const activa = p => p.activo !== false

function Interruptor({ encendido, onClick, etiqueta, bloqueado, titulo }) {
  return (
    <button type="button" role="switch" aria-checked={encendido} aria-label={etiqueta} aria-disabled={bloqueado || undefined}
      title={titulo} onClick={onClick}
      className={`w-10 h-6 rounded-full p-0.5 flex-shrink-0 transition-colors ${encendido ? 'bg-[#0F7B55]' : 'bg-slate-300'} ${bloqueado ? 'opacity-50 cursor-not-allowed' : ''}`}>
      <span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${encendido ? 'translate-x-4' : ''}`} />
    </button>
  )
}

// Quién la usa, en corto: los nombres completos quedan en el title
function QuienUsa({ p }) {
  const clientes = (p.clientes || []).map(c => c.cliente?.nombre).filter(Boolean)
  const pills = []
  if (p.es_estandar) pills.push(<span key="e" className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#1B3A6B]/10 text-[#1B3A6B]">De Ingemedic</span>)
  if (p.uso_general) pills.push(<span key="g" className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#0F7B55]/10 text-[#0F7B55]">Uso general</span>)
  if (clientes.length === 1) pills.push(<span key="c" className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 truncate max-w-[180px]">{clientes[0]}</span>)
  if (clientes.length > 1) pills.push(<span key="c" title={clientes.join(', ')} className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600">{clientes.length} clientes</span>)
  if (!pills.length) return <span className="text-[11.5px] text-slate-400">Sin cliente</span>
  return <span className="flex flex-wrap items-center gap-1">{pills}</span>
}

// Marcas de la plantilla (anexo, renovable, categorías)
function Marcas({ p }) {
  const cats = categoriasDe(p.bloques)
  if (p.tipo !== 'anexo' && !esRenovable(p.bloques) && !cats.length) return null
  return (
    <span className="flex flex-wrap items-center gap-1 mt-1">
      {p.tipo === 'anexo' && <span className="px-1.5 py-px rounded text-[10.5px] font-semibold bg-amber-50 text-amber-700">Anexo</span>}
      {esRenovable(p.bloques) && <span className="px-1.5 py-px rounded text-[10.5px] font-semibold bg-[#F5F3FF] text-[#6D28D9]">Renovable</span>}
      {cats.map(c => <span key={c.id || c.nombre} className="px-1.5 py-px rounded text-[10.5px] font-semibold bg-[#E8F7FB] text-[#0E7490]">{c.nombre}</span>)}
    </span>
  )
}

function Accion({ p }) {
  const a = accionDe(p)
  const Icono = ICONO_ACCION[a] || ArrowUpRight
  return <span className="inline-flex items-center gap-1.5 text-[12.5px] text-slate-600 whitespace-nowrap"><Icono size={13} className="text-slate-400" />{ACCIONES[a]}</span>
}

export default function ListaPlantillas({ plantillas, onCambiar, onToast, onConfigurar, onPrevisualizar }) {
  const supabase = useMemo(() => createClient(), [])
  const [buscar, setBuscar] = useState('')
  const [accion, setAccion] = useState('todas')
  const [estado, setEstado] = useState('activas')
  const [ocupado, setOcupado] = useState(null)        // id de la plantilla que se está guardando
  const [desactivando, setDesactivando] = useState(null)
  const [borrando, setBorrando] = useState(null)

  const q = buscar.trim().toLowerCase()
  const delEstado = plantillas.filter(p => estado === 'todas' || (estado === 'activas') === activa(p))
  const visibles = delEstado
    .filter(p => accion === 'todas' || accionDe(p) === accion)
    .filter(p => !q || `${p.nombre} ${p.descripcion || ''} ${(p.clientes || []).map(c => c.cliente?.nombre).join(' ')}`.toLowerCase().includes(q))
    .sort((a, b) => ORDEN_ACCION.indexOf(accionDe(a)) - ORDEN_ACCION.indexOf(accionDe(b))
      || Number(!!b.es_estandar) - Number(!!a.es_estandar) || a.nombre.localeCompare(b.nombre))
  const cuantas = a => delEstado.filter(p => a === 'todas' || accionDe(p) === a).length
  const nActivas = plantillas.filter(activa).length

  function alternar(p) {
    if (activa(p)) {
      if (p.es_estandar) { onToast(`Es la de Ingemedic para ${ACCIONES[accionDe(p)].toLowerCase()}. Marca otra como de Ingemedic antes de desactivarla.`, 'error'); return }
      setDesactivando(p)
    } else cambiarActivo(p, true)
  }

  async function cambiarActivo(p, activo) {
    setOcupado(p.id)
    const cambios = { activo }
    // Solo puede haber una de Ingemedic activa por acción (índice plantillas_acta_una_estandar)
    if (activo && p.es_estandar && plantillas.some(x => x.id !== p.id && activa(x) && x.es_estandar && accionDe(x) === accionDe(p))) cambios.es_estandar = false
    const { data, error } = await supabase.from('plantillas_acta').update(cambios).eq('id', p.id).select('id').maybeSingle()
    setOcupado(null); setDesactivando(null)
    if (error || !data) { onToast(error ? `No se pudo cambiar: ${error.message}` : 'No se pudo cambiar (sin permiso).', 'error'); return }
    onCambiar(l => l.map(x => x.id === p.id ? { ...x, ...cambios } : x))
    registrarBitacora({ modulo: 'configuracion', accion: activo ? 'activar' : 'desactivar', entidad: 'plantilla de acta', entidad_id: p.id, detalle: { nombre: p.nombre } })
    onToast(activo ? 'Plantilla activada' : 'Plantilla desactivada')
  }

  async function bajarWord(p) {
    setOcupado(p.id)
    try { await descargarWord(p) } catch (e) { onToast('No se pudo crear el Word: ' + (e.message || e), 'error') }
    setOcupado(null)
  }

  // Antes de ofrecer el borrado se mira si ya se usó
  async function pedirBorrar(p) {
    setOcupado(p.id)
    const [actas, ordenes] = await Promise.all([
      supabase.from('actas').select('id', { count: 'exact', head: true }).eq('plantilla_id', p.id),
      supabase.from('ordenes_servicio').select('id', { count: 'exact', head: true }).contains('plantillas_acta', [p.id]),
    ])
    setOcupado(null)
    if (actas.error || ordenes.error) { onToast('No se pudo revisar si la plantilla ya se usó.', 'error'); return }
    const usos = (actas.count || 0) + (ordenes.count || 0)
    if (usos) { onToast('Ya se usó en préstamos o actas: se queda inactiva, no se puede borrar.', 'error'); return }
    setBorrando(p)
  }

  async function borrar() {
    const p = borrando
    setOcupado(p.id)
    const { error: e1 } = await supabase.from('cliente_plantillas_acta').delete().eq('plantilla_id', p.id)
    const { data, error } = e1 ? { error: e1 } : await supabase.from('plantillas_acta').delete().eq('id', p.id).select('id')
    setOcupado(null); setBorrando(null)
    if (error || !data?.length) { onToast(error ? `No se borró: ${error.message}` : 'No se borró (sin permiso).', 'error'); return }
    onCambiar(l => l.filter(x => x.id !== p.id))
    registrarBitacora({ modulo: 'configuracion', accion: 'eliminar', entidad: 'plantilla de acta', entidad_id: p.id, detalle: { nombre: p.nombre } })
    onToast('Plantilla borrada')
  }

  const chip = on => `${ui.chip} ${on ? ui.chipActivo : ui.chipInactivo}`
  const botones = p => (
    <>
      <button onClick={() => onPrevisualizar(p)} className={ui.btnIcono} title="Previsualizar" aria-label={`Previsualizar ${p.nombre}`}><Eye size={15} /></button>
      <button onClick={() => bajarWord(p)} disabled={ocupado === p.id} className={ui.btnIcono} title="Descargar en Word" aria-label={`Descargar ${p.nombre} en Word`}><FileDown size={15} /></button>
      <button onClick={() => onConfigurar(p)} className={ui.btnIcono} title="Configuración" aria-label={`Configuración de ${p.nombre}`}><Settings2 size={15} /></button>
      {!activa(p) && (
        <button onClick={() => pedirBorrar(p)} disabled={ocupado === p.id} className={`${ui.btnIcono} hover:!text-[#D81B43] hover:!bg-red-50`} title="Borrar" aria-label={`Borrar ${p.nombre}`}><Trash2 size={15} /></button>
      )}
    </>
  )
  const interruptor = p => (
    <Interruptor encendido={activa(p)} onClick={() => ocupado !== p.id && alternar(p)} etiqueta={`Plantilla ${p.nombre} activa`}
      bloqueado={activa(p) && p.es_estandar} titulo={activa(p) && p.es_estandar ? 'La de Ingemedic no se desactiva' : activa(p) ? 'Desactivar' : 'Activar'} />
  )

  return (
    <div>
      {/* Filtros */}
      <div className="flex flex-col md:flex-row md:items-center gap-2.5 mb-3">
        <div className="relative md:w-[280px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={buscar} onChange={e => setBuscar(e.target.value)} placeholder="Buscar plantilla o cliente…" className={`${ui.input} pl-9`} />
        </div>
        <div className="inline-flex self-start p-0.5 rounded-[9px] bg-slate-100 md:ml-auto md:order-last">
          {[['activas', `Activas ${nActivas}`], ['inactivas', `Inactivas ${plantillas.length - nActivas}`], ['todas', 'Todas']].map(([v, l]) => (
            <button key={v} onClick={() => setEstado(v)} aria-pressed={estado === v}
              className={`px-3 h-8 rounded-[7px] text-[12.5px] font-semibold transition-colors ${estado === v ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{l}</button>
          ))}
        </div>
        <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-0.5">
          {[['todas', 'Todas'], ...Object.entries(ACCIONES)].map(([v, l]) => (
            <button key={v} onClick={() => setAccion(v)} aria-pressed={accion === v} className={chip(accion === v)}>{l} <span className="opacity-70">{cuantas(v)}</span></button>
          ))}
        </div>
      </div>

      {visibles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 text-center py-8 text-[12.5px] text-slate-400">
          {q ? 'Ninguna plantilla coincide.' : estado === 'inactivas' ? 'No hay plantillas inactivas.' : 'No hay plantillas aquí.'}
        </div>
      ) : (<>
        {/* PC: tabla */}
        <div className={`${ui.tarjeta} hidden md:block overflow-hidden`}>
          <table className="w-full">
            <thead>
              <tr>
                <th className={ui.th}>Plantilla</th>
                <th className={ui.th}>Acción</th>
                <th className={ui.th}>Quién la usa</th>
                <th className={`${ui.th} text-center w-[80px]`}>Activa</th>
                <th className={`${ui.th} w-[150px]`}><span className="sr-only">Opciones</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibles.map(p => (
                <tr key={p.id} className={`${activa(p) ? '' : 'bg-slate-50/60'} ${ocupado === p.id ? 'opacity-60' : ''}`}>
                  <td className="px-4 py-2.5 max-w-0 w-[45%]">
                    <div className="flex items-start gap-2.5">
                      <FileText size={15} className={`mt-0.5 flex-shrink-0 ${activa(p) ? 'text-[#D81B43]' : 'text-slate-300'}`} />
                      <div className="min-w-0">
                        <div className={`text-[13px] font-semibold truncate ${activa(p) ? 'text-slate-700' : 'text-slate-400'}`} title={p.nombre}>{p.nombre}</div>
                        {p.descripcion && <div className="text-[11.5px] text-slate-400 truncate" title={p.descripcion}>{p.descripcion}</div>}
                        <Marcas p={p} />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5"><Accion p={p} /></td>
                  <td className="px-4 py-2.5"><QuienUsa p={p} /></td>
                  <td className="px-4 py-2.5"><div className="flex justify-center">{interruptor(p)}</div></td>
                  <td className="px-3 py-2.5"><div className="flex justify-end gap-0.5">{botones(p)}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Celular: tarjetas */}
        <div className="md:hidden space-y-2">
          {visibles.map(p => (
            <div key={p.id} className={`${ui.tarjeta} px-3.5 py-3 ${activa(p) ? '' : 'bg-slate-50'} ${ocupado === p.id ? 'opacity-60' : ''}`}>
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className={`text-[13.5px] font-semibold ${activa(p) ? 'text-slate-700' : 'text-slate-400'}`}>{p.nombre}</div>
                  <Marcas p={p} />
                </div>
                {interruptor(p)}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Accion p={p} />
                <span className="text-slate-300">·</span>
                <div className="flex-1 min-w-0"><QuienUsa p={p} /></div>
                <div className="flex -mr-1.5">{botones(p)}</div>
              </div>
            </div>
          ))}
        </div>
      </>)}

      <ConfirmDialog abierto={!!desactivando} titulo="¿Desactivar esta plantilla?"
        mensaje="Deja de ofrecerse en los préstamos nuevos. Las actas firmadas no cambian y la puedes volver a activar."
        textoConfirmar="Desactivar" tipo="peligro" onConfirmar={() => cambiarActivo(desactivando, false)} onCancelar={() => setDesactivando(null)} />
      <ConfirmDialog abierto={!!borrando} titulo="¿Borrar esta plantilla?" mensaje="Nunca se usó. Se borra del todo y no se puede deshacer."
        textoConfirmar="Borrar" tipo="peligro" onConfirmar={borrar} onCancelar={() => setBorrando(null)} />
    </div>
  )
}
