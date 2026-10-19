// Circulito de un cliente: su logo si lo tiene (clientes.logo_url) y si no la
// inicial, como siempre. `tamano` en px; `estilo` = colores del círculo de inicial.
export default function AvatarCliente({ cliente, tamano = 32, estilo, className = '' }) {
  const medida = { width: tamano, height: tamano }
  if (cliente?.logo_url) {
    return (
      <div className={`siempre-claro rounded-full bg-white border border-slate-200 flex items-center justify-center overflow-hidden flex-shrink-0 ${className}`}
        style={{ ...medida, padding: Math.round(tamano * 0.12) }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cliente.logo_url} alt="" className="max-w-full max-h-full object-contain" loading="lazy" />
      </div>
    )
  }
  return (
    <div className={`rounded-full flex items-center justify-center font-bold flex-shrink-0 ${estilo ? '' : 'bg-[#D81B43]/10 text-[#D81B43]'} ${className}`}
      style={{ ...medida, fontSize: Math.round(tamano * 0.36), ...(estilo ? { background: estilo.bg, color: estilo.color } : {}) }}>
      {cliente?.nombre?.charAt(0)?.toUpperCase() || '?'}
    </div>
  )
}
