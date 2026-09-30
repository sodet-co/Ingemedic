'use client'
import Link from 'next/link'
import { MapPin, Phone, Mail } from 'lucide-react'

function WhatsappIcon({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={`flex-shrink-0 ${className}`}>
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.5 14.1c-.2.6-1.2 1.2-1.7 1.2-.5.1-1 .1-1.6-.1a12 12 0 0 1-6.4-5.6c-.5-.9-.7-1.7-.7-2.4 0-.8.4-1.4.8-1.7.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2 0 .4-.1.5l-.4.5c-.1.2-.3.3-.1.6a8 8 0 0 0 3.6 3.1c.3.1.5.1.7-.1l.7-.8c.2-.2.3-.2.6-.1l2 .9c.2.1.3.2.3.3s0 .8-.3 1.5z" />
    </svg>
  )
}

export default function Footer() {
  return (
    <footer className="font-body bg-[#091D36] text-[#B9CBDF] pt-16">
      <div className="max-w-[1180px] mx-auto px-5 md:px-7">
        <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr_1fr_1.1fr] gap-11 pb-12">
          {/* Identidad — texto, no la imagen del logo: trae varios colores propios
              y no existe una versión clara/blanca del archivo para este fondo oscuro. */}
          <div>
            <div className="font-display text-[19px] font-semibold text-white mb-4 tracking-[-0.02em]">
              Ingemedic de Colombia
            </div>
            <p className="text-[14px] leading-relaxed max-w-[34ch]">
              Producción y suministro de oxígeno medicinal y equipos biomédicos para hospitalización domiciliaria en la región del Cesar.
            </p>
          </div>

          {/* Enlaces rápidos */}
          <div>
            <h4 className="font-display text-[15px] font-medium text-white mb-4">Enlaces rápidos</h4>
            <ul className="space-y-2.5 text-[14px]">
              <li><Link href="/" className="hover:text-white transition-colors">Inicio</Link></li>
              <li><Link href="/quienes-somos" className="hover:text-white transition-colors">Nosotros</Link></li>
              <li><Link href="/portafolio" className="hover:text-white transition-colors">Portafolio</Link></li>
              <li><Link href="/contacto" className="hover:text-white transition-colors">Contáctenos</Link></li>
            </ul>
          </div>

          {/* Servicios */}
          <div>
            <h4 className="font-display text-[15px] font-medium text-white mb-4">Nuestros servicios</h4>
            <ul className="space-y-2.5 text-[14px]">
              <li><Link href="/portafolio" className="hover:text-white transition-colors">Alquiler de equipos</Link></li>
              <li><Link href="/portafolio" className="hover:text-white transition-colors">Oxígeno domiciliario</Link></li>
            </ul>
          </div>

          {/* Contacto */}
          <div>
            <h4 className="font-display text-[15px] font-medium text-white mb-4">Contáctanos</h4>
            <a
              href="https://wa.me/573103861480?text=Hola,%20requiero%20información%20y%20asesoría%20técnica"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-[#128C7E] hover:bg-[#0f7566] transition-colors text-white px-4.5 py-2.5 rounded-md text-[14px] font-medium mb-4"
            >
              <WhatsappIcon size={16} /> Escríbenos por WhatsApp
            </a>
            <ul className="space-y-2.5 text-[14px]">
              <li className="flex items-start gap-2">
                <MapPin size={15} className="text-[#1E9FC4] flex-shrink-0 mt-0.5" />
                <span>Calle 14C # 20-14 Barrio la Popa, Valledupar - César</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone size={15} className="text-[#1E9FC4] flex-shrink-0" />
                <span>310 3636481 · 310 3861480</span>
              </li>
              <li className="flex items-center gap-2">
                <Mail size={15} className="text-[#1E9FC4] flex-shrink-0" />
                <span>ingemedicsas@hotmail.com</span>
              </li>
            </ul>
          </div>
        </div>

        {/* pb-20 en móvil: deja espacio para que la bolita flotante de WhatsApp
            (fixed, bottom-5 right-5) no tape el copyright al hacer scroll al fondo. */}
        <div className="border-t border-white/10 pt-5 pb-20 md:pb-5 text-[13px] text-center">
          © {new Date().getFullYear()} Ingemedic de Colombia S.A.S. · Todos los derechos reservados
          <span className="block md:inline md:before:content-['·'] md:before:mx-2 mt-1.5 md:mt-0">
            Desarrollado por{' '}
            <a href="https://sodet.vercel.app" target="_blank" rel="noopener noreferrer"
              className="font-medium text-white hover:text-[#1E9FC4] transition-colors">
              SODET
            </a>
          </span>
        </div>
      </div>
    </footer>
  )
}
