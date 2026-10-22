import { construirContexto } from './contexto.js'

// Datos inventados para previsualizar una plantilla sin un préstamo real
const firma = color => `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="60"><path d="M5 45 C 30 5, 50 55, 75 25 S 120 50, 140 20 S 190 40, 215 15" stroke="${color}" stroke-width="2.5" fill="none"/></svg>`)}`

export function contextoEjemplo(empresa = {}) {
  return construirContexto({
    empresa,
    orden: {
      codigo: 'ORD-2026-000', diagnostico: 'G473 Apnea del sueño',
      cliente: { nombre: 'CLIENTE DE EJEMPLO', nit_cc: '900000000-0' },
      paciente: {
        nombre: 'MARÍA EJEMPLO PÉREZ', cedula: '12345678', tipo_documento: 'CC', direccion: 'Calle 1 # 2-3',
        barrio: 'Centro', ciudad: 'Valledupar', telefono: '3001234567', eps: 'EPS DE EJEMPLO', fecha_nacimiento: '1950-02-15',
      },
    },
    equipos: [
      { codigo: 'RL0001', atributos: { serie: 'SN-000123', modelo: 'G2S A20' }, tipo_equipo: { nombre: 'BMC', atributos: { nombre: 'Equipo CPAP/BPAP' }, categoria: { nombre: 'CPAP - BPAP' } } },
      { codigo: 'RL0002', atributos: { serie: 'BX000456' }, tipo_equipo: { nombre: 'Cilindro 3.5 M3', atributos: { nombre: 'Cilindro de Oxígeno' }, categoria: { nombre: 'Cilindros de Oxígeno' } } },
    ],
    datos: {
      ciudad: 'Valledupar', motivo: 'Cilindro vacío', observaciones: 'Equipo en óptimas condiciones, se capacita en su manejo.',
      recibe: { nombre: 'JUAN EJEMPLO PÉREZ', documento: '87654321', parentesco: 'Hijo', telefono: '3017654321', correo: 'juan@ejemplo.com' },
      entrega: { nombre: 'Técnico de ejemplo', cargo: 'Biomédico', documento: '11111111' },
      insumos: [{ descripcion: 'Máscara oronasal talla M', cantidad: 1, lote: 'L-0001', invima: '2020DM-0000000' }],
    },
    // Para ver las plantillas de cambio de equipo: el que sale
    retirados: [{ codigo: 'RL0003', atributos: { serie: 'BX000999' }, tipo_equipo: { nombre: 'Cilindro 3.5 M3', atributos: { nombre: 'Cilindro de Oxígeno' }, categoria: { nombre: 'Cilindros de Oxígeno' } } }],
    firmas: { recibe: firma('#1B3A6B'), entrega: firma('#333') },
  })
}
