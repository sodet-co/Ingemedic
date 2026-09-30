'use client'
import { useState, useEffect } from 'react'
import { KeyRound, Loader2, Copy, Check, RefreshCw, UserX, Globe } from 'lucide-react'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { registrarBitacora } from '@/lib/bitacora'
import { formatear } from '@/lib/fechas'
import { PORTAL_URL } from '@/lib/sitio'

const inputCls = 'w-full px-3 py-2.5 border border-slate-200 rounded-[9px] text-[13.5px] text-slate-800 outline-none focus:border-[#D81B43] bg-white transition-colors placeholder:text-slate-400'

// Sin caracteres que se confunden al dictarla o copiarla a mano (0/O, 1/l/I)
const ALFABETO = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
function generarClave(largo = 10) {
  const bytes = new Uint32Array(largo)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => ALFABETO[b % ALFABETO.length]).join('')
}

// Sección "Acceso al portal" del panel de un cliente: crea la cuenta con la
// que el cliente entra a portal.ingemedic.com.co/cliente, le cambia la
// contraseña o se la quita. Todo pasa por /api/clientes/acceso (service_role).
export default function AccesoPortal({ cliente, onToast }) {
  const [cargando, setCargando]   = useState(true)
  const [acceso, setAcceso]       = useState(null)
  const [noHabilitado, setNoHabilitado] = useState(false)
  const [formulario, setFormulario] = useState(null) // null | 'crear' | 'clave'
  const [email, setEmail]         = useState('')
  const [clave, setClave]         = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError]         = useState('')
  const [entregar, setEntregar]   = useState(null) // { email, clave } recién creada, para copiarla
  const [copiado, setCopiado]     = useState(false)
  const [confirmarQuitar, setConfirmarQuitar] = useState(false)

  useEffect(() => {
    let vigente = true
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCargando(true); setFormulario(null); setEntregar(null); setError(''); setNoHabilitado(false)
    fetch(`/api/clientes/acceso?cliente_id=${cliente.id}`)
      .then(async r => {
        const data = await r.json().catch(() => ({}))
        if (!vigente) return
        if (!r.ok) { setNoHabilitado(true); setAcceso(null) }
        else setAcceso(data.acceso || null)
      })
      .catch(() => { if (vigente) setNoHabilitado(true) })
      .finally(() => { if (vigente) setCargando(false) })
    return () => { vigente = false }
  }, [cliente.id])

  function abrir(tipo) {
    setFormulario(tipo)
    setError('')
    setEntregar(null)
    setEmail(tipo === 'crear' ? (cliente.email || '') : '')
    setClave(generarClave())
  }

  async function guardar() {
    setGuardando(true)
    setError('')
    try {
      const res = await fetch('/api/clientes/acceso', {
        method: formulario === 'crear' ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cliente_id: cliente.id, email, password: clave }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error || 'No se pudo guardar.'); return }

      if (formulario === 'crear') {
        setAcceso(data.acceso)
        await registrarBitacora({ modulo: 'clientes', accion: 'crear', entidad: 'acceso al portal', entidad_id: cliente.id, detalle: { cliente: cliente.nombre, email: data.acceso.email } })
      } else {
        await registrarBitacora({ modulo: 'clientes', accion: 'editar', entidad: 'acceso al portal', entidad_id: cliente.id, detalle: { cliente: cliente.nombre, cambio: 'contraseña' } })
      }
      setEntregar({ email: data.acceso?.email || acceso?.email, clave })
      setFormulario(null)
      onToast?.(formulario === 'crear' ? 'Acceso creado' : 'Contraseña cambiada')
    } catch {
      setError('No se pudo conectar con el servidor.')
    } finally {
      setGuardando(false)
    }
  }

  async function quitar() {
    setConfirmarQuitar(false)
    setGuardando(true)
    try {
      const res = await fetch(`/api/clientes/acceso?cliente_id=${cliente.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { onToast?.(data.error || 'No se pudo quitar el acceso.', 'error'); return }
      await registrarBitacora({ modulo: 'clientes', accion: 'eliminar', entidad: 'acceso al portal', entidad_id: cliente.id, detalle: { cliente: cliente.nombre, email: acceso?.email } })
      setAcceso(null)
      setEntregar(null)
      onToast?.('Acceso quitado')
    } catch {
      onToast?.('No se pudo conectar con el servidor.', 'error')
    } finally {
      setGuardando(false)
    }
  }

  async function copiarDatos() {
    const texto = `Portal de clientes Ingemedic\n${PORTAL_URL}/login?cliente=1\nCorreo: ${entregar.email}\nContraseña: ${entregar.clave}`
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      onToast?.('No se pudo copiar. Cópialos a mano.', 'error')
    }
  }

  return (
    <div className="p-6 border-b border-slate-100">
      <div className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-3">Acceso al portal</div>

      {cargando ? (
        <div className="flex items-center gap-2 text-[12.5px] text-slate-400"><Loader2 size={13} className="animate-spin" /> Consultando…</div>
      ) : noHabilitado ? (
        <div className="text-[12.5px] text-slate-400">El acceso de clientes aún no está habilitado.</div>
      ) : (
        <>
          {acceso ? (
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-green-50 text-[#0F7B55] flex items-center justify-center flex-shrink-0"><Globe size={15} /></div>
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] font-semibold text-slate-700 break-all">{acceso.email}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {acceso.ultimo_ingreso ? `Último ingreso: ${formatear(acceso.ultimo_ingreso, { hour: '2-digit', minute: '2-digit' })}` : 'Aún no ha ingresado'}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-[12.5px] text-slate-500">
              Sin acceso. Con una cuenta, el cliente ve sus equipos, sus pacientes y los mantenimientos en {PORTAL_URL.replace('https://', '')}.
            </p>
          )}

          {entregar && (
            <div className="mt-3 p-3 rounded-[9px] bg-[#E8F7FB] border border-[#2EB5D4]/30">
              <div className="text-[11.5px] font-semibold text-[#0E6F85] mb-1.5">Entrégale estos datos al cliente (la contraseña no se vuelve a mostrar):</div>
              <div className="text-[12.5px] text-slate-700">Correo: <span className="font-semibold break-all">{entregar.email}</span></div>
              <div className="text-[12.5px] text-slate-700">Contraseña: <span className="font-mono font-semibold">{entregar.clave}</span></div>
              <button type="button" onClick={copiarDatos}
                className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#1B3A6B] hover:underline">
                {copiado ? <><Check size={13} /> Copiado</> : <><Copy size={13} /> Copiar datos de acceso</>}
              </button>
            </div>
          )}

          {formulario && (
            <div className="mt-3 space-y-2.5 p-3 rounded-[9px] border border-slate-200 bg-slate-50">
              {formulario === 'crear' && (
                <div>
                  <label htmlFor="acceso-email" className="block text-[11px] font-bold uppercase tracking-[0.07em] text-slate-500 mb-1.5">Correo</label>
                  <input id="acceso-email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="correo@cliente.com" autoComplete="off" className={inputCls} />
                </div>
              )}
              <div>
                <label htmlFor="acceso-clave" className="block text-[11px] font-bold uppercase tracking-[0.07em] text-slate-500 mb-1.5">
                  {formulario === 'crear' ? 'Contraseña' : 'Contraseña nueva'}
                </label>
                <div className="flex gap-2">
                  <input id="acceso-clave" type="text" value={clave} onChange={e => setClave(e.target.value)}
                    autoComplete="off" spellCheck={false} className={`${inputCls} font-mono`} />
                  <button type="button" onClick={() => setClave(generarClave())} title="Generar otra"
                    aria-label="Generar otra contraseña"
                    className="w-10 flex-shrink-0 flex items-center justify-center border border-slate-200 rounded-[9px] bg-white text-slate-500 hover:text-slate-700">
                    <RefreshCw size={14} />
                  </button>
                </div>
              </div>
              {error && <div role="alert" className="text-[12px] text-red-600">{error}</div>}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setFormulario(null)} disabled={guardando}
                  className="px-3 py-2 border border-slate-200 rounded-[9px] text-[12.5px] font-medium text-slate-600 bg-white hover:border-slate-300">
                  Cancelar
                </button>
                <button type="button" onClick={guardar} disabled={guardando}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-[#1B3A6B] text-white rounded-[9px] text-[12.5px] font-semibold hover:bg-[#152D54] disabled:opacity-70">
                  {guardando ? <><Loader2 size={13} className="animate-spin" /> Guardando…</> : formulario === 'crear' ? 'Crear acceso' : 'Cambiar contraseña'}
                </button>
              </div>
            </div>
          )}

          {!formulario && (
            <div className="flex flex-wrap gap-2 mt-3">
              {acceso ? (
                <>
                  <button type="button" onClick={() => abrir('clave')} disabled={guardando}
                    className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-[9px] text-[12.5px] font-medium text-slate-600 hover:border-slate-300">
                    <KeyRound size={13} /> Cambiar contraseña
                  </button>
                  <button type="button" onClick={() => setConfirmarQuitar(true)} disabled={guardando}
                    className="inline-flex items-center gap-1.5 px-3 py-2 border border-red-200 rounded-[9px] text-[12.5px] font-medium text-red-500 hover:bg-red-50">
                    <UserX size={13} /> Quitar acceso
                  </button>
                </>
              ) : cliente.activo !== false && (
                <button type="button" onClick={() => abrir('crear')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#1B3A6B] text-white rounded-[9px] text-[12.5px] font-semibold hover:bg-[#152D54]">
                  <Globe size={13} /> Dar acceso al portal
                </button>
              )}
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        abierto={confirmarQuitar}
        titulo="¿Quitar el acceso al portal?"
        mensaje={`"${cliente.nombre}" ya no podrá entrar. Si lo necesita de nuevo, se le crea otro acceso.`}
        textoConfirmar="Sí, quitar"
        tipo="peligro"
        onConfirmar={quitar}
        onCancelar={() => setConfirmarQuitar(false)}
      />
    </div>
  )
}
