'use client'
import { useState, useEffect } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { registrarBitacora } from '@/lib/bitacora'

const TOUR_KEY      = 'ingemedic_tour_completado'
const TOUR_PASO_KEY = 'ingemedic_tour_paso'
const TOUR_USER_KEY = 'ingemedic_tour_usuario'

const MENSAJE_CREDENCIALES = 'Usuario/correo o contraseña incorrectos.'
const MENSAJE_INACTIVO     = 'Tu usuario está desactivado. Habla con un administrador.'
const MENSAJE_CONEXION     = 'No se pudo conectar con el servidor. Revisa tu internet e intenta de nuevo.'
const MENSAJE_INTENTOS     = 'Demasiados intentos seguidos. Espera unos minutos e intenta de nuevo.'
const MENSAJE_SIN_CONFIRMAR = 'Tu cuenta aún no está confirmada. Habla con un administrador.'

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

export default function LoginPage() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword]     = useState('')
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [showPass, setShowPass]     = useState(false)
  const router = useRouter()

  // Arranca vacío siempre (server y cliente deben coincidir en el primer
  // render) y se adopta recién tras montar — igual patrón que el filtro de
  // Préstamos, para no volver a chocar con un error de hidratación.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('expirada')) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError('Tu sesión venció tras 8 horas — ingresa de nuevo.')
    } else if (params.get('inactivo')) {
      setError(MENSAJE_INACTIVO)
    }
  }, [])

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
    if (!ingresado || !clave) { setError('Escribe tu usuario/correo y tu contraseña.'); return }

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
      await Promise.race([
        registrarBitacora({ modulo: 'auth', accion: 'login', entidad: 'sesión', entidad_id: authData.user?.id, detalle: { email } }),
        new Promise(r => setTimeout(r, 1500)),
      ])

      // El límite de 8h lo calcula middleware.js con user.last_sign_in_at.
      // Recarga completa (no client-side navigation) para evitar que el Router Cache
      // de Next.js muestre datos de la sesión anterior al cambiar de usuario.
      window.location.href = '/dashboard'
    } catch (err) {
      console.error('Error en login:', err)
      fallar(MENSAJE_CONEXION)
    }
  }

  const logoSrc = '/images/logo.png'

  return (
    <div className="relative h-screen w-full overflow-hidden bg-white md:bg-[#1B3A6B]">
      {/* Mitad derecha — ahora más angosta (35%). Foto atenuada con un tinte NEUTRO
          (gris oscuro, no azul) para que no se vea "tan azul" */}
      <div className="hidden md:block absolute inset-y-0 right-0 w-[45%] bg-cover bg-center"
        style={{ backgroundImage: 'url(/images/login-bg-photo.jpg)' }}>
        {/* Overlay neutro (slate oscuro) en vez del azul de marca — atenúa sin "pintar" azul */}
        <div className="absolute inset-0" style={{ background: 'rgba(30,41,59,0.5)' }} />
        {/* Logo en círculo, centrado en la foto */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-64 h-64 rounded-full flex items-center justify-center overflow-hidden bg-white shadow-lg">
            <Image
              src={logoSrc}
              alt="Logo"
              width={400}
              height={400}
              className="object-contain"
              style={{ width: 'auto', height: '200px', maxWidth: '200px' }}
              priority
            />
          </div>
        </div>
      </div>

      {/* Mitad izquierda — ahora más ancha (65%), donde vive el login */}
      <div className="hidden md:block absolute inset-y-0 left-0 w-full md:w-[55%]"
        style={{ background: 'linear-gradient(160deg, #1B3A6B 0%, #14315C 100%)' }} />

      {/* Card flotante — centrada verticalmente, superpuesta cerca del borde entre
          las 2 mitades (en móvil, centrada sobre el color sólido nada más) */}
      <div className="absolute inset-y-0 left-0 w-full md:w-[55%] flex items-center justify-center px-6 md:px-0">
        <div className="w-full max-w-[400px] md:bg-white md:rounded-[24px] md:shadow-2xl p-0 md:p-11">
          {/* En celular la foto con el logo está oculta — el logo va arriba del saludo */}
          <div className="md:hidden flex justify-center mb-8">
            <Image src={logoSrc} alt="Ingemedic" width={1600} height={573} priority
              className="h-auto w-[230px]" />
          </div>
          <h2 className="text-[25px] font-extrabold text-[#1B3A6B] mb-1 text-center">¡Hola de nuevo!</h2>
          <p className="text-[15px] text-slate-400 mb-7 text-center">Ingresa con tu correo o nombre de usuario.</p>

          {error && (
            <div className="flex items-center gap-2 p-3 mb-5 rounded-[8px] bg-red-50 border border-red-200 text-[15px] text-red-600">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-[14px] font-bold text-[#1B3A6B] mb-1.5">
                Usuario
              </label>
              <input
                type="text"
                id="login-identificador"
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                placeholder="Correo o nombre de usuario"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className="w-full px-4 py-3.5 border border-slate-200 rounded-[10px] text-[16px] bg-white outline-none transition-all focus:border-[#2EB5D4]"
                required
              />
            </div>

            <div>
              <label className="block text-[14px] font-bold text-[#1B3A6B] mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  id="login-clave"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Ingresa tu contraseña"
                  autoComplete="current-password"
                  className="w-full px-4 pr-10 py-3.5 border border-slate-200 rounded-[10px] text-[16px] bg-white outline-none transition-all focus:border-[#2EB5D4]"
                  required
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    {showPass
                      ? <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>
                      : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
                    }
                  </svg>
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-full text-[16px] font-bold text-white transition-all mt-2 hover:scale-[1.02]"
              style={{ background: loading ? '#94A3B8' : '#1B3A6B' }}
            >
              {loading ? 'Verificando...' : 'Ingresar'}
            </button>
          </form>

          <p className="text-center text-[13px] text-slate-300 mt-7">
            © {new Date().getFullYear()} Ingemedic de Colombia S.A.S. — Desarrollado por{' '}
            <a href="https://sodet.vercel.app" target="_blank" rel="noopener noreferrer"
              className="font-semibold text-slate-400 hover:text-[#1B3A6B] transition-colors">
              SODET
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}