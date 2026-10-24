// Genera docs/manual/Manual_Ingemedic.pdf a partir de manual-usuario.html.
// Uso (desde la raíz del proyecto): node docs/manual/generar-pdf.cjs
const path = require('path')
const { pathToFileURL } = require('url')
const puppeteer = require('puppeteer')

;(async () => {
  const html = path.join(__dirname, 'manual-usuario.html')
  const salida = path.join(__dirname, 'Manual_Ingemedic.pdf')
  const navegador = await puppeteer.launch({ headless: 'new' })
  const pagina = await navegador.newPage()
  await pagina.goto(pathToFileURL(html).href, { waitUntil: 'networkidle0' })
  await pagina.pdf({
    path: salida, format: 'A4', printBackground: true, preferCSSPageSize: true,
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate: '<div style="width:100%;font-size:8px;color:#94A3B8;padding:0 16mm;display:flex;justify-content:space-between;font-family:Arial"><span>Manual de usuario · Portal Ingemedic</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>',
  })
  await navegador.close()
  console.log('PDF:', salida)
})()
