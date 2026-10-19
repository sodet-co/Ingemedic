'use client'
import { useMemo, useState } from 'react'
import Image from 'next/image'
import { Building2, Upload, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { registrarBitacora } from '@/lib/bitacora'
import { ui } from '@/lib/ui'

// Logo de un cliente (clientes.logo_url). Va al bucket público `logos`, carpeta
// clientes/, y se guarda al subirlo. Se muestra en el detalle y en el informe PDF.
export default function LogoCliente({ cliente, onCambio, onToast }) {
  const supabase = useMemo(() => createClient(), [])
  const [subiendo, setSubiendo] = useState(false)

  async function guardar(url) {
    const { error } = await supabase.from('clientes').update({ logo_url: url }).eq('id', cliente.id)
    if (error) { onToast?.('No se guardó el logo: ' + error.message, 'error'); return }
    registrarBitacora({ modulo: 'clientes', accion: 'editar', entidad: 'cliente', entidad_id: cliente.id, detalle: { nombre: cliente.nombre, logo: url ? 'actualizado' : 'quitado' } })
    onCambio(url)
    onToast?.(url ? 'Logo actualizado' : 'Logo quitado')
  }

  async function subir(archivo) {
    setSubiendo(true)
    const ext = (archivo.name.split('.').pop() || 'png').toLowerCase()
    const ruta = `clientes/logo-${cliente.id}.${ext}`
    const { error } = await supabase.storage.from('logos').upload(ruta, archivo, { upsert: true, cacheControl: '60', contentType: archivo.type || undefined })
    if (error) { onToast?.('No se subió el logo: ' + error.message, 'error'); setSubiendo(false); return }
    // ?v= para que el navegador no siga mostrando el anterior (misma dirección)
    const url = `${supabase.storage.from('logos').getPublicUrl(ruta).data.publicUrl}?v=${archivo.lastModified}-${archivo.size}`
    await guardar(url)
    setSubiendo(false)
  }

  return (
    <div>
      <label className={ui.label}>Logo</label>
      <div className="flex items-center gap-3">
        <div className="w-[120px] h-[64px] rounded-[10px] border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden flex-shrink-0">
          {cliente.logo_url
            ? <Image src={cliente.logo_url} alt={`Logo de ${cliente.nombre}`} width={120} height={64} className="object-contain max-w-full max-h-full w-auto h-auto p-1.5" />
            : <Building2 size={22} className="text-slate-300" />}
        </div>
        <div className="flex flex-col items-start gap-1.5">
          <label className={`${ui.btnChico} cursor-pointer ${subiendo ? 'opacity-50 pointer-events-none' : ''}`}>
            {subiendo ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
            {subiendo ? 'Subiendo…' : cliente.logo_url ? 'Cambiar' : 'Subir logo'}
            <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden"
              onChange={e => { const f = e.target.files[0]; e.target.value = ''; if (f) subir(f) }} />
          </label>
          {cliente.logo_url && !subiendo && (
            <button type="button" onClick={() => guardar(null)} className="text-[12px] text-red-400 hover:text-red-600">Quitar</button>
          )}
        </div>
      </div>
      <p className={ui.ayudaCampo}>PNG con fondo transparente. Sale en el informe del cliente.</p>
    </div>
  )
}
