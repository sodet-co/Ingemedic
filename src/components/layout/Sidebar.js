'use client'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect, useRef, useLayoutEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { registrarBitacora } from '@/lib/bitacora'
import { moduloDeRuta, puedeVerModulo } from '@/lib/permisos'
import { ULTIMA_ACTUALIZACION } from '@/lib/ultima-actualizacion'

function formatearFechaActualizacion(iso) {
  const fecha = new Date(iso)
  return fecha.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
}

const NAV = [
  {
    label: 'Principal',
    items: [
      { href: '/admin/dashboard', label: 'Dashboard', icon: 'grid' },
    ]
  },
  {
    label: 'Operaciones',
    items: [
      { href: '/admin/entregas',       label: 'Entregas',            icon: 'truck',  tour: 'nav-entregas'       },
      { href: '/admin/inventario',     label: 'Inventario',          icon: 'pulse',  tour: 'nav-inventario'     },
      { href: '/admin/ordenes',        label: 'Préstamos',           icon: 'file',   tour: 'nav-ordenes'        },
      { href: '/admin/clientes',       label: 'Clientes',            icon: 'users'                              },
      { href: '/admin/mantenimientos', label: 'Mantenimientos',      icon: 'tool',   tour: 'nav-mantenimientos' },
      { href: '/admin/servicios',      label: 'Servicios prestados', icon: 'pulse'                              },
    ]
  },
  {
    label: 'Sistema',
    items: [
      { href: '/admin/bitacora',      label: 'Bitácora',      icon: 'book'     },
      { href: '/admin/configuracion', label: 'Configuración', icon: 'settings' },
    ]
  },
]

const MOBILE_CRITICOS = ['/admin/dashboard', '/admin/entregas', '/admin/ordenes', '/admin/inventario']
const MOBILE_NAV_MODE_KEY = 'ingemedic_mobile_nav_mode'
const FAB_POS_KEY = 'ingemedic_fab_pos'
const FAB_SIZE = 56
const TOP_MARGIN = 64 // espacio reservado arriba para no chocar con headers/notch

const ICONS = {
  grid:     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  truck:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
  pulse:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>,
  file:     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  users:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  tool:     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>,
  book:     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>,
  settings: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>,
  logout:   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  map:      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>,
  chevronL: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>,
  chevronR: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>,
  grip:     <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="5" r="1.8"/><circle cx="12" cy="5" r="1.8"/><circle cx="19" cy="5" r="1.8"/><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/><circle cx="5" cy="19" r="1.8"/><circle cx="12" cy="19" r="1.8"/><circle cx="19" cy="19" r="1.8"/></svg>,
  alert:    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
}

