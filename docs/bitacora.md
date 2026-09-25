# Bitácora — Ingemedic

Registro de cambios importantes y decisiones. Entradas nuevas **arriba**.
Las reglas permanentes del proyecto están en `CLAUDE.md`.

**Formato de cada entrada:**

```
## AAAA-MM-DD — Título corto
**Qué se hizo:** una o dos frases.
**Por qué:** solo si la decisión no es obvia.
**Archivos:** los tocados.
**SQL:** si hubo, y si ya se corrió o no.
**Pendiente:** lo que quedó sin confirmar. Si no hay, omitir.
```

Cuando una entrada vieja ya no aporte (bug cerrado y verificado hace
meses), condénsala en una línea. Este archivo se lee completo en cada
sesión: si crece sin control, deja de servir.

---

# Pendientes abiertos

Lo que está sin resolver, ordenado por prioridad.

1. **Seguridad — `/api/usuarios` sin validar sesión.** El endpoint usa
   `service_role` de Supabase y no verifica quién llama. Cualquiera que
   conozca la URL puede cambiar contraseña, email o rol de cualquier
   usuario mandando un `id` arbitrario. Detectado hace tiempo, nunca
   arreglado. Es lo más urgente de esta lista.
2. **Rol Repartidor.** La restricción no funcionaba por emails con
   mayúsculas inconsistentes entre `auth.users` y `usuarios`. Se entregó
   el `UPDATE usuarios SET email = LOWER(email)` pero nunca se confirmó
   si después quedó restringiendo bien.
3. **`src/lib/ultima-actualizacion.js`** está en gitignore y se genera en
   build. Falta confirmar si un clone nuevo necesita un `git add -f`
   inicial para no romper `npm run dev`.
4. **Columna `domicilio boolean` en `ordenes_servicio`.** Hoy se infiere
   de si `repartidor_id` está presente. Frágil.
5. **Arreglos mecánicos de la auditoría de diseño**, identificados y no
   aplicados: `Sidebar.js` duplica su propio modal de logout en vez de
   usar `ConfirmDialog`; sus 14 íconos hand-rolled deberían ser
   `lucide-react`; hay SVGs sueltos duplicando `Eye`/`EyeOff`/chevrons.
6. **Datos por aclarar con el cliente:** 8 equipos con código RL colisionado
   (RL630, RL765, RL768, RL764, cada uno en 2 equipos distintos) ·
   19 registros en "Otros" sin confirmar si son equipo médico u oficina ·
   "CANDELARIA" no es municipio del Cesar, parece error de captura.

---

# Entradas

## 2026-09-24 — Dashboard: se quitaron 3 secciones (Órdenes activas, Entregas retrasadas, Entregas hoy)

**Qué se hizo:** por pedido directo, se quitaron del dashboard las
secciones "Órdenes activas", "Entregas retrasadas" (una de las dos
tarjetas del bloque de alertas) y "Entregas hoy". "Equipos con novedad"
(la otra tarjeta de ese bloque) y el resto del dashboard (KPIs, gráficos,
mapa, Actividad reciente) quedaron intactos. `page.js` dejó de correr las
tres consultas que solo alimentaban esas secciones (`ordenesActivas`,
`ordenesRetrasadas`, `entregasHoy`) — no tenía sentido seguir trayéndolas
sin usarlas en cada carga del dashboard.

**Archivos:** `src/app/admin/(dashboard)/dashboard/DashboardClient.js`,
`src/app/admin/(dashboard)/dashboard/page.js`.

**Verificación:** Playwright — las tres secciones ya no aparecen, las
que debían quedarse (Actividad reciente, Equipos activos por municipio)
siguen ahí, sin huecos ni errores de consola. Cuenta de prueba borrada.

---

## 2026-09-24 — El bug del mapa: la causa real no era backdrop-filter, era z-index

**⚠️ Corrige la entrada de abajo.** El diagnóstico de "Leaflet no se
difumina por backdrop-filter con capas GPU" era razonable pero
**incompleto** — quitarle `backdrop-blur-sm` a los modales no arregló
nada, y el usuario lo confirmó con otra captura del mismo modal de
cerrar sesión con el mapa igual de nítido encima.

Se confirmó la causa real con `document.elementFromPoint()` sobre el
mapa: el elemento más arriba en ese punto era un `<path>` del SVG de
Leaflet, no el fondo del modal — el mapa estaba pintándose **por
encima** del backdrop en el orden real de apilamiento, sin importar que
el backdrop tuviera z-index 100 y el mapa "z-index: auto". La razón:
`.leaflet-container` queda con `position: relative` pero `z-index: auto`
— y un elemento así **no abre su propio contexto de apilamiento**. Sus
hijos (`.leaflet-pane`, `.leaflet-overlay-pane`), que Leaflet sí posiciona
con z-index explícito (200 a 700), quedan entonces comparándose contra
el contexto del ancestro más cercano que sí lo abra — en este caso, la
página completa — y le ganan a cualquier z-index de un modal que sea
menor a esos 400.

