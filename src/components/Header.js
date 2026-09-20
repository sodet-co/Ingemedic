'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const LOGO_URL = SUPABASE_URL
  ? `${SUPABASE_URL}/storage/v1/object/public/logos/logo-ingemedic.png`
  : '/images/logo.png'

function WhatsappIcon({ size = 20, className = '' }) {
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
  );
}

export function Logo({ size = 36, light = false }) {
  const imageElement = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={LOGO_URL}
      alt="Ingemedic de Colombia"
      style={{ height: size }}
      className="w-auto object-contain"
    />
  )

  if (light) return imageElement
  return <Link href="/" className="flex items-center gap-2 cursor-pointer">{imageElement}</Link>
}

export default function Header({ transparent = false }) {
  const pathname = usePathname()
  const [menuAbierto, setMenuAbierto] = useState(false)
  // Si el header no es "transparent", se comporta como siempre (sólido, sticky).
  // Si lo es, arranca transparente sobre el hero y se vuelve sólido pasado el scroll.
  const [scrolled, setScrolled] = useState(!transparent)

  useEffect(() => {
    if (!transparent) return
    function onScroll() {
      setScrolled(window.scrollY > 50)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [transparent])

  // "claro" = header flotando sobre fondo oscuro (hero) sin haber hecho scroll todavía —
  // logo y texto de navegación necesitan la variante clara en este estado. Con el menú
  // móvil abierto se fuerza a sólido siempre, para no dejar ver el hero (transparente)
  // asomando en la franja del header justo encima del drawer blanco del menú.
  const claro = transparent && !scrolled && !menuAbierto

  const navLinks = [
    { name: 'Inicio', href: '/' },
    { name: 'Portafolio', href: '/portafolio' },
    { name: 'Quiénes somos', href: '/quienes-somos' },
    { name: 'Contáctenos', href: '/contacto' },
  ]

  return (
    <>
    <header className={`${transparent ? 'fixed' : 'sticky'} top-0 w-full z-50 transition-all duration-300 ${
      claro ? 'bg-transparent' : 'bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-sm'
    }`}>
      <div className="max-w-7xl mx-auto px-4 md:px-8 h-20 flex items-center justify-between">
        {/* Logo — el logo trae varios colores propios (no es un solo tono), así que
            sobre el hero oscuro se apoya en un chip blanco en vez de una versión
            "clara" del archivo (no existe ese asset todavía) para garantizar contraste */}
        {claro ? (
          <div className="bg-white/95 rounded-xl px-3 py-1.5 shadow-sm">
            <Logo size={40} />
          </div>
        ) : (
          <Logo size={48} />
        )}

        {/* Desktop Nav */}
        <nav className="hidden lg:flex items-center gap-7">
          {navLinks.map((link) => {
            const activo = pathname === link.href || (link.href === '/portafolio' && (pathname === '/servicios' || pathname === '/catalogo'))
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`text-xs font-bold uppercase tracking-wider transition-colors relative py-1 ${
                  claro
                    ? (activo ? 'text-white' : 'text-white/80 hover:text-white')
                    : (activo ? 'text-blue-700 font-extrabold' : 'text-slate-600 hover:text-blue-700')
                  }`}
              >
                {link.name}
                {activo && (
                  <span className={`absolute bottom-0 left-0 w-full h-[2.5px] rounded-full ${claro ? 'bg-[#2EB5D4]' : 'bg-blue-700'}`} />
                )}
              </Link>
            )
          })}
        </nav>

        {/* Action Buttons */}
        <div className="hidden md:flex items-center gap-3">
          <a
            href="https://wa.me/573103861480?text=Hola,%20requiero%20información%20sobre%20el%20catálogo%20de%20productos"
            target="_blank"
            rel="noopener noreferrer"
            className="h-11 px-5 rounded-full text-xs font-bold text-white bg-[#25D366] hover:bg-[#128C7E] transition-all flex items-center gap-2 shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-95 cursor-pointer"
          >
            <WhatsappIcon size={18} />
            <span>Consultar catalogo</span>
          </a>
          <Link
            href="/admin/login"
            className="h-11 px-5 rounded-full text-xs font-bold text-white bg-[#D81B43] hover:bg-[#B51335] transition-all flex items-center justify-center shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-95 cursor-pointer"
          >
            Acceso del Personal
          </Link>
        </div>

        {/* Mobile hamburger */}
        <div className="flex lg:hidden items-center gap-2">
          <button
            onClick={() => setMenuAbierto((v) => !v)}
            className={`p-2 transition-colors ${claro ? 'text-white hover:text-white/70' : 'text-slate-700 hover:text-blue-700'}`}
            aria-label="Abrir menú"
          >
            {menuAbierto ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>
    </header>

    {/* Mobile dropdown — drawer de pantalla completa, renderizado FUERA de <header> a propósito:
        si el header lleva backdrop-blur (estado sólido), ese backdrop-filter crea un nuevo
        "containing block" para descendientes fixed, y el drawer terminaba anclado al recuadro
        de 80px del header en vez de a todo el viewport (bug real, encontrado midiendo con
        getComputedStyle, no a simple vista) — como hermano de <header> queda inmune a eso. */}
    {menuAbierto && (
      <div className="lg:hidden fixed inset-x-0 top-20 bottom-0 overflow-y-auto border-t px-5 py-5 space-y-3.5 bg-white border-slate-100 shadow-xl z-40">
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            onClick={() => setMenuAbierto(false)}
            className={`block text-sm font-semibold py-1.5 px-3 rounded-lg ${pathname === link.href
              ? 'text-blue-700 font-bold bg-blue-50'
              : 'text-slate-700 hover:bg-slate-50'
              }`}
          >
            {link.name}
          </Link>
        ))}
        <div className="pt-2 flex flex-col gap-2.5">
          <a
            href="https://wa.me/573103861480?text=Hola,%20requiero%20información%20sobre%20el%20catálogo%20de%20productos"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setMenuAbierto(false)}
            className="w-full h-11 rounded-full text-xs font-bold text-white bg-[#25D366] hover:bg-[#128C7E] flex items-center justify-center gap-2 shadow-md"
          >
            <WhatsappIcon size={18} /> Consultar catalogo
          </a>
          <Link
            href="/admin/login"
            onClick={() => setMenuAbierto(false)}
            className="w-full h-11 rounded-full text-xs font-bold text-white bg-[#D81B43] flex items-center justify-center shadow-md"
          >
            Acceso del Personal
          </Link>
        </div>
      </div>
    )}
    </>
  )
}
