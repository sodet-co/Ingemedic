// src/hooks/useTour.js
'use client'
import { useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'

const TOUR_KEY = 'ingemedic_tour_completado'
const TOUR_PASO_KEY = 'ingemedic_tour_paso'

// Definición completa del tour por módulo/ruta
export const PASOS_TOUR = [
  // ── BLOQUE 1: CONFIGURACIÓN ──────────────────────────────
  {
    id: 'bienvenida',
    ruta: '/configuracion',
    elemento: null,
    titulo: '👋 Bienvenido a Ingemedic',
    descripcion: 'Este tour te guiará por todas las funcionalidades del sistema. Puedes pausarlo en cualquier momento y retomarlo desde Configuración → Tour del sistema.',
    posicion: 'center',
  },
  {
    id: 'empresa',
    ruta: '/configuracion',
    elemento: '[data-tour="nav-empresa"]',
    titulo: '🏢 Paso 1: Datos de la empresa',
    descripcion: 'Completa los datos de Ingemedic de Colombia. Esta información aparecerá en todos los documentos y actas generadas.',
    posicion: 'right',
    seccion: 'empresa',
  },
  {
    id: 'categorias',
    ruta: '/configuracion',
    elemento: '[data-tour="nav-categorias"]',
    titulo: '📂 Paso 2: Categorías de equipo',
    descripcion: 'Las categorías agrupan los equipos por tipo (ej. Oxigenoterapia, Ventilación). Cada categoría define qué información se registra para sus equipos.',
    posicion: 'right',
    seccion: 'categorias',
  },
  {
    id: 'tipos',
    ruta: '/configuracion',
    elemento: '[data-tour="nav-tipos"]',
    titulo: '⚙️ Paso 3: Tipos de equipo',
    descripcion: 'Dentro de cada categoría crea los modelos de equipo (ej. Concentrador EverFlo). Cada tipo puede tener una imagen y datos específicos del modelo.',
    posicion: 'right',
    seccion: 'tipos',
  },
  {
    id: 'listas',
    ruta: '/configuracion',
    elemento: '[data-tour="nav-listas"]',
    titulo: '📋 Paso 4: Listas de mantenimiento',
    descripcion: 'Crea listas de actividades para los mantenimientos preventivos. Al abrir un mantenimiento podrás seleccionar una lista y el sistema generará el checklist automáticamente.',
    posicion: 'right',
    seccion: 'listas',
  },
  {
    id: 'usuarios',
    ruta: '/configuracion',
    elemento: '[data-tour="nav-usuarios"]',
    titulo: '👥 Paso 5: Usuarios del sistema',
    descripcion: 'Registra a tu equipo de trabajo: administradores, repartidores y técnicos. Cada repartidor aparecerá disponible para asignar en las órdenes de servicio.',
    posicion: 'right',
    seccion: 'usuarios',
  },

  // ── BLOQUE 2: INVENTARIO ─────────────────────────────────
  {
    id: 'inventario-intro',
    ruta: '/inventario',
    elemento: '[data-tour="inventario-categorias"]',
    titulo: '📦 Bloque 2: Inventario',
    descripcion: 'El inventario está organizado en 3 niveles: Categorías → Tipos → Unidades. Haz clic en una categoría para ver sus tipos de equipo.',
    posicion: 'bottom',
  },
  {
    id: 'nueva-unidad',
    ruta: '/inventario',
    elemento: '[data-tour="btn-nueva-unidad"]',
    titulo: '➕ Registrar un equipo',
    descripcion: 'Desde la vista de unidades de un tipo, usa este botón para registrar cada equipo físico con su serial y código interno. El estado inicial es "Disponible".',
    posicion: 'bottom',
  },

  // ── BLOQUE 3: ÓRDENES ────────────────────────────────────
  {
    id: 'ordenes-intro',
    ruta: '/ordenes',
    elemento: '[data-tour="btn-nueva-orden"]',
    titulo: '📋 Bloque 3: Órdenes de servicio',
    descripcion: 'Una orden de servicio registra un préstamo de equipo a un cliente. Usa este botón para crear una nueva orden con el wizard de 4 pasos.',
    posicion: 'bottom',
  },
  {
    id: 'ordenes-flujo',
    ruta: '/ordenes',
    elemento: '[data-tour="tabla-ordenes"]',
    titulo: '🔄 Flujo de la orden',
    descripcion: 'Una orden pasa por estos estados:\n• Borrador → sin repartidor o fecha\n• Programada → aparece en Entregas\n• En reparto → repartidor la inició\n• Entregada → cliente la recibió\n• Finalizada → equipo devuelto',
    posicion: 'top',
  },

  // ── BLOQUE 4: ENTREGAS ───────────────────────────────────
  {
    id: 'entregas-intro',
    ruta: '/entregas',
    elemento: '[data-tour="entregas-lista"]',
    titulo: '🚚 Bloque 4: Entregas',
    descripcion: 'Aquí aparecen las órdenes programadas listas para salir. El repartidor ve sus asignaciones, inicia la entrega y registra la firma del cliente al entregar.',
    posicion: 'top',
  },
  {
    id: 'entregas-iniciar',
    ruta: '/entregas',
    elemento: '[data-tour="entregas-lista"]',
    titulo: '▶️ Iniciar una entrega',
    descripcion: 'Al hacer clic en "Ver y empezar" se abre un modal con los detalles completos: cliente, equipos y documentos a firmar. Al confirmar, la orden pasa a "En reparto".',
    posicion: 'top',
  },
  {
    id: 'entregas-completar',
    ruta: '/entregas',
    elemento: '[data-tour="entregas-lista"]',
    titulo: '✅ Completar con firma',
    descripcion: 'Al entregar el equipo, el repartidor registra el nombre del receptor y captura la firma a mano alzada en la pantalla. Cada documento puede firmarse por separado.',
    posicion: 'top',
  },

  // ── BLOQUE 5: MANTENIMIENTOS ─────────────────────────────
  {
    id: 'mantenimientos-intro',
    ruta: '/mantenimientos',
    elemento: '[data-tour="btn-nuevo-mantenimiento"]',
    titulo: '🔧 Bloque 5: Mantenimientos',
    descripcion: 'Registra mantenimientos preventivos y correctivos. Al abrir uno, el equipo pasa automáticamente a estado "En mantenimiento" y deja de estar disponible.',
    posicion: 'bottom',
  },
  {
    id: 'mantenimientos-checklist',
    ruta: '/mantenimientos',
    elemento: '[data-tour="tabla-mantenimientos"]',
    titulo: '☑️ Checklist de actividades',
    descripcion: 'Si asignaste una lista al crear el mantenimiento, se genera automáticamente el checklist. Marca cada actividad, agrega observaciones y adjunta fotos.',
    posicion: 'top',
  },
  {
    id: 'mantenimientos-acta',
    ruta: '/mantenimientos',
    elemento: '[data-tour="tabla-mantenimientos"]',
    titulo: '📄 Acta de mantenimiento',
    descripcion: 'Al cerrar el mantenimiento indica si el equipo vuelve a estar disponible o se da de baja. El sistema genera automáticamente el acta en PDF con logo, checklist e imágenes.',
    posicion: 'top',
  },

  // ── FIN ──────────────────────────────────────────────────
  {
    id: 'fin',
    ruta: null,
    elemento: null,
    titulo: '🎉 ¡Tour completado!',
    descripcion: 'Ya conoces todas las funcionalidades del sistema. Puedes relanzar este tour en cualquier momento desde Configuración → Tour del sistema. ¡Éxitos con Ingemedic!',
    posicion: 'center',
  },
]

export function useTour() {
  const router   = useRouter()
  const pathname = usePathname()

  const tourCompletado = () => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(TOUR_KEY) === 'true'
  }

  const getPasoActual = () => {
    if (typeof window === 'undefined') return 0
    return parseInt(localStorage.getItem(TOUR_PASO_KEY) || '0', 10)
  }

  const setPasoActual = (paso) => {
    localStorage.setItem(TOUR_PASO_KEY, String(paso))
  }

  const completarTour = () => {
    localStorage.setItem(TOUR_KEY, 'true')
    localStorage.removeItem(TOUR_PASO_KEY)
  }

  const reiniciarTour = () => {
    localStorage.removeItem(TOUR_KEY)
    localStorage.setItem(TOUR_PASO_KEY, '0')
  }

  return { tourCompletado, getPasoActual, setPasoActual, completarTour, reiniciarTour, PASOS_TOUR }
}