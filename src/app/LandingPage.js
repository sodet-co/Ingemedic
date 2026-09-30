'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { FAQS } from '@/components/landing/faqs'
import {
  Clock, ShieldCheck, Users2, ChevronRight, ChevronDown,
} from 'lucide-react'

const IMAGENES_HERO = [
  { src: '/images/planta-tanques-1.jpg', alt: 'Planta de oxígeno medicinal de Ingemedic en Valledupar' },
  { src: '/images/planta-tanques-2.jpg', alt: 'Tanques de almacenamiento de oxígeno medicinal' },
  { src: '/images/ingemedic-concentrador-oxigeno.png', alt: 'Concentrador de oxígeno domiciliario' },
]

const CIFRAS = [
  { valor: '+ 20.000', label: 'Pacientes atendidos' },
  { valor: '+ 13', label: 'Años de experiencia' },
  { valor: '+ 10.000', label: 'Entregas realizadas' },
  { valor: 'Cesar', label: 'Cobertura en todo el departamento' },
]

const POR_QUE = [
  {
    icon: Clock,
    titulo: 'Servicio técnico 24/7',
    desc: 'Atención permanente para mantenimiento correctivo en todo el departamento.',
  },
  {
    icon: ShieldCheck,
    titulo: 'Equipos de alta calidad',
    desc: 'Equipamiento biomédico certificado y sometido a control periódico.',
  },
  {
    icon: Users2,
    titulo: 'Personal calificado',
    desc: 'Ingenieros y técnicos biomédicos con entrenamiento específico por equipo.',
  },
]

const SERVICIOS = [
  {
    titulo: 'Alquiler de equipos',
    desc: 'Alquiler flexible, sin tiempos mínimos rígidos, ajustado a la indicación médica de cada paciente.',
    img: '/images/ingemedic-cpap.png',
  },
  {
    titulo: 'Oxígeno domiciliario',
    desc: 'Oxígeno medicinal con instalación en el hogar y capacitación al paciente y sus cuidadores.',
    img: '/images/ingemedic-planta-oxigeno.jpg',
  },
]

const EQUIPOS = [
  { nombre: 'Concentrador Respironics', linea: 'Oxigenoterapia domiciliaria', img: '/images/ingemedic-concentrador-oxigeno.png' },
  { nombre: 'Aspirador ADS100', linea: 'Succión de secreciones', img: '/images/ingemedic-aspirador-secreciones.png' },
  { nombre: 'Soporte CPAP / BiPAP', linea: 'Presión positiva no invasiva', img: '/images/ingemedic-cpap.png' },
  { nombre: 'Concentrador portátil', linea: 'Oxigenoterapia compacta', img: '/images/ingemedic-conc-tiger.png' },
]