**Arreglo real:** `isolation: isolate` en el `style` del `MapContainer`
(`MapaMunicipios.js`). Eso fuerza el contexto de apilamiento propio que
`position: relative` + `z-index: auto` no abre solo, y contiene los
z-index internos de Leaflet adentro — confirmado de nuevo con
`elementFromPoint()`: ahora el elemento más arriba sobre el mapa es el
propio `div` del modal, como debe ser. Con esto puesto, los
`backdrop-blur-sm` que se habían quitado (pop-up de atención, modal de
logout, `ConfirmDialog`) **ya podrían volver a llevarlo** sin problema
— se dejaron como tinte sólido de todas formas porque ya funcionan y no
había necesidad de tocarlos de nuevo.

**Archivo:** `src/components/dashboard/MapaMunicipios.js`.

**Verificación:** Playwright, `document.elementFromPoint()` antes/después
del cambio confirma qué elemento queda arriba en el punto central del
mapa, más captura visual con el modal de logout abierto: el mapa ahora
se ve atenuado igual que el resto del fondo. Cuenta de prueba borrada.

---

## 2026-09-24 — El bug del mapa de Leaflet seguía en otros modales

**Qué se hizo:** el bug de la entrada de abajo (Leaflet no se difumina
bajo `backdrop-filter: blur()` por sus capas GPU) volvió a aparecer,
esta vez en el modal de "¿Cerrar sesión?" del Sidebar. La causa es la
misma, pero el arreglo anterior solo tocó el pop-up de atención — el
Sidebar (con su propio modal de logout) vive en **todas** las páginas
del admin, dashboard incluido, así que comparte el mismo riesgo
cualquier vez que alguien cierre sesión desde ahí. Se le quitó el
`backdrop-blur-sm` igual que al pop-up.

De paso, se aplicó el mismo cambio a `ConfirmDialog.js` — el diálogo de
confirmación genérico que CLAUDE.md pide reusar antes de crear uno
nuevo. Hoy no se usa desde el dashboard, pero por ser el componente
"por defecto" para confirmaciones es el más propenso a terminar ahí en
algún flujo futuro, y el cambio no tiene costo (mismo look, un tinte
sólido un poco más oscuro en vez de blur). El resto de los modales con
`backdrop-blur-sm` (Clientes, Inventario, Entregas, Mantenimientos,
Órdenes, Configuración) se dejaron intactos a propósito: son locales a
sus páginas, que nunca tienen el mapa detrás.

**Archivos:** `src/components/layout/Sidebar.js`,
`src/components/ui/ConfirmDialog.js`.

**Verificación:** Playwright — scroll hasta que el mapa quede visible,
abrir el modal de cerrar sesión, capturar: el mapa ahora se ve atenuado
igual que el resto del fondo, ya no nítido encima. Cuenta de prueba
borrada al terminar.

---

## 2026-09-24 — Pop-up más grande, banner también en dashboard, y un bug real de Leaflet

**Qué se hizo:** cuarta vuelta sobre la entrada de abajo, ajustes tras
ver el pop-up en uso:

- El pill "N por atender" (dashboard-only, reabría el pop-up a mano) se
  quitó. En su lugar, `BannerAtencion` vuelve a mostrarse también en el
  dashboard — con el pop-up abriéndose solo una vez, ya no compite ni se
  ve redundante con la franja.
- El pop-up creció de `max-w-460px` a `max-w-760px`, y cuando una regla
  trae más de un préstamo, sus tarjetas pasan de una columna angosta
  apilada a una grilla de 2 columnas — con un solo préstamo se queda en
  una columna. El encabezado de cada regla (ícono + título + conteo)
  ahora también es un botón que lleva a Préstamos ya filtrado, no solo
  el link de "ver más" que aparecía cuando había demasiados para
  itemizar.
- El link "ver en Préstamos" (tanto el de la regla colapsada como el
  nuevo del encabezado) pasó de `router.push` a `window.location.href`
  — más robusto, sin depender de que la transición client-side coincida
  con el efecto que lee el filtro al montar en `OrdenesClient`.

**Bug real encontrado (no un reporte equivocado esta vez):** al abrir
"Ya se recogió" desde dentro del pop-up, `ModalDevolucion` quedaba
**detrás** del pop-up — ambos usaban `z-[60]`/`z-[65]` pero el pop-up
ganaba, así que el modal de confirmación ni se veía ni el mouse le
llegaba. Se subió `ModalDevolucion` a `z-[75]`, por encima de cualquier
otro modal desde el que se pueda abrir.

