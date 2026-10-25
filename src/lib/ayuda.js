// Ayuda de cada módulo (botón "?" del encabezado): frases cortas pensadas para
// quien usa el sistema, sin detalles internos. Cuando exista el video de un
// módulo, su enlace va en `video` y aparece el botón "Ver video".
export const AYUDA = {
  dashboard: {
    titulo: 'Dashboard',
    resumen: 'Resumen del inventario y de los préstamos.',
    tareas: [
      { titulo: 'Qué muestra', pasos: [
        'Cuántos equipos hay y cuántos están prestados.',
        'Los clientes con más equipos.',
        'En qué municipios están los equipos.',
      ] },
      { titulo: 'Alertas', pasos: [
        'La franja de arriba avisa de préstamos por vencer o vencidos.',
        'Tócala para ir a esos préstamos.',
      ] },
    ],
    video: null,
  },

  entregas: {
    titulo: 'Entregas',
    resumen: 'Entregas, recogidas, recargas y cambios a domicilio.',
    tareas: [
      { titulo: 'El tablero', pasos: [
        'Por iniciar: aún no salen.',
        'En ruta: el repartidor va en camino.',
        'Completadas: entregadas hoy. "Historial" muestra las anteriores.',
      ] },
      { titulo: 'Actas', pasos: [
        'Abre una entrega completada.',
        'Toca "Ver actas" o "Descargar PDF".',
      ] },
    ],
    estados: [
      ['Por iniciar', 'gris', 'Aún no sale'],
      ['En ruta', 'cian', 'En camino'],
      ['Completada', 'verde', 'Entregada y firmada'],
    ],
    video: null,
  },

  repartidor: {
    titulo: 'Mis entregas',
    resumen: 'Tus entregas, recogidas, recargas y cambios del día.',
    tareas: [
      { titulo: 'Hacer una entrega', pasos: [
        'Toca "Iniciar" (dice si es entrega, recogida, recarga o cambio).',
        'Usa "Cómo llegar" o "Llamar" si lo necesitas.',
        'Al llegar, toca "Llegué · Registrar".',
        'Firma quien recibe y después tú.',
      ] },
    ],
    video: null,
  },

  inventario: {
    titulo: 'Inventario',
    resumen: 'Todos los equipos, por categoría y tipo.',
    tareas: [
      { titulo: 'Buscar un equipo', pasos: [
        'Entra a la categoría y al tipo, o busca por código.',
        'Toca el equipo para ver su hoja de vida.',
      ] },
      { titulo: 'Agregar equipos', pasos: [
        'Dentro de un tipo, toca "Nueva unidad".',
      ] },
    ],
    estados: [
      ['Disponible', 'verde', 'Listo para prestar'],
      ['Reservado', 'ambar', 'Apartado para un préstamo'],
      ['En préstamo', 'cian', 'Lo tiene un cliente'],
      ['Por recargar', 'violeta', 'Volvió vacío de una recarga: márcalo recargado'],
    ],
    video: null,
  },

  prestamos: {
    titulo: 'Préstamos',
    resumen: 'Equipos prestados a clientes y pacientes.',
    tareas: [
      { titulo: 'Nuevo préstamo', pasos: [
        'Toca "Nuevo préstamo".',
        'Elige cliente y paciente, los equipos y si es en oficina o a domicilio.',
        'Revisa los formatos y confirma.',
      ] },
      { titulo: 'Recoger, recargar o cambiar', pasos: [
        'Busca por paciente, cédula, código o serial y abre el préstamo.',
        'Toca "Recoger", "Recarga" o "Cambiar" (arriba o en cada equipo).',
        'Elige los equipos, si es en oficina o a domicilio, y llena el acta.',
        'En oficina se firma ahí; a domicilio lo hace el repartidor.',
      ] },
      { titulo: 'Recarga periódica', pasos: [
        'En el préstamo, en "Recargas", define cada cuántos días.',
        'Cuando toque, aparece en los avisos del inicio.',
      ] },
      { titulo: 'Formatos', pasos: [
        'Abre el préstamo y toca "Ver formatos" o "Descargar PDF".',
      ] },
    ],
    estados: [
      ['Programada', 'gris', 'Sin entregar'],
      ['Entregada', 'cian', 'El cliente tiene los equipos'],
      ['Finalizada', 'verde', 'Todo devuelto'],
      ['Cancelada', 'gris', 'Anulado'],
    ],
    video: null,
  },

  clientes: {
    titulo: 'Clientes',
    resumen: 'Clientes y pacientes, con los equipos que tienen.',
    tareas: [
      { titulo: 'Ver los equipos de un cliente', pasos: [
        'Abre el cliente.',
        'En "En préstamo" filtra por tipo o busca por código o paciente.',
      ] },
      { titulo: 'Recoger, recargar o cambiar', pasos: [
        'En "En préstamo", toca "Recoger, recargar o cambiar".',
        'Elige los equipos de un mismo paciente y la acción.',
        'Se abre el préstamo para llenar y firmar el acta.',
      ] },
      { titulo: 'Historia de un equipo', pasos: [
        'En "Por equipo", abre un equipo para ver todo lo que le pasó.',
      ] },
      { titulo: 'Informe', pasos: [
        'En el cliente, descarga el informe en PDF o Excel.',
      ] },
    ],
    video: null,
  },

  bitacora: {
    titulo: 'Bitácora',
    resumen: 'Quién hizo qué y cuándo.',
    tareas: [
      { titulo: 'Buscar', pasos: [
        'Usa el buscador o filtra por módulo, acción o fechas.',
      ] },
    ],
    video: null,
  },

  configuracion: {
    titulo: 'Configuración',
    resumen: 'Ajustes del sistema.',
    tareas: [
      { titulo: 'Acceso', pasos: [
        'Usuarios: crea cuentas y asigna su rol.',
        'Portal de clientes: da acceso a cada cliente.',
      ] },
      { titulo: 'Equipos', pasos: [
        'Categorías y tipos de equipo.',
      ] },
      { titulo: 'Documentos', pasos: [
        'Plantillas: «Nueva plantilla» importa un Word o arma una en blanco; «Editar» la cambia.',
        'En el Word, los datos van entre corchetes: [Nombre del paciente].',
        'Datos de la empresa y logos (normal y para modo oscuro).',
      ] },
      { titulo: 'Preferencias', pasos: [
        'Modo oscuro y navegación del celular.',
      ] },
    ],
    video: null,
  },
}
