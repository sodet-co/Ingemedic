# CLAUDE.md — Ingemedic

Claude Code lee este archivo automáticamente al abrir el proyecto.
Contiene lo permanente. El historial de cambios va en `docs/bitacora.md`.

---

## Qué es

Sistema de gestión de equipos biomédicos para Ingemedic de Colombia S.A.S.
Inventario, préstamos a clientes y pacientes, entregas con firma digital,
mantenimientos y bitácora de auditoría. ~1.694 equipos reales cargados.

**Stack:** Next.js App Router · Supabase (`@supabase/ssr`) · Tailwind ·
JavaScript sin TypeScript · Vercel.

---

## Reglas de trabajo

**Leer el código antes de modificarlo.** No asumas la estructura de un
archivo. Ábrelo. Ya ha pasado varias veces que se asumió mal y tocó
rehacer el cambio.

**El SQL va aparte, nunca mezclado con cambios de código.** Linda lo
corre ella misma en Supabase. Entrega el SQL en un bloque separado,
listo para pegar, y no intentes ejecutarlo.

**RLS bloquea en silencio.** Ya pasó con `estados_entrega` y
`novedades_sistema`: la query no falla, simplemente devuelve vacío. Al
crear cualquier tabla nueva, incluye de una vez las políticas y esta
verificación:

```sql
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = '<tabla>';
```

**Verificar con datos reales, no solo leyendo código.** El patrón que
mejor funciona: crear un registro de prueba desechable, correr el flujo
real, confirmar en la base de datos, borrar todo al final.

**Respaldar antes de cualquier UPDATE masivo.** Tabla de respaldo con
fecha en el nombre, y borrarla cuando se confirme el resultado. No
dejarla mucho tiempo en `public` sin RLS.

---

## Patrón arquitectónico

Todos los módulos siguen la misma forma:

```
page.js (Server Component, async)
  └─ queries a Supabase en paralelo con Promise.all
  └─ pasa los datos como props a XxxClient.js
       └─ 'use client' · estado con useState
       └─ mutations directas a Supabase desde el cliente
       └─ router.refresh() para re-sincronizar
```

Todas las pages llevan `export const dynamic = 'force-dynamic'` y
`export const revalidate = 0`.

Cliente Supabase: `@/lib/supabase` (browser) y `@/lib/supabase-server`
(server, async, cookies).

**Dos dominios, un solo proyecto.** El sitio público vive en
`www.ingemedic.com.co`; el panel, en `portal.ingemedic.com.co` con rutas
limpias (`/login`, `/dashboard`…). Los archivos del panel están en
`src/app/(portal)/` (el grupo no aparece en la URL) y el middleware separa por
dominio. En `localhost` se ve todo junto; `portal.localhost:3000` simula el
portal. **Al agregar un módulo al panel, sumarlo a `RUTAS_PORTAL` en
`src/lib/sitio.js`**, o el middleware lo tratará como página pública.

---

## Convenciones

**Estados en español, sin tildes en las claves de código:**
`Disponible`, `Reservado`, `En préstamo`, `Finalizada`, `Cancelada`.

**Paleta:** azul `#1B3A6B` · rojo `#D81B43` · cian `#2EB5D4` · fondo
`#F8FAFC` · verde `#0F7B55` · ámbar `#B45309`. Ver `docs/diseno.md`.

**Diseño — guía completa en `docs/diseno.md`, respetarla:**
- Encabezado de módulo: `<EncabezadoModulo>` (incluye ayuda `?` y novedades)
- Contenido `p-3 md:p-6 pb-20 md:pb-6` — la nav móvil ya la reserva el layout
  (`--mobile-nav-space`); no volver a sumar `pb-28`
- Ventanas: `<Modal>` para formularios, `<VentanaDetalle>` + `<EncabezadoDetalle>`
  para detalles, `<ConfirmDialog>` para confirmar
- Botones, campos, rótulos y toasts: clases de `src/lib/ui.js` (`ui.btnPrimario`,
  `ui.input`, `ui.toast`…), no clases escritas a mano
- Tablas: `hidden md:block` en desktop, cards en móvil

**Reutilizar antes de crear.** Ya existen y deben usarse:
`Modal`, `VentanaDetalle`, `EncabezadoModulo`, `ModalDevolucion`,
`ConfirmDialog`, `Skeleton`, `usePaginacion`,
`<Paginador />`, `IconoTipo`, `devolverEquipo()` en `lib/prestamos.js`,
`traerTodosLosEquipos` (evita el límite de 1000 filas de Supabase).

**El nombre visible de un tipo de equipo** sale de
`tipo.atributos?.nombre || tipo.nombre`. Ojo con eso al tocar tipos.

---

## Al terminar un cambio importante

Agrega una entrada arriba en `docs/bitacora.md` con el formato que está
ahí. Importante en este contexto significa: cambia el esquema, cambia
una decisión de diseño, arregla un bug no obvio, o deja algo a medias.
Un ajuste de estilo no va.

Si el cambio deja algo sin confirmar, escríbelo explícitamente como
pendiente. El valor de la bitácora está en saber qué quedó a medias.