export default function Sidebar({ usuario, empresa, permisos = [], esSuperAdmin = false }) {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()

  // Oculta del menú los módulos que el rol actual no tiene permitidos.
  // SuperAdmin ve el NAV completo sin filtrar, sin importar la tabla permisos.
  const navFiltrada = esSuperAdmin ? NAV : NAV
    .map(group => ({
      ...group,
      items: group.items.filter(item => {
        const modulo = moduloDeRuta(item.href)
        return !modulo || puedeVerModulo(modulo, permisos)
      }),
    }))
    .filter(group => group.items.length > 0)

  // Estado inicial SIEMPRE igual en servidor y cliente (evita hydration mismatch).
  // Las preferencias guardadas se cargan después del montaje, no durante el render inicial.
  const [cargasProcesando, setCargasProcesando] = useState(0)
  const [mobileMode, setMobileMode] = useState('barra')
  const [paginaBarra, setPaginaBarra]   = useState(0)
  const [panelAbierto, setPanelAbierto] = useState(false)
  const [panelPage, setPanelPage]       = useState('main') // 'main' | 'sistema'
  const [confirmSalir, setConfirmSalir] = useState(false)
  const [pos, setPos] = useState({ right: 24, bottom: 96 })
  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, startRight: 0, startBottom: 0, moved: false })

  // Cargar preferencias del cliente después de hidratar (no durante el render inicial)
  useEffect(() => {
    const t = setTimeout(() => {
      const savedMode = localStorage.getItem(MOBILE_NAV_MODE_KEY)
      if (savedMode === 'flotante' || savedMode === 'barra') setMobileMode(savedMode)
      try {
        const savedPos = JSON.parse(localStorage.getItem(FAB_POS_KEY) || 'null')
        if (savedPos && typeof savedPos.right === 'number') setPos(savedPos)
      } catch {}
    }, 0)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    function onModeChange(e) { setMobileMode(e.detail) }
    window.addEventListener('mobile-nav-mode-change', onModeChange)
    return () => window.removeEventListener('mobile-nav-mode-change', onModeChange)
  }, [])

  // Ajusta el espacio reservado abajo del contenido según el modo activo.
  // En modo "barra" reserva espacio para la barra fija; en "flotante" no reserva nada.
  useEffect(() => {
    document.documentElement.style.setProperty(
      '--mobile-nav-space',
      mobileMode === 'barra' ? '78px' : '0px'
    )
  }, [mobileMode])

  useEffect(() => {
    async function fetchProcesando() {
      const { count } = await supabase
        .from('cargas_masivas')
        .select('id', { count: 'exact', head: true })
        .eq('estado', 'procesando')
      setCargasProcesando(count || 0)
    }
    fetchProcesando()
    const canal = supabase
      .channel('sidebar-cargas')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cargas_masivas' }, fetchProcesando)
      .subscribe()
    return () => supabase.removeChannel(canal)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function logout() {
    const { data: { user } } = await supabase.auth.getUser()
    await registrarBitacora({ modulo: 'auth', accion: 'logout', entidad: 'sesión', entidad_id: user?.id })
    await supabase.auth.signOut()
    document.cookie = 'sesion_inicio=; path=/; max-age=0'
    // Recarga completa para limpiar cualquier caché de navegación de la sesión anterior
    window.location.href = '/admin/login'
  }

  // ── ARRASTRE con Pointer Events (unifica mouse y touch, sin warnings de listeners pasivos) ──
  function onPointerDown(e) {
    e.currentTarget.setPointerCapture?.(e.pointerId)
    dragRef.current = {
      dragging: true, moved: false,
      startX: e.clientX, startY: e.clientY,
      startRight: pos.right, startBottom: pos.bottom,
    }
  }
  function onPointerMove(e) {
    if (!dragRef.current.dragging) return
    const dx = e.clientX - dragRef.current.startX
    const dy = e.clientY - dragRef.current.startY
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) dragRef.current.moved = true
    if (!dragRef.current.moved) return
    const vw = window.innerWidth, vh = window.innerHeight
    let newRight  = dragRef.current.startRight - dx
    let newBottom = dragRef.current.startBottom - dy
    newRight  = Math.max(8, Math.min(newRight, vw - FAB_SIZE - 8))
    newBottom = Math.max(16, Math.min(newBottom, vh - TOP_MARGIN - FAB_SIZE))
    setPos({ right: newRight, bottom: newBottom })
  }
  function onPointerUp() {
    if (!dragRef.current.dragging) return
    dragRef.current.dragging = false
    if (!dragRef.current.moved) return // fue un tap — el onClick abre el panel
    setPos(prev => {
      const vw = window.innerWidth
      const distFromLeftEdge = vw - prev.right - FAB_SIZE
      const snapped = { right: distFromLeftEdge < prev.right ? vw - FAB_SIZE - 8 : 8, bottom: prev.bottom }
      localStorage.setItem(FAB_POS_KEY, JSON.stringify(snapped))
      return snapped
    })
  }
  function handleFabClick() {
    if (!dragRef.current.moved) setPanelAbierto(v => !v)
  }

  const mobileItems = navFiltrada.flatMap(group => group.items)
  const criticos = mobileItems.filter(i => MOBILE_CRITICOS.includes(i.href))
  const resto    = mobileItems.filter(i => !MOBILE_CRITICOS.includes(i.href))

  // Panel flotante: Dashboard + Operaciones en la vista principal, Bitácora + Configuración en "Más"
  const itemsOperacion = mobileItems.filter(i => i.href !== '/admin/bitacora' && i.href !== '/admin/configuracion')
  const itemsSistema   = mobileItems.filter(i => i.href === '/admin/bitacora' || i.href === '/admin/configuracion')

  const PAGE_SIZE = 4
  const paginasResto = []
  for (let i = 0; i < resto.length; i += PAGE_SIZE) paginasResto.push(resto.slice(i, i + PAGE_SIZE))
  const totalPaginas = 1 + paginasResto.length
  const itemsPaginaActual = paginaBarra === 0 ? criticos : paginasResto[paginaBarra - 1] || []

  const panelAbreHaciaIzquierda = pos.right > 100
  // El panel (248px de ancho) nunca debe salirse de la pantalla — se acota el
  // offset "right" para que su borde izquierdo nunca quede en una posición
  // negativa cuando la bolita está cerca del borde izquierdo del viewport.
  const PANEL_W = 248
  const panelRightClamped = (() => {
    const vw = typeof window !== 'undefined' ? window.innerWidth : 375
    const deseado = Math.max(8, pos.right - 96)
    return Math.min(deseado, Math.max(8, vw - PANEL_W - 8))
  })()

  // Igual que con el ancho, la altura del panel varía según la página (principal
  // vs "más") y no se puede asumir un valor fijo — se mide con un ref después de
  // pintarse, y con eso se acota "bottom" para que nunca se salga por arriba
  // (ni se meta debajo del header fijo móvil, ~56px).
  const panelRef = useRef(null)
  const [panelH, setPanelH] = useState(280) // estimado inicial, se corrige tras medir
  useLayoutEffect(() => {
    if (panelAbierto && panelRef.current) {
      setPanelH(panelRef.current.getBoundingClientRect().height)
    }
  }, [panelAbierto, panelPage])

  const panelBottomClamped = (() => {
    const vh = typeof window !== 'undefined' ? window.innerHeight : 667
    const TOP_SAFE = 64 // deja espacio bajo el header fijo móvil
    const deseado = pos.bottom
    // El borde superior del panel queda en: vh - bottom - panelH. Debe ser >= TOP_SAFE.
    const maxBottom = vh - TOP_SAFE - panelH
    return Math.min(deseado, Math.max(8, maxBottom))
  })()

  return (
    <>
      {/* ── DESKTOP SIDEBAR ── */}
      <aside className="hidden md:flex w-56 min-w-[224px] flex-col h-screen overflow-y-auto flex-shrink-0 bg-white border-r border-slate-200">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-center">
          {empresa?.logo_url ? (
            <Image src={empresa.logo_url} alt={empresa.razon_social || 'Logo'} width={300} height={100}
              className="object-contain" style={{ width: 'auto', height: '80px' }} priority />
          ) : (
            <Image src="/logo.png" alt="Ingemedic" width={300} height={100}
              className="object-contain" style={{ width: 'auto', height: '80px' }} priority />
          )}
        </div>

        <nav className="flex-1 py-3 overflow-y-auto">
          {navFiltrada.map(group => (
            <div key={group.label} className="mb-3">
              <div className="text-[9.5px] font-bold tracking-[0.14em] uppercase text-slate-400 px-4 py-1.5">
                {group.label}
              </div>
              {group.items.map(item => {
                const active = pathname === item.href ||
                  (item.href !== '/admin/dashboard' && pathname.startsWith(item.href))
                return (
                  <Link key={item.href} href={item.href}
                    data-tour={item.tour}
                    className={`flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-medium transition-all border-r-[3px] ${
                      active
                        ? 'text-[#E53935] bg-[#E53935]/5 border-r-[#E53935]'
                        : 'text-slate-500 border-r-transparent hover:bg-slate-50 hover:text-slate-700'
                    }`}>
                    <span className={`w-[18px] flex-shrink-0 flex items-center justify-center ${active ? 'text-[#E53935]' : 'text-slate-400'}`}>
                      {ICONS[item.icon]}
                    </span>
                    {item.label}
                    {item.href === '/admin/inventario' && cargasProcesando > 0 && (
                      <span className="ml-auto w-2 h-2 rounded-full bg-[#B45309] animate-pulse flex-shrink-0" title="Carga masiva en proceso" />
                    )}
                  </Link>
                )
              })}
            </div>
          ))}
          {['nav-empresa','nav-categorias','nav-tipos','nav-listas','nav-usuarios'].map(id => (
            <div key={id} data-tour={id} className="hidden" />
          ))}
        </nav>
        {/*
        <div className="px-3 pb-2">
          <button onClick={() => window.dispatchEvent(new Event('reiniciar-tour'))}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-[9px] text-[12px] font-medium text-slate-500 hover:bg-slate-50 hover:text-[#D81B43] transition-all border border-dashed border-slate-200 hover:border-[#D81B43]/30">
            <span className="w-[18px] flex items-center justify-center text-slate-400">{ICONS.map}</span>
            Tour del sistema
          </button>
        </div>*/}

        <div className="px-4 py-3 border-t border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#E53935] flex items-center justify-center text-[12px] font-bold text-white flex-shrink-0">
              {usuario?.nombre?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12.5px] font-semibold text-slate-700 truncate">{usuario?.nombre || 'Usuario'}</div>
              <div className="text-[10.5px] text-slate-400 capitalize">{usuario?.roles.nombre || 'admin'}</div>
            </div>
            <button onClick={() => setConfirmSalir(true)} className="text-slate-300 hover:text-slate-600 transition-colors flex-shrink-0 p-1">
              {ICONS.logout}
            </button>
          </div>
          <div className="text-[9.5px] text-slate-400 mt-1 px-2">
            Actualizado: {formatearFechaActualizacion(ULTIMA_ACTUALIZACION)}
          </div>
        </div>
      </aside>

      {/* ── MOBILE: HEADER FIJO ARRIBA — logo/nombre + cerrar sesión (ya no flota sobre el contenido) ── */}
      <header className="fixed top-0 left-0 right-0 z-40 md:hidden h-12 flex items-center justify-between px-3 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-full bg-[#E53935] flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
            {usuario?.nombre?.charAt(0) || 'U'}
          </div>
          <div className="min-w-0 leading-none">
            <div className="text-[12px] font-semibold text-slate-700 truncate">{usuario?.nombre || 'Usuario'}</div>
            <div className="text-[9px] text-slate-400 capitalize truncate mt-0.5">{usuario?.roles.nombre || 'admin'}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="text-[8px] text-slate-300 whitespace-nowrap">
            Act: {formatearFechaActualizacion(ULTIMA_ACTUALIZACION)}
          </div>
          <button
            onClick={() => setConfirmSalir(true)}
            className="w-7 h-7 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors flex-shrink-0">
            {ICONS.logout}
          </button>
        </div>
      </header>

      {/* ── MOBILE: MODO BARRA FIJA ── */}
      {mobileMode === 'barra' && (
        <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden border-t border-slate-200 bg-white/95 backdrop-blur-sm shadow-[0_-1px_15px_rgba(15,23,42,0.06)]">
          <div className="flex items-center px-1 py-2">
            {totalPaginas > 1 && (
              <button
                onClick={() => setPaginaBarra(p => (p - 1 + totalPaginas) % totalPaginas)}
                className="flex-shrink-0 w-8 h-12 flex items-center justify-center text-slate-300 active:text-[#E53935] transition-colors">
                {ICONS.chevronL}
              </button>
            )}
            <div className="flex-1 flex items-center justify-around">
              {itemsPaginaActual.map(item => {
                const active = pathname === item.href || (item.href !== '/admin/dashboard' && pathname.startsWith(item.href))
                return (
                  <Link key={item.href} href={item.href}
                    data-tour={item.tour}
                    className={`flex flex-col items-center justify-center gap-1 rounded-[12px] px-2 py-1.5 text-[9.5px] font-semibold transition-all min-w-0 ${
                      active ? 'text-[#E53935]' : 'text-slate-500'
                    }`}>
                    <span className={`flex items-center justify-center w-8 h-8 rounded-full transition-all ${
                      active ? 'bg-[#E53935]/10 text-[#E53935]' : 'bg-slate-50 text-slate-500'
                    }`}>
                      {ICONS[item.icon]}
                    </span>
                    <span className="whitespace-nowrap leading-none tracking-tight">{item.label.split(' ')[0]}</span>
                  </Link>
                )
              })}
            </div>
            {totalPaginas > 1 && (
              <button
                onClick={() => setPaginaBarra(p => (p + 1) % totalPaginas)}
                className="flex-shrink-0 w-8 h-12 flex items-center justify-center text-slate-300 active:text-[#E53935] transition-colors">
                {ICONS.chevronR}
              </button>
            )}
          </div>
          {totalPaginas > 1 && (
            <div className="flex items-center justify-center gap-1 pb-1.5">
              {Array.from({ length: totalPaginas }).map((_, i) => (
                <div key={i} className="h-1 rounded-full transition-all"
                  style={{ width: i === paginaBarra ? 12 : 4, background: i === paginaBarra ? '#E53935' : '#E2E8F0' }} />
              ))}
            </div>
          )}
        </nav>
      )}

      {/* ── MOBILE: MODO ACCESO RÁPIDO (flotante, arrastrable) ── */}
      {mobileMode === 'flotante' && (
        <>
          {panelAbierto && (
            <div className="fixed inset-0 z-40 md:hidden" onClick={() => { setPanelAbierto(false); setPanelPage('main') }} />
          )}

          {/* Panel de módulos — reemplaza al botón en su misma posición aproximada */}
          {panelAbierto && (
            <div ref={panelRef} className="fixed z-50 md:hidden w-[248px] rounded-[24px] shadow-2xl"
              style={{
                background: 'rgba(255,255,255,0.96)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(0,0,0,0.07)',
                right:  panelAbreHaciaIzquierda ? panelRightClamped : undefined,
                left:   !panelAbreHaciaIzquierda ? 8 : undefined,
                bottom: panelBottomClamped,
              }}>
              {panelPage === 'main' ? (
                <div className="grid grid-cols-3 gap-1 p-3">
                  {itemsOperacion.map(item => {
                    const active = pathname === item.href || (item.href !== '/admin/dashboard' && pathname.startsWith(item.href))
                    return (
                      <Link key={item.href} href={item.href}
                        onClick={() => { setPanelAbierto(false); setPanelPage('main') }}
                        className="flex flex-col items-center justify-center gap-1 rounded-[14px] py-2.5 active:bg-slate-100 transition-colors">
                        <span className={`flex items-center justify-center w-9 h-9 rounded-full ${
                          active ? 'bg-[#E53935]/12 text-[#E53935]' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {ICONS[item.icon]}
                        </span>
                        <span className={`text-[9px] font-medium text-center leading-tight ${active ? 'text-[#E53935]' : 'text-slate-500'}`}>
                          {item.label.split(' ')[0]}
                        </span>
                      </Link>
                    )
                  })}
                  {/* Botón "más" — abre Bitácora / Configuración */}
                  <button onClick={() => setPanelPage('sistema')}
                    className="flex flex-col items-center justify-center gap-1 rounded-[14px] py-2.5 active:bg-slate-100 transition-colors">
                    <span className="flex items-center justify-center w-9 h-9 rounded-full bg-slate-100 text-slate-600">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
                    </span>
                    <span className="text-[9px] font-medium text-slate-500">Más</span>
                  </button>
                </div>
              ) : (
                <div className="p-3">
                  <button onClick={() => setPanelPage('main')}
                    className="flex items-center gap-1.5 px-2 py-1.5 mb-1.5 text-[11.5px] font-semibold text-slate-500 active:text-slate-700">
                    {ICONS.chevronL} Volver
                  </button>
                  <div className="grid grid-cols-3 gap-1">
                    {itemsSistema.map(item => {
                      const active = pathname === item.href || pathname.startsWith(item.href)
                      return (
                        <Link key={item.href} href={item.href}
                          onClick={() => { setPanelAbierto(false); setPanelPage('main') }}
                          className="flex flex-col items-center justify-center gap-1 rounded-[14px] py-2.5 active:bg-slate-100 transition-colors">
                          <span className={`flex items-center justify-center w-9 h-9 rounded-full ${
                            active ? 'bg-[#E53935]/12 text-[#E53935]' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {ICONS[item.icon]}
                          </span>
                          <span className={`text-[9px] font-medium text-center leading-tight ${active ? 'text-[#E53935]' : 'text-slate-500'}`}>
                            {item.label.split(' ')[0]}
                          </span>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Botón flotante — desaparece cuando el panel está abierto, igual que AssistiveTouch */}
          {!panelAbierto && (
            <button
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onClick={handleFabClick}
              className="fixed z-50 md:hidden w-14 h-14 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform select-none"
              style={{
                right:  pos.right,
                bottom: pos.bottom,
                background: 'rgba(60,60,67,0.55)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.15)',
                touchAction: 'none',
                WebkitUserSelect: 'none',
                userSelect: 'none',
              }}>
              <span className="text-white/90 pointer-events-none">{ICONS.grip}</span>
            </button>
          )}
        </>
      )}

      {/* ── MODAL CONFIRMAR CERRAR SESIÓN ── */}
      {confirmSalir && (
        <>
          {/* Sin backdrop-blur: este Sidebar vive en TODAS las páginas del
              admin, dashboard incluido, y el mapa de Leaflet ahí usa capas
              con transform3d que el navegador compone en su propia capa
              GPU — un backdrop-filter no la "ve" y queda nítida encima del
              fondo del modal en vez de difuminarse. Un tinte sólido más
              oscuro no depende de backdrop-filter y no tiene ese problema. */}
          <div className="fixed inset-0 bg-black/60 z-[100]" onClick={() => setConfirmSalir(false)} />
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-[340px] p-6 shadow-2xl text-center" onClick={e => e.stopPropagation()}>
              <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
                <span className="text-[#D81B43]">{ICONS.alert}</span>
              </div>
              <h3 className="text-[16px] font-bold text-slate-800 mb-1">¿Cerrar sesión?</h3>
              <p className="text-[13px] text-slate-400 mb-6">Tendrás que volver a iniciar sesión para acceder al sistema.</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmSalir(false)}
                  className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-[9px] text-[13px] font-semibold hover:bg-slate-200 transition-colors">
                  Cancelar
                </button>
                <button onClick={logout}
                  className="flex-1 py-2.5 bg-[#D81B43] text-white rounded-[9px] text-[13px] font-semibold hover:bg-[#B0172F] transition-colors">
                  Sí, salir
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}