// Eventos del sitio público: clics en WhatsApp y envíos del formulario.
// Se guardan en la tabla `eventos_sitio` vía /api/evento y se ven en el
// dashboard del panel. (Vercel Analytics solo cuenta visitas: sus eventos
// personalizados exigen un plan de pago.) Sin cookies ni datos personales.

function registrar(evento, origen, detalle) {
  try {
    const datos = JSON.stringify({ evento, origen, detalle, pagina: window.location.pathname })
    // sendBeacon sobrevive a que el clic abra otra pestaña o cambie de página
    const enviado = navigator.sendBeacon?.('/api/evento', new Blob([datos], { type: 'application/json' }))
    if (!enviado) {
      fetch('/api/evento', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: datos, keepalive: true })
        .catch(() => {})
    }
  } catch { /* el conteo nunca debe impedir que se abra WhatsApp ni el envío */ }
}

// Clic en un botón de WhatsApp. `origen` dice cuál botón fue; `equipo` solo
// aplica a las tarjetas del portafolio. Los orígenes válidos están en
// src/app/api/evento/route.js: uno nuevo hay que sumarlo allá.
export function clicWhatsapp(origen, equipo) {
  registrar('whatsapp_clic', origen, equipo)
}

// Formulario de /contacto enviado con éxito. Solo viaja el servicio elegido
// en la lista, nada de lo que la persona escribió.
export function formularioEnviado(servicio) {
  registrar('contacto_enviado', 'formulario', servicio)
}
