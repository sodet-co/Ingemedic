'use client'
import { useState } from 'react'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { ChevronRight, ChevronLeft } from 'lucide-react'
import { clicWhatsapp } from '@/lib/analitica'

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

// 4 Equipos Biomédicos para el Carrusel 3D
const CAROUSEL_EQUIPOS = [
  {
    badge: 'Respironics',
    nombre: 'Concentrador Respironics',
    desc: 'Concentrador de oxígeno de alto rendimiento (5L a 10L/min) diseñado para oxigenoterapia domiciliaria continua.',
    img: '/images/ingemedic-concentrador-oxigeno.png',
  },
  {
    badge: 'ADS100',
    nombre: 'Aspirador de Secreciones ADS100',
    desc: 'Dispositivo de succión de grado médico de alta eficiencia para la remoción segura de fluidos en adultos y niños.',
    img: '/images/ingemedic-aspirador-secreciones.png',
  },
  {
    badge: 'ResMed',
    nombre: 'Soporte CPAP / BiPAP',
    desc: 'Dispositivos de presión positiva no invasiva para el tratamiento de apneas del sueño e insuficiencia respiratoria.',
    img: '/images/ingemedic-cpap.png',
  },
  {
    badge: 'O2 Type',
    nombre: 'Concentrador Portátil',
    desc: 'Oxigenoterapia domiciliaria compacta, ligera y recargable para mantener la autonomía de movimiento del paciente.',
    img: '/images/ingemedic-conc-tiger.png',
  },
]

// 4 Tarjetas de Equipos Biomédicos del Portafolio
const PORTAFOLIO_CARDS = [
  {
    subtitulo: 'ALQUILER Y VENTA DOMICILIARIA',
    titulo: 'Concentrador de Oxígeno Respironics',
    desc: 'Concentrador de oxígeno de alto rendimiento (5L a 10L/min) diseñado para oxigenoterapia domiciliaria continua.',
    img: '/images/ingemedic-concentrador-oxigeno.png',
    caracteristicas: [
      'Capacitación al paciente y cuidador',
      'Mantenimiento preventivo incluido',
      'Operación silenciosa y eficiente',
    ],
  },
  {
    subtitulo: 'SUCCIÓN MÉDICA DE ALTA EFICIENCIA',
    titulo: 'Aspirador de Secreciones ADS100',
    desc: 'Dispositivo de succión de grado médico de alta eficiencia diseñado para la remoción segura de fluidos en adultos y niños.',
    img: '/images/ingemedic-aspirador-secreciones.png',
    caracteristicas: [
      'Fácil operación e higiene',
      'Regulación de presión precisa',
      'Soporte técnico y repuestos a domicilio',
    ],
  },
  {
    subtitulo: 'VENTILACIÓN Y CUIDADO DEL SUEÑO',
    titulo: 'Soporte Ventilatorio CPAP / BiPAP',
    desc: 'Dispositivos de presión positiva no invasiva para el tratamiento de apneas del sueño e insuficiencia respiratoria.',
    img: '/images/ingemedic-cpap.png',
    caracteristicas: [
      'Ajuste personalizado de mascarilla',
      'Monitoreo de adherencia y presión',
      'Acompañamiento clínico continuo',
    ],
  },
  {
    subtitulo: 'AUTONOMÍA Y MOVILIDAD COMPACTA',
    titulo: 'Concentrador de Oxígeno Portátil O2',
    desc: 'Oxigenoterapia domiciliaria compacta, ligera y recargable para mantener la autonomía de movimiento del paciente.',
    img: '/images/ingemedic-conc-tiger.png',
    caracteristicas: [
      'Batería de larga duración recargable',
      'Diseño ultra compacto para transporte',
      'Flujo de oxígeno continuo e impulsado',
    ],
  },
]

