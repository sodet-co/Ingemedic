import { Geist, Geist_Mono, Archivo, Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

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

export const metadata = {
  metadataBase: new URL("https://ingemedic.com.co"),
  title: {
    default: "Ingemedic de Colombia",
    template: "%s | Ingemedic",
  },
  description:
    "Ingemedic de Colombia S.A.S. ofrece alquiler de equipos biomédicos y suministro de oxígeno medicinal en Valledupar y municipios del departamento del Cesar, Colombia.",
  keywords: [
    "alquiler equipos biomédicos Valledupar",
    "oxígeno medicinal Valledupar",
    "equipos médicos Cesar",
    "alquiler camas hospitalarias Valledupar",
    "oxígeno medicinal Cesar",
    "equipos biomédicos Cesar Colombia",
    "Ingemedic Colombia",
    "homecare Valledupar",
  ],
  openGraph: {
    title: "Ingemedic de Colombia S.A.S. — Alquiler de equipos biomédicos en Valledupar y Cesar",
    description:
      "Ingemedic de Colombia S.A.S. ofrece alquiler de equipos biomédicos y suministro de oxígeno medicinal en Valledupar y municipios del departamento del Cesar, Colombia.",
    url: "https://ingemedic.com.co",
    siteName: "Ingemedic",
    locale: "es_CO",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
  },
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
