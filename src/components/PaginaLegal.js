import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { LEGAL_VIGENCIA } from '@/lib/sitio'

// Marco común de las páginas legales del sitio público (/politica-de-datos,
// /terminos). Server Component: el texto sale ya renderizado.

export function Seccion({ titulo, children }) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-[20px] md:text-[22px] font-medium tracking-[-0.01em] text-[#0E2A4D] mb-3">{titulo}</h2>
      <div className="space-y-3 text-[15px] leading-relaxed text-[#5D6F86] [&_strong]:font-medium [&_strong]:text-[#0E2A4D] [&_a]:text-[#1E9FC4] [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5">
        {children}
      </div>
    </section>
  )
}

export default function PaginaLegal({ titulo, intro, children }) {
  return (
    <div className="font-body min-h-screen bg-[#F3F6FA] text-[#101F33]">
      <Header />

      <div className="bg-white border-b border-[#DDE5EE]">
        <div className="max-w-[820px] mx-auto px-5 md:px-7 pt-12 md:pt-16 pb-10 md:pb-12">
          <div className="w-[52px] h-[3px] bg-[#1E9FC4] rounded-full mb-[18px]" />
          <h1 className="font-display text-[30px] md:text-[38px] font-medium tracking-[-0.025em] text-[#0E2A4D] leading-tight">{titulo}</h1>
          {intro && <p className="mt-4 text-[16px] font-light text-[#5D6F86] leading-relaxed">{intro}</p>}
          <p className="mt-4 text-[13px] text-[#5D6F86]">Vigente desde el {LEGAL_VIGENCIA}</p>
        </div>
      </div>

      <main className="max-w-[820px] mx-auto px-5 md:px-7 pb-20 md:pb-24">
        {children}
      </main>

      <Footer />
    </div>
  )
}