**Segundo bug real, confirmado reproduciendo el reporte del usuario:**
el mapa de municipios (Leaflet) se veía nítido y sin oscurecer justo
encima del fondo oscuro del pop-up, mientras todo lo demás sí aparecía
borroso/atenuado. Causa: Leaflet paneas sus capas con
`transform: translate3d(...)`, lo que el navegador compone en su propia
capa GPU — y un `backdrop-filter: blur()` no "ve" esa capa para
difuminarla, sin importar que el z-index ya estuviera bien ordenado
(confirmado: el mapa medía `z-index: auto` correctamente por debajo del
`z-[65]` del pop-up — el problema era puramente de compositing, no de
apilamiento). Se quitó `backdrop-blur-sm` del fondo del pop-up y se
reemplazó por un tinte sólido más oscuro (`bg-black/55`), que no
depende de backdrop-filter y no tiene este problema.

**Archivos:** `src/components/dashboard/PanelAtencion.js`,
`src/app/admin/(dashboard)/dashboard/DashboardClient.js`,
`src/components/layout/BannerAtencion.js`,
`src/components/entregas/ModalDevolucion.js`.

**Verificación:** Playwright, cuenta desechable, con dos préstamos
vencidos reales (CUIDARTE) para forzar la grilla de 2 columnas — pop-up
de 760px confirmado, grilla visible con las 2 tarjetas lado a lado,
clic en un chip de equipo abre `ModalDevolucion` por encima del pop-up
y el botón "Cancelar" responde sin que nada intercepte el clic, clic en
el encabezado de la regla navega a `/admin/ordenes?atencion=...` con el
chip de filtro puesto y exactamente los 2 préstamos esperados en la
lista, banner visible en dashboard además de en Clientes. Capturas
antes/después del mapa confirman que ya no se ve nítido sobre el fondo
oscuro. Datos y cuenta de prueba restaurados/borrados al terminar.

**Pendiente:** ninguno propio de esta vuelta.

---

## 2026-09-24 — El Panel de Atención pasa a ser pop-up al entrar al dashboard

**Qué se hizo:** tercera vuelta, feedback directo sobre la entrada de
abajo: el Panel de Atención deja de vivir inline en el dashboard y pasa
a ser un **pop-up** (mismo patrón visual que `ModalDevolucion`: fondo
oscuro + tarjeta, bottom-sheet en móvil) que se abre solo **una vez por
sesión** al entrar al dashboard — si hay algo que atender y no se cerró
antes — con las mismas acciones rápidas (recoger/extender/posponer) y
una x para saltárselo. `DashboardClient` es quien decide abrirlo (sabe
el conteo por prop y el estado de `sessionStorage`); `PanelAtencion` pasó
de manejar su propio "oculto" a ser controlado por props (`abierto`,
`onCerrar`).

Como el pop-up ya cubre el dashboard, `BannerAtencion` (la franja
transversal) se apaga a propósito ahí (`usePathname() === '/admin/dashboard'`
→ no se pinta) para no repetir el mismo aviso tres veces — sigue
apareciendo en los otros 8 módulos igual que antes. En su lugar, el
dashboard tiene su propia alerta puntual: un pill "N por atender" junto
a la campana (mismo lugar/estilo que el pill de alertas que se había
quitado en la vuelta anterior, pero ahora scopeado solo a vigencia) que
reabre el pop-up con un click aunque ya se haya cerrado esta sesión.

**Archivos:** `src/components/dashboard/PanelAtencion.js`,
`src/app/admin/(dashboard)/dashboard/DashboardClient.js`,
`src/components/layout/BannerAtencion.js`.

**Verificación:** Playwright, cuenta desechable — confirmado que el
pop-up se abre solo al primer login con datos reales de atención, que
cerrarlo lo oculta, que el pill lo reabre, que el banner no aparece en
el dashboard pero sí en Clientes, y que al volver al dashboard tras
navegar el pop-up NO se reabre solo (ya se había cerrado esta sesión)
mientras el pill sigue visible. Datos y cuenta de prueba borrados al
terminar.

**Pendiente:** ninguno propio de esta vuelta — sigue en pie lo ya
anotado en la entrada de abajo (Entregas retrasadas/Equipos con novedad
fuera del motor de reglas, y la cookie de sesión no es httpOnly).

---

## 2026-09-24 — Franja de atención transversal + límite de sesión

**Qué se hizo:** siguiente vuelta sobre la entrada de abajo, a partir de
feedback directo: el Panel de Atención (con acciones) se queda solo en
el dashboard, pero además se agregó `BannerAtencion.js`, una franja fija
montada una sola vez en `layout.js` — así aparece en los 9 módulos del
admin sin tocar cada `XxxClient.js` — con "Tienes N préstamos vencidos y
M por vencer" + botón **Ver** (a Préstamos ya filtrado) + una **x** para
cerrarla. Ninguno de los dos widgets es redundante con el otro: el
banner es aviso + link en todos lados, el panel es la única superficie
con acciones reales (recoger/extender/posponer) y solo vive en el
dashboard, a modo de "esto requiere tu atención" al entrar.

