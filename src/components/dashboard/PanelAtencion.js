'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useUsuarioActual } from '@/lib/usuario-context'
import { REGLAS_ATENCION, clavePospuesto } from '@/lib/atencion'
import { diasParaVencer } from '@/lib/vigencia'
import { devolverEquipo as devolverEquipoLib } from '@/lib/prestamos'
import { registrarBitacora } from '@/lib/bitacora'
import { hoyBogota, sumarDias, formatearSoloFecha, paraGuardar } from '@/lib/fechas'
import ModalDevolucion from '@/components/entregas/ModalDevolucion'
import { AlertTriangle, Clock, ChevronRight, CheckCircle2, Calendar, Timer, X } from 'lucide-react'

// A partir de este número de ítems, la regla se colapsa a una sola línea
// con el conteo — pintar uno por uno deja de ser navegable y el detalle
// ni se trae de la BD (ver el limite en el fetch más abajo).
const UMBRAL_ITEMIZAR = 5
// A partir de este número de equipos pendientes EN UNA orden, se cambia el
// chip por equipo por un solo botón "marcar todos" — cuatro o más chips
// empiezan a competir con las acciones de la tarjeta por espacio y atención.
const UMBRAL_RECOGER_INDIVIDUAL = 3
const DIAS_POSPONER = [3, 7, 30]

const ESTILO_SEVERIDAD = {
  alta:  { bg: '#FEF2F2', borde: '#D81B43', texto: '#D81B43', icono: AlertTriangle },
  media: { bg: '#FFFBEB', borde: '#F59E0B', texto: '#B45309', icono: Clock },
}

function nombreEquipo(eq) {
  return eq?.tipo_equipo?.atributos?.nombre || eq?.tipo_equipo?.nombre || '—'
}

