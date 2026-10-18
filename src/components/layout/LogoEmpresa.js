import Image from 'next/image'

// Logo del panel con versión para modo oscuro (Configuración → Empresa).
// Con las dos versiones, el CSS (globals.css: .logo-claro / .logo-oscuro) muestra
// la que va con el tema. Sin versión oscura, el logo normal va sobre una
// pastilla blanca para que se lea en modo oscuro.
export default function LogoEmpresa({ empresa, alto = 80, respaldo = '/logo.png' }) {
  const claro = empresa?.logo_url || respaldo
  const oscuro = empresa?.logo_oscuro_url
  const img = (src, cls) => (
    <Image src={src} alt={empresa?.razon_social || 'Logo'} width={300} height={100} priority
      className={`object-contain ${cls}`} style={{ width: 'auto', height: `${alto}px` }} />
  )
  if (oscuro) return <>{img(claro, 'logo-claro')}{img(oscuro, 'logo-oscuro')}</>
  return <div className="siempre-claro bg-white rounded-xl px-2 py-1">{img(claro, '')}</div>
}
