'use client'
import { useState, useEffect, useRef, useLayoutEffect } from 'react'
import { Bell, X, Megaphone, AlertTriangle, Clock, ChevronRight, Inbox } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { REGLAS_ATENCION, clavePospuesto } from '@/lib/atencion'
import { diasParaVencer } from '@/lib/vigencia'

const ULTIMA_NOVEDAD_VISTA_KEY = 'ultima_novedad_vista'
// Set de ids de alerta ya vistas (no un solo puntero como en novedades):
// una alerta se recalcula en cada carga y puede reaparecer si se pospuso
// y el plazo venció — no hay un "más nuevo que" estable para comparar.
const ALERTAS_VISTAS_KEY = 'alertas_vistas'
const LIMITE_ALERTA_POR_REGLA = 5
const ORDEN_SEVERIDAD = { alta: 0, media: 1 }

const ESTILO_SEVERIDAD = {
  alta:  { bg: '#FEF2F2', color: '#D81B43', icono: AlertTriangle },
  media: { bg: '#FFFBEB', color: '#B45309', icono: Clock },
}

function nombreEquipoAlerta(eq) {
  return eq?.tipo_equipo?.atributos?.nombre || eq?.tipo_equipo?.nombre || '—'
}

function cargarAlertasVistas() {
  try { return new Set(JSON.parse(localStorage.getItem(ALERTAS_VISTAS_KEY) || '[]')) }
  catch { return new Set() }
}
function guardarAlertasVistas(set) {
  try { localStorage.setItem(ALERTAS_VISTAS_KEY, JSON.stringify([...set].slice(-200))) }
  catch { /* localStorage no disponible — no es crítico */ }
}

function formatearRelativo(iso) {
  const fecha = new Date(iso)
  const diffMin = Math.floor((Date.now() - fecha.getTime()) / 60000)
  if (diffMin < 1) return 'Justo ahora'
  if (diffMin < 60) return `Hace ${diffMin} min`
  const diffHoras = Math.floor(diffMin / 60)
  if (diffHoras < 24) return `Hace ${diffHoras} h`
  const diffDias = Math.floor(diffHoras / 24)
  if (diffDias === 1) return 'Ayer'
  if (diffDias < 7) return `Hace ${diffDias} días`
  return fecha.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
}

const PANEL_W = 380
const MARGEN_VIEWPORT = 12