// Pop-up de atención — se abre solo una vez por sesión al entrar al
// dashboard (lo decide DashboardClient, que sabe si ya se cerró y si hay
// algo que mostrar) y arma sus tarjetas a partir de REGLAS_ATENCION
// (src/lib/atencion.js). El dashboard (server) solo le pasa el conteo de
// cada regla; el detalle (cliente, paciente, equipo) se trae acá, en el
// navegador, y solo para las reglas con pocos ítems — así una regla con
// 40 préstamos vencidos no le carga 40 filas al dashboard, solo un link
// a Préstamos ya filtrado.
export default function PanelAtencion({ reglas, abierto, onCerrar }) {
  const router = useRouter()
  const supabase = createClient()
  const { usuario } = useUsuarioActual()

  const [detalles, setDetalles]               = useState({})
  const [modalDevolucion, setModalDevolucion]  = useState(null)
  const [formDevolucion, setFormDevolucion]    = useState({ fecha: '', observaciones: '' })
  const [accionAbierta, setAccionAbierta]      = useState(null) // "<ordenId>:extender" | "<ordenId>:posponer"
  const [nuevaFecha, setNuevaFecha]            = useState('')
  const [guardando, setGuardando]              = useState(false)

  // El conteo real, mientras haya detalle local cargado, es el tamaño de
  // esa lista — no el de `reglas` (prop del servidor, que solo se pone al
  // día cuando aterriza el router.refresh() de la acción). Así, quitar un
  // ítem localmente (ver quitarItemLocal) oculta la tarjeta al instante en
  // vez de dejarla con la cabecera puesta y cero ítems debajo hasta que
  // vuelva el refresh.
  const reglasConItems = (reglas || [])
    .map(r => ({ ...r, count: Array.isArray(detalles[r.id]) ? detalles[r.id].length : r.count }))
    .filter(r => r.count > 0)

  // Cuando cambia el conteo que manda el servidor (aterrizó un
  // router.refresh()), se descarta el detalle local en caché para que se
  // vuelva a traer fresco — si no, un ítem nuevo que haya entrado a la
  // regla se quedaría sin mostrarse porque el caché local ya "existía".
  const firmaConteos = (reglas || []).map(r => `${r.id}:${r.count}`).join(',')
  useEffect(() => {
    // Adopta el conteo fresco que trajo el server al montar/refrescar —
    // no sincroniza un valor en curso, así que no aplica el patrón de
    // suscripción que pide la regla del proyecto.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDetalles({})
  }, [firmaConteos])

  const idsPendientesDetalle = (reglas || [])
    .filter(r => r.count > 0 && r.count <= UMBRAL_ITEMIZAR)
    .map(r => r.id)
    .filter(id => !detalles[id])
    .join(',')

  useEffect(() => {
    if (!idsPendientesDetalle) return
    idsPendientesDetalle.split(',').forEach(id => {
      const regla = REGLAS_ATENCION.find(r => r.id === id)
      if (!regla) return
      regla.consulta(supabase, { limite: UMBRAL_ITEMIZAR }).then(items => {
        setDetalles(d => ({ ...d, [id]: items }))
      })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsPendientesDetalle])

  if (!abierto || reglasConItems.length === 0) return null

  function quitarItemLocal(reglaId, ordenId) {
    setDetalles(d => ({ ...d, [reglaId]: (d[reglaId] || []).filter(o => o.id !== ordenId) }))
  }

  function abrirRecoger(orden, oe) {
    setModalDevolucion({ ordenId: orden.id, reglaId: orden._reglaId, ordenEquipoId: oe.id, equipoId: oe.equipo_id || oe.equipo?.id })
    setFormDevolucion({ fecha: hoyBogota(), observaciones: '' })
  }

  async function confirmarRecoger() {
    const { ordenId, reglaId, ordenEquipoId, equipoId } = modalDevolucion
    setGuardando(true)
    const { error } = await devolverEquipoLib({
      supabase, ordenEquipoId, equipoId, ordenId,
      fechaDevolucion: formDevolucion.fecha, observaciones: formDevolucion.observaciones,
    })
    setGuardando(false)
    setModalDevolucion(null)
    if (error) return
    quitarItemLocal(reglaId, ordenId)
    router.refresh()
  }

  // Para órdenes con muchos equipos pendientes (ver UMBRAL_RECOGER_INDIVIDUAL):
  // un solo botón que los marca todos devueltos hoy, sin observaciones —
  // para anotar algo puntual por equipo sigue estando el flujo normal de
  // Préstamos, esto es el atajo rápido desde el panel.
  async function recogerTodos(reglaId, orden, pendientes) {
    setGuardando(true)
    for (const oe of pendientes) {
      await devolverEquipoLib({
        supabase, ordenEquipoId: oe.id, equipoId: oe.equipo_id || oe.equipo?.id, ordenId: orden.id,
        fechaDevolucion: hoyBogota(), observaciones: null,
      })
    }
    setGuardando(false)
    quitarItemLocal(reglaId, orden.id)
    router.refresh()
  }

  async function extender(reglaId, orden) {
    if (!nuevaFecha) return
    setGuardando(true)
    const { error } = await supabase.from('ordenes_servicio')
      .update({ fecha_vigencia: nuevaFecha }).eq('id', orden.id)
    if (!error) {
      await registrarBitacora({
        modulo: 'ordenes', accion: 'editar', entidad: 'orden de servicio', entidad_id: orden.id,
        detalle: {
          estado_actual: orden.estado?.nombre || null,
          fecha_vigencia_anterior: orden.fecha_vigencia,
          fecha_vigencia_nueva: nuevaFecha,
          observacion: `Vigencia extendida hasta ${formatearSoloFecha(nuevaFecha)}`,
        },
      })
    }
    setGuardando(false)
    if (error) return
    setAccionAbierta(null)
    setNuevaFecha('')
    quitarItemLocal(reglaId, orden.id)
    router.refresh()
  }

  async function posponer(reglaId, orden, dias) {
    const clave = clavePospuesto(reglaId, orden.id)
    // Se pospone a nivel de día (hasta el inicio del día N, hora Bogotá),
    // no a la hora exacta del click — mismo grano que el resto de vigencia
    // en todo este feature, y evita depender de Date.now()/new Date() acá
    // (el linter del proyecto los trata como impuros dentro de un componente).
    const hasta = paraGuardar(sumarDias(hoyBogota(), dias))
    setGuardando(true)
    const { error } = await supabase.from('atencion_pospuestas')
      .upsert({ clave, hasta, usuario_id: usuario?.id || null }, { onConflict: 'clave' })
    setGuardando(false)
    if (error) return
    setAccionAbierta(null)
    quitarItemLocal(reglaId, orden.id)
    router.refresh()
  }

  return (
    <>
      {/* Sin backdrop-blur: el mapa de Leaflet (abajo, en el dashboard) usa
          capas con transform3d para el paneo, que el navegador compone en su
          propia capa GPU — un backdrop-filter no la "ve" y el mapa queda
          nítido y sin oscurecer encima del fondo del pop-up. Un tinte sólido
          más oscuro evita el problema sin depender de backdrop-filter. */}
      <div className="fixed inset-0 bg-black/55 z-[65]" onClick={onCerrar} />
      <div className="fixed inset-x-0 bottom-0 md:inset-0 z-[65] flex md:items-center justify-center md:p-4">
        <div className="bg-white rounded-t-2xl md:rounded-2xl w-full md:max-w-[760px] max-h-[90vh] md:max-h-[85vh] shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
            <div>
              <div className="text-[15px] font-bold text-slate-800">Esto requiere tu atención</div>
              <div className="text-[11.5px] text-slate-400 mt-0.5">Acciones rápidas antes de seguir</div>
            </div>
            <button type="button" onClick={onCerrar} title="Cerrar"
              className="text-slate-400 hover:text-slate-600 p-1 -m-1 flex-shrink-0">
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {reglasConItems.map(r => {
          const estilo = ESTILO_SEVERIDAD[r.severidad] || ESTILO_SEVERIDAD.media
          const Icono = estilo.icono
          const items = detalles[r.id]
          const itemizar = r.count <= UMBRAL_ITEMIZAR && Array.isArray(items)
          // Navegación completa (no router.push): más robusto — nunca depende
          // de que el filtro (leído al montar en OrdenesClient) coincida con
          // una transición client-side en curso.
          const verEnPrestamos = () => { window.location.href = `/admin/ordenes?atencion=${r.id}` }

          return (
            <div key={r.id} className="rounded-xl border shadow-sm overflow-hidden bg-white" style={{ borderColor: estilo.borde + '40' }}>
              <button type="button" onClick={verEnPrestamos}
                className="w-full px-4 py-3 flex items-center gap-2 hover:opacity-90 transition-opacity" style={{ background: estilo.bg }}>
                <Icono size={15} style={{ color: estilo.texto }} />
                <div className="text-[13px] font-bold text-slate-800">{r.titulo}</div>
                <span className="text-[11px] font-bold text-white px-2 py-0.5 rounded-full ml-auto" style={{ background: estilo.texto }}>
                  {r.count}
                </span>
                <ChevronRight size={14} className="flex-shrink-0" style={{ color: estilo.texto }} />
              </button>

              {!itemizar ? (
                <button onClick={verEnPrestamos}
                  className="w-full flex items-center justify-between gap-2 px-4 py-3 hover:bg-slate-50 text-left transition-colors">
                  <span className="text-[12.5px] text-slate-600">
                    {r.count} préstamo{r.count !== 1 ? 's' : ''} — ver en Préstamos
                  </span>
                  <ChevronRight size={14} className="text-slate-400 flex-shrink-0" />
                </button>
              ) : (
                // Con más de un préstamo, grilla de 2 columnas en pantallas
                // anchas — apilar todo en una sola columna angosta era lo que
                // hacía sentir la ventana chica y apretada.
                <div className={`p-3 gap-3 ${items.length > 1 ? 'grid grid-cols-1 md:grid-cols-2' : 'grid grid-cols-1'}`}>
                  {items.map(orden => {
                    const pendientes = (orden.equipos || []).filter(oe => !oe.fecha_devolucion)
                    const dias = diasParaVencer(orden)
                    const etiquetaDias = dias === null ? '' : dias < 0 ? `Venció hace ${Math.abs(dias)}d` : dias === 0 ? 'Vence hoy' : `Vence en ${dias}d`
                    const claveAccion = `${orden.id}`

                    return (
                      <div key={orden.id} className="p-3 border border-slate-100 rounded-lg" data-testid={`atencion-item-${orden.id}`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[12px] font-bold text-slate-700">{orden.codigo}</span>
                          <span className="text-[11px] font-semibold" style={{ color: estilo.texto }}>{etiquetaDias}</span>
                        </div>
                        <div className="text-[12.5px] text-slate-600 mt-0.5 truncate">
                          {orden.cliente?.nombre}
                          {orden.paciente?.nombre && <span className="text-slate-400"> · {orden.paciente.nombre}</span>}
                        </div>

                        {pendientes.length > 0 && (
                          pendientes.length > UMBRAL_RECOGER_INDIVIDUAL ? (
                            <div className="mt-2">
                              <button type="button" disabled={guardando}
                                onClick={() => recogerTodos(r.id, orden, pendientes)}
                                className="inline-flex items-center gap-1 text-[11px] font-medium text-[#0F7B55] bg-[#ECFDF5] border border-[#0F7B55]/30 rounded-full px-2.5 py-1 hover:bg-[#D1FAE5] transition-colors disabled:opacity-50">
                                <CheckCircle2 size={11} />
                                Marcar los {pendientes.length} equipos como devueltos
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {pendientes.map(oe => (
                                <button key={oe.id} type="button"
                                  onClick={() => abrirRecoger({ ...orden, _reglaId: r.id }, oe)}
                                  className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-full px-2 py-1 hover:border-[#0F7B55] hover:text-[#0F7B55] transition-colors">
                                  <CheckCircle2 size={11} />
                                  {nombreEquipo(oe.equipo)} · {oe.equipo?.codigo}
                                </button>
                              ))}
                            </div>
                          )
                        )}

                        <div className="flex items-center gap-3 mt-2.5">
                          <button type="button"
                            onClick={() => { setAccionAbierta(a => a === `${claveAccion}:extender` ? null : `${claveAccion}:extender`); setNuevaFecha(sumarDias(hoyBogota(), 30)) }}
                            className="flex items-center gap-1 text-[11.5px] font-semibold text-[#1B3A6B] hover:underline">
                            <Calendar size={12} /> Extender
                          </button>
                          <button type="button"
                            onClick={() => setAccionAbierta(a => a === `${claveAccion}:posponer` ? null : `${claveAccion}:posponer`)}
                            className="flex items-center gap-1 text-[11.5px] font-semibold text-slate-500 hover:underline">
                            <Timer size={12} /> Posponer
                          </button>
                        </div>

                        {accionAbierta === `${claveAccion}:extender` && (
                          <div className="flex items-center gap-2 mt-2 bg-slate-50 border border-slate-200 rounded-[9px] p-2">
                            <input type="date" value={nuevaFecha} onChange={e => setNuevaFecha(e.target.value)}
                              className="flex-1 px-2 py-1.5 border border-slate-200 rounded-[7px] text-[12px] outline-none focus:border-[#D81B43] bg-white" />
                            <button type="button" disabled={guardando} onClick={() => extender(r.id, orden)}
                              className="px-3 py-1.5 bg-[#D81B43] text-white rounded-[7px] text-[11.5px] font-semibold hover:bg-[#B0172F] disabled:opacity-50">
                              Guardar
                            </button>
                          </div>
                        )}

                        {accionAbierta === `${claveAccion}:posponer` && (
                          <div className="flex items-center gap-1.5 mt-2 bg-slate-50 border border-slate-200 rounded-[9px] p-2">
                            {DIAS_POSPONER.map(d => (
                              <button key={d} type="button" disabled={guardando} onClick={() => posponer(r.id, orden, d)}
                                className="flex-1 py-1.5 bg-white border border-slate-200 rounded-[7px] text-[11.5px] font-medium text-slate-600 hover:border-[#D81B43] hover:text-[#D81B43] disabled:opacity-50">
                                {d}d
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
          </div>
        </div>
      </div>

      <ModalDevolucion
        abierto={!!modalDevolucion}
        form={formDevolucion}
        onChangeFecha={fecha => setFormDevolucion(f => ({ ...f, fecha }))}
        onChangeObservaciones={observaciones => setFormDevolucion(f => ({ ...f, observaciones }))}
        onConfirmar={confirmarRecoger}
        onCancelar={() => setModalDevolucion(null)}
      />
    </>
  )
}
