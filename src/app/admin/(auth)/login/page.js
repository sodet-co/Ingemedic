'use client'
import { useState, useEffect } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { registrarBitacora } from '@/lib/bitacora'

const TOUR_KEY      = 'ingemedic_tour_completado'
const TOUR_PASO_KEY = 'ingemedic_tour_paso'
const TOUR_USER_KEY = 'ingemedic_tour_usuario'

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
    if (new URLSearchParams(window.location.search).get('expirada')) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError('Tu sesión venció tras 8 horas — ingresa de nuevo.')
    }
  }, [])

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const isEmail  = identifier.includes('@')
    let email      = identifier
    let userId     = null

    if (!isEmail) {
      // Búsqueda case-insensitive con ilike
      const { data, error: fetchError } = await supabase
        .from('usuarios')
        .select('email, id')
        .ilike('username', identifier.trim())
        .single()

      if (fetchError || !data) {
        setError('Usuario no reconocido en el sistema.')
        setLoading(false)
        return
      }
      email  = data.email
      userId = data.id
    }

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      setError('Correo/usuario o contraseña incorrectos.')
      setLoading(false)
      return
    }

    // Si el usuario es diferente al último, resetear el tour
    const lastUser = localStorage.getItem(TOUR_USER_KEY)
    const currentUser = userId || email
    if (lastUser !== currentUser) {
      localStorage.removeItem(TOUR_KEY)
      localStorage.removeItem(TOUR_PASO_KEY)
      localStorage.setItem(TOUR_USER_KEY, currentUser)
    }

    registrarBitacora({ modulo: 'auth', accion: 'login', entidad: 'sesión', entidad_id: authData.user?.id, detalle: { email } })

    // Marca de inicio para el límite absoluto de sesión (8h, ver middleware.js).
    document.cookie = `sesion_inicio=${Date.now()}; path=/; max-age=${60 * 60 * 24}`
    // El Panel de Atención y la franja de vigencia se cierran con una x "por
    // esta sesión" (ver PanelAtencion.js / BannerAtencion.js) — cada login
    // nuevo debe volver a mostrarlos, así el usuario los haya cerrado ayer.
    sessionStorage.removeItem('panel_atencion_oculto')
    sessionStorage.removeItem('banner_atencion_oculto')

    // Recarga completa (no client-side navigation) para evitar que el Router Cache
    // de Next.js muestre datos de la sesión anterior al cambiar de usuario.
    window.location.href = '/admin/dashboard'
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
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                placeholder="Ingresa tu correo"
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
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Ingresa tu contraseña"
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
            © {new Date().getFullYear()} Ingemedic de Colombia S.A.S. — Desarrollado por SODET
          </p>
        </div>
      </div>
    </div>
  )
}