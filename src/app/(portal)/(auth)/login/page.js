'use client'
import { useState, useEffect } from 'react'
import Image from 'next/image'
import { Eye, EyeOff, Loader2, AlertCircle, ArrowLeft, ShieldCheck, Building2, Lock } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { registrarBitacora } from '@/lib/bitacora'
import { SITIO_URL, EMPRESA } from '@/lib/sitio'

const TOUR_KEY      = 'ingemedic_tour_completado'
const TOUR_PASO_KEY = 'ingemedic_tour_paso'
const TOUR_USER_KEY = 'ingemedic_tour_usuario'
const MODO_KEY      = 'ingemedic_login_modo' // recuerda si la última vez entró como cliente

const MENSAJE_CREDENCIALES = 'Usuario/correo o contraseña incorrectos.'
const MENSAJE_INACTIVO     = 'Tu usuario está desactivado. Habla con un administrador.'
const MENSAJE_CONEXION     = 'No se pudo conectar con el servidor. Revisa tu internet e intenta de nuevo.'
const MENSAJE_INTENTOS     = 'Demasiados intentos seguidos. Espera unos minutos e intenta de nuevo.'
const MENSAJE_SIN_CONFIRMAR = 'Tu cuenta aún no está confirmada. Habla con un administrador.'

// Textos que cambian entre el personal de Ingemedic y los clientes. La cuenta
// es la misma (Supabase Auth): el modo solo ajusta la pantalla y a dónde se
// va después; el middleware manda a cada quien a lo suyo de todas formas.
const MODOS = {
  personal: {
    titulo: '¡Hola de nuevo!',
    subtitulo: 'Ingresa con tu correo o nombre de usuario.',
    etiqueta: 'Usuario',
    placeholder: 'Correo o nombre de usuario',
    autoComplete: 'username',
    destino: '/dashboard',
    fotoTitulo: 'Gestión de equipos biomédicos',
    fotoTexto: 'Inventario, préstamos, entregas y mantenimientos en un solo lugar.',
  },
  cliente: {
    titulo: 'Portal de clientes',
    subtitulo: 'Consulta tus equipos, pacientes y mantenimientos.',
    etiqueta: 'Correo',
    placeholder: 'El correo con el que te dimos acceso',
    autoComplete: 'email',
    destino: '/cliente',
    fotoTitulo: 'Tus equipos, siempre a la vista',
    fotoTexto: 'Revisa qué equipos tienes, a qué pacientes están asignados y cuándo recibieron mantenimiento.',
  },
}

// Traduce el error de Supabase Auth a un mensaje claro. Lo que no se
// reconoce cae en "credenciales incorrectas" (no revela si el usuario existe).
function mensajeErrorAuth(err) {
  const code = err?.code || ''
  const msg  = err?.message || ''
  if (code === 'user_banned' || /banned/i.test(msg)) return MENSAJE_INACTIVO   // desactivado (ver /api/usuarios)
  if (err?.status === 429 || /rate.?limit|too many/i.test(code + ' ' + msg)) return MENSAJE_INTENTOS
  if (code === 'email_not_confirmed') return MENSAJE_SIN_CONFIRMAR
  // Sin respuesta del servidor (caída de red): supabase-js devuelve status 0 o AuthRetryableFetchError
  if (err?.status === 0 || err?.name === 'AuthRetryableFetchError' || /fetch|network/i.test(msg)) return MENSAJE_CONEXION
  return MENSAJE_CREDENCIALES
}

const inputCls = 'w-full px-4 py-3.5 border border-slate-300 rounded-[10px] text-[16px] text-slate-800 bg-white outline-none transition-shadow placeholder:text-slate-400 focus:border-[#2EB5D4] focus:ring-4 focus:ring-[#2EB5D4]/20'

