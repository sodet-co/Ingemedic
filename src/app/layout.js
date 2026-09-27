import { Geist, Geist_Mono, Archivo, Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { SITIO_URL, EMPRESA } from "@/lib/sitio";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Solo para el sitio público (Header, Footer, landing) — el admin sigue con
// Geist (font-sans) sin cambios. Ver globals.css: font-display/font-body.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

// Solo tema claro — ver globals.css (evita el fondo negro en celulares en modo oscuro)
export const viewport = {
  colorScheme: 'only light',
  themeColor: '#1B3A6B',
}

// Valores por defecto del sitio público. Cada página pública define su propio
// title, description y alternates.canonical (no se pone canonical aquí: lo
// heredarían todas las páginas y le dirían a Google que todas son la home).
// La imagen para compartir es app/opengraph-image.jpg.
export const metadata = {
  metadataBase: new URL(SITIO_URL),
  title: {
    default: "Ingemedic de Colombia",
    template: "%s | Ingemedic",
  },
  description: EMPRESA.descripcion,
  applicationName: "Ingemedic",
  keywords: [
    "alquiler equipos biomédicos Valledupar",
    "oxígeno medicinal Valledupar",
    "oxígeno domiciliario Valledupar",
    "concentrador de oxígeno Valledupar",
    "alquiler CPAP BiPAP Valledupar",
    "equipos biomédicos Cesar",
    "Ingemedic de Colombia",
  ],
  openGraph: {
    siteName: "Ingemedic de Colombia",
    locale: "es_CO",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
  robots: {
    index: true,
    follow: true,
  },
  // Para verificar Google Search Console por etiqueta: pegar aquí el código
  // (verification: { google: '...' }). Si se verifica por DNS no hace falta.
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} ${archivo.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
