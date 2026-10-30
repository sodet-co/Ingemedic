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

1. **Probar con sesión real las rutas `/api/*` protegidas el 2026-09-25**
   (ver entrada de ese día). Sin sesión ya se verificó 401 en las 7.
2. **Rol Repartidor.** La restricción no funcionaba por emails con
   mayúsculas inconsistentes entre `auth.users` y `usuarios`. Se entregó
   el `UPDATE usuarios SET email = LOWER(email)` pero nunca se confirmó
   si después quedó restringiendo bien.
3. **`src/lib/ultima-actualizacion.js`** está en gitignore y se genera en
   build. Confirmado el 2026-10-28: en un clone nuevo `npm run dev` falla
   ("Can't resolve '@/lib/ultima-actualizacion'") hasta correr
   `node scripts/generar-timestamp.js`.
4. **Columna `domicilio boolean` en `ordenes_servicio`.** Hoy se infiere
   de si `repartidor_id` está presente. Frágil.
5. **Arreglos mecánicos de la auditoría de diseño**, identificados y no
   aplicados: `Sidebar.js` duplica su propio modal de logout en vez de
   usar `ConfirmDialog`; sus 14 íconos hand-rolled deberían ser
   `lucide-react`; hay SVGs sueltos duplicando `Eye`/`EyeOff`/chevrons.
6. **Datos por aclarar con el cliente:** 19 registros en "Otros" sin
   confirmar si son equipo médico u oficina · "CANDELARIA" no es municipio
   del Cesar, parece error de captura. (Los códigos RL colisionados ya no
   aparecen: la auditoría del 2026-09-25 encontró 0 códigos repetidos.)
7. **Permisos por rol en RLS.** Hoy cualquier usuario con sesión puede todo
   en las 20 tablas (política `autenticados_todo`). Falta: bitácora solo
   admin/SuperAdmin, repartidor solo sus entregas. Las políticas viejas
   `solo_admin_bitacora` y `repartidor_sus_entregas` excluyen a SuperAdmin
   — no reutilizarlas tal cual.
8. **Limpieza de datos (auditoría 2026-09-25):** datos de prueba de agosto
   (LR-002, EQ-1, PR2, LR-123, ORD-2026-131..142) · 6 préstamos
   "Finalizada" sin devolución · paciente duplicado ESNEIDER DAVID CORRALES
   CORZO · 12 series repetidas · tipos escritos distinto (ENMIND/Enmind,
   Pulmo Med/Pulmo-Med, cilindro 3.5) · tablas `tipos_equipo_bkp_20260921`
   y `tmp_tipos_objetivo` · `configuracion_empresa.tel` vacío.

---

# Entradas

## 2026-10-29 — Firma fija libre (mover y cambiar tamaño) y Configuración rediseñada
**Qué se hizo:** la firma fija del editor ahora es un bloque `{ tipo: 'firma_libre', url, x, y, ancho }` (px de la hoja) que render.js dibuja encima de la hoja (`position:absolute` sobre el body, fuera de `.bloque`: no empuja el texto). Se pone con doble clic → Firma fija, **dibujándola o subiendo una imagen**, y queda en el punto tocado. Un clic sobre ella en la vista previa abre el marco (VistaActa → `FirmaMovil`): se arrastra, se agranda desde la esquina y se guarda con el **✓ flotante** (✕ la deja como estaba, papelera la quita). En la lista de bloques sale como "Firma fija" (cambiar imagen, ancho); no está en "Agregar bloque". La ventana de Configuración se rediseñó: dos columnas en PC (general | quién la usa), "Se usa para" con tarjetas e íconos, interruptores para Renovable / De Ingemedic / Uso general, clientes elegidos como etiquetas.
**Archivos:** lib/actas/render.js, components/actas/{VistaActa,EditorPlantilla,ConfigPlantilla}.js
**Pendiente:** probar en el navegador (arrastre con mouse y con el dedo, PDF con la firma).

## 2026-10-29 — Configuración de plantilla aparte del editor
**Qué se hizo:** en Configuración → Plantillas, cada tarjeta tiene **Configuración** (components/actas/ConfigPlantilla.js, reemplaza a AsignarPlantilla.js): nombre, descripción, para qué acción, equipos (todos / algunas categorías), renovable, de Ingemedic, uso general, clientes asignados, Desactivar, Guardar y **Editar plantilla** (guarda y abre el editor). El editor queda solo con el nombre y el contenido; al guardar conserva acción, descripción y los bloques `para_equipos` / `renovable` tal como estén. Una plantilla nueva, al guardarse en el editor, abre su Configuración. Las tarjetas muestran "Renovable" y sus categorías.
**Archivos:** components/actas/{ConfigPlantilla,EditorPlantilla}.js, configuracion/ConfiguracionClient.js; se borró components/actas/AsignarPlantilla.js
**Pendiente:** probar en el navegador.

## 2026-10-29 — Préstamo por pestañas, renovación de actas, texto y firma fija en el editor
**Qué se hizo:**
- **Detalle del préstamo con pestañas** (OrdenesClient): arriba siguen estado y acciones; debajo **Resumen** (datos, programado, equipos agrupados por tipo, último evento y actas), **Equipos** (tarjetas con la imagen del tipo, código, serie, fecha; devueltos aparte; Cambiar/Devolver antes de entregar), **Actas** (solo actas) e **Historial** (ya no plegado). `useEventosPrestamo` y `UltimoEvento` salen de HistorialPrestamo.
- **Actas renovables:** en el editor, *Renovable: Sí* (bloque `{ tipo: 'renovable' }`, no se dibuja). Un acta firmada de esa plantilla tiene **Renovar** en el préstamo (RenovarActa.js): fecha nueva y, si hace falta, otros datos corregidos, con vista previa; se guarda como acta nueva `accion: 'renovacion'`, misma firma, `entrega_id` null y `datos.renovacion = { de, fecha, entrega_id }` (lib/actas/renovar.js). Va en el grupo "Renovaciones" del panel de actas y en el historial (bitácora `renovar`, con "Ver acta"). La plantilla cuenta como renovable si lo dice la copia del acta o la plantilla de hoy.
- **Editor:** el doble clic también ofrece **Texto** (queda escrito) y **Firma fija** (se dibuja con FirmaPad, se sube a Storage `logos/plantillas/`): sobre una raya de firma queda en `firmas[i].imagen`; en otro lugar, como bloque imagen debajo.
**Archivos:** ordenes/OrdenesClient.js, components/prestamos/HistorialPrestamo.js, components/actas/{ActasPrestamo,RenovarActa,EditorPlantilla}.js, lib/actas/{renovar,contexto,render}.js, lib/historialPrestamo.js, lib/bitacora-texto.js, bitacora/BitacoraClient.js
**SQL:** ninguno (actas.accion no tiene restricción de valores).
**Pendiente:** probar en el navegador · marcar como Renovable las plantillas que lo necesiten · ¿avisar cuando toque renovar (mensual)?

## 2026-10-29 — Tabla estándar de equipos (plantillas nuevas)
**Qué se hizo:** tabla `{ tipo: 'tabla', fuente: 'equipos', agrupar: 'tipo_equipo', columnas }` (render.js → `tablaEstandar`): una fila por tipo de equipo; la cantidad suma las unidades y lo que cambia entre ellas (seriales, códigos…) va separado por comas. **Cantidad va siempre** (`columnasEstandar` la pone después de la descripción si falta). Columnas: las básicas (`COLUMNAS_ESTANDAR`) y los datos que cada categoría define en el inventario (`atributos_extra.campos_tipo/campos_unidad`, como `attr:clave`); en el editor se eligen, ordenan y renombran, y si la plantilla es para algunas categorías solo se ofrecen los de esas. Es la tabla por defecto al agregar una tabla de equipos y al importar un Word con [Equipos]. `filaEquipo` trae `tipo_id` y `atributos` (tipo + unidad).
**Por qué:** que las plantillas futuras no dependan de formatos programados uno por uno, y faltaba la cantidad. Las plantillas existentes se dejan como están (verificado: mismo HTML).
**Archivos:** lib/actas/{render,contexto,importarWord,ejemplo}.js, components/actas/EditorPlantilla.js
**Pendiente:** probar en el navegador · los equipos que se retiran en un cambio no tienen opción estándar todavía (siguen "por tipo").

## 2026-10-29 — Plantillas para algunas categorías de equipos
**Qué se hizo:** en el editor, junto a "Para", **Equipos: Todos / Solo algunos** con las categorías del inventario. Se guarda en los bloques como `{ tipo: 'para_equipos', categorias: [{ id, nombre }] }` (no se dibuja; sin SQL). Con categorías, la tabla y los datos de equipo de esa plantilla solo toman esos equipos y la plantilla solo se sugiere con ellos. `contexto.js → paraPlantilla(ctx, plantilla)` reemplaza a `conManuales` en todos los lugares que arman un acta, también `guardarActas` (la copia firmada queda filtrada); lo escrito a mano encima (`datos_acta.valores`) se respeta. `filaEquipo` trae `categoria_id`; se compara por id y, si no hay, por nombre.
**Por qué:** propuesta de Sofía: que cualquier formato se limite a sus equipos desde Configuración, sin programar reglas por formato. Las filas impresas del F-FAM-11 siguen reconociendo el equipo por texto (`coincide`).
**Archivos:** lib/actas/{contexto,acciones,firmar,render}.js, components/actas/{EditorPlantilla,LlenarFormatos,ActasPrestamo,FirmaActas}.js, components/prestamos/{NuevoPrestamo,AccionPrestamo}.js
**Pendiente:** marcar las categorías de los F-FAM-11 en el editor · probar en el navegador.

## 2026-10-29 — Llenar datos: todo editable aunque se autocomplete
**Qué se hizo:** quien recibe ya no queda fijo en "El mismo paciente": nombre, documento y parentesco salen llenos con los del paciente ("del paciente") y se pueden cambiar; escribir otra persona desmarca la casilla. Igual en el paso de firma (antes ni se mostraban). Los datos automáticos (fecha, equipo, quien entrega…) se ven escritos ("automático") en vez de vacíos con el valor en gris.
**Archivos:** components/actas/{LlenarFormatos,FirmaActas}.js
**Pendiente:** un dato automático borrado del todo vuelve al automático (para cambiarlo se escribe encima) · probar en el navegador.

## 2026-10-29 — Editor de plantillas: espacios con doble clic sobre la hoja y eliminar hojas
**Qué se hizo:** en la vista previa del editor cada espacio es un cuadro de color: azul = lo llena el sistema, amarillo = se escribe al prestar (campo propio), gris = raya en blanco para el papel. **Doble clic** (doble toque en el celular) en el texto abre "¿Qué va aquí?" y lo pone en esa letra; **un toque en un cuadro** lo cambia o lo quita; las rayas tienen ancho corto / medio / largo. render.js en modo `ctx.editor` (`interpolarEditor`) marca cada texto con `data-src` (dónde está en la plantilla) y cada pedazo con `data-o` (en qué letra empieza); VistaActa ubica el doble clic con `caretRangeFromPoint`. Verificado sobre todas las plantillas base: 319 textos, 273 pedazos, 216 cuadros sin error de posición; fuera del editor el HTML no cambia. La lista de bloques va por hojas con **Eliminar hoja** y "Unir con la anterior". Los [corchetes] siguen funcionando.
**Por qué:** pedir campos poniéndolos en su lugar, como en el iPhone, sin crear renglones nuevos.
**Archivos:** components/actas/{EditorPlantilla,VistaActa}.js, lib/actas/render.js
**Pendiente:** probar en el navegador (computador y celular): doble clic, toque en cuadro, Quitar, Eliminar hoja. Borrar o mover hojas en una plantilla con préstamos sin firmar puede correr lo escrito a mano (va por posición de bloque).

## 2026-10-29 — Family: los F-FAM-11 llevan dentro el acta de entrega de equipos (y el de CPAP, la de máscara)
**Qué se hizo:** de los Excel "ACTA DE ENTREGA DE EQUIPOS FAMILY" y "ACTA DE ENTREGA INSUMO (MASCARA)" se armaron dos hojas (`hojaEntregaFamily`, `hojaMascaraFamily` en plantillas-base.js) que van al final de los F-FAM-11: CPAP - BPAP = F-FAM-11 + acta de entrega + máscara; Oxígeno y Otros equipos = F-FAM-11 + acta de entrega. De cada Excel va solo la parte de entrega. Variables nuevas `mascara_descripcion/marca/modelo/invima` (el primer insumo que sea máscara).
**Por qué:** así lo pidió el cliente: una plantilla con sus actas, no plantillas aparte. Primero se hicieron como plantillas separadas que se sugerían según el equipo (`sugerir_con`); se deshizo el mismo día y no se subió.
**Archivos:** lib/actas/{plantillas-base,contexto,nombres}.js, docs/sql-family-f11-con-actas.sql
**SQL:** `docs/sql-family-f11-con-actas.sql`: respalda los 3 F-FAM-11 en `respaldo_plantillas_f11_20261029` (con RLS) y les agrega las hojas al final (no pisa lo editado; no repite si ya las tiene). **Corrido el 2026-10-29**: CPAP 3 hojas con máscara, Oxígeno y Otros 2. Antes se confirmó que ningún préstamo de Family (233) usaba aún un F-FAM-11: ninguna acta anterior cambia.
**Pendiente:** borrar el respaldo (`DROP TABLE respaldo_plantillas_f11_20261029;`) cuando se vea bien en la app · subir el código (sin él, la hoja de máscara pide sus datos a mano en vez de tomarlos de los insumos) · la marca y el modelo de la máscara se escriben en "Llenar datos" (los insumos no los piden) · ¿hacen falta devolución y recarga de Family con su parte del Excel? · probar en el navegador.

## 2026-10-29 — F-FAM-11: lo que pone el sistema en las filas impresas se puede cambiar o borrar
**Qué se hizo:** en las tablas de equipos con filas impresas (`filas_fijas`, los F-FAM-11) cada celda que llena el sistema (lo que va tras "OTROS:", cantidad, marca, serial) se puede editar o borrar en "Llenar datos" (`EditorTablaFija` en LlenarFormatos). Se guarda en `datos_acta.manuales[plantilla]` con clave `bloque.tFila.columna`; `''` = borrado, sin clave = automático. "Restaurar" vuelve a lo automático. El texto impreso de la fila no cambia. render.js: `tablaFija` se partió en `filasAutomaticas` + `celdasTablaFija` (la usan la hoja y el editor); campos.js agrega el campo `t:bloque`.
**Por qué:** el cliente no quiere un formato dinámico; las filas tienen categorías quemadas y lo que no encaja cae en "OTROS". Así sigue automático, pero puede quitar lo que no quiere que salga. El equipo no se quita del préstamo.
**Archivos:** lib/actas/{render,campos}.js, components/actas/LlenarFormatos.js
**Pendiente:** probar en el navegador (préstamo nuevo con un equipo en OTROS, borrar, firmar y ver el PDF). La clave va por número de fila: si cambian los equipos después de editar, lo escrito se queda en esa fila (con "Restaurar" vuelve a lo automático).

## 2026-10-28 — Family / FOMAG: formatos separados y acta de cambio Family
**Qué se hizo:** lo pedido en la videollamada (docs/Video.mp4): el formato único "Family Homecare / FOMAG — Comodato, acta general y F-FAM-11" se cambia por el contrato de comodato solo, tres F-FAM-11 (CPAP-BPAP, Oxígeno, Otros equipos, del Excel "FORMATO ENTREGA DE EQUIPOS BIOMEDICOS 2025") y "Acta de cambio de equipo Family" (la de Ingemedic con el logo y el nombre de Family). Todas con el logo real de Family (`logos/clientes/family-homecare.jpg`). En el F-FAM-11 la edad y los meses de atención se escriben (`{{edad}}`, `{{meses_atencion}}`, campos propios): antes la edad salía de la fecha de nacimiento y "MESES" mostraba el mes de la entrega. Se corrigió del Excel la numeración repetida de oxígeno, "EPS:" doble, "FAMLIAR" y "VENTURY". `render.js` → `tablaFija`: las filas fijas también miran modelo y marca (el tamaño del cilindro solo está en el modelo) y con `juntar` toman todas las unidades que coinciden (cantidad sumada, series separadas por coma).
**Por qué:** el acta general de Family (entrega/devolución/recarga) no se pidió en las nuevas y quedó fuera.
**Archivos:** lib/actas/{plantillas-base,render}.js, docs/sql-plantillas-family.sql
**SQL:** `docs/sql-plantillas-family.sql` (crea las 5, las asigna a FOMAG y FAMILY HOMECARE SAS, desactiva la vieja). Ya aplicado el 2026-10-28 desde un script con service_role (mismo efecto que el SQL; el logo ya está en Storage). El SQL es idempotente: correrlo otra vez no duplica nada.
**Sugerencias por equipo:** `plantillasSugeridas(…, equipos)` (lib/actas/acciones.js): una plantilla con filas fijas de equipos (los F-FAM-11) solo se sugiere si algún equipo del préstamo cae en una de sus filas; si ninguno cae en ninguna (p. ej. un desfibrilador), se sugieren todas. En Préstamo nuevo se vuelve a sugerir al cambiar el carrito, mientras no se hayan marcado formatos a mano (`formatos_a_mano`). Probado con las plantillas reales: concentrador → contrato + Oxígeno; CPAP → contrato + CPAP; CPAP + concentrador → los tres; otros clientes sin cambio. Archivos: lib/actas/{acciones,firmar}.js, prestamos/NuevoPrestamo.js.
**Pendiente:** faltan los Word de CPAP (acta de la máscara, recibido a satisfacción) que van a mandar · el cliente de prueba (c57b5124…) tenía la vieja y no recibe las nuevas · probar en el navegador con un préstamo real.

