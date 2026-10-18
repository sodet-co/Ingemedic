// Imágenes de las plantillas (logos, sellos): van al bucket público `logos`,
// carpeta plantillas/, y el bloque guarda la URL (render.js las dibuja por URL).

const nombre = ext => `plantillas/${crypto.randomUUID()}.${ext}`

export async function subirImagen(supabase, archivo) {
  const ext = (archivo.name?.split('.').pop() || archivo.type?.split('/')[1] || 'png').toLowerCase().replace('jpeg', 'jpg')
  const ruta = nombre(ext)
  const { error } = await supabase.storage.from('logos').upload(ruta, archivo, { contentType: archivo.type || undefined })
  if (error) throw error
  return supabase.storage.from('logos').getPublicUrl(ruta).data.publicUrl
}

// Sube las imágenes que trajo un Word (importarWord) y cambia { imagen: id } por { url }
export async function subirImagenesImportadas(supabase, bloques, imagenes) {
  const urls = {}
  for (const [id, im] of Object.entries(imagenes || {})) {
    const ruta = nombre(im.ext === 'jpeg' ? 'jpg' : im.ext)
    const { error } = await supabase.storage.from('logos').upload(ruta, new Blob([im.datos], { type: im.tipo }), { contentType: im.tipo })
    if (!error) urls[id] = supabase.storage.from('logos').getPublicUrl(ruta).data.publicUrl
  }
  const poner = obj => {
    if (!obj?.imagen) return obj
    const { imagen, ...resto } = obj
    return urls[imagen] ? { ...resto, url: urls[imagen] } : resto
  }
  return bloques
    .map(b => ({ ...poner(b), ...(b.logos ? { logos: b.logos.map(poner).filter(l => l.url) } : {}) }))
    .filter(b => b.tipo !== 'imagen' || b.url)
}
