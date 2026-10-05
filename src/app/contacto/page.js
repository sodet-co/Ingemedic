'use client'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { MapPin, Phone, Mail, Clock, Headphones, Send, CheckCircle2, MessageSquare, Loader2 } from 'lucide-react'
import { useState } from 'react'
import Link from 'next/link'
import { clicWhatsapp, formularioEnviado } from '@/lib/analitica'

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

export default function ContactoPage() {
  const FORM_VACIO = { nombre: '', telefono: '', correo: '', servicio: 'Suministro de Oxígeno', mensaje: '', sitio_web: '', autoriza: false }
  const [enviado, setEnviado] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState(FORM_VACIO)

  // Envía a /api/contacto: valida y responde al instante; el correo (Google Apps
  // Script) sale en segundo plano desde el servidor.
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (enviando) return
    setEnviando(true)
    setError('')
    setEnviado(false)
    try {
      const res = await fetch('/api/contacto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        setError(res.status === 400 && data.error ? data.error : 'No pudimos enviar tu mensaje.')
        return
      }
      setEnviado(true)
      formularioEnviado(form.servicio)
      setForm(FORM_VACIO)
    } catch {
      setError('No pudimos enviar tu mensaje. Revisa tu conexión.')
    } finally {
      setEnviando(false)
    }
  }

  // Si el envío falla, el cliente no pierde lo que escribió: se lo llevamos a WhatsApp
  const waFallback = 'https://wa.me/573103861480?text=' + encodeURIComponent(
    `Hola, soy ${form.nombre || '—'}. ${form.servicio ? `Me interesa: ${form.servicio}. ` : ''}${form.mensaje}`
  )

  return (
    <div className="min-h-screen bg-white text-slate-800 font-body selection:bg-blue-600 selection:text-white">
      <Header />

      {/* Hero Banner Contacto */}
      <section className="bg-gradient-to-br from-[#0B2656] via-[#0D2E68] to-[#071C40] text-white py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 md:px-8 text-center max-w-3xl">
          <div className="inline-block px-4 py-1.5 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-200 text-xs font-medium uppercase tracking-wider mb-4">
            CANALES DE ATENCIÓN DIRECTA Y ASESORÍA
          </div>
          <h1 className="text-3xl sm:text-5xl font-medium tracking-[-0.025em] mb-6">
            Estamos listos para atender tu consulta
          </h1>
          <p className="text-sm sm:text-base font-light text-blue-100/90 leading-relaxed max-w-2xl mx-auto">
            Contáctanos de inmediato para alquiler de equipos biomédicos, suministro de oxígeno medicinal o asesoría técnica para la oxigenoterapia en el hogar.
          </p>
        </div>
      </section>

      {/* Sección Principal: Información de Contacto + Formulario Interactivo */}
      <section className="max-w-7xl mx-auto px-4 md:px-8 py-16 lg:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">

          {/* Columna Izquierda: Información de Contacto + Asesoría 24h */}
          <div className="lg:col-span-6 space-y-6">
            <div>
              <span className="text-xs font-medium text-blue-600 uppercase tracking-widest block mb-1">Atención Inmediata</span>
              <h2 className="text-3xl font-medium tracking-[-0.02em] text-[#0B2656]">Información de Contacto</h2>
              <div className="w-12 h-1 rounded-full bg-blue-600 mt-2.5 mb-6" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-50 border border-slate-200/90 p-5 rounded-2xl flex items-start gap-4 hover:border-blue-300 transition-all shadow-sm">
                <div className="w-11 h-11 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
                  <Phone size={20} />
                </div>
                <div>
                  <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-0.5">Teléfonos Directos</h4>
                  <p className="text-sm font-medium text-slate-900 leading-snug">310 3636481</p>
                  <p className="text-sm font-medium text-slate-900 leading-snug">310 3861480</p>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200/90 p-5 rounded-2xl flex items-start gap-4 hover:border-blue-300 transition-all shadow-sm">
                <div className="w-11 h-11 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
                  <Mail size={20} />
                </div>
                <div>
                  <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-0.5">Correo Electrónico</h4>
                  <p className="text-xs font-medium text-slate-900 break-all">ingemedicsas@hotmail.com</p>
                  <p className="text-[11px] text-slate-500 mt-1">Atención administrativa</p>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200/90 p-5 rounded-2xl flex items-start gap-4 hover:border-blue-300 transition-all shadow-sm sm:col-span-2">
                <div className="w-11 h-11 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
                  <MapPin size={20} />
                </div>
                <div>
                  <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-0.5">Sede Principal</h4>
                  <p className="text-sm font-medium text-slate-900">Calle 14C # 20-14 Barrio la Popa</p>
                  <p className="text-xs text-slate-600 font-medium">Valledupar - Cesar, Colombia</p>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200/90 p-5 rounded-2xl flex items-start gap-4 hover:border-blue-300 transition-all shadow-sm sm:col-span-2">
                <div className="w-11 h-11 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
                  <Clock size={20} />
                </div>
                <div>
                  <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-0.5">Horarios de Atención</h4>
                  <p className="text-xs font-medium text-slate-900">Lunes a Viernes: 8:00 am - 12:00 pm / 2:00 pm - 6:00 pm</p>
                  <p className="text-xs font-medium text-slate-900 mt-0.5">Sábados: 8:00 am - 12:00 pm</p>
                </div>
              </div>
            </div>

            {/* Asesora Badge Card */}
            <div className="relative rounded-3xl overflow-hidden bg-[#0A2656] text-white p-6 shadow-xl flex items-center gap-5 mt-6 border border-blue-900/60">
              <div className="w-16 h-16 rounded-2xl bg-white text-[#0A2656] flex items-center justify-center flex-shrink-0 shadow-lg">
                <Headphones size={30} />
              </div>
              <div>
                <span className="text-[10px] font-medium text-blue-200 uppercase tracking-widest block mb-1">Soporte Continuo</span>
                <h4 className="text-base font-medium text-white">Asesoría Personalizada 24h</h4>
                <p className="text-xs text-blue-100/85 mt-1 leading-relaxed">
                  Te orientamos en la selección de concentradores, cilindros de oxígeno y repuestos médicos.
                </p>
              </div>
            </div>

            <div className="pt-2">
              <a
                href="https://wa.me/573103861480?text=Hola,%20requiero%20información%20y%20asesoría%20técnica"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => clicWhatsapp('contacto')}
                className="w-full h-12 rounded-2xl bg-[#25D366] hover:bg-[#128C7E] text-white text-xs font-medium flex items-center justify-center gap-2.5 shadow-lg hover:scale-[1.01] active:scale-95 transition-all cursor-pointer"
              >
                <WhatsappIcon size={18} /> Escribir a WhatsApp
              </a>
            </div>
          </div>

          {/* Columna Derecha: Formulario Completo y Estructurado */}
          <div className="lg:col-span-6 bg-slate-50 border border-slate-200/90 p-7 sm:p-9 rounded-3xl shadow-xl">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center flex-shrink-0">
                <MessageSquare size={20} />
              </div>
              <div>
                <h3 className="text-2xl font-medium tracking-[-0.01em] text-[#0B2656]">Envíanos un Mensaje</h3>
              </div>
            </div>
            <p className="text-xs text-slate-500 mb-6">
              Completa el formulario a continuación y uno de nuestros especialistas se pondrá en contacto contigo de forma prioritaria.
            </p>

            {enviado && (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium mb-6 flex items-center gap-3 shadow-sm">
                <CheckCircle2 size={20} className="text-emerald-600 flex-shrink-0" />
                <span>¡Mensaje recibido con éxito! Te contactaremos al número indicado en breve.</span>
              </div>
            )}

            {error && (
              <div role="alert" className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs font-medium mb-6 shadow-sm">
                {error}{' '}
                <a href={waFallback} target="_blank" rel="noopener noreferrer" onClick={() => clicWhatsapp('contacto_error_formulario')} className="underline">
                  Envíalo por WhatsApp
                </a>{' '}
                o llámanos al 310 3861480.
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Honeypot anti-spam: oculto para personas, los bots lo llenan */}
              <div aria-hidden="true" className="absolute -left-[9999px] w-px h-px overflow-hidden">
                <label>
                  No llenar
                  <input type="text" tabIndex={-1} autoComplete="off"
                    value={form.sitio_web} onChange={(e) => setForm({ ...form, sitio_web: e.target.value })} />
                </label>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Nombre Completo *</label>
                <input
                  type="text"
                  required
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  placeholder="Ej. María Pérez"
                  className="w-full h-12 px-4 rounded-xl border border-slate-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none text-xs sm:text-sm bg-white shadow-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">Teléfono / WhatsApp *</label>
                  <input
                    type="tel"
                    required
                    value={form.telefono}
                    onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                    placeholder="Ej. 310 1234567"
                    className="w-full h-12 px-4 rounded-xl border border-slate-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none text-xs sm:text-sm bg-white shadow-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">Correo Electrónico</label>
                  <input
                    type="email"
                    value={form.correo}
                    onChange={(e) => setForm({ ...form, correo: e.target.value })}
                    placeholder="ejemplo@correo.com"
                    className="w-full h-12 px-4 rounded-xl border border-slate-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none text-xs sm:text-sm bg-white shadow-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Servicio o Equipo de Interés</label>
                <select
                  value={form.servicio}
                  onChange={(e) => setForm({ ...form, servicio: e.target.value })}
                  className="w-full h-12 px-4 rounded-xl border border-slate-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none text-xs sm:text-sm bg-white shadow-sm font-medium text-slate-800"
                >
                  <option value="Suministro de Oxígeno">Suministro de Oxígeno Medicinal (INVIMA)</option>
                  <option value="Concentrador Respironics">Alquiler / Venta Concentrador Respironics</option>
                  <option value="Aspirador ADS100">Aspirador de Secreciones ADS100</option>
                  <option value="CPAP / BiPAP">Soporte Ventilatorio CPAP / BiPAP</option>
                  <option value="Concentrador Portátil">Concentrador de Oxígeno Portátil O2</option>
                  <option value="Mantenimiento o Asesoría">Mantenimiento de Equipos o Asesoría Técnica</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Mensaje o Detalle del Requerimiento *</label>
                <textarea
                  rows={4}
                  required
                  value={form.mensaje}
                  onChange={(e) => setForm({ ...form, mensaje: e.target.value })}
                  placeholder="Cuéntanos qué equipo o servicio necesitas y en qué municipio..."
                  className="w-full p-4 rounded-xl border border-slate-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none text-xs sm:text-sm bg-white resize-none shadow-sm"
                />
                <p className="text-[11px] text-slate-500 mt-1.5">
                  No hace falta incluir diagnósticos, historias clínicas ni documentos de identidad.
                </p>
              </div>

              {/* Autorización de tratamiento de datos (Ley 1581 de 2012) — también se valida en /api/contacto */}
              <label className="flex items-start gap-2.5 text-xs text-slate-600 leading-relaxed cursor-pointer">
                <input
                  type="checkbox"
                  required
                  checked={form.autoriza}
                  onChange={(e) => setForm({ ...form, autoriza: e.target.checked })}
                  className="mt-0.5 w-4 h-4 flex-shrink-0 accent-[#0A2656]"
                />
                <span>
                  Autorizo a Ingemedic de Colombia S.A.S. a tratar mis datos para responder esta solicitud, según su{' '}
                  <Link href="/politica-de-datos" target="_blank" className="font-medium text-blue-600 underline">
                    política de tratamiento de datos
                  </Link>. *
                </span>
              </label>

              <button
                type="submit"
                disabled={enviando}
                className="w-full h-12 rounded-xl bg-[#0A2656] hover:bg-[#0A2656] text-white text-xs font-medium flex items-center justify-center gap-2 shadow-lg hover:scale-[1.01] active:scale-95 transition-all cursor-pointer disabled:opacity-70 disabled:cursor-wait disabled:hover:scale-100"
              >
                {enviando
                  ? <><Loader2 size={16} className="animate-spin" /> Enviando…</>
                  : <><Send size={16} /> Enviar Solicitud de Información</>}
              </button>
            </form>
          </div>

        </div>
      </section>

      <Footer />
    </div>
  )
}
