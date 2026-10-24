import { readFile } from 'fs/promises'
import path from 'path'
import { NextResponse } from 'next/server'
import { verificarSesion } from '@/lib/api-auth'

// Manual de usuario en PDF (docs/manual, se genera con generar-pdf.cjs). Va por
// aquí y no en /public porque sus capturas traen datos reales de pacientes:
// solo lo descarga quien tiene sesión en el panel. El archivo entra al deploy
// por outputFileTracingIncludes (next.config.mjs).
export async function GET() {
  const { respuesta } = await verificarSesion()
  if (respuesta) return respuesta

  const pdf = await readFile(path.join(process.cwd(), 'docs', 'manual', 'Manual_Ingemedic.pdf'))
  return new NextResponse(pdf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="Manual_Ingemedic.pdf"',
      'Cache-Control': 'private, no-store',
    },
  })
}
