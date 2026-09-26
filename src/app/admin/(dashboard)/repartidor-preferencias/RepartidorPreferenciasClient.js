'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { registrarBitacora } from '@/lib/bitacora'
import { ULTIMA_ACTUALIZACION } from '@/lib/ultima-actualizacion'
import { iniciales } from '@/components/layout/RepartidorHeader'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { User, Lock, LogOut, Eye, EyeOff, Mail, AtSign, Check } from 'lucide-react'

const inputCls = 'w-full px-3.5 py-3 border border-slate-200 rounded-[10px] text-[15px] text-slate-800 outline-none focus:border-[#1B3A6B] bg-white placeholder:text-slate-300'
const labelCls = 'block text-[12px] font-semibold text-slate-500 mb-1.5'
const MIN_PASS = 6

function Seccion({ Icono, titulo, children }) {
  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-[#1B3A6B]/8 text-[#1B3A6B] flex items-center justify-center"><Icono size={16} /></div>
        <div className="text-[15px] font-bold text-slate-800">{titulo}</div>
      </div>
      {children}
    </section>
  )
}

// "Mi perfil" del rol Repartidor — su nombre, cambio de contraseña y cerrar
// sesión. Nada de la Configuración de admin (categorías, usuarios, empresa...).
export default function RepartidorPreferenciasClient({ usuario }) {
  const supabase = createClient()
  const router = useRouter()

  const [nombreGuardado, setNombreGuardado] = useState(usuario?.nombre || '')
  const [nombre, setNombre] = useState(usuario?.nombre || '')
  const [guardandoNombre, setGuardandoNombre] = useState(false)

  const [passwords, setPasswords] = useState({ nueva: '', confirmar: '' })
  const [verPass, setVerPass] = useState(false)
  const [guardandoPass, setGuardandoPass] = useState(false)

  const [confirmarSalida, setConfirmarSalida] = useState(false)
  const [toast, setToast] = useState(null)
  function showToast(msg, tipo = 'success') {
    setToast({ msg, tipo })
    setTimeout(() => setToast(null), 3200)
  }

  const nombreCambio = nombre.trim() !== nombreGuardado.trim()
  const passCorta    = passwords.nueva.length > 0 && passwords.nueva.length < MIN_PASS
  const noCoinciden  = passwords.confirmar.length > 0 && passwords.nueva !== passwords.confirmar
  const passLista    = passwords.nueva.length >= MIN_PASS && passwords.nueva === passwords.confirmar

  async function guardarNombre() {
    if (!nombre.trim()) { showToast('El nombre no puede quedar vacío', 'error'); return }
    setGuardandoNombre(true)
    const { error } = await supabase.from('usuarios').update({ nombre: nombre.trim() }).eq('id', usuario.id)
    setGuardandoNombre(false)
    if (error) { showToast('Error: ' + error.message, 'error'); return }
    setNombreGuardado(nombre.trim())
    showToast('Nombre actualizado')
    router.refresh() // actualiza las iniciales de la barra superior
  }

  async function cambiarPassword() {
    if (!passLista) return
    setGuardandoPass(true)
    const { error } = await supabase.auth.updateUser({ password: passwords.nueva })
    setGuardandoPass(false)
    if (error) { showToast('Error: ' + error.message, 'error'); return }
    registrarBitacora({ modulo: 'auth', accion: 'editar', entidad: 'contraseña', entidad_id: usuario?.id })
    setPasswords({ nueva: '', confirmar: '' })
    showToast('Contraseña actualizada')
  }

  async function cerrarSesion() {
    await registrarBitacora({ modulo: 'auth', accion: 'logout', entidad: 'sesión', entidad_id: usuario?.id })
    await supabase.auth.signOut()
    window.location.href = '/admin/login'
  }

  return (
    <div className="max-w-[520px] mx-auto p-4 pb-8 space-y-4">
      {/* Tarjeta de identidad */}
      <div className="rounded-2xl p-5 text-white shadow-sm" style={{ background: 'linear-gradient(150deg, #1B3A6B 0%, #14315C 100%)' }}>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-white text-[#1B3A6B] text-[22px] font-extrabold flex items-center justify-center flex-shrink-0">
            {iniciales(nombreGuardado)}
          </div>
          <div className="min-w-0">
            <div className="text-[19px] font-bold leading-tight truncate">{nombreGuardado || 'Sin nombre'}</div>
            <span className="inline-block mt-1.5 text-[11px] font-bold uppercase tracking-[0.06em] bg-white/15 px-2 py-0.5 rounded-full">
              {usuario?.roles?.nombre || 'Repartidor'}
            </span>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-white/15 space-y-1.5 text-[13px] text-white/80">
          <div className="flex items-center gap-2 min-w-0"><Mail size={14} className="flex-shrink-0" /><span className="truncate">{usuario?.email}</span></div>
          {usuario?.username && <div className="flex items-center gap-2"><AtSign size={14} className="flex-shrink-0" />{usuario.username}</div>}
        </div>
      </div>


      <Seccion Icono={User} titulo="Mis datos">
        <label className={labelCls}>Nombre completo</label>
        <input value={nombre} onChange={e => setNombre(e.target.value)} className={inputCls} autoComplete="name" />
        <button onClick={guardarNombre} disabled={guardandoNombre || !nombreCambio}
          className="w-full mt-3 py-3 bg-[#1B3A6B] text-white rounded-[10px] text-[14px] font-semibold disabled:bg-slate-200 disabled:text-slate-400 transition-colors">
          {guardandoNombre ? 'Guardando...' : nombreCambio ? 'Guardar nombre' : 'Sin cambios'}
        </button>
        <p className="text-[12px] text-slate-400 mt-2">El correo y el usuario solo los puede cambiar un administrador.</p>
      </Seccion>

      <Seccion Icono={Lock} titulo="Cambiar contraseña">
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Nueva contraseña</label>
            <div className="relative">
              <input type={verPass ? 'text' : 'password'} value={passwords.nueva}
                onChange={e => setPasswords(p => ({ ...p, nueva: e.target.value }))}
                placeholder={`Mínimo ${MIN_PASS} caracteres`} autoComplete="new-password"
                className={`${inputCls} pr-11 ${passCorta ? '!border-red-300' : ''}`} />
              <button type="button" onClick={() => setVerPass(v => !v)} aria-label={verPass ? 'Ocultar' : 'Mostrar'}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-slate-400">
                {verPass ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
            {passCorta && <p className="text-[12px] text-red-500 mt-1">Faltan {MIN_PASS - passwords.nueva.length} caracteres</p>}
          </div>
          <div>
            <label className={labelCls}>Repite la contraseña</label>
            <input type={verPass ? 'text' : 'password'} value={passwords.confirmar}
              onChange={e => setPasswords(p => ({ ...p, confirmar: e.target.value }))} autoComplete="new-password"
              className={`${inputCls} ${noCoinciden ? '!border-red-300' : ''}`} />
            {noCoinciden && <p className="text-[12px] text-red-500 mt-1">No coinciden</p>}
            {passLista && <p className="text-[12px] text-[#0F7B55] mt-1 flex items-center gap-1"><Check size={13} /> Coinciden</p>}
          </div>
        </div>
        <button onClick={cambiarPassword} disabled={guardandoPass || !passLista}
          className="w-full mt-4 py-3 bg-[#1B3A6B] text-white rounded-[10px] text-[14px] font-semibold disabled:bg-slate-200 disabled:text-slate-400 transition-colors">
          {guardandoPass ? 'Guardando...' : 'Actualizar contraseña'}
        </button>
      </Seccion>

      <button onClick={() => setConfirmarSalida(true)}
        className="w-full py-3.5 bg-white border border-red-200 text-[#D81B43] rounded-2xl text-[15px] font-semibold flex items-center justify-center gap-2 shadow-sm">
        <LogOut size={17} /> Cerrar sesión
      </button>

      <p className="text-center text-[11.5px] text-slate-400">
        Versión del {new Date(ULTIMA_ACTUALIZACION).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
      </p>

      <ConfirmDialog
        abierto={confirmarSalida}
        titulo="¿Cerrar sesión?"
        mensaje="Tendrás que volver a ingresar con tu usuario y contraseña."
        textoConfirmar="Cerrar sesión"
        onConfirmar={cerrarSesion}
        onCancelar={() => setConfirmarSalida(false)}
      />

      {toast && (
        <div className={`fixed bottom-24 left-4 right-4 z-[70] px-4 py-3 rounded-[12px] text-[14px] font-medium text-white shadow-lg text-center ${toast.tipo === 'error' ? 'bg-red-500' : 'bg-[#0F7B55]'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
