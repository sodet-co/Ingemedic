'use client'
import { useState, useEffect, useRef, useLayoutEffect } from 'react'
import { Bell, Plus, X, Megaphone, AlertTriangle, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { useUsuarioActual } from '@/lib/usuario-context'
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

const PANEL_W = 340
const MARGEN_VIEWPORT = 12

// Buzón de novedades del sistema, junto al nombre de cada módulo en su
// topbar. El usuario actual y si es SuperAdmin vienen del UsuarioContext
// (calculado una vez en layout.js) — así cada módulo solo agrega
// `<BuzonNovedades />` sin tener que pasarle nada.
//
// El panel se posiciona con `position: fixed` y coordenadas calculadas en
// JS a partir de la posición real del botón (no con clases condicionales
// de Tailwind tipo `md:right-0`/`md:left-auto`) — con el botón pegado al
// borde derecho de cada topbar, esas clases quedaban sobre-restringidas
// contra un contenedor angosto (el propio ícono) y el panel se salía de
// la pantalla. Calculándolo así, nunca se desborda sin importar dónde
// esté el botón.
export default function BuzonNovedades({ dark = false }) {
  const { usuario, esSuperAdmin } = useUsuarioActual()
  const supabase = createClient()
  const btnRef = useRef(null)

  const [novedades, setNovedades]           = useState([])
  const [alertas, setAlertas]               = useState([])
  const [buzonAbierto, setBuzonAbierto]     = useState(false)
  const [noLeidasNovedades, setNoLeidasNovedades] = useState(0)
  const [noLeidasAlertas, setNoLeidasAlertas]     = useState(0)
  const [modalNueva, setModalNueva]         = useState(false)
  const [form, setForm]                     = useState({ asunto: '', descripcion: '' })
  const [guardando, setGuardando]           = useState(false)
  const [error, setError]                   = useState('')
  const [panelPos, setPanelPos]             = useState(null)

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

  // Recarga usada después de publicar una novedad — no vive dentro del efecto
  // de montaje para no duplicar la lógica de fetch.
  async function cargarNovedades() {
    aplicarNovedades(await fetchNovedades())
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
      const rect = btnRef.current.getBoundingClientRect()
      const panelW = Math.min(PANEL_W, window.innerWidth - MARGEN_VIEWPORT * 2)
      let left = rect.right - panelW
      left = Math.max(MARGEN_VIEWPORT, Math.min(left, window.innerWidth - panelW - MARGEN_VIEWPORT))
      setPanelPos({ left, top: rect.bottom + 8, width: panelW })
    }
    calcular()
    window.addEventListener('resize', calcular)
    return () => window.removeEventListener('resize', calcular)
  }, [buzonAbierto])

  async function guardarNovedad() {
    const asunto = form.asunto.trim()
    const descripcion = form.descripcion.trim()
    if (!asunto || !descripcion) { setError('Completa asunto y descripción'); return }
    setGuardando(true)
    setError('')
    const { error: err } = await supabase.from('novedades_sistema').insert({
      asunto, descripcion, creado_por: usuario?.id || null,
    })
    setGuardando(false)
    if (err) { setError(err.message); return }
    setForm({ asunto: '', descripcion: '' })
    setModalNueva(false)
    await cargarNovedades()
  }

  return (
    <div className="relative">
      <button ref={btnRef} onClick={toggleBuzon} className="relative" title="Buzón de notificaciones">
        <Bell size={19} className={dark ? 'text-white/80' : 'text-slate-500'} />
        {noLeidas > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 flex items-center justify-center bg-[#D81B43] text-white text-[9.5px] font-bold rounded-full border-2 border-white">
            {noLeidas > 9 ? '9+' : noLeidas}
          </span>
        )}
      </button>

      {buzonAbierto && panelPos && (
        <>
          <div className="fixed inset-0 z-[59]" onClick={() => setBuzonAbierto(false)} />
          <div style={{ position: 'fixed', left: panelPos.left, top: panelPos.top, width: panelPos.width, zIndex: 60 }}
            className="bg-white rounded-xl border border-slate-200 shadow-lg max-h-[26rem] overflow-y-auto">
            <div className="px-4 py-3.5 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white rounded-t-xl">
              <span className="text-[14px] font-bold text-slate-800">Buzón de notificaciones</span>
              {esSuperAdmin && (
                <button onClick={() => setModalNueva(true)} className="text-[#D81B43] hover:bg-[#D81B43]/10 rounded-[6px] p-1 transition-colors" title="Nueva novedad">
                  <Plus size={16} />
                </button>
              )}
            </div>
            {alertas.map(a => {
              const estilo = ESTILO_SEVERIDAD[a.severidad] || ESTILO_SEVERIDAD.media
              const Icono = estilo.icono
              const etiquetaDias = a.dias < 0 ? `Venció hace ${Math.abs(a.dias)}d` : a.dias === 0 ? 'Vence hoy' : `Vence en ${a.dias}d`
              return (
                <div key={a.id} onClick={() => irAAlerta(a)}
                  className="px-4 py-3 border-b border-slate-100 last:border-0 flex gap-3 hover:bg-slate-50 transition-colors cursor-pointer">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: estilo.bg, color: estilo.color }}>
                    <Icono size={15} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11.5px] font-bold text-slate-700">{a.codigo}</span>
                      <span className="text-[10.5px] font-semibold flex-shrink-0" style={{ color: estilo.color }}>{etiquetaDias}</span>
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
                </div>
              )
            })}
            {novedades.map(n => (
              <div key={n.id} className="px-4 py-3 border-b border-slate-100 last:border-0 flex gap-3 hover:bg-slate-50 transition-colors">
                <div className="w-9 h-9 rounded-full bg-[#D81B43]/10 text-[#D81B43] flex items-center justify-center flex-shrink-0">
                  <Megaphone size={15} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-bold text-slate-800">{n.asunto}</div>
                  <div className="text-[12px] text-slate-500 mt-0.5 whitespace-pre-wrap">{n.descripcion}</div>
                  <div className="text-[10.5px] text-slate-400 mt-1">{formatearRelativo(n.fecha)}</div>
                </div>
              </div>
            ))}
            {alertas.length === 0 && novedades.length === 0 && (
              <div className="px-4 py-6 text-center text-[12px] text-slate-400">Sin novedades recientes</div>
            )}
          </div>
        </>
      )}

      {modalNueva && (
        <>
          <div className="fixed inset-0 bg-black/40 z-[70]" onClick={() => setModalNueva(false)} />
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-[440px] shadow-2xl p-6" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <div className="text-[15px] font-bold text-slate-800">Nueva novedad</div>
                <button onClick={() => setModalNueva(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={18} />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-[0.07em] text-slate-500 mb-1.5">Asunto</label>
                  <input value={form.asunto} onChange={e => setForm(f => ({ ...f, asunto: e.target.value }))}
                    placeholder="ej. Nuevo módulo de historial"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-[9px] text-[13.5px] outline-none focus:border-[#D81B43]" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-[0.07em] text-slate-500 mb-1.5">Descripción</label>
                  <textarea value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                    rows={3} placeholder="Describe brevemente el cambio..."
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-[9px] text-[13.5px] outline-none focus:border-[#D81B43] resize-none" />
                </div>
                {error && <div className="text-[12px] text-red-500">{error}</div>}
              </div>
              <div className="flex gap-2 mt-5">
                <button onClick={() => setModalNueva(false)}
                  className="flex-1 py-2.5 border border-slate-200 rounded-[9px] text-[13px] font-medium text-slate-600 hover:border-slate-300 transition-colors">
                  Cancelar
                </button>
                <button onClick={guardarNovedad} disabled={guardando}
                  className="flex-1 py-2.5 bg-[#D81B43] text-white rounded-[9px] text-[13px] font-semibold hover:bg-[#B0172F] transition-colors disabled:opacity-60">
                  {guardando ? 'Publicando...' : 'Publicar'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
