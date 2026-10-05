import { NextResponse, after } from 'next/server'

// Ruta PÚBLICA a propósito (formulario de /contacto, sin sesión).
// Valida y reenvía al Google Apps Script que manda el correo
// (scripts/google-apps-script/contacto.gs). La URL del script vive solo en
// el servidor (CONTACTO_SCRIPT_URL), nunca llega al navegador.

const LIMITES = { nombre: 120, telefono: 40, correo: 120, servicio: 120, mensaje: 3000 }

export async function POST(request) {
  const url = process.env.CONTACTO_SCRIPT_URL
  if (!url) {
    console.error('[contacto] Falta CONTACTO_SCRIPT_URL')
    return NextResponse.json({ ok: false, error: 'Formulario no configurado' }, { status: 503 })
  }

  let body
  try { body = await request.json() } catch { body = null }
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ ok: false, error: 'Solicitud inválida' }, { status: 400 })
  }

  // Honeypot: campo invisible que una persona nunca llena. Si viene lleno es
  // un bot; se responde "ok" para que no reintente, pero no se envía nada.
  if (body.sitio_web) return NextResponse.json({ ok: true })

  const datos = {}
  for (const [campo, max] of Object.entries(LIMITES)) {
    datos[campo] = String(body[campo] ?? '').trim().slice(0, max)
  }

  if (!datos.nombre || !datos.telefono || !datos.mensaje) {
    return NextResponse.json({ ok: false, error: 'Nombre, teléfono y mensaje son obligatorios' }, { status: 400 })
  }
  // Autorización de tratamiento de datos (Ley 1581 de 2012). Sin ella no se
  // envía nada. Viaja en el correo como constancia de que se otorgó.
  if (body.autoriza !== true) {
    return NextResponse.json({ ok: false, error: 'Debes autorizar el tratamiento de tus datos para enviar el mensaje' }, { status: 400 })
  }
  datos.autorizacion = 'Aceptada en el formulario web'
  if (datos.telefono.replace(/\D/g, '').length < 7) {
    return NextResponse.json({ ok: false, error: 'El teléfono no es válido' }, { status: 400 })
  }
  if (datos.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.correo)) {
    return NextResponse.json({ ok: false, error: 'El correo no es válido' }, { status: 400 })
  }

  // Apps Script tarda 2–8 s (arranque en frío + MailApp). Para no hacer esperar al
  // cliente, se responde apenas pasa la validación y el envío sigue en segundo
  // plano con after() (en Vercel la función se mantiene viva hasta que termine).
  // Costo: si Google falla, el cliente ya vio "recibido" — queda en los logs de
  // Vercel como "[contacto] Apps Script falló" con los datos para recuperarlo.
  after(() => enviarAlScript(url, datos))
  return NextResponse.json({ ok: true })
}

async function enviarAlScript(url, datos) {
  try {
    // Apps Script responde con un 302 hacia googleusercontent; fetch lo sigue solo.
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
      signal: AbortSignal.timeout(25000),
    })
    const texto = await res.text()
    let respuesta = null
    try { respuesta = JSON.parse(texto) } catch { /* HTML de error de Google */ }
    if (!res.ok || !respuesta?.ok) {
      console.error('[contacto] Apps Script falló', res.status, texto.slice(0, 300), JSON.stringify(datos))
    }
  } catch (e) {
    console.error('[contacto] Apps Script falló (red/timeout)', e?.message, JSON.stringify(datos))
  }
}
