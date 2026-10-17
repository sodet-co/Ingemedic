# Guía de diseño del panel

Cómo debe verse cada módulo. Las clases viven en `src/lib/ui.js` y los
componentes en `src/components/ui/`. Antes de escribir un botón, un campo o una
ventana a mano, usar lo que ya existe.

## Estructura de un módulo

```
<EncabezadoModulo titulo subtitulo ayuda="clave" acciones={…} />   ← h-14 md:h-16, px-4 md:px-7
<div className="flex-1 overflow-y-auto p-3 md:p-6 pb-20 md:pb-6">  ← contenido
```

- **Encabezado** (`EncabezadoModulo`): título 18px, subtítulo 12px. A la derecha,
  en este orden: acciones del módulo → ayuda (?) → novedades. En celular va sin
  fondo; en PC, franja blanca con borde.
- **Acción principal** ("Nuevo préstamo", "Nueva unidad"…): en el encabezado
  (`ui.btnPrimario`, `hidden md:inline-flex`) y, en celular, botón flotante rojo
  abajo a la derecha. **Exportar** también va en el encabezado (`ui.btnSecundario`).
- **Ayuda**: cada módulo tiene su entrada en `src/lib/ayuda.js` (resumen, tareas
  paso a paso, estados). Es la versión corta del manual; cuando haya video, se
  pone su enlace en `video`.
- **Contenido**: `p-3 md:p-6`. Abajo, `pb-20` en celular (deja ver el último
  elemento por encima del botón flotante). El espacio de la barra de navegación
  móvil ya lo reserva el layout (`--mobile-nav-space`): **no** sumar `pb-28`.
- **Módulos de tabla** (Clientes, Préstamos): filtros y tabla dentro de una
  sola tarjeta blanca. **Tableros y cuadrículas** (Dashboard, Entregas,
  Inventario): sin tarjeta exterior.
- **Configuración**: menú de secciones como tarjeta de 224px a la izquierda,
  separada del menú principal por el padding del contenido (en celular, un
  selector). Cada sección empieza con `h2` `ui.tituloBloque` + subtítulo 13px.

## Ventanas

| Para | Componente | Notas |
|---|---|---|
| Formularios y avisos | `Modal` | Encabezado / cuerpo con scroll / pie con botones a la derecha (Cancelar, luego la acción). Tamaños sm 420 · md 560 · lg 760 · xl 960. |
| Detalle de un registro | `VentanaDetalle` + `EncabezadoDetalle` | Ancha en PC, hoja desde abajo en celular. Encabezado siempre blanco con ícono o inicial. |
| Confirmar algo | `ConfirmDialog` | `tipo="peligro"` para borrar, desactivar o salir sin guardar. |
| Actas | `PreviaActas` | Una hoja a la vez, flechas e índice lateral. |

Capas: página < detalle (z-50) < ventana abierta desde un detalle (z-[60]) <
devolución / cambio de equipo (z-[75]) < avisos (toast, z-[80]).

## Controles

- Campos: `ui.input` + `ui.label`. Alto ~40px, radio 9px, foco rojo. En celular
  la letra sube a 16px sola (regla en `globals.css`: evita el zoom de iPhone).
- Buscadores: ícono a la izquierda (`left-3`, 13px), `pl-9`, alto 38px.
- Botones: `ui.btnPrimario` (rojo, acción principal), `ui.btnAzul` (acción
  secundaria fuerte: descargar, actualizar), `ui.btnSecundario` (Cancelar,
  Exportar), `ui.btnPeligro`, `ui.btnIcono`. Alto 38px, radio 9px, texto 13px.
- Chips de filtro: `ui.chip` + `ui.chipActivo` / `ui.chipInactivo`.
- Rótulo de sección (INFORMACIÓN GENERAL…): 10.5px, mayúsculas, `tracking-[0.1em]`, slate-400.
- Encabezado de tabla: `ui.th`.

## Color

| Uso | Color |
|---|---|
| Acción principal, activo, error | rojo `#D81B43` (hover `#B0172F`) |
| Marca, acción secundaria | azul `#1B3A6B` (hover `#152D54`) |
| Disponible / hecho | verde `#0F7B55` |
| En uso / en préstamo | cian `#2EB5D4` / `#0E86A0` |
| Espera / atención | ámbar `#F59E0B` / `#B45309` |
| Cerrado / inactivo | slate |

Estados como clases (`TONOS` en `ui.js`), no en `style={{}}`: así el modo oscuro
los ajusta. Los que siguen en `style` los corrige `tema-oscuro.css` por atributo.
Nada de rojos o azules nuevos: el menú usaba `#E53935` y se unificó.