export default function PortafolioPage() {
  const [productoActivo, setProductoActivo] = useState(0)

  // Drag handlers para el carrusel 3D
  const [touchStart, setTouchStart] = useState(0)
  const [touchEnd, setTouchEnd] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  const handleStart = (clientX) => {
    setTouchStart(clientX)
    setIsDragging(true)
  }

  const handleMove = (clientX) => {
    if (!isDragging) return
    setTouchEnd(clientX)
  }

  const handleEnd = () => {
    if (!isDragging) return
    setIsDragging(false)
    if (!touchStart || !touchEnd) return
    const distance = touchStart - touchEnd
    if (distance > 35) {
      setProductoActivo((p) => (p + 1) % CAROUSEL_EQUIPOS.length)
    } else if (distance < -35) {
      setProductoActivo((p) => (p - 1 + CAROUSEL_EQUIPOS.length) % CAROUSEL_EQUIPOS.length)
    }
    setTouchStart(0)
    setTouchEnd(0)
  }

  const getCardOffset = (index) => {
    const total = CAROUSEL_EQUIPOS.length
    let diff = index - productoActivo
    while (diff < -1) diff += total
    while (diff > 2) diff -= total
    return diff
  }

  return (
    <div className="min-h-screen bg-white text-slate-800 font-body selection:bg-blue-600 selection:text-white">
      <Header />

      {/* ── HERO UNIFICADO CON CARRUSEL 3D INTEGRADO ── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#0B2656] via-[#0D2E68] to-[#071C40] text-white pt-14 pb-16 lg:pt-18 lg:pb-20">
        <div className="max-w-[1920px] mx-auto px-4 md:px-10 2xl:px-16 relative z-10">
          <div className="text-center max-w-3xl mx-auto mb-10">
            <div className="inline-block px-4 py-1.5 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-200 text-xs font-medium uppercase tracking-wider mb-4 shadow-sm">
              PORTAFOLIO DE EQUIPOS BIOMÉDICOS
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-medium tracking-[-0.025em] text-white mb-4">
              Nuestro portafolio de equipos
            </h1>
            <p className="text-sm sm:text-base font-light text-blue-100/90 leading-relaxed max-w-xl mx-auto">
              Explora nuestra gama de concentradores de oxígeno, aspiradores de secreciones y soporte ventilatorio domiciliario.
            </p>
          </div>

          {/* Container del Carrusel 3D */}
          <div className="relative w-full overflow-hidden min-h-[400px] lg:min-h-[420px] flex items-center justify-center">

            {/* Flecha Izquierda */}
            <button
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                setProductoActivo((p) => (p - 1 + CAROUSEL_EQUIPOS.length) % CAROUSEL_EQUIPOS.length)
              }}
              aria-label="Equipo anterior"
              className="absolute left-2 md:left-6 top-1/2 -translate-y-1/2 z-50 w-12 h-12 rounded-full border border-white/40 bg-white/20 backdrop-blur-md text-white shadow-2xl flex items-center justify-center hover:bg-white/40 hover:scale-110 active:scale-95 transition-all cursor-pointer"
            >
              <ChevronLeft size={24} />
            </button>

            {/* Flecha Derecha */}
            <button
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                setProductoActivo((p) => (p + 1) % CAROUSEL_EQUIPOS.length)
              }}
              aria-label="Siguiente equipo"
              className="absolute right-2 md:left-auto md:right-6 top-1/2 -translate-y-1/2 z-50 w-12 h-12 rounded-full border border-white/40 bg-white/20 backdrop-blur-md text-white shadow-2xl flex items-center justify-center hover:bg-white/40 hover:scale-110 active:scale-95 transition-all cursor-pointer"
            >
              <ChevronRight size={24} />
            </button>

            <div
              onTouchStart={(e) => handleStart(e.touches[0].clientX)}
              onTouchMove={(e) => handleMove(e.touches[0].clientX)}
              onTouchEnd={handleEnd}
              onMouseDown={(e) => handleStart(e.clientX)}
              onMouseMove={(e) => handleMove(e.clientX)}
              onMouseUp={handleEnd}
              onMouseLeave={handleEnd}
              className="carousel-perspective-container relative py-4 select-none cursor-grab active:cursor-grabbing w-full flex items-center justify-center"
            >
              <div className="relative w-full max-w-6xl h-[360px] flex items-center justify-center">
                {CAROUSEL_EQUIPOS.map((item, index) => {
                  const offset = getCardOffset(index)
                  const isCenter = offset === 0
                  const isLeft = offset === -1
                  const isRight = offset === 1
                  const isVisible = isCenter || isLeft || isRight

                  const rotateY = isCenter ? 0 : isLeft ? 25 : isRight ? -25 : 0
                  const translateZ = isCenter ? 0 : isVisible ? -80 : -200

                  return (
                    <div
                      key={index}
                      onClick={() => isVisible && setProductoActivo(index)}
                      style={{
                        transform: `translate3d(calc(${offset} * min(470px, 68vw)), 0, ${translateZ}px) rotateY(${rotateY}deg) scale(${
                          isCenter ? 1 : 0.85
                        })`,
                        opacity: isCenter ? 1 : isVisible ? 0.5 : 0,
                        visibility: isVisible ? 'visible' : 'hidden',
                        transitionDuration: isVisible ? '0.8s' : '0s',
                        transitionProperty: isVisible ? 'transform, opacity, box-shadow' : 'none',
                        zIndex: isCenter ? 30 : isVisible ? 10 : 0,
                        pointerEvents: isVisible ? 'auto' : 'none',
                      }}
                      className={`carousel-slide-item absolute rounded-[28px] overflow-hidden ${
                        isCenter
                          ? 'w-full max-w-[320px] sm:max-w-[460px] lg:max-w-[540px] h-[340px] lg:h-[355px] border border-white/35 bg-gradient-to-br from-[#0F3B8C] via-[#0B2A66] to-[#071C44] backdrop-blur-xl shadow-[0_25px_60px_rgba(0,0,0,0.6)] cursor-default'
                          : 'w-full max-w-[320px] sm:max-w-[460px] lg:max-w-[540px] h-[340px] lg:h-[355px] border border-white/15 bg-white/10 backdrop-blur-md cursor-pointer hover:opacity-75'
                      }`}
                    >
                      <div className="w-full h-full flex flex-col sm:flex-row items-center p-6 sm:p-7 gap-5">
                        <div className="w-full sm:w-[48%] h-[170px] sm:h-full flex items-center justify-center p-2 relative flex-shrink-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={item.img}
                            alt={item.nombre}
                            className="max-h-full w-auto max-w-full object-contain filter drop-shadow-[0_15px_25px_rgba(0,0,0,0.45)]"
                          />
                        </div>

                        <div className="w-full sm:w-[52%] flex flex-col justify-center items-start text-left gap-2">
                          <span className="bg-[#1D4ED8] text-white text-[11px] font-medium px-3.5 py-0.5 rounded-full uppercase tracking-wider shadow-md">
                            {item.badge}
                          </span>
                          <h3 className="font-medium tracking-[-0.01em] text-white text-xl lg:text-2xl leading-tight">
                            {item.nombre}
                          </h3>
                          <div className="w-8 h-[2px] bg-white/60 rounded-full my-0.5" />
                          <p className="text-blue-100/90 text-xs leading-relaxed">
                            {item.desc}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 mt-4 relative z-50">
            {CAROUSEL_EQUIPOS.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setProductoActivo(i)}
                className={`h-2.5 rounded-full transition-all duration-500 cursor-pointer ${
                  i === productoActivo ? 'w-7 bg-white shadow-md' : 'w-2.5 bg-white/35 hover:bg-white/60'
                }`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── REJILLA DE TARJETAS DE PORTAFOLIO ── */}
      <section className="max-w-[1920px] mx-auto px-4 md:px-10 2xl:px-16 py-20 bg-slate-50 border-t border-slate-200">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <h2 className="text-2xl sm:text-4xl font-medium tracking-[-0.02em] text-[#0B2656] uppercase">
            Detalle del Portafolio
          </h2>
          <div className="w-14 h-1 rounded-full bg-blue-600 mx-auto my-3" />
          <p className="text-sm text-slate-600">Equipos biomédicos garantizados con entrega e instalación en tu domicilio</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-10">
          {PORTAFOLIO_CARDS.map((item, index) => (
            <div
              key={index}
              className="bg-white rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-xl transition-all overflow-hidden flex flex-col justify-between p-6 sm:p-8"
            >
              <div>
                <div className="bg-slate-100/80 rounded-2xl h-[210px] w-full flex items-center justify-center p-4 mb-5 overflow-hidden border border-slate-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.img}
                    alt={item.titulo}
                    className="max-h-full max-w-full object-contain filter drop-shadow-md hover:scale-105 transition-transform duration-500"
                  />
                </div>

                <span className="text-[11px] font-medium text-blue-600 uppercase tracking-widest block mb-1">
                  {item.subtitulo}
                </span>

                <h3 className="text-xl font-medium tracking-[-0.01em] text-[#0B2656] mb-2 leading-snug">
                  {item.titulo}
                </h3>

                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-5">
                  {item.desc}
                </p>

                <div className="space-y-2 mb-6 border-t border-slate-100 pt-4">
                  {item.caracteristicas.map((car, cIdx) => (
                    <div key={cIdx} className="flex items-center gap-2.5 text-xs font-medium text-slate-700">
                      <div className="w-4 h-4 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0 font-semibold text-[10px]">
                        ✓
                      </div>
                      <span>{car}</span>
                    </div>
                  ))}
                </div>
              </div>

              <a
                href={`https://wa.me/573103861480?text=Hola,%20requiero%20información%20sobre%20${encodeURIComponent(item.titulo)}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => clicWhatsapp('portafolio_equipo', item.titulo)}
                className="w-full h-12 rounded-xl bg-[#25D366] hover:bg-[#128C7E] text-white text-xs font-medium flex items-center justify-center gap-2 shadow-md hover:scale-[1.01] active:scale-95 transition-all cursor-pointer"
              >
                <WhatsappIcon size={18} />
                <span>Consultar disponibilidad</span>
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* Banner de Asesoría Rápida */}
      <section className="bg-[#0B2656] text-white py-12">
        <div className="max-w-[1920px] mx-auto px-4 md:px-10 2xl:px-16 text-center flex flex-col items-center">
          <h2 className="text-xl sm:text-3xl font-medium tracking-[-0.02em] mb-3">¿Dudas sobre el equipo o servicio indicado?</h2>
          <p className="text-xs sm:text-sm text-blue-100/90 max-w-xl mb-6">Nuestro equipo técnico responde tus preguntas de forma inmediata y coordina la entrega en tu domicilio.</p>
          <a
            href="https://wa.me/573103861480?text=Hola,%20requiero%20asesoría%20sobre%20los%20equipos%20del%20portafolio"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => clicWhatsapp('portafolio_asesoria')}
            className="h-12 px-8 rounded-full bg-[#25D366] hover:bg-[#128C7E] text-white text-xs font-medium flex items-center gap-2 shadow-xl hover:scale-105 transition-all"
          >
            <WhatsappIcon size={18} /> Hablar con un Asesor
          </a>
        </div>
      </section>

      <Footer />
    </div>
  )
}