Tanto el banner como el panel se pueden cerrar con una x — el cierre
dura la sesión (`sessionStorage`) y se limpia al hacer login de nuevo
(`login/page.js` borra esas dos llaves tras autenticar), para que
cerrarlos hoy no los esconda para siempre.

**Límite de sesión (pedido aparte, pero necesario para que "cerrar por
esta sesión" signifique algo):** hasta ahora la sesión de Supabase se
renovaba sola indefinidamente — la única salida era "Cerrar sesión" a
mano. Se agregó un límite absoluto de 8 horas desde el login (decisión
tomada con el usuario: absoluta, no por inactividad, para no cortar a un
repartidor a mitad de una entrega con firma). Mecanismo: `login/page.js`
pone una cookie `sesion_inicio` (texto plano, no protege nada por sí
sola) al autenticar; `middleware.js` la revisa en cada request a
`/admin/*` y si pasaron más de 8h llama `supabase.auth.signOut()` y
redirige a `/admin/login?expirada=1` (con un aviso en el login). Una
sesión que ya existía antes de este cambio y no tiene la cookie arranca
el conteo de nuevo en vez de cerrarse de una — no expulsa de golpe a
quien ya estaba adentro.

**Multiequipos en el panel:** si una orden tiene más de 3 equipos
pendientes, el panel deja de listarlos uno por uno (competían por
espacio con Extender/Posponer) y muestra un solo botón "Marcar los N
equipos como devueltos" — sin fecha ni observaciones personalizadas por
equipo, ese detalle sigue disponible entrando a la orden desde
Préstamos. Con 3 o menos, sigue mostrando un chip por equipo.

**Se quitó** el pill "N alertas" del topbar del dashboard (Entregas
retrasadas + Equipos con novedad): quedaba redundante en cuanto las
alertas de vigencia se conectaron al Buzón — esas dos categorías siguen
visibles en sus tarjetas más abajo en el dashboard, que ya eran la
fuente principal.

**Bug de layout encontrado al integrar el banner:** 7 de los 9
`XxxClient.js` (Dashboard, Préstamos, Inventario, Servicios, Bitácora,
Mantenimientos, Clientes) miden su contenedor raíz con `h-screen`
(100vh fijo) en vez de `h-full` — funcionaba porque antes ese div era
literalmente lo único dentro de `<main>` (también 100vh). En cuanto el
banner ocupa una franja arriba, el contenido de la página seguía
pidiendo el 100% del viewport completo y se recortaba por abajo esa
misma franja. Se cambió `h-screen` → `h-full` en los 7 archivos y se
envolvió `{children}` en `layout.js` en un `flex-1 min-h-0` — Entregas y
Configuración ya usaban `h-full` (o ni siquiera este patrón), por eso no
les tocaba el bug.

**Otro bug de paso:** los links "ver en Préstamos" del buzón y del
banner usaban `router.push()` — si el usuario ya estaba parado en
Préstamos, un push a la misma ruta con otro query no remonta el
componente y el filtro (que se lee al montar) no se aplicaba. Se
cambiaron a `window.location.href` (mismo patrón que ya usan
login/page.js y el logout de Sidebar.js para lo mismo).

**Archivos:** `src/components/layout/BannerAtencion.js` (nuevo),
`src/components/dashboard/PanelAtencion.js`,
`src/components/layout/BuzonNovedades.js`, `src/middleware.js`,
`src/app/admin/(auth)/login/page.js`, `src/components/layout/Sidebar.js`,
`src/app/admin/(dashboard)/layout.js`, y el cambio `h-screen`→`h-full`
en `DashboardClient.js`, `OrdenesClient.js`, `InventarioClient.js`,
`ServiciosClient.js`, `BitacoraClient.js`, `MantenimientosClient.js`,
`ClientesClient.js`.

**SQL:** ninguno.

**Verificación:** con Playwright y cuentas SuperAdmin desechables —
confirmado que el banner aparece en Dashboard y en Clientes (no solo
dashboard), que cerrarlo persiste al navegar entre módulos en la misma
pestaña, que el panel es independiente del banner (cerrar uno no cierra
el otro) y solo vive en el dashboard, que el pill viejo ya no aparece,
y que el "Marcar los 4 equipos como devueltos" funciona sobre una orden
real de 4 equipos. El límite de 8h se probó pisando la cookie
`sesion_inicio` a 9h atrás: la siguiente navegación expulsa al login con
el aviso y la sesión de Supabase queda realmente cerrada (no solo un
redirect suelto). Cuentas y datos de prueba borrados al terminar.

**Pendiente:**
- "Entregas retrasadas" y "Equipos con novedad" no están en el banner
  ni en el buzón — solo las dos reglas de vigencia. Si se quieren ahí
  también, son dos reglas más en `src/lib/atencion.js`.
- La cookie `sesion_inicio` no es httpOnly (la pone JS del cliente) —
  no protege nada por sí misma, un usuario podría editarla a mano para
  extenderse la sesión. El límite real de seguridad sigue siendo el
  propio JWT de Supabase; esto es solo una política de UX/higiene, no
  un control de seguridad.

---

## 2026-09-24 — Panel de Atención y alertas de vigencia en el Buzón

**Qué se hizo:** `src/lib/atencion.js` es el motor de reglas que pedía la
entrada de abajo — cada regla es `{ id, titulo, severidad, consulta,
acciones }`, arranca con `prestamos_vencidos` y `prestamos_por_vencer`, y
agregar una regla nueva es agregar un objeto al arreglo, nada más lee la
lista a mano. `consulta(supabase, { limite })` trae los candidatos con un
filtro amplio en la BD (`fecha_vigencia <= corte`) y los afina en JS con
`estaVencida()`/`diasParaVencer()` de `src/lib/vigencia.js` — las mismas
funciones que ya usa el badge "Vencida" de Préstamos, así nunca pueden
desacordar entre sí. Ambas reglas excluyen lo que esté en
`atencion_pospuestas` con `hasta > now()`, clave `"<regla_id>:<orden_id>"`.

El dashboard (`page.js`) corre `contarRegla()` por regla en el mismo
`Promise.all` de siempre — trae solo el conteo, nunca el detalle. El
detalle (cliente, paciente, equipo, fecha) se trae en el navegador desde
`PanelAtencion.js`, nuevo, arriba del contenido del dashboard: si una
regla tiene ≤5 ítems los pinta uno por uno con sus acciones encima; si
tiene más, colapsa a una sola línea con el conteo que linkea a Préstamos
ya filtrado (`?atencion=<regla_id>`, nuevo filtro leído del URL en
`OrdenesClient.js`, con chip para quitarlo). Si no hay nada que atender,
el panel no se renderiza — nada de tarjeta vacía.

Cada ítem tiene tres acciones:
- **Ya se recogió** — abre el `ModalDevolucion` que ya existía y cierra
  con `devolverEquipo()` de `lib/prestamos.js`, sin tocar esa función.
- **Extender** — pide fecha nueva, actualiza `fecha_vigencia` y deja
  rastro (ver más abajo por qué no es `historial_ordenes`).
- **Posponer** — upsert en `atencion_pospuestas` a 3/7/30 días, con
  `usuario_id` como rastro de quién lo pospuso — el pospuesto en sí es
  global: no vuelve a salirle a nadie del equipo, no solo a quien lo pidió.

Las alertas también se mezclan en `BuzonNovedades.js` (el buzón, no un
banner nuevo — ver más abajo) con ícono/color propio (rojo=vencidos,
ámbar=por vencer), siempre antes que los anuncios manuales y ordenadas
por severidad. El contador del buzón suma alertas no vistas + novedades
no vistas; "vista" para una alerta es un Set en localStorage
(`alertas_vistas`), no el puntero único que ya usaban las novedades,
porque una alerta puede volver a aparecer si se pospuso y el plazo venció
— no hay un "más nueva que" estable para comparar como sí lo hay con las
novedades por fecha.

**Por qué el buzón y no una franja superior nueva:** la idea original del
pedido era una franja fija que atravesara cualquier módulo. Pero
`BuzonNovedades` ya vive en el topbar de los 9 módulos del admin (barrido
con Playwright lo confirmó en una sesión anterior) — conectarle las
alertas ahí *es* la franja transversal que se pedía, con menos superficie
nueva y sin otro componente que mantener sincronizado. Construir las dos
cosas habría sido redundante: mismo dato, dos lugares que podían
desacordar. El Panel de Atención sigue siendo el único lugar con acciones
reales (recoger/extender/posponer); el buzón es solo aviso + link.

**Por qué no `historial_ordenes`:** el pedido asumía que esa tabla ya
existía para dejar rastro del "Extender". Se verificó contra la BD
(`select * from historial_ordenes limit 1`) y no existe — a diferencia de
`atencion_pospuestas`, que sí. En vez de inventar la tabla sin poder
correr el `CREATE TABLE`, "Extender" deja el rastro con
`registrarBitacora()` de `lib/bitacora.js` (ya existente, ya probado):
`accion: 'editar'`, `entidad: 'orden de servicio'`, `detalle` con estado
actual, fecha anterior/nueva y la observación "Vigencia extendida hasta
X" — mismo contenido que se pedía, en la bitácora general en vez de una
tabla dedicada. Si más adelante hace falta un historial por-orden
separado de la bitácora global, avisar y se entrega el `CREATE TABLE`
aparte.

**Bug encontrado y corregido en el camino (no pedido, pero bloqueaba
todo):** el bloque de alertas viejo del dashboard (`vigenciasProximas` en
`page.js`) excluía `estado_id in (Finalizada, Entregada)` — Entregada es
el estado de un préstamo *activo* normal, no uno cerrado; ese filtro
dejaba prácticamente todas las órdenes por vencer fuera de la alerta
vieja. Las reglas nuevas excluyen `Finalizada` y `Cancelada` (los dos
estados cerrados reales) y ya no tienen ese problema. El bloque viejo
(`vigenciasProximas`, la tarjeta "Vigencias — 7 días" y la entrada
"Vigencias por vencer" del dropdown del topbar) se eliminó, reemplazado
por el Panel de Atención y el buzón.

**Otros dos bugs de por medio, ya corregidos:**
- `filtroAtencion` en `OrdenesClient.js` se leía del URL en el
  inicializador de `useState` — en el primer render del cliente eso ya
  difiere de lo que renderizó el servidor (que nunca ve `window`), y
  React tiraba un error de hidratación y regeneraba el árbol completo.
  Ahora arranca vacío siempre y se adopta en un efecto tras montar.
- El buzón traía sus alertas una sola vez al montar; después de resolver
  un ítem desde el Panel de Atención (`router.refresh()`) el buzón se
  quedaba mostrándolo igual, porque `router.refresh()` no lo remonta.
  Ahora se suscribe a `postgres_changes` de `ordenes_servicio` y
  `atencion_pospuestas` y se refresca solo.

**Archivos:** `src/lib/atencion.js` (nuevo), `src/lib/fechas.js` (sin
cambios, solo reusado), `src/app/admin/(dashboard)/dashboard/page.js`,
`src/app/admin/(dashboard)/dashboard/DashboardClient.js`,
`src/components/dashboard/PanelAtencion.js` (nuevo),
`src/components/layout/BuzonNovedades.js`,
`src/app/admin/(dashboard)/ordenes/OrdenesClient.js`.

**SQL:** ninguno — `atencion_pospuestas` ya existía con sus políticas
RLS, tal como se indicó. Nada que entregar.

**Verificación:** con Playwright y una cuenta SuperAdmin desechable,
sobre tres préstamos reales de CUIDARTE/FOMAG (se guardó su
`fecha_vigencia` original antes de tocarla y se restauró al final) más
una orden desechable creada y borrada por completo para probar "Ya se
recogió" sin arriesgar un préstamo real: las tres acciones confirmadas
en BD (fecha_vigencia extendida + bitácora con el detalle correcto;
upsert en `atencion_pospuestas` con la clave y `hasta` esperados; equipo
devuelto a Disponible y orden a Finalizada), el filtro `?atencion=` en
Préstamos, y el buzón actualizándose solo tras cada acción sin recargar
la página. Todos los datos y la cuenta de prueba se borraron al terminar.

**Pendiente:**
- El resto del alcance original (alertas de "Entregas retrasadas"/
  "Equipos con novedad" como reglas del mismo motor, en vez de las
  tarjetas sueltas que siguen como estaban) no se tocó — quedó fuera de
  este pedido puntual.
- Decidir si en algún momento vale la pena un `historial_ordenes`
  dedicado en vez de reusar la bitácora general para "Extender".

---

## 2026-09-24 — Captura y badge de vigencia en Préstamos

**Qué se hizo:** el paso 3 del wizard de nuevo préstamo ahora tiene un
control real de vigencia (antes no existía ninguno, ver corrección más
abajo): toggle apagado = préstamo indefinido (`fecha_vigencia = null`,
caso instituciones); al encenderlo preselecciona 30 días con chips de
30/60/90 y una opción "Hasta fecha". Los chips calculan la fecha desde
hoy y solo se guarda la fecha final, nunca la duración. El mismo
control (`ControlVigencia`, local a `OrdenesClient.js`) se reusa en el
drawer para editar la vigencia de una orden existente, incluyendo
volver a marcarla indefinida. Se agregó un badge ámbar "Vencida" en la
lista de Préstamos (tabla, tarjetas móviles, fila compacta con drawer
abierto y encabezado del drawer) para toda orden con `fecha_vigencia`
pasada que no esté Finalizada ni Cancelada.

**Por qué el badge se calcula y no se guarda:** un préstamo vencido
sigue en préstamo — el sistema no sabe si el equipo ya volvió. Guardar
"vencido" como estado lo desincroniza en cuanto alguien extiende la
fecha. `estaVencida()`/`diasParaVencer()` viven ahora en
`src/lib/vigencia.js`, consolidando la `estaVencida()` que estaba
duplicada en `OrdenesClient.js` y el cálculo de días que hacía
`diasRestantes()` en `DashboardClient.js` (esa función se dejó intacta
para su otro uso, el retraso de `fecha_entrega`, y solo se reemplazó el
call site que calculaba contra `fecha_vigencia`).

**Corrección a la entrada de abajo (2026-09-24, diseño):** al abrir el
código, ninguna de las dos afirmaciones de "Hallazgos al revisar el
código" era cierta. `fecha_vigencia` no se capturaba en ningún lado del
wizard — ni con un input suelto ni de otra forma; el wizard nunca
escribía esa columna, solo la leía en otras pantallas. Y el texto "La
orden se finalizará automáticamente el [fecha]" no existe ni existió en
`OrdenesClient.js`: no hay ese string en el archivo ni en el repo
(confirmado con `grep` sobre todo `src/`). Tampoco se encontró cron,
trigger, edge function ni route handler que finalice órdenes por
vigencia — sigue sin existir automatización de ningún tipo, así que no
había nada que reemplazar por "Se te avisará cuando el préstamo esté
por vencer"; ese aviso queda pendiente de plantear cuando se construya
el panel de alertas (ver pendientes de esa entrada).

**Archivos:** `src/app/admin/(dashboard)/ordenes/OrdenesClient.js`,
`src/app/admin/(dashboard)/dashboard/DashboardClient.js`,
`src/lib/vigencia.js` (nuevo), `src/lib/fechas.js` (se agregó
`sumarDias`).

**Verificación:** flujo real con Playwright contra un usuario
SuperAdmin desechable — creación de préstamo con toggle apagado→30
días→60 días→"Hasta fecha" con fecha manual, confirmado en BD que
`fecha_vigencia` guardó exactamente esa fecha; backdateo de la fecha
para forzar vencimiento y confirmación visual del badge "Vencida" en
lista y drawer; edición desde el drawer de vuelta a indefinido,
confirmado `fecha_vigencia = null` en BD y que el badge desaparece.
Datos y cuenta de prueba borrados al terminar.

**Pendiente:** el resto del alcance de la entrada de abajo (alertas
calculadas con acciones, posponer global, tabla `atencion_pospuestas`)
sigue sin implementar — solo se cubrió captura + badge.

---

## 2026-09-24 — Vigencia de préstamos y panel de atención (en diseño)

**⚠️ Implementado más arriba** en "Captura y badge de vigencia en
Préstamos" y "Panel de Atención y alertas de vigencia en el Buzón" — esta
entrada queda como el diseño original, con dos hallazgos corregidos
donde se marcan tachados. Lo que sigue sin tocar: "Entregas retrasadas"
y "Equipos con novedad" todavía no son reglas del motor de
`src/lib/atencion.js`, y "Extender" deja rastro en la bitácora general en
vez de en un `historial_ordenes` dedicado (esa tabla nunca existió).

**Qué se hizo:** se definió el alcance. Nada implementado todavía.

**Decisiones tomadas:**

- La vigencia va **por orden**, no por equipo.
- Al vencerse, el equipo **sigue en préstamo**. No se libera solo. La
  fecha es una expectativa, no un hecho: el sistema no sabe si el equipo
  volvió, y un equipo marcado disponible que en realidad está en casa de
  alguien termina asignado dos veces.
- El estado "vencido" **se calcula**, no se guarda:
  `fecha_vigencia < hoy` y sin devolución. Así nunca se desincroniza.
- Las alertas **se calculan también**, no se insertan como filas. Una
  alerta guardada envejece mal: si el equipo vuelve, la fila sigue ahí
  mintiendo.
- Cada alerta lleva acciones encima: **ya se recogió** (abre
  `ModalDevolucion`), **extender** (nueva fecha + rastro en
  `historial_ordenes`) y **posponer**.
- El posponer es **global, no por usuario**: si alguien del equipo ya
  sabe que el préstamo se extendió de palabra, no tiene sentido que le
  siga saliendo a los demás.
- Toggle apagado = préstamo indefinido y sin alertas (caso de las
  instituciones). Encendido = presets 30/60/90 días, default 30, más un
  "hasta fecha". Se guarda solo la fecha final, nunca la duración: en
  cuanto se extiende una vez, la duración deja de ser verdad.

**Hallazgos al revisar el código (⚠️ corregidos en la entrada de arriba
tras verificar con herramientas — dos de estos cuatro puntos eran
incorrectos, quedan tachados aquí por trazabilidad):**

- ~~`fecha_vigencia` **ya existe** en `ordenes_servicio` y ya se captura
  en el paso 3 del wizard de órdenes.~~ La columna ya existía, pero el
  wizard **no la capturaba** — no había ningún input, suelto ni de otro
  tipo. Se construyó desde cero.
- `estaVencida()` ya existe en `OrdenesClient.js` (línea ~41). — esto sí
  era correcto, y quedó consolidada en `src/lib/vigencia.js`.
- El Dashboard **ya tiene** un bloque de alertas con `vigenciasProximas`,
  contador y días restantes. Falta sumarle los ya vencidos (hoy solo
  muestra próximos), meterle las acciones y conectarlo al buzón.
- ~~⚠️ El wizard dice **"La orden se finalizará automáticamente el
  [fecha]"** (`OrdenesClient.js` ~línea 868)~~ — ese texto nunca existió
  en el archivo ni en el repo (confirmado por `grep`). No había nada que
  cambiar.

**SQL entregado, sin correr:** tabla `atencion_pospuestas`
(`clave` única tipo `vencida:<orden_id>`, `hasta`, `usuario_id` como
rastro) con sus políticas RLS. El "así está bien" de las inconsistencias
reusa la misma tabla con `hasta = 'infinity'`.

**Pendiente:**
- Revisar `BuzonNovedades.js` y el `page.js` del dashboard antes de
  escribir código.

---

## 2026-09-24 — Nombre de tipo en 100 equipos

**Qué se hizo:** se preparó el UPDATE para que esos equipos muestren su
modelo (`GMR-SM`, `G2S A20`) en vez del genérico heredado de la
migración (`Aspirador de Secreciones`, `Regulador de Oxígeno`).

**Por qué va sobre `equipos.atributos.nombre` y no sobre `tipos_equipo`:**
un tipo lo comparten muchos equipos, así que tocarlo habría modificado
registros fuera del alcance pedido, incluidos concentradores.

**SQL entregado, sin confirmar si se corrió:** respaldo
`equipos_bkp_20260921` con los 100 IDs + UPDATE limitado a ese respaldo.
Deben salir 88 filas: 10 equipos no tienen modelo (cilindros y
TEST-RL10962) y 2 tienen "N/A" (RL165, RL1039).

**Pendiente:**
- Confirmar que se corrió y borrar el respaldo.
- `M Care` tiene modelos mezclados (CGA540 y CGA870, ambos reales) y
  `MED CAPTAIN` tiene un SUP-6010 (RL720) que parece error de digitación
  porque su serie casi coincide con la de RL1040. Ambos quedaron fuera.
- Llegaron exactamente 100 equipos, que es el tamaño de página del editor
  de Supabase. Si el filtro daba más, falta exportar el resto.

---

## 2026-09-24 — Mockup de rediseño de la landing pública

**Qué se hizo:** mockup HTML de ingemedic.com.co reorganizada para
escritorio, con el contenido real y recuadros marcando dónde van las
fotos y los datos que faltan.

**Decisiones:** el rojo baja a **una sola acción por pantalla** (hoy está
en botones, subrayados y acentos a la vez, y así nada destaca) · el badge
INVIMA sube a bloque visible con la resolución, es el argumento de
confianza más fuerte · la franja de cifras monta sobre el hero para
romper la sucesión de bloques oscuros · títulos en sentence case salvo el
H1 · se quitó la sección de noticias y sus enlaces, la página cierra en
certificación.

**Pendiente:** reemplazar placeholders con el logo real, las fotos, las
descripciones de servicios, los datos de contacto y las cifras de KPIs.

---

## Estado previo (sesiones anteriores)

Resumen de lo ya hecho y verificado. El detalle completo está en el
documento de estado del proyecto.

- **Inventario migrado:** 1.415 equipos nuevos en 12 categorías + 279
  concentradores = 1.694 reales. Íconos por categoría y tipo, incluyendo
  `regulador` y `cpap_bpap` dibujados a mano.
- **Roles y permisos:** rol SuperAdmin inmune a restricciones. Tabla
  `permisos` con modelo "todo permitido salvo excepción explícita".
  `src/lib/permisos.js` centraliza la lógica.
- **Master-detail** en Clientes, Pacientes y Préstamos: una sola tarjeta
  blanca, filtros fijos arriba, transición lista↔detalle debajo.
- **Devolución compartida:** `devolverEquipo()` en `lib/prestamos.js` +
  `ModalDevolucion.js`, un solo lugar de verdad con tres entradas.
- **Paginación** (`usePaginacion` + `<Paginador />`) en Clientes,
  Pacientes, Préstamos, Inventario, Bitácora y Mantenimientos. Servicios
  prestados **no** se pagina a propósito: es un reporte con totales
  agrupados y paginar rompe esa lógica.
- **Exportación de inventario** respeta el nivel de navegación y está
  blindada contra el límite de 1000 filas.
- **Mapa de municipios** del Cesar en el Dashboard, GeoJSON del DANE, sin
  API key. `normalizarCiudadPaciente()` en `lib/municipios.js`.
- **Buzón de notificaciones** (`novedades_sistema` + `BuzonNovedades.js`):
  hoy solo anuncios manuales que se insertan por SQL. El feed automático
  de eventos del sistema se descartó a propósito, queda para después.
- **Auditoría de diseño** en `docs/auditoria-diseño.md` y especificación
  curada lista para Figma vía el plugin html.to.design.
