'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Truck, User } from 'lucide-react'

export function iniciales(nombre) {
  return (nombre || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase()
}

const TABS = [
  { href: '/entregas',              label: 'Entregas',  Icono: Truck },
  { href: '/repartidor-preferencias', label: 'Mi perfil', Icono: User },
]

// Layout del rol Repartidor — mobile-first, sin el sidebar de admin.
// Barra superior blanca (el logo es un JPG con fondo blanco: sobre la barra
// azul de antes se veía como un recuadro pegado) + barra inferior con las
// dos secciones al alcance del pulgar. Cerrar sesión vive en "Mi perfil".
export default function RepartidorHeader({ children, logoUrl, nombre }) {
  const pathname = usePathname()

  return (
    <div className="flex flex-col h-[100dvh] bg-[#F8FAFC]">
      <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 flex-shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl} className="h-8 w-auto" alt="Ingemedic" />
        <Link href="/repartidor-preferencias" aria-label="Mi perfil"
          className="w-9 h-9 rounded-full bg-[#1B3A6B] text-white text-[13px] font-bold flex items-center justify-center">
          {iniciales(nombre)}
        </Link>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto">
        {children}
      </main>

      <nav className="flex-shrink-0 bg-white border-t border-slate-200 grid grid-cols-2"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {TABS.map(({ href, label, Icono }) => {
          const activa = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link key={href} href={href}
              className={`h-16 flex flex-col items-center justify-center gap-1 text-[11.5px] font-semibold transition-colors ${
                activa ? 'text-[#D81B43]' : 'text-slate-400'
              }`}>
              <Icono size={22} strokeWidth={activa ? 2.4 : 2} />
              {label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
