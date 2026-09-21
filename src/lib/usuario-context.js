'use client'
import { createContext, useContext } from 'react'

// El usuario actual y si es SuperAdmin ya se calculan una sola vez en
// layout.js (server component) — este contexto los expone a cualquier
// Client Component anidado (ej. el buzón de novedades en el header de
// cada módulo) sin repetir la consulta a `usuarios`/`roles` en cada page.js.
//
// layout.js (server component) no puede renderizar <UsuarioContext.Provider>
// directamente — al cruzar el límite server→client, el Provider no se
// resuelve como un componente válido (falla en runtime). Por eso el
// Provider vive envuelto en este wrapper 'use client', y layout.js solo le
// pasa los valores (serializables) como props normales.
const UsuarioContext = createContext({ usuario: null, esSuperAdmin: false })

export function UsuarioProvider({ usuario, esSuperAdmin, children }) {
  return (
    <UsuarioContext.Provider value={{ usuario, esSuperAdmin }}>
      {children}
    </UsuarioContext.Provider>
  )
}

export function useUsuarioActual() {
  return useContext(UsuarioContext)
}
