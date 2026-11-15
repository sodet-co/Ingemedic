# Ingemedic de Colombia — Plataforma de gestión de equipos biomédicos

> Caso de proyecto desarrollado por **SODET**

**Cliente:** Ingemedic de Colombia S.A.S. — alquiler y préstamo de equipos biomédicos (oxígeno medicinal, concentradores, CPAP y más) a EPS, IPS, instituciones y pacientes en casa.
**Tipo de proyecto:** plataforma web a la medida (sitio público + panel de operación + portal de clientes).
**Sitio:** [www.ingemedic.com.co](https://www.ingemedic.com.co)

---

## Versiones cortas (para tarjetas y encabezados)

**Una línea:**
Sistema a la medida que digitaliza toda la operación de Ingemedic: inventario, préstamos, entregas a domicilio con firma digital, actas en PDF y portal para sus clientes.

**Párrafo:**
Ingemedic manejaba más de 1.600 equipos biomédicos, sus préstamos a pacientes y las actas de entrega en hojas de cálculo y papel. En SODET construimos una plataforma que reúne todo en un solo lugar: la oficina crea el préstamo en minutos, el repartidor lo entrega desde el celular y recoge la firma del paciente con el dedo, y el acta en PDF queda lista al instante, con el formato propio de cada cliente. Además, la empresa tiene un sitio web nuevo, optimizado para buscadores, y un portal donde sus clientes consultan sus equipos.

---

## El reto

- Más de **1.600 equipos** con código, serie y estado que se llevaban a mano.
- Cada cliente (EPS, IPS, instituciones) exige **sus propios formatos de acta**, que se llenaban en Word o Excel y se imprimían para firmar.
- Entregas, recogidas, recargas de oxígeno y cambios de equipo a domicilio, sin trazabilidad de quién hizo qué ni cuándo.
- Préstamos vencidos y recargas pendientes que se descubrían tarde.
- Un sitio web que no generaba contactos ni medía el interés.

## La solución

Una plataforma con tres caras sobre una sola base de datos:

1. **Sitio web público** para atraer clientes.
2. **Panel de operación** para la oficina, el repartidor y la administración.
3. **Portal de clientes**, donde cada cliente ve solo lo suyo.

---

## Funcionalidades

### Inventario de equipos
- Organización por **categorías → tipos → unidades**, cada una con su imagen, datos y columnas propias.
- **Hoja de vida de cada equipo**: estado, a quién está prestado y línea de tiempo completa (préstamos, recargas, cambios, mantenimientos y actas).
- Código de inventario con **consecutivo sugerido** y aviso si ya existe.
- Estados que cambian solos según la operación (Disponible, Reservado, En préstamo, Por recargar, En mantenimiento, Baja): nadie los cambia a mano y no se desincronizan.
- Búsqueda por código, serie o modelo y filtros generales.
- **Exportación a Excel** y hoja de vida descargable en PDF.
- **Cargue masivo** de equipos y clientes desde CSV.

### Préstamos
- **Asistente por pasos** (cliente y paciente → equipos → entrega → formatos → confirmación) que guarda un borrador si se interrumpe.
- Entrega **en oficina** (sale de inmediato) o **a domicilio** (con repartidor, fecha y hora).
- **Vigencia** del préstamo con aviso antes de vencer y opción de extenderla.
- **Recargas periódicas**: se define cada cuántos días y el sistema calcula la próxima.
- Acciones sobre un préstamo activo: **recoger, recargar y cambiar equipos**, cada una con su acta, en oficina o programada a domicilio.
- Detalle por pestañas: resumen, equipos, actas e **historial completo** de todo lo que le pasó al préstamo y quién lo hizo.
- Búsqueda por paciente, cédula, cliente, NIT, código o serial.
- Al recoger todos los equipos, el préstamo se cierra solo.

### Actas y documentos con firma digital
- **Motor de plantillas propio**: cada cliente tiene sus formatos por acción (entrega, devolución, recarga, cambio de equipo) y, si no tiene uno, se usa el de Ingemedic.
- **Importación desde Word**: se escriben los datos entre corchetes (`[Nombre del paciente]`, `[Equipos]`, `[Firma de quien recibe]`) y el sistema los convierte en campos.
- **Editor visual** con bloques (títulos, textos, campos, tablas de equipos, imágenes, firmas), vista previa en vivo, deshacer, y firma fija que se arrastra y cambia de tamaño sobre la hoja.
- **Llenado mirando la hoja**: los campos a un lado y el documento al otro; al tocar uno se resalta el otro. Los datos del paciente se autocompletan y se guardan para la próxima vez.
- **Firma con el dedo** en el celular, del paciente o familiar y del funcionario.
- **PDF al instante**, idéntico a la vista previa, descargable junto o por separado; logo de la empresa y del cliente.
- **Actas renovables**: se reemiten con nueva fecha conservando la firma.
- Cada acta firmada guarda su propia copia: editar la plantilla después no altera documentos ya firmados.

### Entregas y app del repartidor
- **Tablero de entregas** en tres columnas: por iniciar, en ruta (con tiempo transcurrido) y completadas, con filtros por repartidor, fecha y cliente.
- Vista **móvil para el repartidor**: visitas agrupadas en atrasadas, hoy, mañana y próximas; botones para llamar y abrir el mapa.
- Flujo guiado en la visita: iniciar (con cronómetro) → datos de quien recibe → revisión de formatos → firmas → listo.
- Al firmar, el sistema **aplica todo automáticamente**: préstamo entregado, equipos recogidos disponibles, cambio hecho o recarga registrada.
- Mapa de ubicaciones con Leaflet.

### Clientes y pacientes
- Clientes (EPS, IPS, instituciones) y pacientes con cédula única.
- **Hoja de vida del cliente**: equipos que tiene hoy, línea de tiempo en lenguaje natural ("Se prestó Cilindro de Oxígeno a…") e historial por equipo.
- **Informe del cliente** descargable en PDF o Excel.
- Recoger, recargar o cambiar directamente desde el cliente o el paciente.
- Logo por cliente que sale en listados, informes y actas.

### Mantenimientos
- Apertura de mantenimientos para uno o varios equipos a la vez, con selector tipo mini-inventario.
- Listas de actividades configurables y acta de mantenimiento en PDF.
- El equipo vuelve al estado correcto al cerrar (sigue prestado si lo estaba).

### Dashboard y alertas
- Resumen de equipos por estado, clientes con más equipos y distribución por municipio.
- **"Esto requiere tu atención"**: préstamos vencidos o por vencer y recargas pendientes, con acciones directas (recoger, extender, programar recarga, posponer).
- Actividad reciente y buzón de novedades del sistema.

### Portal de clientes
- Acceso propio para cada cliente con usuario y contraseña creados desde el panel.
- Ve sus equipos en préstamo, sus pacientes y los mantenimientos de sus equipos, **y nada más**.

### Seguridad, roles y auditoría
- **Roles y permisos por módulo** (SuperAdmin, Administrador, Operador, Repartidor), configurables desde el panel.
- Seguridad a nivel de base de datos: cada fila está protegida según quién consulta.
- Sesiones con límite de 8 horas y usuarios desactivables.
- **Bitácora de auditoría**: quién hizo qué y cuándo, en frases legibles, con filtros por módulo, acción y fecha.

### Sitio web público
- Landing, quiénes somos, portafolio de equipos y contacto, con diseño responsive.
- **SEO**: títulos y descripciones por página, sitemap, datos estructurados e imagen para compartir en redes.
- Formulario de contacto funcional y botones de WhatsApp.
- **Módulo de analítica propio**: clics en WhatsApp y formularios enviados por botón, página y equipo, en tiempo real, sin guardar datos personales.
- Páginas legales (política de tratamiento de datos y términos) conforme a la ley colombiana.

### Experiencia de uso
- Diseñado **primero para el celular**: navegación inferior en móvil, tablas que se vuelven tarjetas.
- **Modo oscuro** claro/oscuro/automático que sigue al usuario en cualquier dispositivo.
- Ayuda contextual (`?`) en cada módulo, tour guiado y **manual de usuario** en PDF descargable.
- Dos dominios en un solo proyecto: sitio público en `www` y panel en `portal`.

---

## Tecnología

| Capa | Herramientas |
|---|---|
| Frontend | Next.js (App Router), React, Tailwind CSS |
| Backend y base de datos | Supabase (PostgreSQL, Auth, Realtime, Storage, Row Level Security) |
| Documentos | Generación de PDF en servidor (Puppeteer + Chromium), jsPDF, ExcelJS |
| Mapas y gráficos | Leaflet, Recharts |
| Hosting | Vercel (Analytics y Speed Insights) |

---

## Resultados

- **Toda la operación en un solo sistema**: de hojas de cálculo y papel a una plataforma en la nube accesible desde el computador y el celular.
- **Más de 1.600 equipos** con trazabilidad completa, desde que entran al inventario hasta cada préstamo, recarga y mantenimiento.
- **Actas sin papel**: firmadas en el celular y en PDF al instante, con el formato exacto que pide cada cliente.
- **Alertas proactivas** que evitan préstamos vencidos y recargas olvidadas.
- **Clientes autónomos** que consultan sus equipos sin llamar a la oficina.
- **Sitio web medible**, con cada contacto por WhatsApp o formulario contado.

---

## Etiquetas sugeridas

`Desarrollo a la medida` · `Plataforma web` · `Sector salud` · `Gestión de inventario` · `Firma digital` · `Generación de PDF` · `App móvil web` · `Portal de clientes` · `SEO` · `Next.js` · `Supabase`
