// Solo para sacar el panel interno de Google (login incluido). No agrega UI:
// los layouts reales son (auth) y (dashboard).
export const metadata = {
  robots: { index: false, follow: false },
}

export default function PortalLayout({ children }) {
  return children
}