function WhatsappIcon({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={`flex-shrink-0 ${className}`}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414-.074-.124-.272-.198-.57-.347m-5.421 7.461h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

export default function LandingPage() {
  const [faqAbierta, setFaqAbierta] = useState(0)
  const [indiceImagenHero, setIndiceImagenHero] = useState(0)

  useEffect(() => {
    const intervalo = setInterval(() => {
      setIndiceImagenHero(i => (i + 1) % IMAGENES_HERO.length)
    }, 4000)
    return () => clearInterval(intervalo)
  }, [])

  return (
    <div className="font-body min-h-screen bg-[#F3F6FA] text-[#101F33]">
      <Header />

      {/* ── HERO ── */}
      <div className="bg-white border-b border-[#DDE5EE]">
        <div className="max-w-[1180px] mx-auto px-5 md:px-7 grid grid-cols-1 md:grid-cols-[1.05fr_0.95fr] gap-10 md:gap-14 items-center pt-14 md:pt-16 pb-16 md:pb-24">
          <div>
            <h1 className="font-display text-[34px] sm:text-[42px] lg:text-[50px] font-medium text-[#0E2A4D] uppercase leading-[1.12] tracking-[-0.025em]">
              Equipos biomédicos<br />y oxígeno domiciliario
            </h1>
            <p className="mt-5 text-[16px] sm:text-[18px] font-light text-[#5D6F86] leading-relaxed max-w-xl">
              Servicio técnico calificado y acompañamiento en la recuperación de tus pacientes en todo el Cesar.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mt-8">
              <a
                href="https://wa.me/573103861480?text=Hola,%20requiero%20información%20sobre%20el%20catálogo%20de%20productos"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 text-[14.5px] font-medium text-white bg-[#C8102E] hover:bg-[#a80d26] px-6 py-3.5 rounded-md transition-colors"
              >
                <WhatsappIcon size={17} /> Consultar catálogo
              </a>
              <Link href="/portafolio"
                className="inline-flex items-center justify-center text-[14.5px] font-medium text-[#0E2A4D] border border-[#0E2A4D] hover:bg-[#0E2A4D] hover:text-white px-6 py-3.5 rounded-md transition-colors">
                Ver portafolio
              </Link>
            </div>

            <a href="#certificacion-invima"
              className="inline-flex items-center gap-3.5 mt-9 px-5 py-3.5 bg-[#E3F3F8] border border-[#C3E2ED] border-l-4 border-l-[#1E9FC4] rounded-lg hover:bg-[#DCEFF6] transition-colors">
              <span className="w-11 h-11 flex-shrink-0 rounded-full bg-white border border-[#C3E2ED] grid place-items-center font-display text-[10px] font-medium text-[#1E9FC4]">
                INVIMA
              </span>
              <span>
                <span className="block font-display text-[15px] font-medium text-[#0E2A4D]">Certificados por INVIMA</span>
                <span className="block text-[13px] text-[#5D6F86]">Resolución 2026013255 · vigente hasta abril de 2029</span>
              </span>
            </a>
          </div>

          <div className="relative aspect-[4/3.2] rounded-[10px] overflow-hidden border border-[#DDE5EE]">
            {IMAGENES_HERO.map((img, i) => (
              <div key={img.src} className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${i === indiceImagenHero ? 'opacity-100' : 'opacity-0'}`}>
                {/* La primera es lo primero que se ve (LCP): con prioridad. Las demás, diferidas */}
                <Image src={img.src} alt={img.alt} fill priority={i === 0} sizes="(min-width: 1180px) 530px, (min-width: 768px) 45vw, 100vw" className="object-cover" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── CIFRAS — monta sobre el borde inferior del hero ── */}
      <div className="max-w-[1180px] mx-auto px-5 md:px-7 -mt-10 md:-mt-14 relative z-10">
        <div className="bg-[#0E2A4D] rounded-[10px] grid grid-cols-2 md:grid-cols-4 shadow-[0_18px_40px_-22px_rgba(14,42,77,0.55)]">
          {CIFRAS.map((c, i) => (
            <div key={c.label} className={`px-6 py-7 md:px-8 ${i < CIFRAS.length - 1 ? 'border-b md:border-b-0 md:border-r border-white/15' : ''} ${i % 2 === 0 ? 'border-r md:border-r-0 border-white/15' : ''}`}>
              <div className="font-display text-[26px] md:text-[34px] font-medium tracking-[-0.02em] text-white leading-none">{c.valor}</div>
              <div className="mt-1.5 text-[12.5px] md:text-[13.5px] text-[#A9C2DC]">{c.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── POR QUÉ ELEGIRNOS ── */}
      <section className="py-20 md:py-24" id="nosotros">
        <div className="max-w-[1180px] mx-auto px-5 md:px-7">
          <div className="max-w-xl mb-11">
            <div className="w-[52px] h-[3px] bg-[#1E9FC4] rounded-full mb-[18px]" />
            <h2 className="font-display text-[28px] md:text-[34px] font-medium tracking-[-0.02em] text-[#0E2A4D]">Por qué elegir Ingemedic</h2>
            <p className="mt-3 font-light text-[17px] text-[#5D6F86]">Respaldo técnico permanente para instituciones de salud y pacientes en casa.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 bg-white border border-[#DDE5EE] rounded-[10px] overflow-hidden">
            {POR_QUE.map((p, i) => (
              <div key={p.titulo} className={`p-8 md:p-9 ${i < POR_QUE.length - 1 ? 'border-b md:border-b-0 md:border-r border-[#DDE5EE]' : ''}`}>
                <div className="w-11 h-11 rounded-[9px] bg-[#E3F3F8] grid place-items-center mb-[18px]">
                  <p.icon size={22} className="text-[#1E9FC4]" strokeWidth={2} />
                </div>
                <h3 className="font-display text-[19px] font-medium tracking-[-0.01em] text-[#0E2A4D] mb-2">{p.titulo}</h3>
                <p className="text-[14.5px] text-[#5D6F86]">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SERVICIOS DESTACADOS + EQUIPOS ── */}
      <section className="bg-white py-20 md:py-24" id="servicios">
        <div className="max-w-[1180px] mx-auto px-5 md:px-7">
          <div className="max-w-xl mb-11">
            <div className="w-[52px] h-[3px] bg-[#1E9FC4] rounded-full mb-[18px]" />
            <h2 className="font-display text-[28px] md:text-[34px] font-medium tracking-[-0.02em] text-[#0E2A4D]">Servicios destacados</h2>
            <p className="mt-3 font-light text-[17px] text-[#5D6F86]">Del suministro del equipo al soporte técnico durante toda su vida útil.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {SERVICIOS.map(s => (
              <Link href="/portafolio" key={s.titulo}
                className="border border-[#DDE5EE] rounded-[10px] overflow-hidden bg-white flex flex-col sm:flex-row hover:shadow-md transition-shadow">
                <div className="relative aspect-[16/10] sm:aspect-auto sm:w-[42%] flex-shrink-0">
                  <Image src={s.img} alt={s.titulo} fill sizes="(min-width: 640px) 240px, 100vw" className="object-cover" />
                </div>
                <div className="p-6 flex flex-col gap-2.5 flex-1">
                  <h3 className="font-display text-[19px] font-medium tracking-[-0.01em] text-[#0E2A4D]">{s.titulo}</h3>
                  <p className="text-[14px] text-[#5D6F86] flex-1">{s.desc}</p>
                  <span className="text-[13.5px] font-medium text-[#1E9FC4] mt-1">Conoce más</span>
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-[52px] pt-11 border-t border-[#DDE5EE]" id="equipos">
            <div className="flex items-end justify-between gap-6 flex-wrap mb-6">
              <div>
                <h3 className="font-display text-[22px] font-medium tracking-[-0.01em] text-[#0E2A4D]">Equipos disponibles</h3>
                <p className="mt-1.5 text-[15px] text-[#5D6F86]">Los que más solicitan nuestros clientes.</p>
              </div>
              <Link href="/portafolio"
                className="inline-flex items-center text-[13.5px] font-medium text-[#0E2A4D] border border-[#0E2A4D] hover:bg-[#0E2A4D] hover:text-white px-[18px] py-2.5 rounded-md transition-colors">
                Ver catálogo completo
              </Link>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-[18px]">
              {EQUIPOS.map(eq => (
                <Link href="/portafolio" key={eq.nombre}
                  className="border border-[#DDE5EE] rounded-[10px] bg-white p-[18px] text-center hover:shadow-md transition-shadow">
                  <div className="relative aspect-square rounded-[8px] mb-3.5 bg-gradient-to-br from-[#eaf1f6] to-[#f7fafc] overflow-hidden">
                    <Image src={eq.img} alt={eq.nombre} fill sizes="(min-width: 1024px) 260px, 50vw" className="object-contain p-3" />
                  </div>
                  <div className="font-display text-[14px] font-medium text-[#0E2A4D]">{eq.nombre}</div>
                  <div className="text-[12.5px] text-[#5D6F86] mt-0.5">{eq.linea}</div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA COTIZACIÓN ── */}
      <div className="bg-[#C8102E]" id="contacto">
        <div className="max-w-[1180px] mx-auto px-5 md:px-7 py-11 flex items-center justify-between gap-9 flex-wrap">
          <div>
            <h2 className="font-display text-[24px] md:text-[28px] font-medium tracking-[-0.02em] text-white">¿Necesitas un equipo o servicio técnico?</h2>
            <p className="mt-2 text-[15px] text-white/90">Cuéntanos qué necesitas y te respondemos con una cotización.</p>
          </div>
          <Link href="/contacto"
            className="inline-flex items-center justify-center text-[14.5px] font-medium text-[#0E2A4D] bg-white hover:bg-slate-100 px-6 py-3.5 rounded-md transition-colors flex-shrink-0">
            Solicita tu cotización
          </Link>
        </div>
      </div>

      {/* ── CERTIFICACIÓN INVIMA ── */}
      <section className="bg-white py-20 md:py-24" id="certificacion-invima">
        <div className="max-w-[1180px] mx-auto px-5 md:px-7 grid grid-cols-1 md:grid-cols-[0.9fr_1.1fr] gap-11 md:gap-14 items-center">
          <div className="aspect-[4/3] rounded-[10px] border border-[#DDE5EE] bg-white flex items-center justify-center p-10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/logo-invima-oficial.png" alt="INVIMA — Instituto Nacional de Vigilancia de Medicamentos y Alimentos" className="max-h-28 w-auto object-contain" />
          </div>
          <div>
            <div className="w-[52px] h-[3px] bg-[#1E9FC4] rounded-full mb-[18px]" />
            <h2 className="font-display text-[28px] md:text-[34px] font-medium tracking-[-0.02em] text-[#0E2A4D]">Certificación INVIMA</h2>
            <p className="mt-3.5 text-[16px] font-light text-[#5D6F86] leading-relaxed max-w-xl">
              Ingemedic de Colombia S.A.S. está habilitada por el Instituto Nacional de Vigilancia de Medicamentos y Alimentos. Los datos de la resolución pueden consultarse directamente en el registro oficial.
            </p>
            <dl className="mt-6 border-t border-[#DDE5EE]">
              {[['Resolución', '2026013255'], ['Vigencia', 'Abril de 2029'], ['Razón social', 'Ingemedic de Colombia S.A.S.']].map(([dt, dd]) => (
                <div key={dt} className="flex items-center justify-between gap-5 py-3.5 border-b border-[#DDE5EE] text-[14.5px]">
                  <dt className="text-[#5D6F86]">{dt}</dt>
                  <dd className="font-medium text-[#0E2A4D]">{dd}</dd>
                </div>
              ))}
            </dl>
            <a href="https://www.invima.gov.co/establecimiento/2345g-ingemedic-de-colombia-sas" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-7 text-[14.5px] font-medium text-white bg-[#0E2A4D] hover:bg-[#091D36] px-6 py-3.5 rounded-md transition-colors">
              Consultar ficha oficial <ChevronRight size={15} />
            </a>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-20 md:py-24">
        <div className="max-w-[1180px] mx-auto px-5 md:px-7">
          <div className="text-center max-w-2xl mx-auto mb-10 flex flex-col items-center">
            <div className="w-[52px] h-[3px] bg-[#1E9FC4] rounded-full mb-[18px]" />
            <h2 className="font-display text-[28px] md:text-[34px] font-medium tracking-[-0.02em] text-[#0E2A4D]">Preguntas frecuentes</h2>
            <p className="mt-3 font-light text-[17px] text-[#5D6F86]">Resolvemos las dudas más comunes sobre nuestros servicios y equipos médicos.</p>
          </div>

          <div className="space-y-3 max-w-3xl mx-auto">
            {FAQS.map((f, i) => {
              const abierta = faqAbierta === i
              return (
                <div key={f.q} className="rounded-[10px] border border-[#DDE5EE] bg-white overflow-hidden">
                  <button onClick={() => setFaqAbierta(abierta ? -1 : i)}
                    className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-slate-50/60 transition-colors">
                    <span className="text-[14px] font-medium text-[#0E2A4D]">{f.q}</span>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-transform duration-300 ${abierta ? 'bg-[#1E9FC4] text-white rotate-180' : 'bg-[#E3F3F8] text-[#5D6F86]'}`}>
                      <ChevronDown size={14} />
                    </div>
                  </button>
                  {abierta && (
                    <div className="px-5 pb-4 pt-1 text-[13.5px] leading-relaxed border-t border-[#DDE5EE] text-[#5D6F86]">
                      {f.a}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
