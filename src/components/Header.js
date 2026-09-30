'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { PORTAL_URL } from '@/lib/sitio'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const LOGO_URL = SUPABASE_URL
  ? `${SUPABASE_URL}/storage/v1/object/public/logos/logo-ingemedic.png`
  : '/images/logo.png'

// El panel está en portal.ingemedic.com.co. En local no hay subdominio: el
// login se sirve en el mismo localhost.
const URL_PORTAL = process.env.NODE_ENV === 'development' ? '/login' : PORTAL_URL

function WhatsappIcon({ size = 18, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={`flex-shrink-0 ${className}`}
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414-.074-.124-.272-.198-.57-.347m-5.421 7.461h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

export function Logo({ size = 34 }) {
  return (
    <Link href="/" className="flex items-center gap-2 cursor-pointer">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={LOGO_URL}
        alt="Ingemedic de Colombia"
        style={{ height: size }}
        className="w-auto object-contain"
      />
    </Link>
  )
}

const NAV_LINKS = [
  { name: 'Inicio', href: '/' },
  { name: 'Nosotros', href: '/quienes-somos' },
  { name: 'Portafolio', href: '/portafolio' },
  { name: 'Contáctenos', href: '/contacto' },
]

export default function Header() {
  const pathname = usePathname()
  const [menuAbierto, setMenuAbierto] = useState(false)

  return (
    <>
      <header className="sticky top-0 w-full z-50 bg-white/95 backdrop-blur-md border-b border-[#DDE5EE]">
        <div className="max-w-[1180px] mx-auto px-5 md:px-7 h-[72px] md:h-[76px] flex items-center gap-9">
          <Logo size={40} />

          <nav className="hidden lg:flex items-center gap-7 ml-2">
            {NAV_LINKS.map(link => {
              const activo = pathname === link.href
              return (
                <Link key={link.href} href={link.href}
                  className={`font-body text-[14.5px] font-medium pb-1.5 border-b-2 transition-colors ${
                    activo ? 'text-[#0E2A4D] border-[#1E9FC4]' : 'text-[#5D6F86] border-transparent hover:text-[#0E2A4D]'
                  }`}>
                  {link.name}
                </Link>
              )
            })}
          </nav>

          <div className="hidden md:flex items-center gap-3 ml-auto">
            <Link href={URL_PORTAL}
              className="font-body inline-flex items-center text-[13.5px] font-medium text-[#0E2A4D] border border-[#0E2A4D] hover:bg-[#0E2A4D] hover:text-white px-4 py-2.5 rounded-md transition-colors">
              Acceso del personal
            </Link>
            <Link href="/contacto"
              className="font-body inline-flex items-center text-[14.5px] font-medium text-white bg-[#C8102E] hover:bg-[#a80d26] px-5 py-2.5 rounded-md transition-colors">
              Solicitar cotización
            </Link>
          </div>

          <div className="flex lg:hidden items-center ml-auto">
            <button onClick={() => setMenuAbierto(v => !v)} className="p-2 text-[#0E2A4D]" aria-label="Abrir menú">
              {menuAbierto ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </header>

      {/* Drawer móvil — hermano de <header>, no descendiente: si el header lleva
          backdrop-blur (siempre, ahora), ese backdrop-filter crea un nuevo
          "containing block" para descendientes fixed, y el drawer terminaba
          anclado al recuadro del header en vez de a todo el viewport. */}
      {menuAbierto && (
        <div className="lg:hidden fixed inset-x-0 top-[72px] bottom-0 overflow-y-auto border-t border-[#DDE5EE] px-5 py-5 space-y-3 bg-white shadow-xl z-40">
          {NAV_LINKS.map(link => (
            <Link key={link.href} href={link.href} onClick={() => setMenuAbierto(false)}
              className={`font-body block text-[14.5px] font-medium py-2 px-3 rounded-lg ${
                pathname === link.href ? 'text-[#0E2A4D] bg-[#E3F3F8]' : 'text-[#5D6F86] hover:bg-slate-50'
              }`}>
              {link.name}
            </Link>
          ))}
          <div className="pt-2 flex flex-col gap-2.5">
            <Link href="/contacto" onClick={() => setMenuAbierto(false)}
              className="font-body w-full inline-flex items-center justify-center text-[14.5px] font-medium text-white bg-[#C8102E] px-5 py-3 rounded-md">
              Solicitar cotización
            </Link>
            <Link href={URL_PORTAL} onClick={() => setMenuAbierto(false)}
              className="font-body w-full inline-flex items-center justify-center text-[14px] font-medium text-[#0E2A4D] border border-[#0E2A4D] px-5 py-3 rounded-md">
              Acceso del personal
            </Link>
          </div>
        </div>
      )}

      {/* Bolita flotante de WhatsApp — reemplaza el botón "Consultar catálogo" que
          antes vivía dentro del header, para no gastarle espacio a la barra. */}
      <a
        href="https://wa.me/573103861480?text=Hola,%20requiero%20información%20sobre%20el%20catálogo%20de%20productos"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Consultar catálogo por WhatsApp"
        className="fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full bg-[#25D366] hover:bg-[#128C7E] shadow-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95"
      >
        <WhatsappIcon size={27} className="text-white" />
      </a>
    </>
  )
}
