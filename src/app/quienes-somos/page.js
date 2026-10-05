'use client'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import Link from 'next/link'
import {
  Target, Eye, ShieldCheck, Clock, Users, FlaskConical, FileText,
  Headphones, ClipboardCheck, Truck, GraduationCap
} from 'lucide-react'

export default function QuienesSomosPage() {
  return (
    <div className="min-h-screen bg-white text-slate-800 font-body selection:bg-blue-600 selection:text-white">
      <Header />

      {/* Hero Banner Quiénes Somos */}
      <section className="bg-gradient-to-br from-[#0B2656] via-[#0D2E68] to-[#071C40] text-white py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 md:px-8 text-center max-w-3xl">
          <div className="inline-block px-4 py-1.5 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-200 text-xs font-medium uppercase tracking-wider mb-4">
            INGEMEDIC DE COLOMBIA S.A.S.
          </div>
          <h1 className="text-3xl sm:text-5xl font-medium tracking-[-0.025em] mb-6">
            Más de 13 años cuidando la salud de la región del Cesar
          </h1>
          <p className="text-sm sm:text-base font-light text-blue-100/90 leading-relaxed">
            Somos una empresa colombiana especializada en la producción de oxígeno medicinal con certificación INVIMA y la comercialización de equipos biomédicos.
          </p>
        </div>
      </section>

      {/* Historia & Presentación */}
      <section className="max-w-[1920px] mx-auto px-4 md:px-10 2xl:px-16 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="text-xs font-medium text-blue-600 uppercase tracking-widest">Nuestra Historia</span>
            <h2 className="text-3xl font-medium tracking-[-0.02em] text-[#0B2656] mt-2 mb-4">
              Compromiso, Calidad y Humanización en la Salud
            </h2>
            <div className="w-14 h-1 rounded-full bg-blue-600 mb-6" />
            <p className="text-sm text-slate-600 leading-relaxed mb-4 text-justify">
              <strong className="font-medium">INGEMEDIC DE COLOMBIA S.A.S.</strong> nació con la misión de proporcionar soluciones integrales de oxigenoterapia y tecnología biomédica para pacientes en hospitalización domiciliaria.
            </p>
            <p className="text-sm text-slate-600 leading-relaxed mb-6 text-justify">
              Con sede principal en Valledupar, cubrimos las necesidades respiratorias de más de 20,000 pacientes con un equipo técnico capacitado y una flota capacitada para el transporte seguro de gases medicinales.
            </p>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200">
              <div className="flex flex-col">
                <span className="text-3xl font-medium tracking-[-0.02em] text-[#0B2656]">+ 20.000</span>
                <span className="text-xs text-slate-500 font-medium mt-0.5">Pacientes atendidos</span>
              </div>
              <div className="flex flex-col">
                <span className="text-3xl font-medium tracking-[-0.02em] text-[#0B2656]">+ 13 Años</span>
                <span className="text-xs text-slate-500 font-medium mt-0.5">De experiencia en el sector</span>
              </div>
            </div>
          </div>

          <div className="rounded-3xl overflow-hidden shadow-2xl border border-slate-200 aspect-[4/3]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/ingemedic-senor.jpg"
              alt="Atención médica Ingemedic"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </section>

      {/* Misión y Visión */}
      <section className="bg-slate-50 py-20 border-y border-slate-200">
        <div className="max-w-[1920px] mx-auto px-4 md:px-10 2xl:px-16 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mb-4">
              <Target size={28} />
            </div>
            <h3 className="text-xl font-medium tracking-[-0.01em] text-[#0B2656] mb-3 uppercase">MISIÓN</h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed text-justify">
              Somos una empresa especializada en el suministro y comercialización de oxígeno medicinal y en el alquiler, mantenimiento y calibración de equipos Biomédicos para la hospitalización domiciliaria, enfocada en mejorar la calidad de vida de las personas en el departamento del Cesar.
            </p>
          </div>

          <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mb-4">
              <Eye size={28} />
            </div>
            <h3 className="text-xl font-medium tracking-[-0.01em] text-[#0B2656] mb-3 uppercase">VISIÓN</h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed text-justify">
              Para el año 2027 Ingemedic planea ser la empresa líder en el departamento del Cesar en el suministro y comercialización de oxígeno medicinal y equipos biomédicos para la hospitalización domiciliaria.
            </p>
          </div>
        </div>
      </section>

      {/* ── SECCIÓN ¿POR QUÉ ELEGIRNOS? ── */}
      <section className="max-w-[1920px] mx-auto px-8 md:px-10 2xl:px-16 py-20">
        <div className="mb-10 text-left max-w-4xl">
          <h2 className="text-3xl sm:text-4xl font-medium tracking-[-0.02em] text-[#0B2656] uppercase mb-4">
            ¿Por qué elegirnos?
          </h2>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
            En Ingemedic de Colombia S.A.S. nos diferenciamos por ofrecer un servicio responsable, técnicamente respaldado y orientado al bienestar del paciente. Estas son las razones por las que clientes, instituciones de salud y familias colombianas confían en nosotros:
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Card 1: Registro INVIMA */}
          <div className="bg-white border border-slate-200/90 rounded-3xl p-8 shadow-sm hover:shadow-xl transition-all flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-6 shadow-inner">
              <ShieldCheck size={26} />
            </div>
            <h3 className="text-lg font-medium tracking-[-0.01em] text-[#0B2656] mb-3">
              Registro sanitario vigente ante el INVIMA
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Operamos bajo el marco regulatorio exigido por las autoridades sanitarias colombianas, lo que garantiza que nuestro oxígeno medicinal cumple con los más altos estándares de calidad, pureza y seguridad establecidos en la normativa legal vigente.
            </p>
          </div>

          {/* Card 2: Disponibilidad 24h */}
          <div className="bg-white border border-slate-200/90 rounded-3xl p-8 shadow-sm hover:shadow-xl transition-all flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-6 shadow-inner">
              <Clock size={26} />
            </div>
            <h3 className="text-lg font-medium tracking-[-0.01em] text-[#0B2656] mb-3">
              Disponibilidad las 24 horas al día
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Entendemos que las necesidades médicas no tienen horario. Por eso, contamos con un esquema de atención continua que asegura el suministro oportuno de oxígeno y el soporte técnico de equipos en cualquier momento.
            </p>
          </div>

          {/* Card 3: Equipo técnico especializado */}
          <div className="bg-white border border-slate-200/90 rounded-3xl p-8 shadow-sm hover:shadow-xl transition-all flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-6 shadow-inner">
              <Users size={26} />
            </div>
            <h3 className="text-lg font-medium tracking-[-0.01em] text-[#0B2656] mb-3">
              Equipo técnico especializado
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Contamos con personal capacitado en el manejo, mantenimiento y asesoría de equipos médicos domiciliarios, garantizando una atención segura, precisa y humanizada en cada visita.
            </p>
          </div>
        </div>
      </section>

      {/* ── SECCIÓN ¿CÓMO FUNCIONA? (DISEÑO EXACTO SEGÚN REFERENCIA) ── */}
      <section className="bg-[#F8FAFC] py-20 border-y border-slate-200/80 overflow-hidden">
        <div className="max-w-[1920px] mx-auto px-4 md:px-10 2xl:px-16">
          <div className="mb-14 text-left max-w-4xl">
            <h2 className="text-3xl sm:text-4xl font-medium tracking-[-0.02em] text-[#1D4ED8] mb-2 uppercase">
              ¿CÓMO FUNCIONA?
            </h2>
            <div className="w-20 h-1.5 rounded-full bg-[#1D4ED8] mb-5" />
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              En <span className="font-medium text-slate-800">Ingemedic de Colombia S.A.S.</span> acompañamos al paciente y su familia desde el primer contacto hasta la entrega y seguimiento del servicio. Nuestro proceso es <strong className="text-[#1D4ED8] font-semibold">simple, ágil y seguro</strong>.
            </p>
          </div>

          <div className="relative max-w-6xl mx-auto">
            {/* Dashed Connecting Lines in Desktop View */}
            <svg
              className="hidden lg:block absolute inset-0 w-full h-full pointer-events-none z-10"
              xmlns="http://www.w3.org/2000/svg"
            >
              <line x1="48%" y1="70" x2="52%" y2="185" stroke="#1D4ED8" strokeWidth="2.5" strokeDasharray="8 8" />
              <line x1="52%" y1="225" x2="48%" y2="340" stroke="#1D4ED8" strokeWidth="2.5" strokeDasharray="8 8" />
              <line x1="48%" y1="380" x2="52%" y2="495" stroke="#1D4ED8" strokeWidth="2.5" strokeDasharray="8 8" />
              <line x1="52%" y1="535" x2="48%" y2="650" stroke="#1D4ED8" strokeWidth="2.5" strokeDasharray="8 8" />
              <line x1="48%" y1="690" x2="52%" y2="805" stroke="#1D4ED8" strokeWidth="2.5" strokeDasharray="8 8" />
            </svg>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-y-10 lg:gap-y-12 gap-x-12 lg:gap-x-16 items-start">
              {/* STEP 01 - Left */}
              <div className="relative group">
                <div className="absolute -top-4 -right-3 lg:-right-5 w-12 h-12 rounded-full bg-[#1D4ED8] text-white font-medium text-lg flex items-center justify-center shadow-lg border-2 border-white z-20 group-hover:scale-110 transition-transform">
                  01
                </div>
                <div className="bg-white rounded-[22px] border border-blue-200/90 p-6 sm:p-7 shadow-[0_4px_20px_rgba(29,78,216,0.06)] hover:shadow-xl hover:border-blue-400 transition-all duration-300 flex flex-col sm:flex-row items-start sm:items-center gap-5">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-blue-50/80 border border-blue-100 flex items-center justify-center flex-shrink-0 text-[#1D4ED8]">
                    <Headphones size={32} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-medium tracking-[-0.01em] text-[#0B2656] mb-2 leading-snug">
                      Contacto Inicial y Asesoría Personalizada
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                      El cliente se comunica con nosotros a través de nuestros canales de atención disponibles. Nuestro equipo especializado escucha la necesidad del paciente, ya sea por prescripción médica o requerimiento institucional, y orienta sobre el servicio más adecuado según su condición clínica.
                    </p>
                  </div>
                </div>
              </div>

              {/* STEP 02 - Right */}
              <div className="relative group lg:mt-24">
                <div className="absolute -top-4 -left-3 lg:-left-5 w-12 h-12 rounded-full bg-[#1D4ED8] text-white font-medium text-lg flex items-center justify-center shadow-lg border-2 border-white z-20 group-hover:scale-110 transition-transform">
                  02
                </div>
                <div className="bg-white rounded-[22px] border border-blue-200/90 p-6 sm:p-7 shadow-[0_4px_20px_rgba(29,78,216,0.06)] hover:shadow-xl hover:border-blue-400 transition-all duration-300 flex flex-col sm:flex-row items-start sm:items-center gap-5">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-blue-50/80 border border-blue-100 flex items-center justify-center flex-shrink-0 text-[#1D4ED8]">
                    <ClipboardCheck size={32} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-medium tracking-[-0.01em] text-[#0B2656] mb-2 leading-snug">
                      Evaluación y Verificación de Requisitos
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                      Se verifican los documentos necesarios para la prestación del servicio, incluyendo la orden médica o fórmula que justifica el suministro de oxígeno medicinal o el uso de equipos domiciliarios, conforme a la normativa sanitaria vigente.
                    </p>
                  </div>
                </div>
              </div>

              {/* STEP 03 - Left */}
              <div className="relative group">
                <div className="absolute -top-4 -right-3 lg:-right-5 w-12 h-12 rounded-full bg-[#1D4ED8] text-white font-medium text-lg flex items-center justify-center shadow-lg border-2 border-white z-20 group-hover:scale-110 transition-transform">
                  03
                </div>
                <div className="bg-white rounded-[22px] border border-blue-200/90 p-6 sm:p-7 shadow-[0_4px_20px_rgba(29,78,216,0.06)] hover:shadow-xl hover:border-blue-400 transition-all duration-300 flex flex-col sm:flex-row items-start sm:items-center gap-5">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-blue-50/80 border border-blue-100 flex items-center justify-center flex-shrink-0 text-[#1D4ED8]">
                    <FileText size={32} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-medium tracking-[-0.01em] text-[#0B2656] mb-2 leading-snug">
                      Cotización y Acuerdo del Servicio
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                      Se presenta al cliente una propuesta clara con las condiciones del servicio, tarifas de alquiler o venta de equipos y frecuencia de suministro de oxígeno, asegurando transparencia y cumplimiento regulatorio en cada acuerdo.
                    </p>
                  </div>
                </div>
              </div>

              {/* STEP 04 - Right */}
              <div className="relative group lg:mt-24">
                <div className="absolute -top-4 -left-3 lg:-left-5 w-12 h-12 rounded-full bg-[#1D4ED8] text-white font-medium text-lg flex items-center justify-center shadow-lg border-2 border-white z-20 group-hover:scale-110 transition-transform">
                  04
                </div>
                <div className="bg-white rounded-[22px] border border-blue-200/90 p-6 sm:p-7 shadow-[0_4px_20px_rgba(29,78,216,0.06)] hover:shadow-xl hover:border-blue-400 transition-all duration-300 flex flex-col sm:flex-row items-start sm:items-center gap-5">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-blue-50/80 border border-blue-100 flex items-center justify-center flex-shrink-0 text-[#1D4ED8]">
                    <Truck size={32} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-medium tracking-[-0.01em] text-[#0B2656] mb-2 leading-snug">
                      Instalación y Entrega
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                      Nuestro equipo técnico realiza la entrega e instalación de los equipos médicos directamente en el domicilio del paciente, verificando su correcto funcionamiento y garantizando condiciones seguras de uso. El suministro de oxígeno medicinal se realiza bajo protocolos estrictos de transporte y manipulación.
                    </p>
                  </div>
                </div>
              </div>

              {/* STEP 05 - Left */}
              <div className="relative group">
                <div className="absolute -top-4 -right-3 lg:-right-5 w-12 h-12 rounded-full bg-[#1D4ED8] text-white font-medium text-lg flex items-center justify-center shadow-lg border-2 border-white z-20 group-hover:scale-110 transition-transform">
                  05
                </div>
                <div className="bg-white rounded-[22px] border border-blue-200/90 p-6 sm:p-7 shadow-[0_4px_20px_rgba(29,78,216,0.06)] hover:shadow-xl hover:border-blue-400 transition-all duration-300 flex flex-col sm:flex-row items-start sm:items-center gap-5">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-blue-50/80 border border-blue-100 flex items-center justify-center flex-shrink-0 text-[#1D4ED8]">
                    <GraduationCap size={32} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-medium tracking-[-0.01em] text-[#0B2656] mb-2 leading-snug">
                      Capacitación al Paciente y su Familia
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                      Brindamos una inducción completa al paciente y sus cuidadores sobre el manejo adecuado de los equipos, medidas de seguridad en el hogar y uso correcto del oxígeno medicinal, promoviendo una atención domiciliaria segura y efectiva.
                    </p>
                  </div>
                </div>
              </div>

              {/* STEP 06 - Right */}
              <div className="relative group lg:mt-24">
                <div className="absolute -top-4 -left-3 lg:-left-5 w-12 h-12 rounded-full bg-[#1D4ED8] text-white font-medium text-lg flex items-center justify-center shadow-lg border-2 border-white z-20 group-hover:scale-110 transition-transform">
                  06
                </div>
                <div className="bg-white rounded-[22px] border border-blue-200/90 p-6 sm:p-7 shadow-[0_4px_20px_rgba(29,78,216,0.06)] hover:shadow-xl hover:border-blue-400 transition-all duration-300 flex flex-col sm:flex-row items-start sm:items-center gap-5">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-blue-50/80 border border-blue-100 flex items-center justify-center flex-shrink-0 text-[#1D4ED8] relative">
                    <Clock size={32} />
                    <span className="absolute bottom-1 right-1 text-[9px] font-semibold bg-[#1D4ED8] text-white px-1 rounded">24h</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-medium tracking-[-0.01em] text-[#0B2656] mb-2 leading-snug">
                      Seguimiento y Soporte Continuo
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                      Realizamos acompañamiento periódico para verificar el estado de los equipos, la evolución del servicio y la satisfacción del paciente. Ante cualquier eventualidad, nuestro equipo técnico responde de manera oportuna, con disponibilidad las 24 horas del día.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Certificación INVIMA */}
      <section className="max-w-[1920px] mx-auto px-4 md:px-10 2xl:px-16 py-20">
        <div className="bg-slate-950 text-white rounded-3xl p-8 lg:p-12 relative overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-8 items-center shadow-2xl">
          <div className="lg:col-span-7">
            <div className="inline-block px-4 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-medium uppercase tracking-wider mb-4 border border-blue-400/30">
              GARANTÍA SANITARIA
            </div>
            <h2 className="text-3xl font-medium tracking-[-0.02em] text-white mb-3">
              Certificación Oficial <span className="text-blue-400">INVIMA</span>
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed mb-6">
              Nuestra planta de producción y procesos de envasado cumplen rigurosamente con las Buenas Prácticas de Manufactura (BPM) exigidas en Colombia para gases medicinales.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-white/15 pt-6">
              <div className="flex items-center gap-3">
                <ShieldCheck size={24} className="text-blue-400 flex-shrink-0" />
                <span className="text-xs font-medium">Pureza certificada</span>
              </div>
              <div className="flex items-center gap-3">
                <FlaskConical size={24} className="text-blue-400 flex-shrink-0" />
                <span className="text-xs font-medium">Control de calidad</span>
              </div>
              <div className="flex items-center gap-3">
                <FileText size={24} className="text-blue-400 flex-shrink-0" />
                <span className="text-xs font-medium">Normativa legal</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 flex justify-center">
            <div className="bg-white/5 border border-white/15 rounded-2xl p-6 lg:p-8 max-w-[340px] backdrop-blur-sm">
              <h3 className="text-lg font-medium tracking-[-0.01em] text-white mb-2 leading-snug">
                Certificados en Buenas Prácticas de Manufactura — INVIMA
              </h3>
              <p className="text-sm text-slate-300 mb-5">
                Vigente hasta abril de 2029 · Resolución 2026013255
              </p>
              <a
                href="https://www.invima.gov.co/establecimiento/2345g-ingemedic-de-colombia-sas"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 transition-all shadow-md"
              >
                Verificar certificación en INVIMA →
              </a>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