## 2026-10-26 — Actas: descargar juntas o por separado
**Qué se hizo:** nuevo `<DescargarActas>` (components/actas). Con una sola acta baja el PDF directo; con varias abre un menú: "Todas en un PDF" o "Cada una por separado" (un PDF por acta, `<base>_<nombre del acta>.pdf`). En la vista previa además "Solo esta acta". Se usa en Préstamos (ActasPrestamo), Entregas (detalle), Entregas del repartidor (lista y pantalla de éxito), hoja de vida del equipo y el historial del préstamo (la vista previa ahora deja descargar). `PreviaActas` cambió `onDescargar/descargando` por `nombreArchivo/onError`.
**Por qué:** por separado son archivos sueltos, no un ZIP: así lo pidieron. El navegador puede pedir permiso la primera vez para "descargar varios archivos".
**Archivos:** lib/actas/pdf.js, components/actas/{DescargarActas,PreviaActas,ActasPrestamo}.js, components/inventario/ActasEquipo.js, components/prestamos/HistorialPrestamo.js, entregas/{EntregasClient,EntregasRepartidorClient}.js
**Pendiente:** probarlo en el navegador (escritorio y celular): menú, descarga por separado y el permiso de varias descargas.

## 2026-10-25 — Ficha del equipo rediseñada y "Marcar disponible"
**Qué se hizo:** hoja de vida del equipo (Inventario): encabezado con el tipo y la categoría del propio equipo y su estado; resumen con imagen, estado y quién lo tiene; ficha en dos columnas (Esta unidad / Del tipo); Historia y Actas en pestañas. Si está "Por recargar", botón **Marcar disponible** con confirmación (bitácora). Se sacó `Date.now()` del componente (`ahoraMs`) por la regla de pureza de React.
**Archivos:** `inventario/InventarioClient.js`.

## 2026-10-25 — Todas las actas del préstamo en un solo lugar
**Qué se hizo:** la sección Actas del préstamo (`actas/ActasPrestamo.js`, reescrito) muestra todas las actas, firmadas o no, agrupadas: Préstamo y cada recogida, cambio o recarga, con su fecha, "Firmada"/"Sin firmas" y "Firmar" (o "Llenar datos" en el préstamo sin firmar). "Ver todas" y "Descargar PDF" llevan todo. Se generaron sin firmas las actas de las 5 visitas que no tenían (ENT-2026-026 y 027 de ORD-2026-518; 028, 029 y 030 de ORD-2026-520, con cambio + recarga), con los datos que había.

## 2026-10-25 — Siempre queda acta (sin firmas si no se firma)
**Qué se hizo:** en oficina, el botón de hacer (sin "Firmar formatos") ya no deja la visita sin acta: guarda las actas sugeridas llenas con los datos que hay y sin firmas. En las Actas del préstamo y del equipo, las visitas sin firmar (con acta sin firmas, o sin acta si son de antes) tienen "Firmar"; al firmar, el acta sin firmas se borra y se guarda la firmada. Si RLS no deja borrar, se avisa en vez de dejar dos actas.
**Archivos:** `prestamos/AccionPrestamo.js`, `actas/ActasPrestamo.js`, `inventario/ActasEquipo.js`.
**SQL:** política `actas_borrar_sin_firmas` (DELETE para authenticated cuando `firma_recibe IS NULL`). Ya se corrió.
**Pendiente:** probar en el navegador firmar un acta sin firmas (el borrado con la sesión de un usuario no se pudo probar desde aquí: el script usa service_role, que se salta RLS).

## 2026-10-25 — Recarga con dos actas; actas en la hoja de vida del equipo; filtros generales en Inventario
**Qué se hizo:**
- Una recarga (cambio con `datos.recarga`) lleva **dos actas**: la de cambio de equipo (para el préstamo) y la de recarga (para el equipo). `formatosDeVisita(e)` da las acciones; `sugeridasDe`/`ofrecidasDe` (lib/actas/acciones.js) sugieren de varias acciones. `guardarActas` ahora guarda en `actas.accion` la acción de cada plantilla (antes, la misma para todas).
- Hoja de vida del equipo (Inventario) → **Actas del equipo** (`components/inventario/ActasEquipo.js`): cada vez que estuvo en un préstamo (prestado, recogido, cambiado, salió a recargar / entró recargado) con sus actas: ver, PDF, o "Llenar y firmar" si se hizo sin formatos.
- Inventario, vista de categorías: el buscador encuentra equipos de todo el inventario (código, serie, estado, quién lo tiene); filtro por categoría y chips por estado con conteo; lista paginada que abre la hoja de vida. El aviso "Por recargar": cada código abre el equipo y "Ver todos" filtra por ese estado.
**Verificado:** prueba desechable: se sugieren el acta de cambio y la de recarga de Ingemedic, las dos quedan pegadas a la visita con su acción, y la visita cuenta para el equipo que salió y el que entró. Borrado al final.
**Pendiente:** verlo en el navegador.

## 2026-10-25 — Estado "Por recargar" y aviso en Inventario
**Qué se hizo:** en un cambio con motivo Recarga, el equipo que sale (vacío) queda **"Por recargar"** en vez de Disponible: no se puede prestar ni elegir. Inventario muestra arriba un aviso con los equipos por recargar y "Marcar recargados" (uno o varios → Disponible, con bitácora). `cambiarEquipo` recibe `estadoSale`; si el estado no existe en la BD, el cambio falla con mensaje claro. Color violeta en Inventario, Dashboard y el selector de mantenimientos; también en la ayuda de Inventario.
**Archivos:** `lib/prestamos.js`, `lib/accionesPrestamo.js`, `components/inventario/AvisoPorRecargar.js` (nuevo), `inventario/InventarioClient.js`, `dashboard/DashboardClient.js`, `mantenimientos/SelectorEquipos.js`, `lib/ayuda.js`, `prestamos/AccionPrestamo.js`.
**SQL:** `INSERT` del estado "Por recargar" en `estados_equipo`. Ya se corrió.
**Verificado:** prueba desechable: en la recarga el vacío queda Por recargar y el recargado En préstamo; en un cambio por falla, el que sale queda Disponible; al marcarlo recargado pasa a Disponible. Todo borrado al final.
**Pendiente:** ver el aviso de Inventario en el navegador.

## 2026-10-25 — Recarga = cambio de equipo con motivo; menos botones; ventanas más anchas
**Qué se hizo:**
- La recarga se hace como **cambio de equipo con motivo "Recarga"** (se deja uno recargado, el vacío vuelve a Disponible). Ese motivo usa los formatos de recarga y guarda `ultima_recarga`. Se guarda como `entregas.tipo='cambio'` con `datos.recarga=true`; helpers `esRecargaVisita`, `formatoDeEntrega`, `nombreVisita` en `lib/accionesPrestamo.js`. Las filas viejas con tipo 'recarga' siguen funcionando. Se quitó el botón Recargar (Préstamos y Clientes); los avisos de recarga abren el cambio con ese motivo.
- Asistente: Cómo · Equipos (+ motivo obligatorio en un cambio). En oficina: "Hacer el cambio" (sin formatos) o "Firmar formatos" (firma ahí mismo); y si no, "Llenar formatos" después en el historial. A domicilio: + Confirmación con los formatos (al menos uno, los firma el repartidor) y "Llenar datos (opcional)".
- Detalle del préstamo: Cambiar equipo · Recoger · Finalizar préstamo, y Cancelar en "Más".
- Ventanas más anchas: Modal (sm 480, md 720, lg 960, xl 1180), VentanaDetalle 1200, firma de actas 1120, vista previa 1200, elegir equipo 1120, confirmar 460, y otras sueltas.
**Verificado:** prueba desechable de recarga como cambio en oficina: el vacío queda Disponible, el recargado En préstamo, `ultima_recarga` guardada; todo borrado al final.
**Archivos:** `AccionPrestamo.js` (reescrito), `accionesPrestamo.js`, `historialPrestamo.js`, `HistorialPrestamo.js`, `informeCliente.js`, `OrdenesClient.js`, `EntregasClient.js`, `EntregasRepartidorClient.js`, `EntregaEnCurso.js`, `ClientesClient.js`, `EquiposDelCliente.js`, `Modal.js`, `VentanaDetalle.js`, `FirmaActas.js`, `PreviaActas.js`, `ModalCambioEquipo.js`, `ConfirmDialog.js` y anchos sueltos.
**Pendiente:** recorrerlo en el navegador (la sesión de pruebas venció). A domicilio sigue pidiendo al menos un formato porque el repartidor cierra la visita firmando.

## 2026-10-25 — Un equipo puede volver al préstamo en el que ya estuvo
**Qué se hizo:** el cambio de equipo fallaba con `orden_equipos_orden_id_equipo_id_key` cuando el equipo que entra ya había estado en ese préstamo (cambio de ida y vuelta). Se cambió la regla: un equipo no puede estar dos veces *activo* en el mismo préstamo, pero sí volver. El historial guarda cada vez que entró y salió.
**SQL:** `DROP CONSTRAINT orden_equipos_orden_id_equipo_id_key` + índice único parcial `orden_equipos_activo_unico (orden_id, equipo_id) WHERE fecha_devolucion IS NULL`. Ya se corrió y se verificó con filas desechables: repetida cerrada entra, dos activas se bloquean.
**Además:** en el cambio, al marcar el equipo que sale se abre de una vez para elegir el que entra, y si no, queda un botón grande "Elegir el equipo que entra".

## 2026-10-24 — Recoger, recargar y cambiar: primero "¿se crea una entrega a domicilio?"
**Qué se hizo:** en el asistente de un préstamo ya entregado, el primer paso pregunta si se crea una entrega a domicilio. Si no, son dos pasos (Cómo · Equipos) y se hace de una vez, sin formatos. Los formatos se llenan y firman después, si se quiere, desde el historial del préstamo ("Llenar formatos" en la visita sin acta). A domicilio sigue igual: equipos, formatos, confirmación y programar.
**Por qué:** menos pasos para lo del día a día en oficina. Se quitaron del asistente "Firmar ahora" y "Registrar sin firmas".
**Archivos:** `components/prestamos/AccionPrestamo.js`, `components/prestamos/HistorialPrestamo.js`, `ordenes/OrdenesClient.js`.
**Pendiente:** probarlo en el navegador. La sesión guardada para las pruebas venció y no se pudo recorrer; solo se verificó con lint.

## 2026-10-23 — "Finalizar préstamo" siempre, aunque tenga un solo equipo
**Qué se hizo:** el botón para finalizar sin acta solo salía en préstamos entregados con varios equipos; con uno solo no había forma. Ahora sale en todo préstamo "Entregada". Al finalizar también se cancelan las recogidas, recargas y cambios que quedaron programados (en un cambio, libera el equipo reservado).
**Archivos:** `ordenes/OrdenesClient.js`.

