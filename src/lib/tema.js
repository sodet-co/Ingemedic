// Tema del panel (claro / oscuro / automático). Es una preferencia del usuario:
// se guarda en `usuarios.tema` (lo sigue en cualquier dispositivo) y se copia a
// localStorage para aplicarla al instante. Se aplica poniendo la clase
// `tema-oscuro` en <html>. Los colores oscuros viven en
// src/app/tema-oscuro.css y solo afectan lo que está dentro de `.panel-app`
// (el sitio público y los PDF no cambian).
export const CLAVE_TEMA = 'ingemedic.tema'
export const TEMAS = ['claro', 'oscuro', 'sistema']

export function leerTema() {
  try {
    const t = localStorage.getItem(CLAVE_TEMA)
    return TEMAS.includes(t) ? t : 'claro'
  } catch { return 'claro' }
}

export function aplicarTema(tema) {
  const oscuro = tema === 'oscuro' || (tema === 'sistema' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('tema-oscuro', oscuro)
}

export function guardarTema(tema) {
  try { localStorage.setItem(CLAVE_TEMA, tema) } catch {}
  aplicarTema(tema)
  window.dispatchEvent(new CustomEvent('tema-cambio', { detail: tema }))
}

// Guarda la preferencia en el perfil del usuario (si no hay columna o falla,
// queda al menos en este navegador)
export async function guardarTemaUsuario(supabase, usuarioId, tema) {
  guardarTema(tema)
  if (!usuarioId) return { error: null }
  return supabase.from('usuarios').update({ tema }).eq('id', usuarioId)
}

// Corre antes de pintar (va en un <script> del layout) para que no se vea un
// destello claro al cargar con el modo oscuro puesto. `temaUsuario` es el que
// trae el servidor de la BD: manda sobre lo que hubiera en este navegador.
export function scriptTema(temaUsuario) {
  const delServidor = TEMAS.includes(temaUsuario) ? temaUsuario : ''
  return `(function(){try{var s='${delServidor}';if(s)localStorage.setItem('${CLAVE_TEMA}',s);var t=s||localStorage.getItem('${CLAVE_TEMA}');var o=t==='oscuro'||(t==='sistema'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('tema-oscuro',o)}catch(e){}})()`
}