// Buzón de novedades del sistema, junto al nombre de cada módulo en su
// topbar. Es autocontenido — cada módulo solo agrega `<BuzonNovedades />`
// sin tener que pasarle nada. Las novedades se publican directo en la
// tabla `novedades_sistema` (ya no hay formulario en la app).
//
// El panel se posiciona con `position: fixed` y coordenadas calculadas en
// JS a partir de la posición real del botón (no con clases condicionales
// de Tailwind tipo `md:right-0`/`md:left-auto`) — con el botón pegado al
// borde derecho de cada topbar, esas clases quedaban sobre-restringidas
// contra un contenedor angosto (el propio ícono) y el panel se salía de
// la pantalla. Calculándolo así, nunca se desborda sin importar dónde
// esté el botón.
export default function BuzonNovedades({ dark = false }) {
  const supabase = createClient()
  const btnRef = useRef(null)

  const [novedades, setNovedades]           = useState([])
  const [alertas, setAlertas]               = useState([])
  const [buzonAbierto, setBuzonAbierto]     = useState(false)
  const [noLeidasNovedades, setNoLeidasNovedades] = useState(0)
  const [noLeidasAlertas, setNoLeidasAlertas]     = useState(0)
  const [panelPos, setPanelPos]             = useState(null)
  const [pestana, setPestana]               = useState('todas')
  // Ids que estaban sin leer al abrir el buzón. Al abrir se marcan como
  // vistas de una vez (el badge se apaga), pero guardamos esta foto para
  // poder resaltar cuáles eran las nuevas mientras el panel siga abierto.
  const [nuevasIds, setNuevasIds]           = useState(() => new Set())
  const [expandidas, setExpandidas]         = useState(() => new Set())

  const noLeidas = noLeidasNovedades + noLeidasAlertas

  // Cuenta cuántas novedades son más nuevas que la última vista (no solo
  // si "hay alguna" nueva) — así el badge puede mostrar un número, como
  // en el resto del sistema de notificaciones de referencia.
  function aplicarNovedades(lista) {
    setNovedades(lista)
    const ultimaVista = localStorage.getItem(ULTIMA_NOVEDAD_VISTA_KEY)
    const idx = ultimaVista ? lista.findIndex(n => n.id === ultimaVista) : -1
    setNoLeidasNovedades(idx === -1 ? lista.length : idx)
  }

  async function fetchNovedades() {
    const { data } = await supabase
      .from('novedades_sistema')
      .select('id, asunto, descripcion, fecha')
      .eq('activo', true)
      .order('fecha', { ascending: false })
      .limit(12)
    return data || []
  }


  // Préstamos vencidos/por vencer, calculados con las mismas reglas de
  // src/lib/atencion.js que usa el Panel de Atención del dashboard — el
  // buzón es lo único que vive en el topbar de todos los módulos, así que
  // es el lugar natural para que estas alertas se vean sin importar dónde
  // esté el usuario.
  async function fetchAlertas() {
    const porRegla = await Promise.all(REGLAS_ATENCION.map(async regla => {
      const items = await regla.consulta(supabase, { limite: LIMITE_ALERTA_POR_REGLA })
      return items.map(o => ({
        id: clavePospuesto(regla.id, o.id),
        ordenId: o.id,
        reglaId: regla.id,
        severidad: regla.severidad,
        titulo: regla.titulo,
        codigo: o.codigo,
        cliente: o.cliente?.nombre,
        paciente: o.paciente?.nombre,
        equipos: o.equipos || [],
        dias: diasParaVencer(o),
      }))
    }))
    return porRegla.flat().sort((a, b) => (ORDEN_SEVERIDAD[a.severidad] - ORDEN_SEVERIDAD[b.severidad]) || (a.dias - b.dias))
  }

  function aplicarAlertas(lista) {
    setAlertas(lista)
    const vistas = cargarAlertasVistas()
    setNoLeidasAlertas(lista.filter(a => !vistas.has(a.id)).length)
  }

  useEffect(() => {
    let cancelado = false
    fetchNovedades().then(lista => { if (!cancelado) aplicarNovedades(lista) })
    fetchAlertas().then(lista => { if (!cancelado) aplicarAlertas(lista) })

    // Recogido/extendido/pospuesto desde PanelAtencion (u otro usuario, en
    // cualquier módulo) cambia lo que estas reglas deben mostrar. A
    // diferencia de las novedades manuales (que solo cambian al publicar
    // una nueva, y ahí se recargan a mano), las alertas se recalculan de
    // datos que otros flujos tocan constantemente — router.refresh() no
    // remonta este componente, así que sin esta suscripción quedarían
    // stale hasta la próxima navegación de página.
    const canal = supabase
      .channel('buzon-alertas-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ordenes_servicio' }, () => {
        fetchAlertas().then(lista => { if (!cancelado) aplicarAlertas(lista) })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'atencion_pospuestas' }, () => {
        fetchAlertas().then(lista => { if (!cancelado) aplicarAlertas(lista) })
      })
      .subscribe()

    return () => { cancelado = true; supabase.removeChannel(canal) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function toggleBuzon() {
    if (!buzonAbierto) {
      const vistas = cargarAlertasVistas()
      const nuevas = new Set(alertas.filter(a => !vistas.has(a.id)).map(a => a.id))
      novedades.slice(0, noLeidasNovedades).forEach(n => nuevas.add(n.id))
      setNuevasIds(nuevas)
      setExpandidas(new Set())
      setPestana('todas')
    }
    setBuzonAbierto(v => {
      const next = !v
      if (next) {
        if (novedades.length > 0) {
          localStorage.setItem(ULTIMA_NOVEDAD_VISTA_KEY, novedades[0].id)
          setNoLeidasNovedades(0)
        }
        if (alertas.length > 0) {
          const vistas = cargarAlertasVistas()
          alertas.forEach(a => vistas.add(a.id))
          guardarAlertasVistas(vistas)
          setNoLeidasAlertas(0)
        }
      }
      return next
    })
  }

  function irAAlerta(alerta) {
    setBuzonAbierto(false)
    // Navegación completa: el buzón vive en todos los módulos, incluido
    // Préstamos — un router.push a la misma ruta con otro query no lo
    // remonta, y el filtro (que se lee al montar) no se aplicaría. Mismo
    // patrón que ya usan login/page.js y Sidebar.js (logout) para lo mismo.
    // eslint-disable-next-line react-hooks/immutability
    window.location.href = `/admin/ordenes?atencion=${alerta.reglaId}`
  }

  useLayoutEffect(() => {
    if (!buzonAbierto || !btnRef.current) return
    function calcular() {
      // En móvil el panel es una hoja inferior (patrón de drawers del proyecto)
      if (window.innerWidth < 768) { setPanelPos({ movil: true }); return }
      const rect = btnRef.current.getBoundingClientRect()
      const panelW = Math.min(PANEL_W, window.innerWidth - MARGEN_VIEWPORT * 2)
      let left = rect.right - panelW
      left = Math.max(MARGEN_VIEWPORT, Math.min(left, window.innerWidth - panelW - MARGEN_VIEWPORT))
      setPanelPos({ left, top: rect.bottom + 8, width: panelW })
    }
    function onKey(e) { if (e.key === 'Escape') setBuzonAbierto(false) }
    calcular()
    window.addEventListener('resize', calcular)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('resize', calcular)
      window.removeEventListener('keydown', onKey)
    }
  }, [buzonAbierto])

  function toggleExpandida(id) {
    setExpandidas(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div className="relative">
      <button ref={btnRef} onClick={toggleBuzon} title="Buzón de notificaciones"
        className={`relative w-9 h-9 flex items-center justify-center rounded-full transition-colors ${
          buzonAbierto
            ? (dark ? 'bg-white/15' : 'bg-slate-100')
            : (dark ? 'hover:bg-white/10' : 'hover:bg-slate-100')
        }`}>
        <Bell size={19} className={dark ? 'text-white/80' : 'text-slate-500'} />
        {noLeidas > 0 && (
          <span className="absolute top-0 right-0 min-w-[16px] h-4 px-1 flex items-center justify-center bg-[#D81B43] text-white text-[9.5px] font-bold rounded-full border-2 border-white">
            {noLeidas > 9 ? '9+' : noLeidas}
          </span>
        )}
      </button>

      {buzonAbierto && panelPos && (
        <>
          <div className={`fixed inset-0 z-[59] ${panelPos.movil ? 'bg-black/40' : ''}`} onClick={() => setBuzonAbierto(false)} />
          <div
            style={panelPos.movil ? { zIndex: 60 } : { position: 'fixed', left: panelPos.left, top: panelPos.top, width: panelPos.width, zIndex: 60 }}
            className={`bg-white flex flex-col overflow-hidden ${
              panelPos.movil
                ? 'fixed inset-x-0 bottom-0 max-h-[85vh] rounded-t-2xl shadow-2xl'
                : 'rounded-xl border border-slate-200 shadow-xl max-h-[32rem]'
            }`}>

            {/* Encabezado */}
            <div className="px-4 pt-3.5 pb-3 border-b border-slate-200 flex-shrink-0">
              {panelPos.movil && <div className="w-10 h-1 rounded-full bg-slate-200 mx-auto mb-3" />}
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-[14px] font-bold text-slate-800">Notificaciones</div>
                  <div className="text-[11.5px] text-slate-400 mt-0.5">
                    {nuevasIds.size > 0
                      ? `${nuevasIds.size} nueva${nuevasIds.size !== 1 ? 's' : ''} desde tu última visita`
                      : 'Estás al día'}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setBuzonAbierto(false)} title="Cerrar"
                    className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-[7px] p-1.5 transition-colors">
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Pestañas */}
              <div className="flex bg-slate-100 rounded-[8px] p-1 gap-1 mt-3">
                {[
                  { key: 'todas',     label: 'Todas',     n: alertas.length + novedades.length },
                  { key: 'alertas',   label: 'Alertas',   n: alertas.length },
                  { key: 'novedades', label: 'Novedades', n: novedades.length },
                ].map(t => (
                  <button key={t.key} onClick={() => setPestana(t.key)}
                    className={`flex-1 px-2 py-1.5 rounded-[6px] text-[12px] font-medium transition-all ${
                      pestana === t.key ? 'bg-white text-slate-800 font-semibold shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}>
                    {t.label} <span className="text-[10.5px] opacity-60">({t.n})</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Contenido */}
            <div className={`flex-1 overflow-y-auto ${panelPos.movil ? 'pb-6' : ''}`}>
              {pestana !== 'novedades' && alertas.length > 0 && (
                <>
                  {pestana === 'todas' && (
                    <div className="px-4 pt-3 pb-1.5 text-[10.5px] font-bold uppercase tracking-[0.07em] text-slate-400">
                      Préstamos que requieren atención
                    </div>
                  )}
                  {alertas.map(a => {
                    const estilo = ESTILO_SEVERIDAD[a.severidad] || ESTILO_SEVERIDAD.media
                    const Icono = estilo.icono
                    const etiquetaDias = a.dias < 0 ? `Venció hace ${Math.abs(a.dias)}d` : a.dias === 0 ? 'Vence hoy' : `Vence en ${a.dias}d`
                    const esNueva = nuevasIds.has(a.id)
                    return (
                      <div key={a.id} onClick={() => irAAlerta(a)}
                        className={`px-4 py-3 border-b border-slate-100 flex gap-3 hover:bg-slate-50 transition-colors cursor-pointer ${esNueva ? 'bg-[#2EB5D4]/[0.04]' : ''}`}>
                        <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: estilo.bg, color: estilo.color }}>
                          <Icono size={15} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="flex items-center gap-1.5 min-w-0">
                              {esNueva && <span className="w-1.5 h-1.5 rounded-full bg-[#2EB5D4] flex-shrink-0" title="Nueva" />}
                              <span className="font-mono text-[11.5px] font-bold text-slate-700 truncate">{a.codigo}</span>
                            </span>
                            <span className="text-[10.5px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: estilo.bg, color: estilo.color }}>
                              {etiquetaDias}
                            </span>
                          </div>
                          <div className="text-[12px] text-slate-600 mt-0.5 truncate">
                            {a.cliente}{a.paciente && <span className="text-slate-400"> · {a.paciente}</span>}
                          </div>
                          {a.equipos.length > 0 && (
                            <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                              {a.equipos.map(oe => `${nombreEquipoAlerta(oe.equipo)} · ${oe.equipo?.codigo}`).join(', ')}
                            </div>
                          )}
                        </div>
                        <ChevronRight size={14} className="text-slate-300 self-center flex-shrink-0" />
                      </div>
                    )
                  })}
                </>
              )}

              {pestana !== 'alertas' && novedades.length > 0 && (
                <>
                  {pestana === 'todas' && (
                    <div className="px-4 pt-3 pb-1.5 text-[10.5px] font-bold uppercase tracking-[0.07em] text-slate-400">
                      Novedades del sistema
                    </div>
                  )}
                  {novedades.map(n => {
                    const esNueva = nuevasIds.has(n.id)
                    const abierta = expandidas.has(n.id)
                    const larga = n.descripcion.length > 140 || n.descripcion.split('\n').length > 3
                    return (
                      <div key={n.id} className={`px-4 py-3 border-b border-slate-100 flex gap-3 ${esNueva ? 'bg-[#2EB5D4]/[0.04]' : ''}`}>
                        <div className="w-9 h-9 rounded-full bg-[#1B3A6B]/10 text-[#1B3A6B] flex items-center justify-center flex-shrink-0">
                          <Megaphone size={15} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <span className="flex items-center gap-1.5 min-w-0">
                              {esNueva && <span className="w-1.5 h-1.5 rounded-full bg-[#2EB5D4] flex-shrink-0" title="Nueva" />}
                              <span className="text-[12.5px] font-bold text-slate-800">{n.asunto}</span>
                            </span>
                            <span className="text-[10.5px] text-slate-400 flex-shrink-0 mt-0.5">{formatearRelativo(n.fecha)}</span>
                          </div>
                          <div className={`text-[12px] text-slate-500 mt-0.5 whitespace-pre-wrap ${larga && !abierta ? 'line-clamp-3' : ''}`}>
                            {n.descripcion}
                          </div>
                          {larga && (
                            <button onClick={() => toggleExpandida(n.id)}
                              className="text-[11.5px] font-semibold text-[#1B3A6B] hover:underline mt-1">
                              {abierta ? 'Ver menos' : 'Ver más'}
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </>
              )}

              {((pestana === 'todas' && alertas.length === 0 && novedades.length === 0) ||
                (pestana === 'alertas' && alertas.length === 0) ||
                (pestana === 'novedades' && novedades.length === 0)) && (
                <div className="px-4 py-10 text-center text-slate-400">
                  <Inbox className="w-10 h-10 mx-auto mb-2 opacity-20" />
                  <div className="text-[12.5px] font-semibold">
                    {pestana === 'alertas' ? 'Ningún préstamo requiere atención' :
                     pestana === 'novedades' ? 'Sin novedades publicadas' :
                     'Sin notificaciones'}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