## 2026-10-22 — Manual de usuario y botón para descargarlo
**Qué se hizo:** manual en PDF para oficina, repartidor y administración, con capturas reales del portal. Se descarga desde la ayuda "?" de cada módulo con el enlace "Manual completo (PDF)".
**Por qué:** las capturas traen datos reales de pacientes, por eso el PDF no va en `/public`: lo sirve `/api/manual` solo con sesión (sin sesión, 401). Se probó con sesión: 200 y el PDF completo.
**Archivos:** `docs/manual/` (manual-usuario.html, generar-pdf.cjs, capturar.cjs, capturas/web/*.jpg, Manual_Ingemedic.pdf), `src/app/api/manual/route.js`, `src/components/ui/Ayuda.js`, `next.config.mjs` (outputFileTracingIncludes), `.gitignore`.
**Para actualizarlo:** editar el HTML y correr `node docs/manual/generar-pdf.cjs`. Capturas: `node docs/manual/capturar.cjs` con `npm run dev` abierto (`REPARTIDOR=1` para las del repartidor); las PNG originales y las sesiones de esa ventana no van al repo.
**Pendiente:** confirmar la descarga en producción (que el PDF entre al deploy); faltan capturas de la visita en curso y de las firmas del repartidor.

## 2026-10-22 — Historial del préstamo
**Qué se hizo:** Sección "Historial" en el detalle del préstamo (`components/prestamos/HistorialPrestamo.js`; armado en `lib/historialPrestamo.js`): creación, equipos que salen, entrega a domicilio (repartidor, quién recibió, duración), recogidas, recargas y cambios (oficina o domicilio, quién, motivo), programadas y canceladas, vigencia, frecuencia de recarga, devoluciones sin acta y finalización, con "Ver acta" por visita. Sale de orden_equipos, entregas y la bitácora del préstamo y de sus visitas (lo viejo solo dice quién si la bitácora lo registró). Probado con ORD-2026-502, 504 y 505.
**Archivos:** `src/lib/historialPrestamo.js`, `src/components/prestamos/HistorialPrestamo.js`, `ordenes/OrdenesClient.js`, `ordenes/page.js`.

## 2026-10-21 — Partes 2 a 5: recoger, recargar y cambiar con acta; historia por equipo
**Qué se hizo:** Cada recogida, recarga o cambio es una fila de `entregas` (tipo `retiro` / `recarga` / `cambio`, `modo` oficina o domicilio, `fecha_programada`, `datos` con copia de los equipos, cambios, motivo, formatos y datos del acta). Lógica en `lib/accionesPrestamo.js` (programar, iniciar, cancelar, aplicar, registrar en oficina, completar). Asistente `components/prestamos/AccionPrestamo.js` (Equipos · Cómo · Formatos · Confirmación) igual al de préstamo nuevo; en oficina "Firmar ahora" o "Registrar sin firmas", a domicilio queda en la lista del repartidor. `FirmaActas` sirve para cualquier acción (plantillas, equipos y retirados, datos iniciales, textos por acción; alFirmar puede devolver `{ entregaId }`). Préstamos: botones Recoger / Recarga / Cambiar arriba y por equipo (con el préstamo entregado; antes de entregarlo sigue el cambio directo), "Programado" con cancelar, "Recargas" con frecuencia (`recarga_cada_dias`, `ultima_recarga`) y apertura por URL (`?abrir=&accion=&equipos=&volver=`). Clientes ya no devuelve sin acta: lleva al asistente y vuelve (`?cliente=` / `?paciente=`); pestaña "Por equipo" (historia + mantenimientos). Entregas (admin y repartidor) muestran y completan las acciones; las de oficina no salen en el tablero. Aviso "Recargas por hacer" en el inicio (`lib/atencion.js`); el panel de atención recoge vía asistente. Informe PDF y Excel con recargas e "Historial por equipo" (`armarInforme(..., { entregas })` → `porEquipo`). `ActasPrestamo` separa las actas del préstamo de las de las acciones.
**Archivos:** `lib/accionesPrestamo.js` (nuevo), `lib/prestamos.js` (cambiarEquipo acepta `yaReservado`), `lib/actas/firmar.js`, `lib/informeCliente.js`, `lib/atencion.js`, `lib/ayuda.js`, `components/prestamos/AccionPrestamo.js` (nuevo), `ModalCambioEquipo.js` (`soloElegir`), `components/actas/FirmaActas.js`, `ActasPrestamo.js`, `LlenarFormatos.js`, `components/entregas/EntregaEnCurso.js`, `components/clientes/EquiposDelCliente.js`, `HistorialPorEquipo.js` (nuevo), `components/dashboard/PanelAtencion.js`, `ordenes/*`, `entregas/*`, `clientes/ClientesClient.js`, `api/exportar/cliente/route.js`.
**SQL:** `docs/sql-partes2a5-acciones.sql` (solo columnas y restricción de `entregas.tipo`). Corrido y verificado el 2026-10-21.
**Prueba:** de punta a punta con un préstamo desechable (lógica de `lib/accionesPrestamo.js` contra la BD, con service role): recarga en oficina con acta, cambio a domicilio (reserva, iniciar, completar), cambio cancelado (libera la reserva), recogida total (préstamo finalizado) e historia por equipo — 25/25. Se arregló el orden de la historia: `orden_equipos.fecha_entrega/fecha_devolucion` son `date` y la recarga es timestamptz; se ordena por día de Bogotá (`diaLocal` en lib/fechas.js) y, el mismo día, préstamo → recarga → cambio → devolución. La prueba consumió ORD-2026-506 a 512 (borrados).
**Pendiente:** Probar en pantalla (oficina con firma, sin firmas, domicilio con repartidor). RLS no se probó: al completar una recogida o un cambio, la sesión del repartidor modifica `orden_equipos` (nuevo frente a la entrega de siempre). Si falla, mover la aplicación de la acción a una ruta de servidor.

## 2026-10-21 — Plantilla de cambio de equipo, "¿para qué es?" al crear y "Se recarga" por tipo
**Qué se hizo:** Configuración → Plantillas agrupada en secciones por acción. "Acta de cambio de equipo Ingemedic" (de Ingemedic para cambio): tabla por tipo con los que se retiran (`fuente: 'retirados'`, `ctx.retirados`, guardado en `actas.datos.retirados`) y los que se entregan, y `{{motivo_cambio}}` (`datos.motivo`). Nueva plantilla pregunta primero para qué acción es. En Configuración → Tipos, casilla "Se recarga" (`tipos_equipo.atributos.se_recarga`, sin SQL); si no se marca, los cilindros se recargan (`seRecarga` en acciones.js).
**Archivos:** `lib/actas/acciones.js`, `contexto.js`, `render.js`, `firmar.js`, `ejemplo.js`, `nombres.js`, `plantillas-base.js`, `components/actas/NuevaPlantilla.js`, `EditorPlantilla.js`, `configuracion/ConfiguracionClient.js`.
**SQL:** `docs/sql-plantilla-cambio.sql` (crea la plantilla). Corrido y verificado el 2026-10-21.
**Pendiente:** El acta de cambio todavía no se llena desde ningún flujo: la usa la parte 4.

## 2026-10-21 — Parte 1 de acciones con acta: cada plantilla es de una acción
**Qué se hizo:** Base para recoger, recargar y cambiar equipos con acta (las partes 2 a 5 hacen los flujos). Cada plantilla es de UNA acción: `plantillas_acta.accion` (`prestamo`, `devolucion`, `recarga`, `cambio`); `es_estandar` pasa a significar "de Ingemedic para su acción" (una por acción). Se descartó un primer intento con varias acciones por plantilla y secciones por acción dentro de una misma plantilla: Sofía prefiere plantillas separadas. `lib/actas/acciones.js`: sugerencia por acción (las del cliente de esa acción; si no, la de Ingemedic). Editor: "Para: Préstamo · Devolución · Recarga · Cambio de equipo". Configuración: la acción en cada tarjeta, ordenadas por acción, y "De Ingemedic para …" en Clientes de la plantilla. El Excel "ACTA DE ENTREGA DE EQUIPOS INGEMEDIC" se separó en "Acta de devolución Ingemedic" y "Acta de recarga Ingemedic" (tabla por tipo), de Ingemedic en su acción. `actas.accion` guarda la acción de cada acta firmada. Préstamos: el buscador también encuentra por cédula, NIT, código, código de inventario y serial del equipo.
**Archivos:** `src/lib/actas/acciones.js` (nuevo), `firmar.js`, `plantillas-base.js`, `components/actas/EditorPlantilla.js`, `AsignarPlantilla.js`, `NuevoPrestamo.js`, `configuracion/*`, `ordenes/page.js`, `OrdenesClient.js`.
**SQL:** `docs/sql-parte1-acciones.sql` — corrido y verificado el 2026-10-21 (deshace el SQL de la versión descartada desde `bkp_plantillas_acta_20261022`, agrega `accion`, cambia el índice `plantillas_acta_una_estandar` a una por acción y crea las dos plantillas). Borrar `bkp_plantillas_acta_20261022` y `bkp_cliente_plantillas_20261022` cuando se confirme.
**Decisiones:** la recarga es de los tipos de equipo que Ingemedic marque (por defecto cilindros) — parte 3. En Clientes los botones de acción llevan al asistente de Préstamos (no se duplica). La parte de devolución que traen el estándar y Family se queda como está en el papel (en blanco); al recoger se usa la plantilla de devolución.

## 2026-10-21 — Equipos entregados: una tabla por tipo de equipo
**Qué se hizo:** ORD-2026-505 tiene 6 equipos (aspirador, concentrador, 2 cilindros, 2 reguladores) y el acta estándar mostraba 3: el recuadro copiado del formato impreso tiene una casilla de equipo, una de cilindro y una de regulador. Decisión de Sofía: dejar el recuadro y usar una tabla estándar por tipo. Tabla nueva `{ tipo: 'tabla', fuente: 'equipos', agrupar: 'tipo', accesorios: [...] }` (render.js → `tablasPorTipo`): una tabla por categoría, solo con las columnas que esos equipos traen (marca, modelo —"TAMAÑO" en cilindros—, serial, código), cilindros y reguladores al final, y una fila de accesorios para marcar (HUMIDIFICADOR, CANULA, CIRCUITOS, OTROS = insumos; claves manuales `bloque.aN`). La devolución sigue con el recuadro (se llena a mano). En el editor: Lista → "Equipos por tipo". Además: el equipo principal (`{{equipo_*}}`) es el primero que no sea cilindro ni regulador, y la descripción sale de `equipos.atributos.nombre` (nombre genérico, en 1.700 de 1.709 unidades; el del tipo a veces es modelo o marca).
**Archivos:** `src/lib/actas/render.js`, `campos.js`, `contexto.js`, `plantillas-base.js`, `nombres.js`, `components/actas/EditorPlantilla.js`.
**SQL:** cambia el bloque 4 del estándar y el 2 de Family, y mueve las marcas a mano (`4.3`/`4.7`/`4.11` → `4.a0`/`4.a1`/`4.a2`; ídem bloque 2). Respaldo `bkp_plantillas_acta_20261021` y `bkp_datos_acta_20261021`. Corrido el 2026-10-21 y verificado (las dos plantillas con `agrupar: tipo`; la 505 con sus X en `4.a0`/`4.a1`). Borrar los respaldos cuando se confirme en el PDF.
**Pendiente:** Las actas ya firmadas guardan su copia de la plantilla y no cambian.

## 2026-10-19 — PDF de actas desde el celular: texto al doble, logos perdidos y cortes a mitad de línea
**Qué se hizo:** (1) `capturar.js` apaga el agrandado de texto de Chrome Android con `text-size-adjust:100%` en el iframe. (2) Las imágenes se capturan ocultas y se dibujan encima en su lugar exacto (con `setTransform` reiniciado: html2canvas deja el lienzo escalado). (3) `pdf.js` arma las hojas con `armarHojas()`: si una página no cabe, corta solo en cortes seguros (entre bloques, filas o renglones de párrafo, medidos en el iframe) y repite el margen de arriba en las hojas siguientes. (4) `.texto` con `overflow-wrap:anywhere`: las rayas largas "____" del pagaré ya no se salen del margen.
**Por qué:** Acta_ORD-2026-504 (descargada en el celular desde la pantalla de éxito del repartidor) salió con los párrafos al ~1,9× (760 px de acta / ~393 de pantalla), sin logo en 2 de 3 encabezados, con títulos y renglones partidos entre hojas y las firmas solas en otra hoja.
**Archivos:** `src/lib/capturar.js`, `src/lib/actas/pdf.js`, `src/lib/actas/render.js`.
**Pendiente:** El agrandado no se pudo reproducir en Puppeteer (ni con `--blink-settings`); la causa se dedujo por el patrón (solo párrafos largos y proporción de anchos). Confirmar descargando el acta desde un celular Android. Logos, firmas y cortes sí se verificaron con los datos reales de la 504.

## 2026-10-19 — Sitio público: horario en vez de 24/7, portafolio sin carrusel, INVIMA arriba en Nosotros
**Qué se hizo:** Cambios mínimos sobre el diseño que ya había (un primer rediseño completo se descartó: a Sofía le gustaba más el original). Se quitó "24/7 / 24 horas" de Inicio, Nosotros, Contacto y los metadatos (soporte de lunes a sábado, con el horario). Inicio: sin "Servicios destacados"; "Equipos disponibles" queda como sección. Portafolio: sin carrusel 3D (el banner azul se mantiene) y el banner "¿Dudas…?" pasó a ser una tarjeta "Consulta por más equipos" con el mismo estilo de las tarjetas. Nosotros: la sección de certificación INVIMA sube justo después del banner. Celular y contraste: botones de WhatsApp en verde oscuro (#128C7E; el verde claro con letra blanca no se leía), rótulos de Contacto más oscuros, horario de Contacto en renglones, párrafos sin justificar en celular, margen igual en "¿Por qué elegirnos?".
**Archivos:** `LandingPage.js`, `portafolio/page.js`, `quienes-somos/page.js` y su layout, `contacto/page.js` y su layout, `Footer.js`, `app/page.js`, `lib/sitio.js` (HORARIO: fuente única de los datos estructurados de Google), `lib/interes-web.js`.

## 2026-10-19 — Vistas previas de actas con el alto real de la hoja
**Qué se hizo:** Auditoría de las 4 plantillas activas (datos de ejemplo y extremos) y de las 24 actas firmadas: sin variables sin reemplazar, sin imágenes rotas, sin desbordes. Con datos extremos dos hojas pasan del A4 (estándar pág. 1, Family pág. 6): el PDF las parte bien, pero las vistas en pantalla (VistaActa, PreviaActas, hoja de LlenarFormatos) tenían alto fijo A4 y cortaban el sobrante; ahora miden la hoja. `render.js` también lleva `text-size-adjust:100%` (agrandado de Chrome Android en las vistas previas).
**Archivos:** `components/actas/VistaActa.js`, `PreviaActas.js`, `LlenarFormatos.js`, `lib/actas/render.js`.

## 2026-10-18 — Logo por cliente y captura de PDF compartida
**Qué se hizo:**
- **Captura de PDF en un solo lugar** (`lib/capturar.js → capturarHTML`): iframe
  aparte, texto dibujado por el navegador (foreignObject) con las imágenes
  incrustadas antes, y vuelta al dibujo normal si el navegador no lo soporta. La
  usan las actas (`lib/actas/pdf.js`), el informe de Clientes, la hoja de vida de
  Inventario y el acta antigua de Entregas. Así ya no salen textos corridos en
  celular en ninguno.
- **Logo por cliente** (`clientes.logo_url`, `components/clientes/LogoCliente.js`):
  se sube en el detalle del cliente al darle Editar en "Datos" y se guarda al
  subirlo (`logos/clientes/logo-<id>`, con `?v=`).
  - Se ve en el encabezado del detalle (`EncabezadoDetalle` acepta `imagen`).
  - Va en el informe PDF, junto al nombre, en lugar del círculo con la inicial.
**SQL:** `clientes.logo_url` corrido el 2026-10-18.
**Pendiente:** no se vio en pantalla ni se generaron los PDF en el navegador.

## 2026-10-18 — PDF de actas sin hojas en blanco; el repartidor lo descarga
**Qué se hizo:**
- **Hojas en blanco** (`lib/actas/pdf.js`): el alto de una hoja A4 en píxeles
  (2149,7) tenía decimales. Cada página de 2150 px dejaba un resto de 0,3 px que
  salía como hoja en blanco: ORD-2026-307 tenía 3 páginas y el PDF salía con 6.
  - Ahora el alto va redondeado y un pedazo en blanco no se agrega.
  - Si una página se pasa hasta un 8 % (fuente un poco más grande en el navegador),
    se achica para que quepa en una hoja, en vez de partirla.
- **Valores corridos sobre las rayas** (Acta_ORD-2026-503): html2canvas, al dibujar
  el texto él mismo, calcula mal la altura de la letra en algunos equipos (celulares
  sin Arial). En PC con Windows se ve bien. Ahora el texto lo dibuja el navegador
  (`foreignObjectRendering`), con los logos incrustados como data URL antes, porque
  en ese modo las imágenes externas no cargan. Si la captura sale bloqueada o vacía,
  vuelve al modo anterior. Probado con la hoja real de ASMEDC en Chrome sin ventana:
  los valores van sobre la raya y salen el logo y la firma. **Pendiente:** probar la
  descarga en el celular donde salió mal. El informe de Clientes y la hoja de vida
  de Inventario usan html2canvas y pueden tener el mismo problema.
- **Repartidor:** en Completadas, cada entrega tiene un botón **PDF** con las actas
  firmadas en esa entrega (por `entrega_id`; si no hay, las del préstamo).
- **Al cerrar la entrega**, el repartidor ve una pantalla de éxito (`EntregaExitosa`)
  con el tiempo de entrega (de `fecha_inicio` a la firma), quién recibió, la hora y
  "Descargar acta".
**Verificado:** las páginas de ORD-2026-307 miden 1070, 761 y 931 px (A4 = 1075), así
que ahora sale una hoja por página.
**Pendiente:** generar el PDF en el navegador y ver la pantalla de éxito en un
celular. No se hizo porque Chrome estaba en segundo plano.

## 2026-10-18 — Llenar formatos mirando la hoja (todos los campos)
**Qué se hizo:** a pedido de Sofía, "Llenar formatos" (asistente, paso 4, y
"Llenar datos" del detalle) deja de ser una lista larga. Ahora es
`components/actas/LlenarFormatos.js`:
- **Una pestaña por formato**, cada una con su contador de lo que falta.
- **A la izquierda, la hoja** (una a la vez, con flechas), que se actualiza al
  escribir. Los espacios para llenar van marcados: ámbar si están vacíos, azul si
  están llenos.
- **A la derecha, todos los campos de ese formato**, en el orden de la hoja y por
  sección, con la etiqueta del documento (`campos.js → camposDelFormato`):
  - datos que se piden (cuentan en "Faltan");
  - automáticos (fecha, marca, quien entrega…), que muestran en gris lo que pondría
    el sistema (`datos_acta.valores`);
  - campos propios;
  - renglones en blanco (`datos_acta.manuales[plantilla]['bloque.campo']`; los de
    "FIRMA" no);
  - estado de cada equipo (`datos_acta.estados`, antes fijo en "Bueno") e insumos
    (con su estado, antes fijo en "Nuevo").
- **Ida y vuelta:** tocar un campo resalta su lugar (y cambia de hoja); tocar la hoja
  lleva al campo. `render.js` con `ctx.marcar = CLAVES_HOJA` pone `data-campo`;
  sin marcar no deja rastro (PDF igual).
- El iframe se carga una vez y luego solo cambia su contenido, así que no parpadea.
- En celular hay dos pestañas: Campos y Ver hoja.
- **Ventana casi a pantalla completa** (`VentanaLlenarFormatos`), para que la hoja se
  vea a tamaño real. En el asistente, el paso 4 muestra los formatos elegidos, lo que
  falta y un botón "Llenar formatos" (se cierra con "Listo"). En el detalle se
  cierra con Cancelar o Guardar.
- `DatosFormatos.js` se eliminó. `EditorInsumos` vive en `LlenarFormatos.js`. La firma
  conserva todo y cada acta guarda sus renglones (`actas.datos.manuales`).
**Verificado:** en las 5 plantillas activas, cada espacio de la hoja tiene su campo y
cada campo su espacio. En ORD-2026-501 (sin guardar): pestañas con contador, un
toque en la hoja lleva al campo, un renglón de la hoja 2 cambia de hoja y se resalta,
y lo escrito aparece en vivo.
**Ojo:** los renglones se ubican por la posición del bloque. Si se mueven bloques
en el editor, lo llenado en préstamos sin firmar puede quedar en otro renglón. Las
actas firmadas no se afectan.

## 2026-10-18 — Plantillas desde el panel: importar Word y editor visual (fase 3)
**Qué se hizo:** desde Configuración → Plantillas ya se crean plantillas sin
tocar código. Dos caminos: importar un Word o armarla por bloques.
- **Nombres de datos** (`lib/actas/nombres.js`): en Word y en el editor los datos
  van entre corchetes, como `[Nombre del paciente]`. Se traducen a `{{variables}}`
  y de vuelta.
  - Si el nombre no existe (`[Número de contrato]`), se vuelve un campo propio:
    `{{numero_contrato}}`, y su etiqueta queda en un bloque oculto `campos_propios`.
  - Ese campo se pide en "Llenar formatos" del préstamo.
  - Marcadores especiales: `[Equipos]`, `[Insumos]`, `[Firma de quien recibe]` y
    `[Firma de quien entrega]`.
- **Importar Word** (`lib/actas/importarWord.js`): lee el `.docx` en el navegador
  con JSZip y un lector de XML propio.
  - Párrafos → texto o título. Tablas → campos. Una tabla con `[Equipos]`, o con
    títulos tipo CANTIDAD / MARCA / SERIE y filas vacías → tabla de equipos.
  - Primera tabla con logo → encabezado. El encabezado y el pie de página de Word
    se repiten en cada hoja. Imágenes → bloque `imagen` (nuevo en `render.js`).
  - Las imágenes se suben a `logos/plantillas/` (`lib/actas/imagenesPlantilla.js`).
  - El resultado es un **borrador**: se ajusta en el editor. No copia el Word al
    milímetro.
- **Editor** (`components/actas/EditorPlantilla.js`): bloques plegables (subir,
  bajar, duplicar, quitar), un formulario por tipo, "+ Dato" que inserta
  `[Nombre]` donde está el cursor, vista previa en vivo con datos de ejemplo,
  Guardar y Desactivar.
- **Nueva plantilla** (`components/actas/NuevaPlantilla.js`): Word, copia de otra
  o en blanco, con la lista de nombres de datos para copiar.
- `jszip` pasa a ser dependencia directa.
**Verificado:**
- Abrir y guardar sin tocar deja las 4 plantillas reales idénticas.
- Con sesión en local, de punta a punta: un Word de prueba (ASMEDC con corchetes)
  se importó, el logo subió y se guardó con el campo propio y su etiqueta.
  Después se editó y se desactivó. Todo lo de la prueba se borró: fila, logo y
  bitácora.
- "Llenar datos" en ORD-2026-308 marca lo que falta. El asistente muestra los
  5 pasos.
**Ojo al probar en Chrome:** con la ventana oculta, React 19 no muestra el
contenido que llega por streaming (lo hace con `requestAnimationFrame`) y la
página se queda en el esqueleto de carga. No es un error del código.
**Pendiente:**
- Probar con Words reales de clientes. Un Word armado con tabulaciones queda
  como texto corrido y hay que pasarlo a campos en el editor.
- No se probó crear un préstamo de punta a punta con el paso Formatos, ni la
  firma precargada.

## 2026-10-18 — Formatos: se llenan al crear el préstamo, insumos libres, plantillas unidas
**Qué se hizo:**
- **Plantillas unidas (decisión de Sofía):** el pagaré vuelve a ser parte de la estándar.
  Comodato, acta general y F-FAM-11 de Family quedan en un solo formato. Las tres viejas
  se desactivan y los préstamos que las tenían pasan a la unida.
- **F-FAM-11:** las tablas de equipos e insumos dejan las filas fijas (CPAP / BPAP /
  máscaras) y listan lo del préstamo. Así reemplaza las 3 hojas del Excel.
- **Insumos:** vuelven, pero libres (insumo, cantidad, lote, Reg. INVIMA). No salen del
  inventario. Antes la firma los mandaba vacíos.
- **Llenar formatos al crear el préstamo:** el asistente tiene 5 pasos y "Formatos" es
  uno propio. `lib/actas/campos.js` mira qué `{{variables}}` usan las plantillas elegidas
  y `components/actas/DatosFormatos.js` pide solo esas. Cuenta los vacíos y deja seguir
  sin llenarlos. Tiene vista previa "Ver cómo quedan".
  - Lo que se llena se guarda en `ordenes_servicio.datos_acta`.
  - Los datos del paciente van al paciente y el diagnóstico al préstamo.
  - `FirmaActas` llega precargado, así que el repartidor solo corrige y firma.
  - En el detalle del préstamo, si los formatos no están firmados, se muestra
    "Faltan N datos" y un botón "Llenar datos".
- **Campos propios:** una variable que el sistema no conoce (`{{numero_contrato}}`) se
  pide como texto libre en "Otros datos" y se guarda en `datos_acta.extra`. Es la base
  para importar plantillas desde Word.
- **Logo para modo oscuro:** Configuración → Empresa permite subir una segunda versión
  (`configuracion_empresa.logo_oscuro_url`). Con las dos, `LogoEmpresa.js` muestra la del
  tema; sin la oscura, el logo normal va sobre una pastilla blanca. El logo se guarda al
  subirlo, con `?v=` para que el navegador no siga mostrando el anterior.
**SQL:** respaldo `bkp_*_20261018`, columna `datos_acta`, unión y reasignación: ya
corrido, 4 plantillas activas. `logo_oscuro_url`: entregado, sin correr.
**Pendiente:**
- Ver en pantalla el asistente, la firma y "Llenar datos" (Chrome sin sesión).
- FAM-11 revisado contra `docs/FORMATO ENTREGA DE EQUIPOS BIOMEDICOS 2025.xlsx`: entre las 3 hojas solo cambian las filas. En la versión 2025, "quien recibe" lleva solo NOMBRE y CEDULA, sin PARENTESCO ni RECIBO CONFORME: falta que Sofía diga si se quitan.
- Importar plantillas desde Word y el editor visual (fase 3).
- Borrar los respaldos cuando se confirme.

## 2026-10-17 — Ajustes tras la revisión: Clientes, Configuración, textos
**Qué se hizo:**
- **Textos**: ayudas y avisos cortos y generales (sin detalles internos ni de
  permisos). "Tu sesión expiró. Vuelve a ingresar." en vez de explicar las 8 horas.
- **Clientes**: Clientes/Pacientes como selector segmentado (ya no pegado al
  encabezado). Detalle con datos bloqueados y botón "Editar" en la misma ventana
  (ya no un pop-up encima); "Desactivar cliente" solo dentro de la edición.
  Pestañas: En préstamo y Línea de tiempo (sin "Órdenes"). Línea de tiempo en
  palabras ("Se prestó Cama hospitalaria a Ana Pérez"), paginada. Equipos en
  préstamo paginados; grupos plegados si son muchos. "Devolver equipos": vista de
  búsqueda con selección múltiple y confirmación con espera de 5 s
  (`ui/ConfirmarConEspera.js`). Informe PDF rehecho (equipos, pacientes, línea de
  tiempo) y nuevo Excel (`/api/exportar/cliente`), con los mismos datos
  (`lib/informeCliente.js`).
- **Acceso al portal** sale del detalle del cliente: Configuración → Acceso de
  clientes (módulo de permisos `configuracion.accesos`). "Portal de clientes"
  (bloqueo general) pasa a llamarse "Estado del portal".
- **Inventario**: "Editar ficha" edita en la misma hoja de vida; "Eliminar" solo
  dentro de la edición. "Actividad reciente" es ahora una mini bitácora del
  inventario. En celular, solo 2 indicadores (Disponibles, En préstamo).
- **Préstamos**: filtros Categoría → Tipo (el tipo se habilita al elegir la
  categoría) y nuevo filtro por paciente. En celular salía dos veces "Nuevo
  préstamo": `ui.btn*` trae `inline-flex` y le ganaba a `hidden`; ahora se oculta
  con `max-md:hidden`.
- **Configuración**: sin centrar el bloque (dejaba un vacío enorme junto al menú
  en pantallas anchas). En celular, lista de secciones tipo app.
**SQL:** ocultar "Acceso de clientes" al Operador — entregado, pendiente de correr.
**Pendiente:** revisión en pantalla (Chrome minimizado y luego sin internet); el
Excel y el PDF del informe no se descargaron en una prueba real.

## 2026-10-16 — Homologación de diseño, ayuda (?) y fuera Servicios prestados
**Qué se hizo:**
- **Sistema de diseño** (`lib/ui.js`, guía en `docs/diseno.md`): clases únicas para
  botones, campos, rótulos, chips, toast y tonos de estado. Componentes nuevos:
  `EncabezadoModulo` (encabezado de todos los módulos), `Modal` (ventana
  estándar), `EncabezadoDetalle` (en `VentanaDetalle`), `Ayuda`.
- **Ayuda "?"** en el encabezado de cada módulo y en la vista del repartidor:
  guía corta por módulo en `lib/ayuda.js` (base para el manual; campo `video`
  para enlazar cada video cuando exista).
- **Detalles**: Préstamos, Clientes y Pacientes dejan el panel lateral que
  encogía la lista y abren en `VentanaDetalle` como Entregas e Inventario.
  Encabezados de detalle blancos en todos (Entregas lo tenía rojo).
- **Ventanas** pasadas a `Modal`: formularios de cliente/paciente, Configuración
  (usuario, categoría, tipo, lista), Inventario (editar, nuevo tipo, nueva
  unidad), "Ver y empezar" de Entregas, Devolución, Asignar plantilla.
  Confirmaciones copiadas a mano → `ConfirmDialog` (botones: Cancelar | Acción).
  Vista previa de plantillas → `PreviaActas`.
- **Configuración**: el menú de secciones es una tarjeta dentro del contenido
  (antes, segunda columna pegada al menú principal); en celular, un selector.
- **Acción principal y Exportar** en el encabezado del módulo, no en la franja
  de filtros. Buscadores de 38px iguales; foco rojo en todos los campos.
- **Espacio inferior en celular**: `pb-28` se sumaba a lo que ya reserva el
  layout para la barra (y en listas iba dos veces). Ahora `pb-20` solo donde hay
  scroll.
- **Color**: `#E53935` (menú) → `#D81B43`; `#C0392B`, `#25A9E0`, `#152d55` unificados.
  Menú lateral con ítems en pastilla, como el de Configuración.
- **iPhone**: campos a 16px en celular (regla en `globals.css`).
- **Modo oscuro**: estados en `style={{}}` corregidos por atributo; logo sobre
  pastilla blanca.
- "Act:" sale del encabezado móvil; la versión está al final de Preferencias.
- **Servicios prestados eliminado** (página, menú, permisos y rutas): la tabla no
  existía y no se va a usar.
**Archivos:** `lib/ui.js`, `lib/ayuda.js`, `components/ui/{Modal,EncabezadoModulo,Ayuda,VentanaDetalle,ConfirmDialog}.js`,
los `*Client.js` de todos los módulos, `Sidebar.js`, `ModalDevolucion.js`,
`AsignarPlantilla.js`, `ModalCambioEquipo.js`, `globals.css`, `tema-oscuro.css`,
`permisos.js`, `sitio.js`, `docs/diseno.md`, `CLAUDE.md`.
**SQL:** opcional, limpiar los permisos huérfanos de `servicios_prestados`
(`DELETE FROM permisos WHERE modulo = 'servicios_prestados';`) — no afecta si quedan.
**Pendiente:**
- Revisión visual con la ventana de Chrome a la vista: se verificó que las 8
  rutas compilan y responden 200 con sesión, no se vieron en pantalla.
- Mantenimientos (apagado) no se homologó.
- Tarjetas internas aún con padding p-4/p-5/p-6 según el módulo; los
  archivos de 1.700+ líneas siguen sin partir.

## 2026-10-16 — Auditoría: finalizar/cancelar préstamo dejaba equipos colgados
**Qué se hizo:** "Finalizar" (préstamo de varios equipos) y "Cancelar" en Préstamos
liberaban con `liberarEquipos` sin cerrar las filas de `orden_equipos`, y
Finalizar liberaba **todos** los equipos que alguna vez pasaron por la orden
(también los ya devueltos o cambiados, que pueden estar prestados a otro
cliente: les borraba cliente/paciente y los ponía Disponibles). Ahora ambos usan
`cerrarEquiposAbiertos` (`lib/prestamos.js`): cierra solo las filas abiertas y
libera solo esos equipos. Clientes → En préstamo ya no cuenta órdenes
Finalizadas/Canceladas (el comentario lo decía; el código no).
**Por qué:** la auditoría encontró 18 filas abiertas en órdenes Finalizadas o
Canceladas (ORD-2026-209 de ASMEDC mostraba 3 equipos duplicados; RL1550 de
FOMAG en dos órdenes finalizadas; el resto, del cliente JUAN PRUEBAS).
**Archivos:** `lib/prestamos.js`, `ordenes/OrdenesClient.js`, `clientes/ClientesClient.js`.
**SQL:** cierre de esas filas con respaldo `bkp_orden_equipos_20261016` — entregado, pendiente de correr.
**Pendiente:** probar Finalizar y Cancelar con un préstamo desechable; borrar el
respaldo cuando se confirme. Otros hallazgos de la auditoría (Servicios prestados
sin tabla, zoom de iPhone en formularios, código sin uso) quedaron como
recomendaciones, sin aplicar.

## 2026-10-16 — Rol Operador, modo oscuro, inicio de entregas, equipos del cliente y tipos
**Qué se hizo:**
- **Rol Operador** (por debajo de Administrador): ve los módulos de operación,
  pero en Configuración solo Preferencias. No hay código nuevo: son filas en
  `permisos` con `puede_ver = false` para cada `configuracion.*`, y la pantalla ya
  oculta lo no permitido. Se ajusta desde Roles y permisos como cualquier rol.
- **Modo oscuro** (Preferencias: Claro / Oscuro / Automático). Es preferencia del
  usuario: `usuarios.tema`, copiada a localStorage `ingemedic.tema`. El layout la
  lee en una consulta aparte (si la columna no existe, no rompe) y el script la
  aplica antes de pintar. Tailwind 4 pinta con variables, así que
  `src/app/tema-oscuro.css` redefine `--color-white`, `--color-slate-*` y los tonos
  claros de rojo/verde/ámbar… dentro de `.panel-app` (clase del layout del panel), y
  corrige uno a uno los hex escritos a mano más usados. `.siempre-claro` devuelve
  la paleta clara (hojas de actas, pad de firma). Un script en el layout aplica el
  tema antes de pintar; `<html>` lleva `suppressHydrationWarning` por eso. El sitio
  público y los PDF no cambian. También está en el perfil del repartidor.
- **Clientes → En préstamo:** tabla de un renglón por equipo con resumen, chips por
  tipo, buscador y vista agrupada por paciente o tipo
  (`components/clientes/EquiposDelCliente.js`). Columna "Equipos" en la lista.
- **Entregas:** en la vista de administración solo SuperAdmin puede iniciar una
  entrega; los demás ven "Espera al repartidor". El repartidor la inicia desde su
  vista, como siempre. Es una restricción de pantalla, no de BD.
- **Configuración → Tipos:** un solo botón "Nuevo tipo" junto a la categoría (antes
  había dos que hacían lo mismo).
**Archivos:** `lib/tema.js`, `app/tema-oscuro.css`, `app/globals.css`, `app/layout.js`,
`(dashboard)/layout.js`, `layout/TemaPanel.js`, `layout/SelectorTema.js`,
`configuracion/ConfiguracionClient.js`, `repartidor-preferencias/…Client.js`,
`clientes/ClientesClient.js`, `clientes/EquiposDelCliente.js`, `entregas/FirmaPad.js`,
`actas/VistaActa.js`, `actas/PreviaActas.js`.
**SQL:** rol Operador y sus permisos — corrido. `usuarios.tema` — entregado, pendiente de correr.
**Pendiente:**
- El Operador solo pierde *visibilidad*: la BD (RLS) y `/api/*` no distinguen
  roles salvo los módulos que valida `api-auth.js`. Ver pendiente de RLS por rol.
- Modo oscuro verificado con una página de muestra y el CSS real, no recorriendo
  cada módulo con sesión. Colores en `style={{}}` o hex poco usados pueden quedar
  claros: se corrigen agregándolos a `tema-oscuro.css`.

## 2026-10-15 — Ajustes de actas, entregas y plantillas por cliente
**Qué se hizo:**
- **PDF:** los valores llenos quedaban más arriba que su etiqueta (renglón
  alineado al fondo con altura mínima). Ahora etiqueta y valor comparten línea
  base (`last baseline`) y firma + nombre van uno sobre otro. Vive en
  `render.js`, así que corrige también las actas ya firmadas. Verificado con
  html2canvas en Chrome sin ventana.
- **Vista previa de actas** (`components/actas/PreviaActas.js`): desde el detalle
  del préstamo o la entrega, las actas firmadas o los formatos sin firmar se ven
  en una ventana grande, hoja por hoja con flechas (← →, deslizar en celular) e
  índice lateral de documentos; desde ahí también se descarga el PDF.
- **Logos:** si una plantilla no tiene la imagen del logo (Family, fiduprevisora,
  FOMAG) no se deja recuadro; la celda desaparece.
- **Nuevo préstamo:** el paso de equipos vuelve al selector de siempre
  (categorías → tipos → unidades con filtros + carrito, pedido del cliente),
  ahora en `components/prestamos/SelectorEquiposPrestamo.js`; se quitó el
  buscador único con lectura de códigos.
- **Préstamos en oficina sin firma** (el paciente no está en la oficina): ya no
  se abre la firma al crearlos; los formatos quedan relacionados y
  `ActasPrestamo` los descarga llenos y sin firmar. A futuro: enviarlos al correo
  del cliente para que firme.
- **Firma:** sin captura de insumos (deben venir del inventario, no escribirse);
  firma en dos pasos: primero quien recibe, sola y con pad grande; después quien
  entrega. La firma ya hecha se muestra con "Volver a firmar".
- **Plantillas por cliente:** Configuración → Plantillas → "Clientes" asigna la
  plantilla a clientes o la marca de **uso general** (`AsignarPlantilla.js`). Al
  crear un préstamo solo se ofrecen las del cliente, las de uso general y la
  estándar.
- **Entregas (admin):** las pestañas Activas/Historial se cambian por un tablero
  Por iniciar → En ruta → Completadas (Hoy | Historial). Las que van en ruta
  muestran un camión animado sobre una barra de progreso (estimado 45 min, sin
  GPS). El detalle de una entrega en ruta abre con la vista "Entrega en curso"
  (`components/entregas/EntregaEnCurso.js`): cronómetro, destino con Cómo llegar
  y Llamar, resumen y equipos.
- **Repartidor:** al iniciar una entrega se abre esa vista a pantalla completa;
  la tarjeta en curso muestra el camión y "Abrir entrega en curso".
**SQL:** `plantillas_acta.uso_general` entregado, sin correr (las pantallas de
Préstamos y Configuración lo piden).
**Pendiente:** ver en pantalla el tablero, la vista en curso, la firma en dos
pasos y la asignación de plantillas (Chrome en segundo plano no pintaba).
Duración estimada de 45 min es fija: ajustarla si hace falta.

## 2026-10-15 — Nuevo préstamo: asistente por pasos (rediseño)
**Qué se hizo:** el asistente sale de `OrdenesClient.js` (de ~2.100 a ~1.250
líneas) a `components/prestamos/NuevoPrestamo.js`, rehecho con las opciones que
eligió Sofía de la auditoría (A + C + E + F + H):
- **A** un paso a la vez (Cliente y paciente · Equipos · Entrega · Formatos y
  confirmación) con indicador arriba, barra de botones siempre visible y
  resumen al final con "Editar" por sección; errores junto a cada campo.
- **C** paciente activado por defecto (94% de los préstamos lo tienen): se busca
  por nombre o cédula; "Paciente nuevo" pide lo obligatorio y deja "Datos para
  los formatos" (EPS, barrio, nacimiento, correo, Dx) plegados. "Sin paciente"
  es la excepción. Cliente con buscador y los 3 más usados como atajo.
- **E** un solo buscador de equipos (código, serie, tipo, categoría, cualquier
  atributo) + filtros por categoría y tipo; Enter con un código exacto (o un
  lector de código de barras) lo agrega; carrito fijo en PC y en la barra
  inferior en celular.
- **F** "En oficina / A domicilio" como selector (oficina por defecto, 96% de los
  casos); una sola fecha de entrega; inicio distinto solo para domicilio.
- **H** borrador en localStorage mientras se llena; al volver a "Nuevo
  préstamo" ofrece Retomar o Empezar de cero (lo que ya no esté disponible sale
  del carrito); "Descartar" pide confirmación.
`ControlVigencia` pasó a `components/prestamos/ControlVigencia.js`.
**Por qué así:** cifras de 292 préstamos: 94% con paciente, 4% a domicilio, 24%
con más de un equipo, 3 clientes concentran el 49%.
**Archivos:** `components/prestamos/{NuevoPrestamo,ControlVigencia}.js` (nuevos),
`ordenes/OrdenesClient.js`.
**Verificado:** ESLint con `no-undef` sin errores en todo lo tocado hoy (encontró
`nombreEquipo` y `equiposParaMini` borrados por error; corregidos). La página
compila y el servidor la entrega completa. **Pendiente:** recorrerlo en
pantalla (Chrome estaba en segundo plano y no pintaba) y crear un préstamo real
con él. Ojo: el proyecto no tiene `no-undef` activo en ESLint.

## 2026-10-15 — Detalles en ventana ancha en lugar de panel lateral
**Qué se hizo:** los paneles laterales derechos de ~480–520px (detalle de
Entrega, hoja de vida en Inventario, detalle de Mantenimiento y detalle de
equipo en el portal del cliente) pasan a una ventana centrada de hasta 1080px
(960 en el portal) con el contenido en dos columnas desde `lg`. En celular
siguen siendo la hoja que sube desde abajo. Componente nuevo
`components/ui/VentanaDetalle.js` (marco + `Columnas`; cierra con ESC).
**Por qué:** pedido de Sofía: en PC amontonaban la información en un tercio de
la pantalla. Préstamos y Clientes no se tocaron: ya usan vista dividida ancha.
**Archivos:** `components/ui/VentanaDetalle.js` (nuevo), `entregas/EntregasClient.js`,
`inventario/InventarioClient.js`, `mantenimientos/MantenimientosClient.js`,
`cliente/PortalClienteClient.js`.
**Verificado:** Entregas en Chrome a 1987px: ventana de 1080px centrada, dos
columnas. **Pendiente:** ver en pantalla Inventario, Mantenimientos (el rol de
prueba no tenía acceso) y el portal del cliente.

## 2026-10-15 — Actas por cliente, fase 2: formatos por préstamo y firma única
**Qué se hizo:** al crear un préstamo se eligen sus formatos (vienen marcados los
del cliente o el estándar; el pagaré es un **anexo opcional**, nunca sugerido) y
se capturan tipo de documento, barrio, EPS y fecha de nacimiento del paciente y
el diagnóstico. Nuevo paso único de firma `components/actas/FirmaActas.js`:
datos de quien recibe (o "recibe el mismo paciente"), datos del paciente que
piden los formatos (se guardan en el paciente), insumos con lote/INVIMA, quien
entrega, revisión de cada formato lleno y firmas de quien recibe y quien
entrega. Guarda una fila de `actas` por formato con copia de bloques y datos
(`lib/actas/firmar.js`). Se usa en Entregas (reemplaza el wizard viejo), en la
vista del repartidor y al crear un préstamo en oficina (si se cancela, queda
"Firmar acta" en el detalle). `ActasPrestamo` lista y descarga las actas en PDF
(`lib/actas/pdf.js`, html2canvas por página) en el detalle de Préstamos y
Entregas; las entregas anteriores siguen descargando el acta vieja.
**Por qué así:** decisión de Sofía: siempre se pregunta qué formatos lleva el
préstamo; el pagaré va como anexo del préstamo, no como documento de entrega.
En entregas, completar la entrega corre antes de guardar las actas: si falla,
no queda nada a medias.
**Archivos:** `src/lib/actas/{firmar,pdf}.js`, `src/components/actas/{FirmaActas,ActasPrestamo}.js`,
`ordenes/page.js`, `ordenes/OrdenesClient.js`, `entregas/EntregasClient.js`,
`entregas/EntregasRepartidorClient.js`, `configuracion/*`.
**SQL:** corrido el 2026-10-15: `plantillas_acta.tipo` ('entrega' | 'anexo',
pagaré → anexo) y `ordenes_servicio.plantillas_acta uuid[]`.
**Verificado con datos reales (desechables, restaurados):** sugerencias por
cliente (Family 3, Solidaridad la suya, otro cliente la estándar, pagaré nunca);
sobre ORD-2026-162 con un equipo de prueba: `cargarParaFirma` trae los formatos
elegidos en orden, el equipo y el diagnóstico; `guardarActas` guardó 4 actas y
se reconstruyeron (datos y firma en el renglón del responsable) y renderizaron
(8 páginas). Se usó una orden existente para no consumir un número ORD.
**Pendiente:** probar en pantalla con sesión: el asistente (formatos, campos
nuevos), el modal `FirmaActas` en Entregas, repartidor y oficina, y el botón de
PDF (html2canvas en navegador; no se pudo correr fuera de él). Sofía lo probó en
pantalla y quedó bien.
**Ajustes (mismo día):** quien entrega es el usuario con sesión: cargo, tipo y
número de documento se editan en Configuración → Usuarios (`/api/usuarios`
acepta los campos) y en la firma salen ya llenos; si faltan se piden una vez y
quedan en su perfil. Auditoría responsive en Chrome a 390×844: la revisión de
formatos dejaba la hoja a ~45% ilegible → botón "Ampliar" en `VistaActa` (y se
mide antes de pintar para no mostrar la hoja gigante un instante); indicador de
pasos en su propia línea; fila de insumo reordenada (cantidad con etiqueta).
Sin desbordes horizontales en Configuración, detalle del préstamo, firma ni
asistente. Visto también: en celular el detalle de un préstamo queda apretado
bajo los filtros (ya era así; va a la auditoría del diseño de préstamos).
**SQL:** `usuarios.tipo_documento` entregado, sin correr; sin él la firma no
autocompleta a quien entrega.
A futuro (pedido de Sofía): enviar
la constancia por correo al cliente y a Ingemedic en cada entrega, y que el
cliente consulte sus actas desde el portal.

## 2026-10-15 — Actas por cliente, fase 1: motor y plantillas
**Qué se hizo:** motor de actas por bloques (`src/lib/actas/`): `render.js`
convierte bloques (encabezado, título, texto con `{{variables}}`, campos en
líneas o tabla, tabla de equipos/insumos, firmas, espacio, pie, salto de página)
en HTML por página; `contexto.js` arma las variables desde orden, paciente,
equipos y lo capturado en la entrega (`VARIABLES` las documenta). Se cargaron 7
plantillas transcritas de los formatos reales (`plantillas-base.js`): estándar
Ingemedic (contrato + entrega + capacitación), pagaré y carta (aparte, sin
cliente), Solidaridad FT-AD-60-02, ASMEDC AMD-FT-019, y Family: comodato FOMAG
(5 págs), acta general y F-FAM-11. Asignadas a SOLIDARIDAD, ASMEDC y FAMILY
HOMECARE SAS. Configuración → Plantillas ahora lista las actas con vista previa
(datos de ejemplo, `VistaActa`); se quitó la lista vieja de `plantillas_orden`.
**Por qué así:** decisión de Sofía: réplica del formato de cada cliente, acta
para todo préstamo, editor por bloques (fase 3). Las actas firmadas guardarán
copia de los bloques (`actas.bloques`) para que editar una plantilla no cambie
lo ya firmado.
**Archivos:** `src/lib/actas/{render,contexto,plantillas-base,ejemplo}.js`,
`src/components/actas/VistaActa.js`, `configuracion/page.js`,
`configuracion/ConfiguracionClient.js`.
**SQL:** corrido el 2026-10-15: `plantillas_acta`, `cliente_plantillas_acta`,
`actas` (con `autenticados_todo`), campos nuevos en `pacientes` (tipo_documento,
barrio, fecha_nacimiento, eps), `ordenes_servicio.diagnostico`, `usuarios`
(cargo, cedula). Plantillas cargadas por script con service_role. Logos de
ASMEDC y Solidaridad subidos a `logos/clientes/`.
**Verificado:** las 7 plantillas renderizadas con puppeteer y comparadas con los
originales; todas caben en A4. No se abrió la pantalla de Configuración con
sesión ni se corrió `next build`.
**Corrección (mismo día):** a pedido de Sofía, todas las plantillas quedaron
palabra por palabra como los originales, con sus errores de ortografía (p. ej.
"deñirse", "PERNONA", "documeto", "RECECIBE", "FAMLIAR", "responsalidad"). Los
textos de Ingemedic se generan desde las celdas del Excel (las rayas pasan a
variables) y se comprobó por script que coinciden con el original. Se quitaron
agregados propios (código de préstamo y NIT en el encabezado estándar, firma de
"Entrega" en ASMEDC) y se borró `docs/COMODATO.pdf` (datos reales de una
paciente). Única licencia: el año del comodato sale de la fecha de entrega
(`{{anio}}`), no "2026" fijo. Las 7 filas de `plantillas_acta` se actualizaron
con esta versión y se comprobó que coinciden con el código; capturas con logos,
todas dentro de A4.
**Decisión para la fase 2 (Sofía):** al crear un préstamo siempre se pregunta qué
formatos se le asignan. Las plantillas del cliente (o la estándar) llegan
marcadas como sugerencia, pero la persona elige. El pagaré queda sin asignar
hasta que Sofía lo revise.
**Pendiente:** logos de Family, fiduprevisora y FOMAG (el original es un
escaneo; van como recuadro hasta subirlos en el editor). El acta de "entrega de
insumo" de Family (una hoja por insumo) no se replicó: los insumos van en
ACCESORIOS y en el F-FAM-11. Fases 2 (captura y
firma), 3 (editor) y 4 (retirar `plantillas_orden`/`orden_plantillas` y
`/api/documentos`). `docs/COMODATO.pdf` tiene datos reales de una paciente: no
subirlo al repositorio.

## 2026-10-15 — Eliminar equipos: libera el código y cierra los préstamos
**Qué se hizo:** el inventario no tenía cómo eliminar una unidad, y eliminar un
tipo o una categoría en Configuración solo los ocultaba (`activo = false`): sus
equipos seguían vivos, ocupando el código (no se podía reutilizar RL1720), en
"últimos agregados" y hasta en préstamos en curso (ORD-2026-162 y 163 con
equipos de "Marca Pruebas"). Ahora `equipos` tiene `activo`, `fecha_eliminacion`
y `motivo_eliminacion`; `traerTodosLosEquipos` solo trae vivos, así que el
equipo eliminado sale de todas las listas y del consecutivo. `eliminarEquipos()`
(en `lib/equipos.js`) cierra sus préstamos en curso (devuelto hoy con el
motivo; la orden que queda sin equipos pasa a Finalizada, o a Cancelada si no
se había entregado) y no deja eliminar con un mantenimiento abierto. Botón
Eliminar en la ficha y en Configuración (tipo/categoría arrastran sus
unidades), con `ModalEliminarEquipos`: lista los préstamos afectados, pide
motivo y no habilita el botón hasta 5 s (3 s sin préstamos).
También: "Editar ficha" cambiaba el código de la tabla (`atributos`) pero no la
columna `codigo` que valida el sistema — 5 equipos quedaron con dos códigos
distintos. Ahora el código se edita en un solo campo, se valida contra los
vivos y se copia a las claves de atributos (`atributosConCodigo`). El motivo de
la edición, que se pedía y se descartaba, ya queda en la bitácora.
**Por qué así:** la fila no se borra porque préstamos, entregas y
mantenimientos la referencian y sus actas deben seguir mostrando el código. El
UNIQUE pasa a ser parcial (`WHERE activo`) para que el código se libere.
"Baja" sigue siendo para equipos reales que salen de servicio y conservan su
código; Eliminar es para registros de prueba o errores.
**Archivos:** `src/lib/equipos.js`, `src/components/inventario/ModalEliminarEquipos.js`
(nuevo), `inventario/InventarioClient.js`, `configuracion/ConfiguracionClient.js`,
`api/cargue/route.js`, `api/exportar/inventario/route.js`, `lib/bitacora-texto.js`.
**SQL:** corrido el 2026-10-15: columnas + índice parcial
`equipos_codigo_vivo_unico` (va ANTES del deploy: sin la columna `activo` todas
las listas de equipos fallan) y limpieza de los 6 equipos de "Marca Pruebas"
(ORD-2026-162 y 163 quedaron Finalizadas). Respaldo en
`bkp_eliminacion_20261015_*` — borrarlo cuando se confirme.
**Verificado con datos reales (desechables, restaurados):** RL1720 libre y
sugerido como siguiente; el aviso lista el préstamo; sin motivo no elimina;
eliminar uno de dos equipos deja la orden Entregada, el segundo la Finaliza;
en orden Programada la Cancela; el código eliminado se puede reusar y la BD
rechaza duplicar uno vivo (23505, sin importar mayúsculas/espacios). Se usaron
ORD-162/163 (de prueba) para no quemar un número ORD: las órdenes nuevas toman
consecutivo con huecos, al parecer de una secuencia.
**Pendiente:** el bloqueo por mantenimiento abierto no se probó (no había
ninguno abierto). Las pantallas (modal con cuenta regresiva, Editar ficha,
Configuración) no se abrieron con sesión.
**Dato corregido:** EQ-0005 (Cama Hospitalaria "Nacional", en préstamo) tenía
`codigo` EQ-0005 pero la tabla mostraba RL1718; por pedido de Sofía queda
RL1718 (encaja entre RL1717 y RL1719), con registro en la bitácora. Su campo
`serie` también dice RL1718, lo que parece error de captura: sin confirmar.

## 2026-10-05 — Bitácora: la columna Detalle en frases legibles
**Qué se hizo:** el módulo Bitácora mostraba el `detalle` (jsonb) tal cual, con
uuids y claves de código. Ahora `describirBitacora()` arma una frase por
registro ("Creó un préstamo de 5 equipos para FOMAG, sin domicilio", "Ocultó
«Listas de mantenimiento» para el rol Administrador"). También se usa en la
búsqueda y en el CSV. Se agregó la etiqueta CANCELACIÓN, que faltaba.
**Por qué así:** solo cambia cómo se lee; lo que se guarda en `bitacora` queda
igual, así que aplica también a los registros viejos y no hubo SQL. Una acción
nueva que no tenga caso propio cae en la frase genérica ("Editó el cliente X").
**Archivos:** `src/lib/bitacora-texto.js` (nuevo), `bitacora/page.js` (trae
los nombres de clientes), `bitacora/BitacoraClient.js`.
**Verificado:** corrido sobre los 546 registros reales: ninguno deja uuids,
`null` ni `undefined` a la vista. No se abrió la pantalla con sesión.

## 2026-10-04 — Sitio público: contenido de borde a borde y crédito de Sodet
**Qué se hizo:** los contenedores de las páginas públicas (home, portafolio,
quiénes somos, contacto, header y footer) pasan de `max-w-[1180px]` /
`max-w-7xl` a `max-w-[1920px]` con `px-5 md:px-10 2xl:px-16`. En la home, el
título y el texto del hero crecen en `2xl` y se corrigieron los divisores de
la franja de cifras (solo salía uno). En el header, insignia "by Sodet" con el
ícono (`public/images/sodet-icono.png`) que enlaza a sodet.vercel.app; se
oculta entre `lg` y `xl` porque no cabe junto al menú y los dos botones.
**Por qué:** pedido de Sofía: en pantallas grandes el contenido se veía con
márgenes exagerados. El tope de 1920px evita que se estire sin límite en
monitores ultraanchos. Las páginas legales siguen angostas (820px) a
propósito: es texto de lectura. Por debajo de `md` no cambia nada.
**Archivos:** `LandingPage.js`, `portafolio/page.js`, `quienes-somos/page.js`,
`contacto/page.js`, `Header.js`, `Footer.js`.
**Pendiente:** revisado con capturas a 1920, 1366 y 1100 px. En celular no se
pudo capturar bien (el navegador sin ventana no baja de ~500px de ancho); las
clases para móvil no cambiaron, pero falta mirarlo en un teléfono real.

## 2026-10-04 — Página web: actualización en tiempo real
**Qué se hizo:** `/sitio-web` se suscribe a los INSERT de `eventos_sitio` y
refresca solo (mismo patrón del Dashboard: `router.refresh()` con debounce).
Indicador "En vivo" en la barra superior.
**Por qué:** Realtime respeta RLS, y la tabla no tenía ninguna política, así
que el navegador no habría recibido nada. Se agrega una política de solo
lectura para SuperAdmin; los datos se siguen consultando con service_role. El
indicador refleja la conexión al canal, no que la política esté bien: sin el
SQL dice "En vivo" pero no llega ningún evento.
**Archivos:** `src/app/(portal)/(dashboard)/sitio-web/SitioWebClient.js`,
`page.js` y `src/lib/interes-web.js` (comentarios).
**SQL:** corrido el 2026-10-04 (lo confirmó Sofía; no se vio el resultado de
la verificación): política `superadmin_lee_eventos_sitio` y `eventos_sitio` en
la publicación `supabase_realtime`. Comprobado después que anon sigue sin leer
ni insertar.
**Pendiente:** probar con un clic real que el módulo se actualiza sin
recargar. No se probó: requiere sesión de SuperAdmin.

## 2026-10-04 — Política de datos: versión recortada
**Qué se hizo:** se quitaron de `/politica-de-datos` los nombres de proveedores
(Vercel, Supabase, Google, WhatsApp), el párrafo de menores, las menciones a
datos de salud y varios supuestos sin base (EPS/IPS, tecnovigilancia, borrado
de mensajes del formulario).
**Por qué:** pedido de Sofía: no aplicaban a Ingemedic y exponían las
herramientas. Se conservan la fecha de vigencia (la exige el Decreto 1377 de
2013, art. 13) y los datos de quien usa o recibe el equipo: la tabla
`pacientes` guarda nombre, cédula, dirección y teléfono, sin nada médico.
**Archivos:** `src/app/politica-de-datos/page.js`, `src/app/contacto/page.js`.

## 2026-10-04 — Sitio público: conteo de clics en WhatsApp y envíos del formulario
**Qué se hizo:** los 7 enlaces a WhatsApp del sitio registran `whatsapp_clic`
(con `origen` = cuál botón, `pagina` y, en las tarjetas del portafolio, el
equipo en `detalle`); el formulario de `/contacto` registra `contacto_enviado`
(con el servicio) cuando el servidor acepta el mensaje. Se guardan en la tabla
nueva `eventos_sitio` vía `/api/evento` (pública, service_role, lista cerrada
de orígenes) y se ven en el módulo nuevo **Página web** (`/sitio-web`), solo
para SuperAdmin: cifras de 7 y 30 días, actividad por día y desgloses por
botón, página, equipo y servicio.
**Por qué:** primero se hizo con eventos de Vercel Analytics, pero el plan de
la cuenta no los incluye. Son métricas de negocio, no de operación: por eso van
en un módulo aparte y no en el dashboard. El módulo NO está en la tabla
`permisos` ni en `MODULOS_RUTA`: lo restringen `sitio-web/page.js` (redirige a
`/dashboard` si no es SuperAdmin) y el Sidebar (`soloSuperAdmin`). La tabla
tiene RLS encendido y ninguna política: solo se lee con service_role, después
de confirmar el rol. No se guarda IP ni dato alguno de la persona.
**Archivos:** `src/lib/analitica.js`, `src/lib/interes-web.js`,
`src/app/api/evento/route.js`, `src/app/(portal)/(dashboard)/sitio-web/**`,
`src/components/layout/Sidebar.js`, `src/lib/sitio.js` (`sitio-web` en
RUTAS_PORTAL), `Header.js`, `Footer.js`, `LandingPage.js`, `contacto/page.js`,
`portafolio/page.js`.
**SQL:** corrido el 2026-10-04: tabla `eventos_sitio`, RLS encendido, sin
políticas (`rowsecurity = true` confirmado).
**Verificado en local con 2 eventos desechables (borrados después):** entran
por `/api/evento`, quedan en la tabla y `resumenInteresWeb` los cuenta en
cifras, desgloses y serie del día; anon lee 0 filas y no puede insertar
(42501); orígenes inventados → 400; `/sitio-web` sin sesión → `/login`.
**Pendiente:** abrir `/sitio-web` con SuperAdmin y con otro rol (no se abrió
con sesión) y confirmar un clic real desde producción. Un origen de botón
nuevo hay que sumarlo en `/api/evento` y en `NOMBRE_ORIGEN`.

## 2026-10-04 — Sitio público: páginas legales y autorización de datos
**Qué se hizo:** páginas `/politica-de-datos` (Ley 1581 de 2012) y `/terminos`,
enlazadas desde el footer y sumadas al sitemap. El formulario de `/contacto`
ahora exige una casilla de autorización (también validada en `/api/contacto`,
que responde 400 sin ella) y ya no invita a escribir "detalles del paciente".
**Por qué:** el sitio recogía datos personales sin política ni autorización, y
el placeholder del mensaje pedía datos de salud (dato sensible).
**Archivos:** `src/app/politica-de-datos/page.js`, `src/app/terminos/page.js`,
`src/components/PaginaLegal.js`, `src/components/Footer.js`,
`src/app/contacto/page.js`, `src/app/api/contacto/route.js`, `src/lib/sitio.js`
(`EMPRESA.nit`, `EMPRESA.correoDatos`, `LEGAL_VIGENCIA`),
`scripts/google-apps-script/contacto.gs`.
**Pendiente:**
- `EMPRESA.nit` está vacío: mientras tanto el NIT no se muestra en ningún lado.
- Confirmar el correo para reclamos de datos (hoy `ingemedicsas@hotmail.com`).
- Los textos legales son un borrador base: falta revisión de un abogado.
- Volver a desplegar el Apps Script ("Nueva versión") para que el correo
  muestre la fila "Autorización de datos". Sin eso el formulario funciona igual.
- `DESTINO` del Apps Script es `sodetteam2024@gmail.com`, no un correo de
  Ingemedic: los mensajes de clientes llegan a SODET. Definir si se cambia.
- No se probó un envío real completo (habría mandado un correo); solo el
  rechazo sin autorización y que las páginas cargan.
- `/api/contacto` sigue escribiendo el mensaje completo en los logs de Vercel
  cuando Google falla. Está declarado en la política; evaluar si se recorta.

## 2026-10-03 — Préstamos: cambiar un equipo por otro
**Qué se hizo:** en el detalle del préstamo, cada equipo activo tiene "Cambiar
equipo": modal que abre en las unidades Disponibles del mismo tipo y deja
navegar ("Otros tipos" → "Otras categorías", como el wizard) para elegir de otro
tipo; el buscador fuera del nivel de unidades busca en todo. Antes se devolvía
y se prestaba de nuevo. De paso, `globals.css` devuelve `cursor: pointer` a los
botones (Tailwind 4 lo quitó y ningún botón del sistema mostraba la manito).
**Por qué así:** sin SQL. Antes de la entrega (Borrador/Programada/En reparto)
se reemplaza `equipo_id` en la misma fila de `orden_equipos` (el equipo nunca
salió; el acta sale con el nuevo, que queda Reservado). Ya entregado, se
conserva el historial: la fila vieja se cierra como devuelta con
"Cambiado por <código> — motivo" y entra una fila nueva En préstamo. Lógica en
`cambiarEquipo()` de `lib/prestamos.js`. En el drawer, "único equipo" ahora
cuenta solo los no devueltos (si no, un cambio volvía múltiple un préstamo de
uno). `finalizarEntrega` ya no pasa a En préstamo equipos devueltos de la orden
(bug latente también con "Marcar como devuelto" antes de la entrega).
**Archivos:** `lib/prestamos.js`, `components/prestamos/ModalCambioEquipo.js`,
`ordenes/OrdenesClient.js`, `ordenes/page.js`, `lib/entregas.js`,
`entregas/page.js`, `entregas/EntregasClient.js`.
**Verificado con datos desechables (cliente + 3 equipos + 2 órdenes, borrados):**
cambio en orden Entregada (2 filas, nota, viejo Disponible, nuevo En préstamo,
orden sigue Entregada), en Programada (misma fila, viejo Disponible, nuevo
Reservado) y rechazo si el nuevo ya no está disponible.
**Pendiente:** probar el modal en el navegador (escritorio y móvil). En los
paneles de Cliente/Paciente no se agregó el botón: solo en Préstamos.

## 2026-10-01 — Bloqueo temporal del portal de clientes
**Qué se hizo:** interruptor Activo/Bloqueado en Configuración → Portal de
clientes (grupo Acceso), visible y editable solo por SuperAdmin
(`/api/configuracion/portal-clientes`, PUT exige SuperAdmin; GET público solo
dice si está activo). Bloqueado: el cliente ve "Módulo bloqueado
temporalmente" (`cliente/PortalBloqueado.js`), el login lo avisa en "Soy
cliente" y desactiva Ingresar, y en Clientes → Acceso al portal no se
puede crear, cambiar ni quitar accesos (la API responde 423).
**Por qué así:** sin SQL. Se guarda como permiso del rol "Cliente" ya
existente: fila `permisos` con `modulo = 'portal_clientes'`; sin fila o
`puede_ver = true` → activo. La página del cliente lo lee con service_role
porque RLS no le deja leer `permisos`. Lógica en `lib/portalClientes.js`.
**Archivos:** `lib/portalClientes.js`, `api/configuracion/portal-clientes`,
`api/clientes/acceso/route.js`, `cliente/page.js`, `cliente/PortalBloqueado.js`,
`login/page.js`, `components/clientes/AccesoPortal.js`, `ConfiguracionClient.js`.
Login: siempre abre en Personal (se quitó el recuerdo de la última pestaña en
localStorage, que lo hacía abrir en "Soy cliente"; `?cliente=1` solo abre esa
pestaña si el portal está activo). Con el portal bloqueado, "Soy cliente" se
puede pulsar pero muestra "Módulo bloqueado temporalmente" en lugar del
formulario (vuelve a consultar el estado al pulsarla). Si una cuenta de cliente
entra por Personal se le cierra la sesión (scope local) con el aviso.
**Verificado con cuentas desechables (SuperAdmin + cliente de CUIDARTE,
borradas):** bloquear desde la pantalla → fila puede_ver=false; el cliente
ve la pantalla de bloqueo; login avisa con botón desactivado; Clientes muestra
el aviso sin botones; PUT de contraseña → 423; al reactivar el cliente vuelve
a ver sus equipos. Se dejó el interruptor como estaba (sin fila = activo).
**Pendiente:** el portal sigue ACTIVO (verificado 2026-10-01: no hay fila
`portal_clientes` en `permisos`). Para bloquearlo, un SuperAdmin debe ponerlo
en Bloqueado desde Configuración → Portal de clientes. Falta probar el login
nuevo con el bloqueo puesto.

## 2026-09-30 — Mantenimientos sin preventivo/correctivo
**Qué se hizo:** se quitó el tipo de mantenimiento de toda la interfaz: botones
del formulario, filtros, tarjeta "Correctivos", insignias y borde rojo en
tabla/tarjetas, color del panel de detalle, acta PDF, portal de clientes y
texto del tour. Los nuevos se guardan con `tipo_mantenimiento_id = null`.
**Por qué:** en la práctica no había diferencia entre uno y otro.
**Archivos:** `MantenimientosClient.js`, `mantenimientos/page.js`,
`lib/mantenimientos.js`, `cliente/page.js`, `PortalClienteClient.js`,
`hooks/useTour.js`.
**SQL:** corrido el 2026-10-01 (verificado: la columna ya no es obligatoria):
`ALTER TABLE mantenimientos ALTER COLUMN tipo_mantenimiento_id DROP NOT NULL`.
**Pendiente:** los registros viejos conservan su tipo en la BD (no se borró
la tabla `tipos_mantenimiento`). La variable `mant_tipo` de las plantillas de
documentos (`/api/documentos`) queda vacía para los nuevos.

## 2026-09-30 — Mantenimientos: tabla con datos de la unidad y selección múltiple
**Qué se hizo:** la tabla principal muestra lo mismo que Inventario → unidades:
código de inventario, equipo + categoría, serie/modelo, paciente (con
dirección) o cliente, además de tipo, estado, fechas; en pantallas muy anchas
también técnico y en qué estado quedó el equipo. La búsqueda principal
encuentra por código de inventario, serie, modelo, paciente y cliente. El
formulario "Nuevo mantenimiento" usa el diseño del modal "Nueva unidad" y un
selector (`components/mantenimientos/SelectorEquipos.js`) con mini-inventario
categorías → tipos → unidades como el wizard de Préstamos, selección múltiple,
"marcar todos", chips por estado del equipo, filtros por columna de la unidad
y búsqueda global por código/serie/modelo/equipo/paciente. Se abre un
mantenimiento por equipo (códigos consecutivos); si falla el cambio de estado
de los equipos se deshace todo. Las consultas compartidas quedaron en
`lib/mantenimientos.js` (`SELECT_MANTENIMIENTO`, `SELECT_EQUIPO_MANT`).
**Archivos:** `mantenimientos/page.js`, `MantenimientosClient.js`,
`components/mantenimientos/SelectorEquipos.js` (nuevo), `lib/mantenimientos.js`.
**Verificado en el navegador con una cuenta SuperAdmin desechable (borrada,
con su bitácora):** buscar FAM370 por serie y EQ500 por código, marcarlos,
"Abrir 2 mantenimientos" → MAN-2026-003/004 En proceso y ambos equipos En
mantenimiento en la BD; luego se borraron y los equipos volvieron a
Disponible. Capturas a 390 y 1440 sin scroll horizontal.
**Nota:** el rol Administrador no tiene permiso de ver Mantenimientos,
Servicios ni Bitácora (tabla `permisos`); confirmar que es intencional.

## 2026-09-29 — Mantenimientos: el estado del equipo ya no miente
**Qué se hizo:** revisión del módulo. Se puede abrir mantenimiento a un equipo
prestado (decisión de Sofía, opción B): conserva cliente/paciente y al cerrar
vuelve al estado de su préstamo (orden Programada/En reparto → Reservado;
Entregada → En préstamo; sin préstamo → Disponible), no a "Disponible". No se
puede dar de baja un equipo que sigue prestado. Devolver, finalizar o
cancelar un préstamo y completar una entrega ya no sacan de "En mantenimiento"
a un equipo con mantenimiento abierto. El wizard de préstamos vuelve a
verificar que los equipos sigan "Disponible" antes de crear la orden. En
Inventario → Editar/Nueva unidad ya no se eligen a mano En préstamo,
Reservado ni En mantenimiento. Abrir/cerrar revisan el error al cambiar el
estado del equipo y deshacen si falla. El código MAN sale del mayor del año,
no del conteo. Se guarda `resultado` del cierre y el acta PDF lo usa (antes
un equipo dado de baja salía "OPERATIVO — DISPONIBLE").
**Bug no obvio:** `select('*, actividades:actividades_mantenimiento(...)')` —
el alias de la relación pisaba la columna de texto `actividades` (resumen del
cierre): al recargar desaparecía del panel y nunca salía en el acta. Ahora se
trae también como `actividades_texto:actividades`.
Portal de clientes responsive: pestañas repartidas en celular (la tercera
quedaba cortada), tarjetas que se salían por nombres largos, mantenimientos
en tarjetas hasta `lg` (la tabla era ilegible a 768), inputs de 16px en
celular (iOS hacía zoom), etiqueta de estado del equipo si no es "En préstamo".
**Archivos:** `src/lib/mantenimientos.js` (nuevo), `src/lib/prestamos.js`,
`src/lib/entregas.js`, `mantenimientos/page.js`, `MantenimientosClient.js`,
`OrdenesClient.js`, `InventarioClient.js`, `cliente/PortalClienteClient.js`.
**SQL:** corrido: columna `mantenimientos.resultado` (el UNIQUE de `codigo` ya
existía). Además se apagó el cron diario (jobid 1) y se borró la función
`finalizar_ordenes_vencidas`: pasaba a "Finalizada" toda orden con vigencia
vencida (incluso Canceladas y Programadas), sin devolver ni liberar los
equipos, y hacía desaparecer el aviso de vencido del Panel de Atención antes
de que alguien lo viera. No había hecho daño: ninguna orden tenía vigencia.
Los vencidos ahora solo se manejan desde el Panel de Atención.
**Verificado con datos reales (desechables, restaurados):** equipo prestado →
al cerrar vuelve a En préstamo; libre → Disponible; "devolver" un equipo con
mantenimiento abierto lo deja En mantenimiento y al otro Disponible; alias del
resumen funciona. Portal con capturas a 360/768/1280 sin scroll horizontal.
**Pendiente:** probar en pantalla con sesión del personal: abrir/cerrar un
mantenimiento de un equipo prestado. (De los 6 "Finalizada sin devolución"
del pendiente #8: 4 son datos de prueba de JUAN PRUEBAS y 2 de FOMAG con
RL1550, ya Disponible; ninguno lo causó el cron.)

## 2026-09-29 — Portal de clientes + rediseño del login
**Qué se hizo:** el login tiene pestañas "Personal / Soy cliente" (recuerda la
última; `?cliente=1` la preselecciona), foco visible, `htmlFor`, ojo de 40×40
con `aria-label`, error con `role="alert"` que se borra al escribir, spinner,
aviso de Bloq Mayús, `min-h-[100dvh]`, logo dentro de la tarjeta, foto con
mensaje y enlace a www. Nuevo `/cliente` (layout propio, sin sidebar): equipos
que el cliente tiene hoy, pacientes asignados y mantenimientos de esos
equipos. En Clientes → panel del cliente, sección "Acceso al portal": crear
cuenta (correo + contraseña generada para entregar), cambiar contraseña,
quitar acceso, vía `/api/clientes/acceso` (service_role, módulo clientes).
Middleware: busca al personal por id y luego email sin mayúsculas; si no es
personal, busca `clientes.auth_user_id` → solo `/cliente`; si no es ninguno,
cierra la sesión (antes pasaba sin restricción).
**Por qué así:** la cuenta del cliente es de Supabase Auth pero NO está en
`usuarios`. RLS: políticas RESTRICTIVE `TO authenticated` en todas las tablas
con RLS, que exigen `es_personal()` (o `mi_cliente_id()` para leer lo suyo en
clientes/equipos/pacientes/mantenimientos). Se suman con AND a
`autenticados_todo`, así que el personal no nota nada y anon no cambia.
**Archivos:** `src/app/(portal)/(auth)/login/page.js`,
`src/app/(portal)/(cliente)/**`, `src/components/layout/ClienteHeader.js`,
`src/components/clientes/AccesoPortal.js`, `src/app/api/clientes/acceso/route.js`,
`src/app/(portal)/(dashboard)/clientes/ClientesClient.js`, `src/middleware.js`,
`src/lib/sitio.js` (`cliente` en RUTAS_PORTAL).
**SQL:** corrido el 2026-09-29: columna `clientes.auth_user_id`, funciones
`es_personal()` / `mi_cliente_id()`, políticas restrictivas. Segunda parte:
6 tablas tenían RLS APAGADO (`mantenimientos`, `actividades_mantenimiento`,
`adjuntos_actividad_mantenimiento`, `listas_mantenimiento`,
`actividades_lista_mantenimiento`, `orden_plantillas`) — se abrían a
cualquiera. Se les puso `autenticados_todo` + restricción y se encendió RLS.
Ya no queda ninguna tabla de `public` con RLS apagado.
**Verificado con cuenta desechable enlazada a CUIDARTE (borrada después):**
ve 1 de 10 clientes, sus 117 equipos, 29 de 200 pacientes, 0 en usuarios,
órdenes, entregas, bitácora, permisos, roles; con dos mantenimientos de
prueba ve solo el de su equipo; update/insert bloqueados; anon no lee ni
escribe mantenimientos/listas. Las 7 cuentas de Auth están en `usuarios`.
La entrada/salida de clientes no va a bitácora (`usuario_id` es FK a usuarios).
Flujo de la app con esa cuenta: `/cliente` muestra solo lo suyo; `/dashboard`,
`/inventario`, `/clientes`, `/configuracion`, `/bitacora` → `/cliente`; APIs
internas → 403. **Verificado por Sofía en local (2026-09-29):** dar acceso
desde Clientes, entrar como cliente y quitar el acceso funcionan.
**Pendiente:** confirmar con sesión real del personal que Mantenimientos y
Configuración → Listas cargan en producción (RLS recién encendido ahí).
Revisar en Supabase Auth que el registro público (signups) esté apagado.
(Arreglado después: el middleware ahora también revisa `/sin-acceso`, y un
cliente que la abre va a `/cliente`. Verificado con cuenta desechable.)

## 2026-09-29 — Exportar inventario: hoja adicional con el escalón de abajo
**Qué se hizo:** el Excel trae la hoja del nivel en pantalla y además la del
nivel inferior. Categorías: resumen + hoja nueva de todos los tipos + todas
las unidades. Dentro de una categoría: tipos + hoja nueva con todas sus
unidades (columna Tipo, autofiltro). Dentro de un tipo: sin cambios.
**Archivos:** `src/app/api/exportar/inventario/route.js`.
**Pendiente:** verificado con datos reales generando los Excel (15/15
categorías cuadran tipos vs. unidades), pero no desde el botón con sesión.

## 2026-09-29 — Panel en portal.ingemedic.com.co con rutas limpias
**Qué se hizo:** `src/app/admin/` pasó a `src/app/(portal)/`: el panel queda en
`/login`, `/dashboard`, `/inventario`… sin `/admin`. El middleware ahora corre
en todo (menos `/api`, estáticos y archivos con extensión) y separa por
dominio: en `portal.` la raíz lleva al login (o al dashboard con sesión) y las
páginas públicas redirigen a www; en www las rutas del panel redirigen al
portal. `/admin/...` viejo redirige a la ruta nueva. Localhost y
`*.vercel.app` muestran todo. Solo las rutas del panel consultan Supabase: la
landing sigue estática. `/servicios` → `/portafolio` quedó solo para el
dominio www (en el portal es el módulo Servicios prestados).
**Por qué:** separar el sitio público del sistema interno sin partir el repo.
**Archivos:** `src/middleware.js`, `src/lib/sitio.js` (`PORTAL_URL`,
`RUTAS_PORTAL`), `next.config.mjs`, `src/lib/permisos.js`, `Header.js`,
`Sidebar.js`, `RepartidorHeader.js`, `BannerAtencion.js`, `BuzonNovedades.js`,
`PanelAtencion.js`, `useTour.js` y las páginas del panel con enlaces fijos.
**Pendiente:**
- Dominio y DNS: ya estaban (verificado 2026-09-29: `portal.` resuelve a
  Vercel, mismo proyecto, Production, sin redirección a nivel de Vercel —
  debe seguir así o anularía el middleware).
- Supabase Auth → URL Configuration: agregar `https://portal.ingemedic.com.co`
  a Redirect URLs.
- Probado sin sesión (curl simulando cada dominio) y con `npm run build`. Falta
  probar con sesión real: login → dashboard, navegar módulos, permisos por rol,
  logout, cierre por 8 h.
- Las sesiones abiertas en www no pasan al portal (cookies por dominio): todos
  tendrán que iniciar sesión otra vez. Avisar al equipo y a los repartidores.

## 2026-09-27 — Sitio público en Poppins (estilo SODET) y crédito a SODET
**Qué se hizo:** todo el sitio público (landing, quienes-somos, portafolio,
contacto, Header y Footer) pasa de Archivo + Inter / Geist a Poppins (300/400/500/600), con la jerarquía de pesos de sodet.vercel.app:
títulos en 500 con tracking negativo, cuerpo en 400, textos introductorios en
300 y botones/enlaces/etiquetas en 500. Nada por encima de 600 (solo
el nombre del footer y detalles diminutos como los ✓ y el "24h"). Se agregó
"Desarrollado por SODET" con enlace a sodet.vercel.app en el Footer público,
el login y el sidebar del admin.
**Por qué:** unificar el aspecto con el otro proyecto de SODET.
**Archivos:** `src/app/layout.js`, `src/app/globals.css`, `src/app/LandingPage.js`,
`src/components/Header.js`, `src/components/Footer.js`,
`src/components/layout/Sidebar.js`, `src/app/admin/(auth)/login/page.js`,
`src/app/quienes-somos/page.js`, `src/app/portafolio/page.js`, `src/app/contacto/page.js`.
**Pendiente:** el crédito del sidebar no se vio
con sesión real, y en móvil del admin el sidebar no aparece (solo se ve en el
login). La copia `LandingPage.js` de la raíz es vieja y no se usa.

## 2026-09-26 — SEO del sitio público
**Qué se hizo:**
- **Dominio:** todo apunta a `https://www.ingemedic.com.co` (el real; sin
  www redirige 308). Fuente única: `src/lib/sitio.js` (URL, teléfonos,
  dirección, horario, INVIMA, páginas del sitemap).
- **Título, descripción y canonical propios** por página
  (`metadatosPagina()`). Las páginas `'use client'` los declaran en un
  `layout.js` de su carpeta. No se pone canonical en el layout raíz: lo
  heredarían todas y dirían que son la home.
- **Imagen para compartir** `app/opengraph-image.jpg` (1200×630, 98 KB:
  WhatsApp no muestra la vista previa grande si pasa de ~300 KB). Se generó
  una vez con `next/og` + sharp: logo, texto y foto de la planta.
- **Sitemap** con las 4 páginas; **robots** bloquea `/api/`; **`/admin`
  lleva `noindex`** (`app/admin/layout.js`). /admin no se bloquea en
  robots.txt a propósito: si Google no puede entrar, no ve el noindex.
- **Datos para Google (JSON-LD):** `MedicalBusiness` con teléfonos,
  correo, dirección, horario y área (Valledupar/Cesar) + `WebSite` +
  `FAQPage`. Las FAQ se movieron a `components/landing/faqs.js` para
  que las lean la landing y page.js (servidor).
- **Home estática:** antes consultaba `configuracion_empresa` con el
  cliente de servidor (cookies) y era dinámica: sin caché, ~3,4 s. Ahora
  `/` sale ○ en el build. Imágenes de la landing con `next/image` (foto del
  carrusel: 947 KB → 50 KB WebP en celular) y la primera precargada.
- **Duplicados:** `/catalogo` y `/servicios` redirigen (308) a
  `/portafolio` (`next.config.mjs`); se borraron sus páginas alias.
- "región del **C**esar" en Quiénes somos; palabras clave sin contenido
  real (camas hospitalarias) fuera.
**Archivos:** `lib/sitio.js`, `app/layout.js`, `app/page.js`,
`app/LandingPage.js`, `app/sitemap.js`, `app/robots.js`,
`app/admin/layout.js`, `app/{portafolio,quienes-somos,contacto}/layout.js`,
`app/opengraph-image.{jpg,alt.txt}`, `components/landing/faqs.js`,
`components/Header.js`, `next.config.mjs`, `quienes-somos/page.js`
**Verificado:** en localhost, títulos/canonical/og por página, admin
`noindex, nofollow`, sitemap (4), robots, redirecciones 308, JSON-LD
parsea (3 tipos, 6 preguntas). `next build` en una copia aislada (para no
romper el dev): compila, `/` estática.
**Verificado en producción (2026-09-26, tras el deploy de `fe8dd53`):**
los 4 títulos y canonical con www, `/admin/login` `noindex, nofollow`,
og:image absoluta con www (98 KB), sitemap (4), robots, `/catalogo`,
`/servicios` y el dominio sin www → 308 a www, JSON-LD con los 3 tipos,
home `X-Vercel-Cache: HIT` en 0,4–0,5 s (antes MISS, 3,4 s), foto del
carrusel 50 KB WebP.
**Nota:** el commit `97ac9d5` quedó solo con el borrado de las páginas
alias (un `git add` falló por una ruta ya borrada); el resto está en
`fe8dd53`.
**Pendiente:**
- Fuera del código: Perfil de Empresa en Google, verificar Search Console
  y enviar el sitemap, redes sociales en `sameAs` (page.js) si existen.
- Si cambian teléfono/dirección/horario, editar `lib/sitio.js` (la
  landing ya NO lee `configuracion_empresa`). Ninguna página pública la
  lee ya: la lectura anónima de esa tabla se podría quitar (sin SQL aún).
- Validar en producción con Rich Results Test y el depurador de Facebook.
- Las otras páginas (portafolio, quiénes somos, contacto) aún usan `<img>`
  y el estilo viejo.

## 2026-09-26 — Formulario de contacto: ahora sí envía (Google Apps Script)
**Qué se hizo:** antes `/contacto` mostraba "¡Mensaje recibido!" sin enviar
nada: todas las solicitudes se perdían. Ahora el formulario hace POST a
`/api/contacto` (ruta pública a propósito), que valida (obligatorios,
teléfono ≥ 7 dígitos, correo, largos máximos), descarta bots con un campo
trampa (`sitio_web`) y reenvía a un Google Apps Script que manda el correo a
sodetteam2024@gmail.com (con "Responder" al correo del cliente y link de
WhatsApp). El script tarda 2–8 s, así que la ruta responde apenas valida
y el envío sigue en segundo plano con `after()`. Si Google falla, el
cliente ya vio "recibido": el error y los datos quedan en los logs de
Vercel ("[contacto] Apps Script falló"). Si la ruta rechaza o no hay red,
se ofrece mandar lo escrito por WhatsApp.
**Por qué por /api y no directo al script:** la URL del script queda solo en
el servidor, y se valida antes de gastar la cuota de Gmail (~100/día).
**Archivos:** `contacto/page.js`, `api/contacto/route.js`,
`scripts/google-apps-script/contacto.gs` (se pega en script.google.com; los
pasos de despliegue están en el encabezado del archivo)
**Verificado (2026-09-26):** script desplegado por Sofía (cuenta
sodetteam2024), URL en `.env.local`. Directo al script: `{"ok":true}` en
1,5 s. Por `/api/contacto` en localhost: válido → 200 en 0,7 s; sin
mensaje, teléfono corto, correo malo y no-JSON → 400 con su mensaje; bot
(campo trampa) → 200 sin enviar.
Sofía confirmó que los correos de prueba llegaron.
En producción (2026-09-26): `CONTACTO_SCRIPT_URL` ya está en Vercel (la
ruta valida en vez de responder 503).
**Pendiente:** un envío real desde ingemedic.com.co/contacto (no se hizo
para no mandar otro correo de prueba). Sin límite de envíos por IP: si
llega spam, agregarlo.

## 2026-09-26 — Editar paciente desde el módulo Clientes
**Qué se hizo:** botón "Editar" en el pie del panel de detalle del paciente
(igual que el de cliente). Reutiliza el modal de "Nuevo paciente" en modo
edición: mismos campos y validaciones; la cédula duplicada excluye al propio
paciente. El panel ahora muestra también el correo. Se registra en bitácora
(`accion: 'editar'`, `entidad: 'paciente'`). Si el update afecta 0 filas
(PGRST116: RLS o paciente borrado) se muestra un mensaje claro.
**Archivos:** `clientes/ClientesClient.js`
**Verificado con datos reales (service_role):** paciente desechable → update
conservando su cédula ✓, update con cédula ajena → 23505
`pacientes_cedula_unica` ✓, id inexistente → PGRST116 ✓. Borrado; conteo
quedó en 174.
**Verificado por Sofía con sesión real en producción (2026-09-26):**
editar un paciente y guardar funciona.

## 2026-09-25 — Login robusto
**Qué se hizo:** `login/page.js` — todo el flujo en try/catch (antes una
caída de red dejaba "Verificando..." para siempre); mensajes distintos para
conexión, demasiados intentos (429), cuenta sin confirmar y desactivada;
error del RPC = conexión (no "contraseña incorrecta"); email del RPC con
trim/lowercase; localStorage/sessionStorage en try (modo privado ya no
impide entrar); se espera la bitácora (máx 1,5 s) antes de redirigir; evita
doble envío. Los campos se leen del DOM al enviar (por id, SIN `name`): en
un celular lento se podía escribir antes de hidratar y el estado quedaba
vacío; con `name`, un envío pre-hidratación ponía los datos en la URL.
**Verificado:** datos de `usuarios` vs `auth` consistentes (7/7 mismo id y
email, 0 usernames repetidos). Prueba real en localhost con usuario
desechable (borrado con su bitácora): usuario con mayúsculas/espacios ✓,
correo en mayúsculas ✓, contraseña mala ✓, usuario inexistente ✓ (mismo
mensaje), sin internet ✓, desactivado ✓; 2 logins en bitácora ✓.
**Archivos:** `src/app/admin/(auth)/login/page.js`

## 2026-09-25 — Consecutivo de código en inventario + Actividad reciente
**Qué se hizo:**
- **Nueva unidad:** el campo de código viene lleno con la sugerencia
  (editable). Botón "Ver últimos registrados" (oculto por defecto) con los
  últimos 5 en pestañas "Esta categoría" / "Todo el inventario". Se
  avisa/bloquea si el código ya existe.
- **Módulo Inventario:** botón "Actividad reciente" a la derecha de Exportar
  Excel (en las 3 vistas). Al abrirlo: en lg+ una columna derecha crece con
  transición (0 → 324px) y las tarjetas (grid auto-fill) se reacomodan solas;
  en celular/tablet se despliega hacia abajo arriba de la vista. Verificado
  con capturas reales de /admin/inventario (usuario de prueba, borrado).
  Muestra los 5 últimos registrados; el primero con info completa (código,
  estado, equipo, marca, categoría, serie, fecha y hora). Se calcula de los
  equipos que ya carga la página.
**Regla de la sugerencia (definida por Sofía):** último código AGREGADO en
todo el inventario + 1, sin importar sus letras, conservando guion y ceros.
Ej.: RL140 y luego EQ34 → EQ35. Si ya existe, salta al siguiente libre.
Códigos compuestos (RL409/FAM356) no sirven de base. Hoy: EQ500 → EQ501.
Se probaron antes y se descartaron: "mayor RL + 1" y "por categoría".
- Duplicados se comparan por número: RL528 = RL0528, CON-0001 = CON-1.
- Equipos reales que salen de servicio van a "Baja", no se borran.
**Archivos:** `src/lib/equipos.js`, `inventario/InventarioClient.js`
**Pendiente:** datos de prueba (EQ500, RL1720 en "Pruebas", TEST-RL10962,
EQ-0005) se dejan a pedido. SQL opcional de índice único por código
(ofrecido, sin correr).

## 2026-09-25 — Rediseño completo de la vista del repartidor
**Qué se hizo:** layout propio (barra blanca + navegación inferior en
celular / pestañas arriba en md+), "Mis entregas" con saludo y resumen del
día, agrupadas En camino / Atrasadas / Hoy / Mañana / Próximas, fecha
visible, botones Llamar (`tel:`) y Cómo llegar (Google Maps), códigos de
equipo, nota de la orden, confirmación antes de iniciar, completar en 2
pasos (datos → firma grande). "Mi perfil" rediseñado (identidad, nombre,
contraseña con validación en vivo, cerrar sesión con confirmación).
Responsive: 1/2/3 columnas; el modal de completar es hoja inferior en
celular y ventana centrada en md+. Login: logo visible en celular.
**Bugs arreglados (no obvios):**
- **Fondo negro:** `globals.css` traía el bloque de la plantilla de Next
  `@media (prefers-color-scheme: dark)` → fondo `#0a0a0a` en celulares con
  modo oscuro. Admin no lo notaba (pinta su fondo); repartidor y su perfil
  sí. Se quitó y se declaró `color-scheme: only light` (CSS + viewport).
- **Firma vacía aceptada:** `FirmaPad` reportaba firma al salir el mouse o
  con un toque sin trazo. Ahora solo si hubo trazo. Además el canvas se
  pinta blanco (antes PNG transparente → negro en WhatsApp/galería/PDF).
  Afecta también la vista de admin (mejora).
- **Paciente perdido al iniciar:** `SELECT_ENTREGA` (lib/entregas.js) no
  traía `paciente`, así que la tarjeta "En camino" mostraba la dirección
  del cliente en vez de la casa del paciente.
**Archivos:** `globals.css`, `app/layout.js`, `(dashboard)/layout.js`,
`RepartidorHeader.js`, `EntregasRepartidorClient.js`, `entregas/page.js`,
`repartidor-preferencias/*`, `FirmaPad.js`, `lib/entregas.js`, `login/page.js`
**Pendiente:** probar con un usuario Repartidor real en celular (no tengo
credenciales): iniciar → completar con firma, Llamar, Cómo llegar, perfil.
Firmas guardadas antes de hoy siguen siendo PNG transparentes.

## 2026-09-25 — Login: usuarios desactivados, límite de 8h y mensajes
**Qué se hizo:**
- Desactivar un usuario ahora también lo bloquea en Supabase Auth
  (`ban_duration`, en `/api/usuarios` PUT); reactivar lo desbloquea. Nadie
  puede desactivarse a sí mismo. El middleware además saca con
  `?inactivo=1` a quien tenga `usuarios.activo = false` con sesión abierta.
- Límite de 8h calculado con `user.last_sign_in_at` (verificado por Auth,
  no cambia al refrescar el token) en vez de la cookie `sesion_inicio`,
  que se podía borrar para reiniciar el conteo. Al cerrar sesión por
  límite/inactivo, las cookies vaciadas por `signOut()` se copian al
  redirect (antes se perdían).
- Login: mismo mensaje si el usuario no existe o la contraseña está mal
  (antes permitía averiguar qué usernames existen); trim/lowercase del
  correo; se quitó el fallback a la tabla `usuarios` (ya no servía tras
  el RLS); `autoComplete`/`autoCapitalize` en los campos.
**Por qué:** "desactivar" era solo una marca: el usuario seguía entrando y
usando todo (RLS deja todo a `authenticated`).
**Archivos:** `src/middleware.js`, `src/app/admin/(auth)/login/page.js`,
`src/app/api/usuarios/route.js`
**Verificado con usuario de Auth desechable:** ban → login da
`user_banned` (con contraseña buena o mala) y el refresh de una sesión
abierta también falla; unban → vuelve a entrar. `last_sign_in_at` viene en
`getUser()`. Usuario borrado al final.
**Nota:** al desplegar, quien haya iniciado sesión hace más de 8h será
enviado al login una vez. Un usuario desactivado que escriba mal la
contraseña igual ve "desactivado" (Supabase responde `user_banned` antes
de validar la contraseña).
**Pendiente:** en Supabase → Authentication → Settings: subir el mínimo
de contraseña (la pantalla de usuarios exige 6) y activar la protección de
contraseñas filtradas si el plan la incluye.

## 2026-09-25 — Las rutas /api/* no validaban sesión
**Qué se hizo:** `src/lib/api-auth.js` → `verificarSesion({ modulos })`:
exige sesión (401), usuario activo (403) y los mismos permisos de módulo
que el middleware (`puedeVerModulo`; SuperAdmin inmune). Aplicado en las 6
rutas: `usuarios` (configuracion + configuracion.usuarios),
`exportar/clientes` (clientes), `exportar/inventario` (inventario),
`cargue` y `cargue/plantilla` (configuracion + configuracion.cargue),
`documentos` (solo sesión; hoy nadie la llama).
Además, en `/api/usuarios` solo un SuperAdmin puede asignar el rol
SuperAdmin o editar/desactivar a un SuperAdmin; el select de rol en
Configuración → Usuarios oculta SuperAdmin a quien no lo es.
**Por qué:** el middleware tiene `matcher: ['/admin/:path*']`, así que
`/api/*` no tenía ninguna protección, y todas usan service_role (se saltan
RLS). Confirmado antes del arreglo: sin sesión se descargaba el Excel con
los 168 pacientes. `/api/usuarios` permitía crear un SuperAdmin sin sesión.
Un Administrador podía asignarse SuperAdmin desde la pantalla.
**Archivos:** `src/lib/api-auth.js`, las 6 `src/app/api/**/route.js`,
`configuracion/ConfiguracionClient.js`
**Verificado:** sin sesión, las 7 llamadas (6 rutas, POST y PUT de
usuarios) responden 401.
**Pendiente:** probar con sesión real: exportar clientes e inventario,
descargar plantilla y hacer un cargue, crear/editar/desactivar usuario
como Administrador y como SuperAdmin.

## 2026-09-25 — Cerrar acceso anónimo: RLS en 20 tablas
**Qué se hizo:** el login por username ahora usa la RPC
`email_por_username` (SECURITY DEFINER) con fallback a la query directa si
la función aún no existe (error PGRST202). SQL entregado para: crear la
función, política `autenticados_todo` (FOR ALL TO authenticated) + ENABLE
RLS en las 20 tablas que anon podía leer/escribir, lectura anónima solo de
`configuracion_empresa` (la landing la usa sin sesión), y quitar la
política "Permitir buscar email por username".
**Por qué así:** las tablas ya tenían políticas pero RLS apagado. Encender
RLS tal cual rompía: `bitacora` y `entregas` solo tenían SELECT (sin
INSERT/UPDATE) y excluían a SuperAdmin; `orden_equipos` y
`plantillas_orden` no tenían ninguna. Se replicó lo que hoy puede hacer un
usuario logueado — nadie con sesión nota el cambio. Las políticas viejas
(`solo_admin_bitacora`, `repartidor_sus_entregas`) quedan pero no
restringen nada, porque las políticas permisivas se suman con OR.
**Archivos:** `src/app/admin/(auth)/login/page.js`
**SQL:** corrido el 2026-09-25 (después del deploy 4801116). Re-sondeo
con anon: de 36 tablas solo se leen `configuracion_empresa`, `municipios`
y `departamentos` (estas dos ya tenían lectura pública; son datos DANE y no
se pueden escribir). Escritura anon bloqueada (update en clientes: 0 filas;
insert en roles: 42501). `usuarios` visibles sin sesión: 0. La RPC devuelve
el email correcto (sin importar mayúsculas), vacío si no existe, y no
permite listar con `%`.
**Nota:** `configuracion_empresa.tel` está vacío en la BD — por eso la
landing no muestra teléfono (no es por RLS).
**Verificado por Sofía con sesión real (2026-09-25):** login por username
y por email, módulos cargan con datos, crear/cancelar préstamo, crear
paciente, repartidor ve sus entregas. Todo funciona.

## 2026-09-25 — Auditoría de integridad y seguridad (solo lectura)
**Qué se hizo:** sondeo de duplicados, consistencia entre tablas y acceso
anónimo. Script en el scratchpad de la sesión (no quedó en el repo).
**Hallazgos:**
- **CRÍTICO — acceso anónimo.** Con la anon key (pública, va en el JS del
  navegador) se LEEN 20 tablas sin sesión: `clientes`, `usuarios` (emails),
  `ordenes_servicio`, `orden_equipos`, `equipos`, `entregas`, `bitacora`,
  `configuracion_empresa`, `plantillas_orden`, catálogos. Y se puede
  ESCRIBIR: confirmado en `clientes` (update con el mismo valor, sin cambio
  real). `pacientes` y `mantenimientos` sí están bloqueadas.
- 12 series de equipo repetidas (ej. MZJ5S174551 en RL703/RL687/RL088;
  CTX14B5J108 en un BMC y un CPAP). Requiere revisión física.
- LR-002 en dos préstamos "Entregada" a la vez (ORD-2026-137 y -163);
  ORD-2026-131..142 parecen datos de prueba de agosto.
- 6 préstamos "Finalizada" con equipos sin fecha de devolución
  (ORD-2026-002, -021, -134, -135, -136, -161).
- Paciente duplicado: ESNEIDER DAVID CORRALES CORZO (uno sin cédula,
  con ORD-2026-084).
- Tipos casi duplicados por escritura: ENMIND/Enmind, Pulmo Med/Pulmo-Med,
  "Cilindro 3.5 M3"/"cilindro 3.5m3".
- `tipos_equipo_bkp_20260921` y `tmp_tipos_objetivo` siguen en public.
**Sin problemas:** códigos de equipo/préstamo/entrega, emails, NIT de
clientes, estados de equipo vs préstamos abiertos, entregas vs préstamo.
**Pendiente:** todo lo de arriba. Lo de seguridad primero.

## 2026-09-25 — Cédula de paciente única
**Qué se hizo:** `src/lib/pacientes.js` con la validación compartida
(`buscarCedulaDuplicada`, normaliza a solo dígitos). La usan el modal
Nuevo paciente y el wizard de Nuevo préstamo (al avanzar el paso 1 y al
guardar; al editar un paciente existente se excluye a sí mismo). Mensaje:
"Cédula ya registrada en el sistema (Nombre)". Si la BD rechaza igual
(error 23505 del índice), se muestra el mismo mensaje en español. El campo
cédula del wizard ahora solo acepta dígitos.
**Archivos:** `src/lib/pacientes.js`, `ClientesClient.js`, `OrdenesClient.js`
**SQL:** índice único `pacientes_cedula_unica` sobre
`regexp_replace(cedula, '[^0-9]', '', 'g')`, parcial (excluye NULL/vacía).
**Ya corrido y verificado (2026-09-25)** con registros desechables:
rechaza cédula repetida y con puntos, permite varios sin cédula, rechaza
editar con cédula ajena, permite conservar la propia. El error real
(23505 "pacientes_cedula_unica") lo reconoce `esErrorCedulaDuplicada`.
Todo borrado; conteo quedó en 168.

## 2026-09-25 — Crear paciente desde el módulo Clientes
**Qué se hizo:** botón "Nuevo paciente" en la franja de filtros de la
pestaña Pacientes (y el FAB móvil ahora crea cliente o paciente según la
pestaña). Modal propio con los mismos campos y validaciones que el wizard
de Nuevo préstamo (nombre y dirección obligatorios). La vía del wizard
sigue igual. Extra respecto al wizard: rechaza una cédula que ya exista.
**Por qué:** antes un paciente solo se podía crear dentro de un préstamo.
**Archivos:** `src/app/admin/(dashboard)/clientes/ClientesClient.js`
**Verificado con datos reales (2026-09-25):** se insertó un paciente de
prueba con el mismo payload, `activo` queda `true` por defecto, aparece en
la pestaña Pacientes, en el buscador del wizard y en el export; FKs
`ordenes_servicio.paciente_id` y `equipos.paciente_actual_id` existen. Se
borró; conteo volvió a 168. La BD **no** tiene UNIQUE en `pacientes.cedula`
(hoy 0 repetidas, 78 sin cédula): solo el formulario de Clientes lo evita.
**Pendiente:** el insert se probó con service_role, no con sesión de
usuario. La política de INSERT para `authenticated` se asume bien porque el
wizard ya inserta en `pacientes` desde el navegador. `creado_por` queda
`null` (igual que en el wizard).

## 2026-09-25 — Buzón de notificaciones rediseñado; se quitó publicar novedades desde la app
**Qué se hizo:** el buzón (`BuzonNovedades`) ahora tiene pestañas Todas /
Alertas / Novedades, marca de "nuevo" por ítem, "Ver más" en novedades
largas y hoja inferior en móvil. Se quitó el botón "+ Novedad" del
SuperAdmin junto con su modal: era el **único** lugar de la app para
publicar en `novedades_sistema`.
**Por qué:** pedido explícito de quitar el botón.
**Archivos:** `src/components/layout/BuzonNovedades.js`
**Pendiente:** publicar una novedad ahora solo se puede con un INSERT
directo en `novedades_sistema` (asunto, descripcion, creado_por). Si se
vuelve a necesitar desde la app, el formulario está en el historial de git.

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
