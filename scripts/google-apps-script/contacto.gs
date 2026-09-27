/**
 * Formulario de contacto de ingemedic.com.co → correo.
 *
 * Este archivo NO corre en el proyecto: se pega en script.google.com.
 * La página /contacto no lo llama directo; envía a /api/contacto (Next),
 * que valida y reenvía aquí. Así la URL de este script nunca queda
 * expuesta en el navegador.
 *
 * Despliegue (una sola vez):
 *   1. script.google.com → Nuevo proyecto → pegar todo este archivo.
 *   2. Implementar → Nueva implementación → tipo "Aplicación web".
 *      - Ejecutar como: Yo
 *      - Quién tiene acceso: Cualquier usuario
 *   3. Autorizar los permisos (enviar correo como tú).
 *   4. Copiar la URL que termina en /exec → variable CONTACTO_SCRIPT_URL
 *      en .env.local y en Vercel.
 *
 * Si cambias este código: Implementar → Gestionar implementaciones →
 * editar la existente → "Nueva versión". Así la URL no cambia.
 *
 * Límite de Gmail gratuito: ~100 correos por día.
 */

const DESTINO = 'sodetteam2024@gmail.com'

function doPost(e) {
  try {
    const datos = JSON.parse((e && e.postData && e.postData.contents) || '{}')

    const nombre   = limpiar(datos.nombre, 120)
    const telefono = limpiar(datos.telefono, 40)
    const correo   = limpiar(datos.correo, 120)
    const servicio = limpiar(datos.servicio, 120)
    const mensaje  = limpiar(datos.mensaje, 3000)

    if (!nombre || !telefono || !mensaje) {
      return responder({ ok: false, error: 'Faltan campos obligatorios' })
    }

    const correoValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)
    const fecha = Utilities.formatDate(new Date(), 'America/Bogota', 'dd/MM/yyyy hh:mm a')
    const telefonoWa = telefono.replace(/\D/g, '')
    const waLink = telefonoWa
      ? 'https://wa.me/' + (telefonoWa.length === 10 ? '57' + telefonoWa : telefonoWa)
      : ''

    const filas = [
      ['Nombre', html(nombre)],
      ['Teléfono', html(telefono) + (waLink ? ' · <a href="' + waLink + '">Abrir WhatsApp</a>' : '')],
      ['Correo', correo ? html(correo) : '—'],
      ['Servicio', servicio ? html(servicio) : '—'],
      ['Fecha', fecha],
    ].map(function (f) {
      return '<tr><td style="padding:6px 12px 6px 0;color:#5D6F86;white-space:nowrap;vertical-align:top">' + f[0] +
        '</td><td style="padding:6px 0;color:#0E2A4D;font-weight:600">' + f[1] + '</td></tr>'
    }).join('')

    const htmlBody =
      '<div style="font-family:Arial,sans-serif;max-width:600px">' +
        '<div style="background:#1B3A6B;color:#fff;padding:16px 20px;border-radius:8px 8px 0 0">' +
          '<div style="font-size:16px;font-weight:bold">Nueva solicitud desde la página web</div>' +
          '<div style="font-size:12px;opacity:.8;margin-top:4px">Formulario de contacto · ingemedic.com.co</div>' +
        '</div>' +
        '<div style="border:1px solid #DDE5EE;border-top:none;padding:16px 20px;border-radius:0 0 8px 8px">' +
          '<table style="border-collapse:collapse;font-size:14px">' + filas + '</table>' +
          '<div style="margin-top:14px;font-size:12px;color:#5D6F86">Mensaje</div>' +
          '<div style="margin-top:4px;padding:12px;background:#F3F6FA;border-radius:6px;font-size:14px;color:#101F33;white-space:pre-wrap">' + html(mensaje) + '</div>' +
        '</div>' +
      '</div>'

    const opciones = {
      to: DESTINO,
      subject: 'Contacto web: ' + nombre + (servicio ? ' — ' + servicio : ''),
      htmlBody: htmlBody,
      name: 'Web Ingemedic',
    }
    // "Responder" en Gmail le escribe directo al cliente
    if (correoValido) opciones.replyTo = correo

    MailApp.sendEmail(opciones)
    return responder({ ok: true })
  } catch (err) {
    console.error(err)
    return responder({ ok: false, error: 'Error interno' })
  }
}

function limpiar(valor, max) {
  return String(valor == null ? '' : valor).trim().slice(0, max)
}

function html(texto) {
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function responder(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON)
}

// Para probar desde el editor de Apps Script (botón Ejecutar) sin pasar por la web
function probarEnvio() {
  const r = doPost({ postData: { contents: JSON.stringify({
    nombre: 'Prueba', telefono: '3001234567', correo: '', servicio: 'Prueba', mensaje: 'Mensaje de prueba',
  }) } })
  console.log(r.getContent())
}
