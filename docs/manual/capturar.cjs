// Toma las capturas de pantalla del manual (docs/manual/capturas/*.png).
// Uso (desde la raíz, con `npm run dev` abierto): node docs/manual/capturar.cjs
// Abre una ventana de Chrome en el login: entra con tu usuario y el script
// recorre los módulos solo. La sesión queda guardada en .perfil-capturas.
const path = require('path')
const fs = require('fs')
const puppeteer = require('puppeteer')

const BASE = process.env.BASE || 'http://localhost:3000'
const DIR = path.join(__dirname, 'capturas')
const ESCRITORIO = { width: 1280, height: 800, deviceScaleFactor: 2 }
const CELULAR = { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true }

const PANTALLAS = [
  { nombre: 'dashboard', ruta: '/dashboard' },
  { nombre: 'inventario', ruta: '/inventario' },
  { nombre: 'prestamos', ruta: '/ordenes' },
  { nombre: 'prestamo-detalle', ruta: '/ordenes', clic: 'tbody tr' },
  { nombre: 'prestamo-nuevo', ruta: '/ordenes', boton: 'Nuevo préstamo' },
  { nombre: 'entregas', ruta: '/entregas' },
  { nombre: 'clientes', ruta: '/clientes' },
  { nombre: 'cliente-detalle', ruta: '/clientes', clic: 'tbody tr' },
  { nombre: 'bitacora', ruta: '/bitacora' },
  { nombre: 'configuracion', ruta: '/configuracion', evento: ['tour-seccion', 'plantillas'] },
  { nombre: 'celular-dashboard', ruta: '/dashboard', celular: true },
  { nombre: 'celular-entregas', ruta: '/entregas', celular: true },
]

// Con un usuario repartidor: REPARTIDOR=1 node docs/manual/capturar.cjs
// (su sesión se guarda aparte, en .perfil-capturas-repartidor)
const PANTALLAS_REPARTIDOR = [
  { nombre: 'repartidor-pendientes', ruta: '/entregas', celular: true },
  { nombre: 'repartidor-completadas', ruta: '/entregas', celular: true, boton: 'Completadas' },
  { nombre: 'repartidor-perfil', ruta: '/repartidor-preferencias', celular: true },
]
const REPARTIDOR = !!process.env.REPARTIDOR

const espera = ms => new Promise(r => setTimeout(r, ms))

// Espera a que la página termine de cargar (sin esqueletos de carga)
async function listo(p) {
  await espera(1200)
  const hasta = Date.now() + 20000
  while (Date.now() < hasta && await p.evaluate(() => !!document.querySelector('.animate-pulse, .animate-spin'))) await espera(500)
  await espera(800)
}

async function cerrarVentanas(p) {
  // La ventana de avisos se abre sola al entrar
  for (let i = 0; i < 2; i++) { await p.keyboard.press('Escape'); await espera(300) }
}

;(async () => {
  fs.mkdirSync(DIR, { recursive: true })
  const navegador = await puppeteer.launch({
    headless: false, defaultViewport: null, protocolTimeout: 120000,
    userDataDir: path.join(__dirname, REPARTIDOR ? '.perfil-capturas-repartidor' : '.perfil-capturas'),
    args: ['--window-size=1300,900'],
  })
  const p = await navegador.newPage()
  await p.setViewport(ESCRITORIO)
  await p.goto(BASE + '/login', { waitUntil: 'networkidle2', timeout: 90000 })
  if (p.url().includes('/login')) {
    await p.screenshot({ path: path.join(DIR, 'login.png') })
    console.log('Esperando a que entres con tu usuario en la ventana de Chrome…')
    const hasta = Date.now() + 15 * 60 * 1000
    while (new URL(p.url()).pathname.startsWith('/login')) {
      if (Date.now() > hasta) { console.log('No se entró a tiempo'); await navegador.close(); return }
      await espera(1000)
    }
    await espera(3000)
  }

  // SOLO=dashboard,clientes  → solo esas capturas
  const solo = process.env.SOLO?.split(',')
  for (const s of (REPARTIDOR ? PANTALLAS_REPARTIDOR : PANTALLAS).filter(x => !solo || solo.includes(x.nombre))) {
    try {
      await p.setViewport(s.celular ? CELULAR : ESCRITORIO)
      await p.goto(BASE + s.ruta, { waitUntil: 'networkidle2', timeout: 60000 })
      await listo(p)
      await cerrarVentanas(p)
      if (s.clic) {
        const fila = await p.$(s.clic)
        if (!fila) throw new Error('no hay ' + s.clic)
        await fila.click(); await listo(p)
      }
      if (s.evento) {
        await p.evaluate(([n, d]) => window.dispatchEvent(new CustomEvent(n, { detail: d })), s.evento)
        await listo(p)
      }
      if (s.boton) {
        const ok = await p.evaluate(t => {
          const b = [...document.querySelectorAll('button, a')].find(x => x.textContent.trim().includes(t))
          if (b) b.click()
          return !!b
        }, s.boton)
        if (!ok) throw new Error('no está el botón ' + s.boton)
        await listo(p)
      }
      // El manual se imprime: siempre en modo claro. Sin el botón "N" de Next en
      // modo desarrollo. Se espera a que terminen transiciones y gráficas.
      await p.evaluate(() => {
        document.documentElement.classList.remove('tema-oscuro')
        document.querySelectorAll('nextjs-portal').forEach(n => n.remove())
      })
      await espera(3000)
      await p.screenshot({ path: path.join(DIR, s.nombre + '.png') })
      console.log('ok', s.nombre)
    } catch (e) { console.log('FALLÓ', s.nombre, e.message) }
  }
  await navegador.close()
})()