export default function LoginPage() {
  const [modo, setModo]             = useState('personal')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword]     = useState('')
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [showPass, setShowPass]     = useState(false)
  const [bloqMayus, setBloqMayus]   = useState(false)
  const [portalBloqueado, setPortalBloqueado] = useState(false)

  const t = MODOS[modo]

  // Arranca vacío siempre (server y cliente deben coincidir en el primer
  // render) y se adopta recién tras montar — igual patrón que el filtro de
  // Préstamos, para no volver a chocar con un error de hidratación.
  // ¿El SuperAdmin bloqueó el portal de clientes? (API pública: solo dice si está activo)
  useEffect(() => {
    let vigente = true
    fetch('/api/configuracion/portal-clientes')
      .then(r => r.ok ? r.json() : { activo: true })
      .then(d => { if (vigente) setPortalBloqueado(d.activo === false) })
      .catch(() => {})
    return () => { vigente = false }
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    let guardado = null
    try { guardado = localStorage.getItem(MODO_KEY) } catch { /* almacenamiento no disponible */ }
    // ?cliente=1 sirve para enlazar directo al portal de clientes (desde www)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (params.get('cliente') || guardado === 'cliente') setModo('cliente')

    if (params.get('expirada')) {
      setError('Tu sesión venció tras 8 horas — ingresa de nuevo.')
    } else if (params.get('inactivo')) {
      setError(MENSAJE_INACTIVO)
    }
  }, [])

  function cambiarModo(nuevo) {
    if (nuevo === modo) return
    setModo(nuevo)
    setError('')
    try { localStorage.setItem(MODO_KEY, nuevo) } catch { /* almacenamiento no disponible */ }
  }

  // El aviso de Bloq Mayús solo se puede leer de un evento de teclado
  function revisarBloqMayus(e) {
    if (typeof e.getModifierState === 'function') setBloqMayus(e.getModifierState('CapsLock'))
  }

  async function handleLogin(e) {
    e.preventDefault()
    if (loading) return // evita doble envío (Enter + clic)

    // Se lee lo que se VE en los campos (no solo el estado de React): en un
    // celular lento se puede escribir antes de que la página termine de
    // cargar, y ahí el estado queda vacío aunque los campos tengan texto.
    // (Por id y SIN atributo name: con name, un envío antes de que cargue el
    // JS mandaría usuario y contraseña en la URL.)
    const form      = e.currentTarget
    const ingresado = (form.querySelector('#login-identificador')?.value ?? identifier).trim()
    const clave     = form.querySelector('#login-clave')?.value ?? password
    if (!ingresado || !clave) {
      setError(modo === 'cliente' ? 'Escribe tu correo y tu contraseña.' : 'Escribe tu usuario/correo y tu contraseña.')
      return
    }
    if (modo === 'cliente' && portalBloqueado) return
    // Los clientes no tienen nombre de usuario: solo correo
    if (modo === 'cliente' && !ingresado.includes('@')) {
      setError('Escribe el correo completo con el que Ingemedic te dio acceso.')
      return
    }

    setLoading(true)
    setError('')

    // Mismo mensaje si el usuario no existe o si la contraseña está mal:
    // mensajes distintos dejaban averiguar qué nombres de usuario existen.
    const fallar = (msg = MENSAJE_CREDENCIALES) => { setError(msg); setLoading(false) }

    // Todo va en try/catch: sin esto, una caída de red o de Supabase dejaba
    // el botón en "Verificando..." para siempre.
    try {
      const supabase = createClient()
      const isEmail  = ingresado.includes('@')
      let email      = ingresado.toLowerCase()
      let userId     = null

      if (!isEmail) {
        // Username → email con la función email_por_username (SECURITY DEFINER):
        // devuelve solo ese usuario, sin exponer la tabla usuarios sin sesión.
        const { data, error: fetchError } = await supabase
          .rpc('email_por_username', { p_username: ingresado })
          .maybeSingle()
        // Un error aquí es de conexión/servidor, no de credenciales
        if (fetchError) return fallar(MENSAJE_CONEXION)
        if (!data?.email) return fallar()
        email  = data.email.trim().toLowerCase()
        userId = data.id
      }

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password: clave })

      if (authError) return fallar(mensajeErrorAuth(authError))

      // Si el usuario es diferente al último, resetear el tour.
      // El almacenamiento puede estar bloqueado (modo privado en algunos
      // celulares): si falla no importa, pero no debe impedir el ingreso.
      try {
        const lastUser = localStorage.getItem(TOUR_USER_KEY)
        const currentUser = userId || authData.user?.id || email
        if (lastUser !== currentUser) {
          localStorage.removeItem(TOUR_KEY)
          localStorage.removeItem(TOUR_PASO_KEY)
          localStorage.setItem(TOUR_USER_KEY, currentUser)
        }
        // El Panel de Atención y la franja de vigencia se cierran con una x "por
        // esta sesión" (ver PanelAtencion.js / BannerAtencion.js) — cada login
        // nuevo debe volver a mostrarlos, así el usuario los haya cerrado ayer.
        sessionStorage.removeItem('panel_atencion_oculto')
        sessionStorage.removeItem('banner_atencion_oculto')
      } catch { /* almacenamiento no disponible */ }

      // Se espera a la bitácora (máx. 1,5 s) para que la redirección no corte
      // el guardado del registro de ingreso. registrarBitacora nunca lanza error.
      // Los clientes no se registran: bitacora.usuario_id apunta a `usuarios`.
      if (modo === 'personal') {
        await Promise.race([
          registrarBitacora({ modulo: 'auth', accion: 'login', entidad: 'sesión', entidad_id: authData.user?.id, detalle: { email } }),
          new Promise(r => setTimeout(r, 1500)),
        ])
      }

      // El límite de 8h lo calcula middleware.js con user.last_sign_in_at.
      // Recarga completa (no client-side navigation) para evitar que el Router Cache
      // de Next.js muestre datos de la sesión anterior al cambiar de usuario.
      // Si alguien entra por la pestaña equivocada, el middleware lo corrige.
      window.location.href = t.destino
    } catch (err) {
      console.error('Error en login:', err)
      fallar(MENSAJE_CONEXION)
    }
  }

  const logoSrc = '/images/logo.png'

  return (
    <div className="min-h-[100dvh] w-full grid md:grid-cols-[minmax(0,1fr)_45%] bg-[#F8FAFC]">
      {/* Formulario — lado claro */}
      <div className="flex flex-col px-4 md:px-10 py-6">
        <a href={SITIO_URL}
          className="self-start inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-slate-500 hover:text-[#1B3A6B] rounded-md px-1 -mx-1 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2EB5D4]">
          <ArrowLeft size={15} /> Volver a ingemedic.com.co
        </a>

        <div className="flex-1 flex items-center justify-center py-8">
          <div className="w-full max-w-[420px] bg-white rounded-[24px] border border-slate-200 shadow-[0_10px_40px_-12px_rgba(27,58,107,0.18)] p-6 sm:p-10">
            <div className="flex justify-center mb-7">
              <Image src={logoSrc} alt="Ingemedic" width={1600} height={573} priority
                className="h-auto w-[200px]" />
            </div>

            {/* Personal / Soy cliente */}
            <div role="tablist" aria-label="Tipo de acceso"
              className="grid grid-cols-2 p-1 mb-7 rounded-full bg-slate-100">
              {[
                { id: 'personal', label: 'Personal', Icono: ShieldCheck },
                { id: 'cliente',  label: 'Soy cliente', Icono: Building2 },
              ].map(({ id, label, Icono }) => (
                <button key={id} type="button" role="tab" aria-selected={modo === id}
                  onClick={() => cambiarModo(id)}
                  className={`flex items-center justify-center gap-1.5 h-10 rounded-full text-[14px] font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2EB5D4] ${
                    modo === id ? 'bg-white text-[#1B3A6B] shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}>
                  <Icono size={15} /> {label}
                </button>
              ))}
            </div>

            <h1 className="text-[25px] font-extrabold text-[#1B3A6B] mb-1 text-center">{t.titulo}</h1>
            <p className="text-[15px] text-slate-500 mb-7 text-center">{t.subtitulo}</p>

            {modo === 'cliente' && portalBloqueado && (
              <div role="status" className="flex items-start gap-2.5 p-3.5 mb-5 rounded-[10px] bg-amber-50 border border-amber-200 text-[14px] text-amber-800">
                <Lock size={16} className="flex-shrink-0 mt-0.5" />
                <span><strong>Módulo bloqueado temporalmente.</strong> El portal de clientes no está disponible en este momento.</span>
              </div>
            )}

            {error && (
              <div role="alert" className="flex items-start gap-2 p-3 mb-5 rounded-[10px] bg-red-50 border border-red-200 text-[14.5px] text-red-700">
                <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4" noValidate>
              <div>
                <label htmlFor="login-identificador" className="block text-[14px] font-bold text-[#1B3A6B] mb-1.5">
                  {t.etiqueta}
                </label>
                <input
                  type="text"
                  id="login-identificador"
                  value={identifier}
                  onChange={e => { setIdentifier(e.target.value); if (error) setError('') }}
                  placeholder={t.placeholder}
                  autoComplete={t.autoComplete}
                  inputMode={modo === 'cliente' ? 'email' : 'text'}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className={inputCls}
                  required
                />
              </div>

              <div>
                <label htmlFor="login-clave" className="block text-[14px] font-bold text-[#1B3A6B] mb-1.5">
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    id="login-clave"
                    value={password}
                    onChange={e => { setPassword(e.target.value); if (error) setError('') }}
                    onKeyDown={revisarBloqMayus}
                    onKeyUp={revisarBloqMayus}
                    onBlur={() => setBloqMayus(false)}
                    placeholder="Ingresa tu contraseña"
                    autoComplete="current-password"
                    aria-describedby={bloqMayus ? 'login-bloq-mayus' : undefined}
                    className={`${inputCls} pr-12`}
                    required
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    aria-pressed={showPass}
                    className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2EB5D4]">
                    {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {bloqMayus && (
                  <p id="login-bloq-mayus" className="mt-1.5 text-[13px] font-medium text-amber-700">
                    Bloq Mayús está activado.
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || (modo === 'cliente' && portalBloqueado)}
                aria-busy={loading}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-full text-[16px] font-bold text-white bg-[#1B3A6B] hover:bg-[#152D54] transition-colors mt-2 disabled:bg-slate-400 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2EB5D4]/40"
              >
                {loading ? <><Loader2 size={18} className="animate-spin" /> Verificando…</> : 'Ingresar'}
              </button>
            </form>

            <p className="text-center text-[13.5px] text-slate-500 mt-6 leading-relaxed">
              {modo === 'cliente' ? (
                <>¿Olvidaste tu contraseña o aún no tienes acceso? Escríbenos a{' '}
                  <a href={`mailto:${EMPRESA.email}`} className="font-semibold text-[#1B3A6B] hover:underline">{EMPRESA.email}</a>{' '}
                  o llama al{' '}
                  <a href={`tel:${EMPRESA.telefonos[0].replace(/\s/g, '')}`} className="font-semibold text-[#1B3A6B] hover:underline whitespace-nowrap">{EMPRESA.telefonos[0].replace('+57 ', '')}</a>.
                </>
              ) : (
                <>¿Olvidaste tu contraseña? Pídele a un administrador que te asigne una nueva.</>
              )}
            </p>
          </div>
        </div>

        <p className="text-center text-[13px] text-slate-400">
          © {new Date().getFullYear()} Ingemedic de Colombia S.A.S. — Desarrollado por{' '}
          <a href="https://sodet.vercel.app" target="_blank" rel="noopener noreferrer"
            className="font-semibold text-slate-500 hover:text-[#1B3A6B] transition-colors">
            SODET
          </a>
        </p>
      </div>

      {/* Foto con mensaje — solo en pantallas medianas en adelante */}
      <div className="hidden md:block relative bg-cover bg-center"
        style={{ backgroundImage: 'url(/images/login-bg-photo.jpg)' }}>
        <div className="absolute inset-0 bg-gradient-to-t from-[#0F1F3D]/90 via-[#1B3A6B]/45 to-[#1B3A6B]/15" />
        <div className="absolute inset-x-0 bottom-0 p-10 lg:p-14 text-white">
          <div className="w-12 h-1 rounded-full bg-[#D81B43] mb-5" />
          <h2 className="text-[30px] lg:text-[34px] font-extrabold leading-tight max-w-[420px]">{t.fotoTitulo}</h2>
          <p className="mt-3 text-[16px] text-white/85 max-w-[420px] leading-relaxed">{t.fotoTexto}</p>
        </div>
      </div>
    </div>
  )
}
