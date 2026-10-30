// Plantillas iniciales de actas, copiadas palabra por palabra de los formatos
// reales que entregó el cliente: el Excel de Ingemedic, Solidaridad, ASMEDC y el
// paquete de Family Homecare / FOMAG. Los textos de Ingemedic salen del Excel
// celda por celda (generado; las rayas para llenar se cambiaron por variables).
// Se cargan una vez en plantillas_acta; después se editan desde Configuración.
// Ver lib/actas/render.js para el formato de bloques.

const logo = (base, ruta, alto) => ({ url: `${base}/storage/v1/object/public/logos/${ruta}`, alto })
const sinLogo = texto => ({ texto })

// Equipos entregados: una tabla por tipo de equipo (cilindros, reguladores…) con
// sus columnas, y los accesorios que se marcan con X (render.js → tablasPorTipo)
const ACCESORIOS = [{ etiqueta: 'HUMIDIFICADOR' }, { etiqueta: 'CANULA' }, { etiqueta: 'CIRCUITOS' }, { etiqueta: 'OTROS', valor: '{{insumos_resumen}}' }]
const equiposPorTipo = titulo => ({ tipo: 'tabla', fuente: 'equipos', agrupar: 'tipo', titulo, accesorios: ACCESORIOS })

// Recuadro de equipos con cilindro, regulador y accesorios, como el formato impreso:
// queda para la devolución, que se llena a mano (Excel de Ingemedic y comodato de Family)
const recuadroEquipos = (titulo, llenar) => llenar ? equiposPorTipo(titulo) : ({
  tipo: 'campos', estilo: 'tabla', columnas: 4, titulo, campos: [
    { etiqueta: 'EQUIPO:', valor: llenar ? '{{equipo_descripcion}}' : '' }, { etiqueta: llenar ? 'CILINDRO: DE OXIGENO' : 'CILINDRO:' },
    { etiqueta: llenar ? 'REGULADOR: DE OXIGENO' : 'REGULADOR:' }, { etiqueta: 'HUMIDIFICADOR' },
    { etiqueta: 'MARCA:', valor: llenar ? '{{equipo_marca}}' : '' }, { etiqueta: 'TAMAÑO:', valor: llenar ? '{{cilindro_tamano}}' : '' },
    { etiqueta: 'MARCA:', valor: llenar ? '{{regulador_marca}}' : '' }, { etiqueta: 'CANULA' },
    { etiqueta: 'MODELO:', valor: llenar ? '{{equipo_modelo}}' : '' }, { etiqueta: 'SERIAL:', valor: llenar ? '{{cilindro_serie}}' : '' },
    { etiqueta: 'SERIAL:', valor: llenar ? '{{regulador_serie}}' : '' }, { etiqueta: 'CIRCUITOS' },
    { etiqueta: 'SERIAL:', valor: llenar ? '{{equipo_serie}}' : '', span: 3 }, { etiqueta: 'OTROS', valor: llenar ? '{{insumos_resumen}}' : '' },
  ],
})

// ── Estándar Ingemedic (Excel, hoja 1 arriba): contrato de arriendo + entrega/devolución + capacitación ──
function estandar(base) {
  const enc = titulo => ({ tipo: 'encabezado', logos: [logo(base, 'logo-ingemedic.png', 44)], ancho_logo: 28, centro: [{ texto: titulo, estilo: 'titulo' }] })
  return {
    nombre: 'Acta de entrega Ingemedic (estándar)',
    descripcion: 'Contrato de arriendo de suministro integral de oxígeno domiciliario, entrega y devolución de equipos y declaración de capacitación. Se usa con los clientes que no tienen formato propio.',
    es_estandar: true,
    bloques: [
      enc("CONTRATO DE ARRIENDO DE SUMINISTRO INTEGRAL DE OXIGENO DOMICILIARIO"),
      { tipo: 'texto', tamano: 10, texto: "Las partes determinadas abajo ENTREGA DE EQUIPOS, y que en el texto del presente contrato se denominan respectivamente INGEMEDIC DE COLOMBIA SAS-QUIEN ENTREGA por una parte y QUIEN RECIBE por la otra parte. INGEMEDIC DE COLOMBIA SAS- mediante este contrato hace la entrega formal del equipo médico descrito en la parte de ENTREGA DE EQUIPOS, en perfecto estado de funcionamiento y conservación, apto para su uso por orden de la {{cliente_nombre}} y según convenio de prestación de servicio suscrito entre las partes. LA PERSONA QUE RECIBE declara haberlo recibido en dicha forma, hecho que ratifica con la suscripción de este documento, y se compromete para con INGEMEDIC DE COLOMBIA SAS. a cumplir con las siguientes obligaciones: a) cuidar y mantener en buen estado los EQUIPOS MEDICOS recibidos, y descritos en la parte de abajo, respondiendo por todo daño que ellos sufran, salvo aquellos daños que se deriven del deterioro normal por su uso legitimo. b) mantener los EQUIPOS en buen estado de conservación. c) Restituir los EQUIPOS al vencimiento del contrato que INGEMEDIC DE COLOMBIA S.A.S, tenga celebrado con la EPS; o cuando el paciente se traslade a una EPS diferente a la de arriba descrita, o a la muerte del paciente, o a la cesación del procedimiento medico por mejoría del paciente. d) Utilizar los EQUIPOS de acuerdo con el uso autorizado. e) Dar aviso a INGEMEDIC DE COLOMBIA S.A.S, de cualquier deterioro, o falla que sufran los equipos, especialmente si del mismo se derivan algún riesgo para el funcionamiento correcto del EQUIPO. f) informar oportunamente a INGEMEDIC DE COLOMBIA S.A.S del cambio de ubicación ó dirección de los EQUIPOS por cualquier razón. g) LA PERSONA QUE RECIBE se hará cargo y responderá por el buen uso y trato de los equipos entregados. en el caso de que hubiere de efectuarse cualquier reparación de estos, la mano de obra y los repuestos necesarios para la misma, cuando el daño sea causado por el mal uso o maltrato de los equipos POR PARTE DE LA PERSONA QUIEN RECIBE , los costos de la reparación correrán de este ultimo. h) los equipos no podrán ser trasladados por LA PERSONA QUE LO RECIBE ni por terceros al lugar diferente del relacionado, cualquier movilización solo podrá ser efectuada por personal autorizado de INGEMEDIC DE COLOMBIA S.A.S, LA PERSONA QUE RECIBE no podrá cambiar el sitio de ubicación de los equipos sin la debida autorización de INGEMEDIC DE COLOMBIA S.A.S. i) En caso de pérdida o destrucción total, hurto o cualquier otra situación similar de los equipos, facturará INGEMEDIC DE COLOMBIA S.A.S, a cobrar a la PERNONA QUE RECIBE el valor de los equipos, según valor comercial de los mismos. j) las ordenes u autorizaciones siguientes, despues de haberse efectuado la entrega de los equipos descritos en las generalidades, debe ser realizada o gestionada por la PERSONA QUE RECIBE o cualquier familiar del paciente ante la EPS. k) LA PERSONA QUE RECIBE se compromete a gestionar las ordenes siguientes, inmediatamente de haberse vencido dicha orden y tenerla en medio físico. l) los equipos entregados serán retirados por QUIEN ENTREGA si la orden u autorización no se encuentra al dia para poder continuar con el servicio." },
      { tipo: 'titulo', texto: 'ENTREGA DE EQUIPOS' },
      { tipo: 'campos', columnas: 2, campos: [{ etiqueta: 'CIUDAD', valor: '{{ciudad}}' }, { etiqueta: 'FECHA', valor: '{{fecha}}' }] },
      { ...recuadroEquipos('EQUIPOS ENTREGADOS', true), titulo: 'EQUIPOS ENTREGADOS' },
      { tipo: 'campos', columnas: 2, campos: [
        { etiqueta: 'QUIEN RECIBE:', valor: '{{recibe_nombre}}' }, { etiqueta: 'FIRMA:', firma: 'recibe' },
        { etiqueta: 'DIRECCION:', valor: '{{paciente_direccion}}' }, { etiqueta: 'TELEFONO', valor: '{{recibe_telefono}}' },
        { etiqueta: 'NOMBRE DEL PACIENTE:', valor: '{{paciente_nombre}}', span: 2 },
        { etiqueta: "OBSERVACIONES: ( Especifique en este campo las observaciones que tenga acerca del estado del equipo en el momento de la entrega)", valor: '{{observaciones}}', span: 2, arriba: true },
      ] },
      { tipo: 'titulo', texto: 'DEVOLUCION DE EQUIPOS' },
      { tipo: 'campos', columnas: 2, campos: [{ etiqueta: 'CIUDAD' }, { etiqueta: 'FECHA' }] },
      { ...recuadroEquipos('EQUIPOS RECIBIDOS', false), titulo: 'EQUIPOS RECIBIDOS' },
      { tipo: 'campos', columnas: 2, campos: [
        { etiqueta: 'QUIEN ENTREGA:' }, { etiqueta: 'FIRMA:' },
        { etiqueta: 'DIRECCION:' }, { etiqueta: 'TELEFONO' },
        { etiqueta: 'NOMBRE DEL PACIENTE:', span: 2 },
        { etiqueta: "OBSERVACIONES: ( Especifique en este campo las observaciones que tenga acerca del estado del equipo en el momento de la devolucion)", span: 2, arriba: true },
      ] },
      { tipo: 'salto_pagina' },
      enc("DECLARACION DE CAPACITACION Y ENTRENAMIENTO"),
      { tipo: 'texto', texto: "Yo {{paciente_nombre}}, con documento de identidad N° {{paciente_documento}} que en la actualidad estoy siendo atendido por INGEMEDIC DE COLOMBIA S.A.S de acuerdo con la autorización de la EPS {{paciente_eps}}, o yo {{responsable_nombre}} con documento de identidad {{responsable_documento}}, en mi calidad de persona responsable del paciente descrito anteriormente, quien presente impedimento fisico para suscribir el presente documento, declaro que he recibido la capacitación sobre seguridad y manejo de Equipos por parte de los funcionarios de INGEMEDIC DE COLOMBIA S.A.S y quedo con el conocimiento y en capacidad de:" },
      { tipo: 'texto', texto: "1. instalar adecuadamente el regulador de oxigeno en el cilindro y/o manioular el concentrador de oxigeno.\n2. Tengo claridad sobre cuál es el procedimiento para solicitar el oxigeno a INGEMEDIC SAS\n3. Conozco las normas sobre seguridad y sobre el correcto uso de los cilindros y/o los concentradores de oxigeno\n4. Conozco los peligros del oxigeno.\n5. Fui informado sobre las incompatibilidades del uso del oxigeno contenido en cilindros y generado por el concentrador frente a productos como grasa, gasolina, aceites y derivados de estos.\n6. Fui informado de frente a la inseguridad y/o incapacidad en la manipulación del oxigeno, el cilindro y/o el concentrador, manometros y los reguladores, me comunicaré primero con INGEMEDIC S.A.S para coordinar el reentrenamiento o la adecuación de los mismos.\n7. No permitiré el uso o la manipulación del oxigeno, el cilindro, el manometro y/o reguladores y el concentrador a terceros ajenos al paciente beneficiario de los mismos.\n8. Tengo la claridad sobre la forma de hacer los pedidos el oxigeno y los plazos de INGEMEDIC S.A.S  para ser entregados." },
      { tipo: 'texto', texto: "INGEMEDIC S.A.S queda exonerado de la responsabilidad por accientes y problemas derivados a mi persona, como paciente beneficiario del suministr, y/o ajenos al proceso, cuando se violen, o se desconozcan los parámetros arriba mencionados, los cuales no son taxativos, sino enumerativos, pero que son complementarios a la permanente orientación que con la entrega periódica del oxigeno y los elementos antes mencionados efectuan nuestros funcionarios." },
      { tipo: 'espacio', alto: 8 },
      { tipo: 'campos', columnas: 3, campos: [
        { etiqueta: 'Ciudad:', valor: '{{ciudad}}' }, { etiqueta: 'Fecha:', valor: '{{fecha}}' }, { etiqueta: 'Hora:', valor: '{{hora}}' },
        { etiqueta: 'Nombre del paciente:', valor: '{{paciente_nombre}}', span: 3 },
        { etiqueta: 'Firma del Paciente:', firma: 'paciente', span: 2 }, { etiqueta: 'C.C', valor: '{{paciente_documento}}' },
        { etiqueta: 'Nombre del Responsable del Paciente:', valor: '{{responsable_nombre}}', span: 3 },
        { etiqueta: 'Firma del Responsable del Paciente:', firma: 'responsable', span: 2 }, { etiqueta: 'C.C', valor: '{{responsable_documento}}' },
        { etiqueta: 'Nombre del Funcionario de INGEMEDIC S.A.S:', valor: '{{entrega_nombre}}', span: 3 },
        { etiqueta: 'Firma del Funcionario de INGEMEDIC S.A.S:', firma: 'entrega', span: 2 }, { etiqueta: 'C.C', valor: '{{entrega_documento}}' },
      ] },
    ],
  }
}

// ── Pagaré y carta de instrucciones (Excel, hoja 1 abajo) — va al final de la estándar ──
function pagare(base) {
  const enc = titulo => ({ tipo: 'encabezado', logos: [logo(base, 'logo-ingemedic.png', 50)], ancho_logo: 28, centro: [{ texto: titulo, estilo: 'titulo' }] })
  const cierre = [
    { tipo: 'texto', texto: "En constancia, firmo en {{ciudad}} el dia ( )________________de {{mes}} de {{anio}} " },
    { tipo: 'firmas', firmas: [{ rol: 'recibe', titulo: "EL(LOS) OTORGANTE(S)", lineas: [{ etiqueta: "CEDULA N°:", valor: '{{recibe_documento}}' }] }, { rol: 'vacia' }] },
  ]
  return {
    nombre: 'Pagaré y carta de instrucciones (Ingemedic)',
    descripcion: 'Carta de instrucciones anexa a pagaré con espacios en blanco, y el pagaré. Solo para los clientes que lo exigen.',
    bloques: [
      enc("CARTA DE INSTRUCCIONES ANEXA A PAGARE CON ESPACIOS EN BLANCO"),
      { tipo: 'texto', texto: "Yo, {{recibe_nombre}}, mayor de edad, domicilio en la ciudad de {{ciudad}}, identificado con la cédula de ciudadania N° {{recibe_documento}}, autorizo a INGEMEDIC DE COLOMBIA S.A.S, con NIT 900.662.580-5 y con domicilio principal en la ciudad de Valledupar, Representada legalmente por LINA ANDREA OROZCO MOLINA, para que haciendo uso de las facultades contenidas en el Articulo 622 del Código de comercio, llene los espacios en blanco que se han dejado en el PAGARÉ N°________________adjunto, el cual podrá ser llenado sin previo aviso, para lo cual deberá deñirse a las siguientes instrucciones:" },
      { tipo: 'texto', texto: "1. El monto será igual a todas las obligaciones exigibles a cargo nuestro y a favor de INGEMEDIC DE COLOMBIA S.A.S, derivadas directa o indirectamente de compraventas o servicios efectuados por INGEMEDIC DE COLOMBIA S.A.S a {{recibe_nombre}},y que existen al momento de ser llenados los espacios. Dichas obligaciones no se limitan exclusivamente a las obligaciones contraidas exclusivamente por las compraventas o prestacion o cobro de servicio, sino tambien a las indemnizaciones a que haya lugar por perjuicios cuantificables tanto por lucro cesante como por daño emergente, que pudieren haberse causado por {{recibe_nombre}} a INGEMEDIC DE COLOMBIA S.A.S." },
      ...cierre,
      { tipo: 'espacio', alto: 24 },
      enc("PAGARÉ"),
      { tipo: 'texto', texto: "Conste por medio del presente documeto, que {{recibe_nombre}}, mayor de edad, vecino de {{ciudad}}, identificado con la cédula de ciudadania N° {{recibe_documento}}, actuando en mi propio nombre y representación, con domicilio principal en________________________________________prometo(emos) pagar incondicionalmente en__________________________(Colombia) a INGEMEDIC DE COLOMBIA S.A.S, con NIT 900.662.580-5 y con domicilio principal en la ciudad de Valledupar, o a su ORDEN, el dia ( ) de _______________________________de___________________________________, la cantidad de____________________________________pesos($ )m/l., dando autorización para llenar los espacios en blanco según CARTA DE INSTRUCCIONES anexa a pagaré con espacios en blanco." },
      { tipo: 'texto', texto: "En caso de mora en el pago, reconeceremos y cubriremos intereses a la máxima tasa autorizada para la mora, conforme al articulo 884 del código de comercio, o sea el doble del interés bancario corriente, según la certificación de la Superintendencia Bancaria para el correspondiente período y sin que exceda la limitación establecida en el Articulo 1ro. del Decreto 141 de 1980." },
      ...cierre,
    ],
  }
}

// ── Solidaridad (FT-AD-60-02, versión 01) ──
function solidaridad(base) {
  return {
    nombre: 'Solidaridad — Acta de entrega de equipos biomédicos (FT-AD-60-02)',
    descripcion: 'Formato del Centro Nacional Integral de Rehabilitación Solidaridad.',
    bloques: [
      { tipo: 'encabezado', logos: [logo(base, 'clientes/solidaridad.png', 44)], ancho_logo: 18,
        logo_pie: 'CENTRO NACIONAL INTEGRAL\nDE REHABILITACION\nSOLIDARIDAD S.A.S. Nit:\n900525552-2',
        centro: [{ etiqueta: 'PERIODO', texto: 'ATENCIÓN DOMICILIARIA', estilo: 'titulo' },
          { etiqueta: 'PROCESO', texto: 'ACTA DE ENTREGA DE EQUIPOS BIOMÉDICOS O SUMINISTRO DE OXÍGENO', estilo: 'subtitulo' }],
        derecha: [{ etiqueta: 'Código', valor: 'FT-AD- 60-02' }, { etiqueta: 'Versión', valor: '01' }] },
      { tipo: 'espacio', alto: 6 },
      { tipo: 'titulo', texto: 'ACTA DE ENTREGA DE EQUIPOS BIOMÉDICOS O SUMINISTRO DE OXÍGENO DOMICILIARIO' },
      { tipo: 'texto', texto: 'El Coordinador del servicio de hospitalización bajo la modalidad domiciliaria de la IPS CENTRO NACIONAL INTEGRAL DE REHABILITACIÓN SOLIDARIDAD, en desarrollo de su competencia, por medio de la presente acta hace constar la entrega de equipos biomédicos y/o suministro de oxígeno domiciliario en calidad de préstamo teniendo en cuenta las siguientes especificaciones:' },
      { tipo: 'tabla', fuente: 'ambos', filas_minimas: 4, columnas: [
        { clave: 'item', etiqueta: 'ITEM', ancho: 9 }, { clave: 'descripcion', etiqueta: 'DESCRIPCIÓN DEL EQUIPO Y/O SUMINISTRO', ancho: 55 },
        { clave: 'estado', etiqueta: 'ESTADO', ancho: 20 }, { clave: 'cantidad', etiqueta: 'CANTIDAD' }] },
      { tipo: 'texto', texto: 'La custodia y buen uso de los equipos entregados antes descritos son responsabilidad del paciente o familiar y a partir de la fecha de entrega asumen el compromiso de su cuidado.\n\nLos equipos anteriormente mencionados son entregados y prestados a:' },
      { tipo: 'campos', columnas: 1, campos: [
        { etiqueta: 'NOMBRE:', valor: '{{paciente_nombre}}' },
        { etiqueta: 'DOCUMENTO DE IDENTIDAD:', valor: '{{paciente_tipo_doc}} {{paciente_documento}}' },
        { etiqueta: 'DIRECCIÓN:', valor: '{{paciente_direccion}}' },
        { etiqueta: 'TELÉFONO:', valor: '{{paciente_telefono}}' },
        { etiqueta: 'FECHA DE ENTREGA:', valor: '{{fecha}}' },
        { etiqueta: 'FIRMA DE RECIBIDO:', firma: 'recibe' },
        { etiqueta: 'NOMBRE DE QUIEN ENTREGA:', valor: '{{entrega_nombre}}' },
        { etiqueta: 'FIRMA DE QUIEN ENTREGA:', firma: 'entrega' },
      ] },
    ],
  }
}

// ── ASMEDC (AMD-FT-019, versión 1) ──
function asmedc(base) {
  return {
    nombre: 'ASMEDC — Acta de entrega de dispositivos médicos (AMD-FT-019)',
    descripcion: 'Formato de Asistencia Médica Domiciliaria del Cesar.',
    bloques: [
      { tipo: 'encabezado', logos: [logo(base, 'clientes/asmedc.png', 62)], ancho_logo: 26,
        centro: [{ texto: 'ASISTENCIA MEDICA DOMICILIARIA DEL CESAR S.A.S', estilo: 'subtitulo' }, { texto: 'ACTA DE ENTREGA DE DISPOSITIVOS MEDICOS', estilo: 'subtitulo' }],
        derecha: [{ etiqueta: '', valor: 'AMD- FT-019' }, { etiqueta: 'VERSION:', valor: '1' }, { etiqueta: 'Fecha:', valor: '02/03/2020' }] },
      { tipo: 'titulo', texto: 'ACTA DE ENTREGA DE DISPOSITIVOS MEDICOS A USUARIOS' },
      { tipo: 'campos', columnas: 2, campos: [
        { etiqueta: 'Nombre del paciente:', valor: '{{paciente_nombre}}', span: 2 },
        { etiqueta: 'Documento de Identificación:', valor: 'CC: {{doc_cc}}  TI: {{doc_ti}}  R.C: {{doc_rc}}  C.E: {{doc_ce}}  No: {{paciente_documento}}', span: 2 },
        { etiqueta: 'Fecha de Entrega:', valor: '{{fecha}}', span: 2 },
        { etiqueta: 'Dirección:', valor: '{{paciente_direccion}}' }, { etiqueta: 'Barrio:', valor: '{{paciente_barrio}}' },
        { etiqueta: 'Teléfono:', valor: '{{paciente_telefono}}' }, { etiqueta: 'Ciudad:', valor: '{{ciudad}}' },
        { etiqueta: 'Motivo de la solicitud (Dx):', valor: '{{diagnostico}}', span: 2 },
      ] },
      { tipo: 'texto', texto: 'Con la siguiente acta se le hace entrega formal del equipo médico descrito a continuación, en perfecto estado de funcionamiento y conservación, apto para su uso. La persona que recibe {{recibe_nombre}} c.c {{recibe_documento}} declara recibirlo en dicha forma, comprometiéndose a cumplir con el cuidado, mantenimiento en buen estado, conservación, respondiendo por todo daño que el(os) sufran, salvo de aquellos daños que se deriven del deterioro normal por su uso legítimo durante el periodo de uso del dispositivo médico.' },
      { tipo: 'tabla', fuente: 'ambos', filas_minimas: 5, columnas: [
        { clave: 'cantidad', etiqueta: 'CANTIDAD', ancho: 11 }, { clave: 'descripcion', etiqueta: 'DESCRIPCION', ancho: 35 },
        { clave: 'marca', etiqueta: 'MARCA' }, { clave: 'modelo', etiqueta: 'MODELO' }, { clave: 'serie', etiqueta: 'N- DE SERIE' }] },
      { tipo: 'campos', columnas: 1, campos: [{ etiqueta: 'Observaciones:', valor: '{{observaciones}}' }] },
      { tipo: 'espacio', alto: 14 },
      { tipo: 'campos', columnas: 2, campos: [
        { etiqueta: 'Recibe a satisfacción:', firma: 'recibe', valor: '{{recibe_nombre}}' }, { etiqueta: 'C.C', valor: '{{recibe_documento}}' },
      ] },
      { tipo: 'pie', texto: 'Asistencia Médica Domiciliaria del Cesar ASMEDC. Cra 19c # 16b – 19. Tel: 5802043 Celular: 3152519883' },
    ],
  }
}

// ── Family Homecare / FOMAG ──
// Logo sacado del Excel "FORMATO ENTREGA DE EQUIPOS BIOMEDICOS 2025" (docs/)
const familyLogo = (base, alto = 46) => logo(base, 'clientes/family-homecare.jpg', alto)

function familyComodato(base) {
  const enc = n => ({
    tipo: 'encabezado', logos: [familyLogo(base)], ancho_logo: 20,
    centro: [{ texto: 'CONTRATO DE COMODATO\nO\nPRÉSTAMO DE USO', estilo: 'titulo' }],
    derecha: [{ etiqueta: '', valor: '01 DE MAYO DE 2024' }, { etiqueta: 'ELABORADO POR:', valor: 'VIERIZ LLANES' }, { etiqueta: 'APROBADO POR:', valor: 'RODOLFO RODRÍGUEZ' }],
    logos_derecha: [sinLogo('{fiduprevisora}'), sinLogo('FOMAG')],
    pie: [{ etiqueta: 'COD:', valor: '000' }, { etiqueta: 'REVISION:', valor: '00' }, { etiqueta: 'VERSION', valor: '01' }, { etiqueta: 'Página', valor: `${n} de 5` }],
  })
  const folios = { tipo: 'pie', texto: 'Número de Folios Total: 5' }
  const t = texto => ({ tipo: 'texto', tamano: 11, texto })
  return {
    nombre: 'Family Homecare / FOMAG — Contrato de comodato',
    descripcion: 'Contrato de comodato o préstamo de uso de Family Homecare para afiliados del FOMAG (5 páginas). Va con todos los préstamos de Family, junto con el F-FAM-11 del tipo de equipo.',
    bloques: [
      enc(1),
      t('A los {{dia}} días del mes de {{mes}} de {{anio}}, en la ciudad de Valledupar, entre la SOCIEDAD **FAMILY HOMECARE S.A.S.**, persona jurídica de derecho privado, identificada con el Nit. 900830296-9, representada legalmente por el señor RODOLFO CARLOS RODRIGUEZ SHORBOGH, mayor de edad, residenciado en la ciudad de Valledupar, parte que se denominará **COMODANTE** y de otra parte el señor (a) {{recibe_nombre}}, identificado (a) con cédula de ciudadanía Nº {{recibe_documento}} en adelante se denominará **COMODATARIO**, celebran por medio de este documento **CONTRATO DE COMODATO** sobre los bienes que recibe el usuario por la prestación del servicio autorizado a la suscripción de este contrato y en las condiciones que a continuación se describen:\n\n' +
        '**ANTECEDENTES**: Para la continuidad de la prestación del servicio de Salud en la población afiliada al FOMAG, la FIDUCIARIA LA PREVISORA S.A. VOCERA Y ADMINISTRADORA DE LOS RECURSOS DEL FOMAG acepto la manifestación de interés de esta sociedad, y nos envió contrato o documento denominado **"ACUERDO DE VOLUNTADES COMO ACEPTACIÓN A LA MANIFESTACIÓN DE INTERÉS PARA LA CONFORMACIÓN DE LA RED DE PROVEEDORES PARA PRESTAR LOS SERVICIOS Y TECNOLOGÍAS EN SALUD PARA EL FOMAG "** -FIDECOMISOS PATRIMONIOS AUTONOMOS FIDUCIARIA LA PREVISORA S.A. , con domicilio en la ciudad de BOGOTA D.C y FAMILY HOMECARE S.A.S., para la atención domiciliaria de sus afiliados acorde a las autorizaciones enviadas, asumiendo el pago por el servicio. FAMILY HOMECARE S.A.S. entrega los equipos autorizados a título gratuito a sus afiliados, para su uso, el equipo puede ser propio o alquilado, pero la persona que recibe o el beneficiario está obligado a cuidar el equipo y devolverlo cuando ha cumplido su finalidad. Acorde a lo anterior las partes se reúnen para celebrar el presente contrato con las siguientes clausulas:\n\n' +
        '**PRIMERA. OBJETO.** El **COMODANTE** entrega al **COMODATARIO**, y éste recibe, a título de comodato, (préstamo de uso) los bienes que a continuación se describen:'),
      { ...recuadroEquipos(null, true), titulo: 'EQUIPOS ENTREGADOS' },
      { tipo: 'campos', columnas: 1, campos: [{ etiqueta: 'OBSERVACIONES: (Especifique en este campo las observaciones que tenga acerca del estado del equipo en el momento de la entrega)', valor: '{{observaciones}}', arriba: true }] },
      folios,
      { tipo: 'salto_pagina' },
      enc(2),
      { tipo: 'titulo', texto: 'DEVOLUCION DE EQUIPOS' },
      { tipo: 'campos', columnas: 2, campos: [{ etiqueta: 'CIUDAD' }, { etiqueta: 'FECHA' }] },
      { ...recuadroEquipos('EQUIPOS RECIBIDOS', false), titulo: 'EQUIPOS RECIBIDOS' },
      { tipo: 'campos', columnas: 2, campos: [
        { etiqueta: 'QUIEN ENTREGA:' }, { etiqueta: 'FIRMA:' },
        { etiqueta: 'DIRECCION:' }, { etiqueta: 'TELEFONO' },
        { etiqueta: 'NOMBRE DEL PACIENTE QUE RECECIBE EL SERVICIO:', span: 2 },
        { etiqueta: 'OBSERVACIONES: (Especifique en este campo las observaciones que tenga acerca del estado del equipo en el momento de la devolución)', span: 2, arriba: true },
      ] },
      t('**SEGUNDA. USO AUTORIZADO.** El COMODATARIO podrá usar el bien descrito en el punto anterior, único y exclusivamente en beneficio de la salud y con ocasión del tratamiento recibido por el/la paciente {{paciente_nombre}}, identificado con cedula de ciudadanía N° {{paciente_documento}} de acuerdo con las indicaciones especificadas por los médicos tratantes.\n\n' +
        '**TERCERA. OBLIGACIONES DEL COMODATARIO.** El COMODATARIO se obliga a:\n' +
        '**a)** Cuidar, conservar y mantener los bienes o equipos recibidos en comodato, respondiendo por todo daño o deterioro que sufran, salvo aquellos daños que se deriven del deterioro normal por su uso legítimo.\n' +
        '**b)** Responder por los daños que los bienes entregados causen a terceros.\n' +
        '**c)** Restituir los bienes al término del comodato en perfecto estado y funcionamiento.\n' +
        '**d)** Utilizar los bienes conforme con el uso autorizado.\n' +
        '**e)** No cambiar la ubicación o colocación de los bienes sin el previo y escrito permiso de EL COMODANTE\n' +
        '**F)** Permitir la revisión, el mantenimiento del equipo.\n' +
        '**G)** Informar el cambio de domicilio del paciente a FAMILY HOMECARE S.A.S.\n' +
        '**H)** Restituir los EQUIPOS al vencimiento del contrato que FAMILY HOMECARE S.A.S, tenga celebrado con la EPS; o cuando el paciente se traslade a una EPS O IPS diferente a la de arriba descrita, o a la muerte del paciente, o a la cesación del procedimiento medico por mejoría del paciente.\n' +
        '**I)** Utilizar los EQUIPOS de acuerdo con el uso autorizado.\n' +
        '**J)** Dar aviso a FAMILY HOMECARE S.A.S, de cualquier deterioro, o falla que sufran los equipos, especialmente si del mismo se derivan algún riesgo para el funcionamiento correcto del EQUIPO.\n' +
        '**K)** Informar oportunamente a FAMILY HOMECARE S.A.S del cambio de ubicación ó dirección de los EQUIPOS por cualquier razón.'),
      folios,
      { tipo: 'salto_pagina' },
      enc(3),
      t('**L)** Responder por el Equipo. LA PERSONA QUE RECIBE o tiene el equipo responderá por el buen uso y trato de los equipos entregados. En el caso de que hubiere de efectuarse cualquier reparación de estos, la mano de obra y los repuestos necesarios para la misma, cuando el daño sea causado por el mal uso o maltrato de los equipos por parte de la persona quien recibe, los costos de la reparación correrán de este último.\n' +
        '**LL)** No trasladar el equipo o cambiar de domicilio el equipo. Los equipos no podrán ser trasladados por LA PERSONA QUE LO RECIBE ni por terceros al lugar diferente del relacionado, cualquier movilización solo podrá ser efectuada por personal autorizado de FAMILY HOMECARE S.A.S, LA PERSONA QUE RECIBE no podrá cambiar el sitio de ubicación de los equipos sin la debida autorización de FAMILY HOMECARE S.A.S.\n' +
        '**M)** PAGAR: En caso de pérdida o destrucción total, hurto o cualquier otra situación similar de los equipos, facultara a FAMILY HOMECARE S.A.S, a cobrar a la PERSONA QUE RECIBE el valor de los equipos, según valor comercial de los mismos y quien lo tiene bajo su custodia se obliga a pagarlo.\n' +
        '**N)** Entregar las órdenes u autorizaciones siguientes que se generen, después de haberse efectuado la entrega de los equipos descritos en las generalidades a FAMILY HOMECARE S.A.S dentro las 24 horas siguientes, debe ser realizada o gestionada por la PERSONA QUE RECIBE o cualquier familiar del paciente ante la EPS o entidad correspondiente.\n' +
        '**Ñ)** Gestionar: La persona que recibe o beneficiaria del bien, se compromete a gestionar las órdenes siguientes, inmediatamente de haberse vencido dicha orden y tenerla en medio físico.\n' +
        '**O)** Entregar los Equipos: Los equipos entregados serán retirados por QUIEN ENTREGA si la orden u autorización no se encuentra al día para poder continuar con el USO DEL EQUIPO.\n' +
        '**P)** Las demás obligaciones propias de los comodatarios de acuerdo con las disposiciones legales.\n\n' +
        '**CUARTA. Localización de los bienes.** —Los bienes descritos en la cláusula primera deberán permanecer durante la vigencia de este contrato en el domicilio del COMODATARIO, es decir, en la dirección: {{paciente_direccion}}. El COMODATARIO no podrá cambiar el sitio de ubicación de los bienes entregados en comodato sin la previa y escrita autorización del COMODANTE.\n\n' +
        '**QUINTA: DURACION Y PERFECCIONAMIENTO.** Este contrato tendrá vigencia desde la firma del mismo y durará: A) Hasta tanto la necesidad del paciente lo requiera de acuerdo a los conceptos de los médicos tratantes que establecerán la necesidad del uso del (los) bien (es) objeto del presente contrato B) Hasta la Terminación del contrato de la EPS o entidad correspondiente donde este afiliado el paciente o la que tenga a cargo al paciente a la IPS contratada para la prestación del servicio o al contrario C) Muerte del paciente D) Este contrato tendrá vigencia a partir de la fecha hasta que la FIDUCIARIA LA PREVISORA S.A. VOCERA Y ADMINISTRADORA DE LOS RECURSOS DEL FOMAG, ordene la finalización del servicio. E) Hasta que la FIDUCIARIA LA PREVISORA S.A. VOCERA Y ADMINISTRADORA DE LOS RECURSOS DEL FOMAG, ordene la terminación del acuerdo de voluntades como aceptación a la manifestación de interés para la conformación de la red de proveedores para prestar los servicios y tecnologías en salud para el FOMAG.F) Devolución del equipo por parte el comodatario al comodante.\n' +
        'Parágrafo: Este contrato está sujeto a las prórrogas, circulares, directrices que emita la FIDUCIARIA LA'),
      folios,
      { tipo: 'salto_pagina' },
      enc(4),
      t('PREVISORA S.A. **PERFECIONAMIENTO:** El contrato se perfecciona haciendo entrega al COMODANTE de los bienes en el lugar donde deben permanecer o continuando con la prestación del servicio.\n\n' +
        '**SEXTA. VALOR DE LOS BIENES.** A pesar del ser el COMODATO un préstamo gratuito, entre COMODANTE y COMODATARIO se acuerda que, en caso de pérdida, daño por golpes, no devolución del equipo u otro equivalente, como valor del bien la suma de $5.000.000 PESOS MCTE, más IVA, suma que deberá ser cancelada actualizada al momento del pago del COMODATARIO al COMODANTE. Esta suma la deberá pagar El Comodatario al Comodante en caso de no devolver el equipo. Si **El Comodante** ejerce la facultad que en su favor establece el artículo 2203 del Código Civil, según la cual puede abandonar la propiedad de la cosa en favor de **El Comodatario** cuando los bienes se deterioren de tal manera que no puedan emplearse en su uso ordinario.\n\n' +
        '**SEXTA. ESTADO DE LOS BIENES.** Al momento en que se firma el presente contrato, se entrega materialmente el bien (o bienes), se deja constancia por ambas partes que el mismo se encuentra en perfecto estado para su uso.\n\n' +
        '**SEPTIMA.** Restitución o terminación del contrato. - El comodatario deberá restituir el mueble, elementos o equipo entregado en calidad de préstamo de uso, en los siguientes casos: 1) Cuando el tratamiento establece un término, es decir; al Vencimiento del mismo; 2) por el incumplimiento de las obligaciones del comodatario en relación con la destinación, la utilización inadecuada, o el deterioro del equipo por su culpa. 3) por muerte de la persona comodataria; 4) Por la terminación de los servicios a los que se destinó el mueble. 5) Por la terminación o suspensión de la continuidad de la prestación del servicio en salud de parte FIDUCIARIA LA PREVISORA S.A. VOCERA Y ADMINISTRADORA DE LOS RECURSOS DEL FOMAG.\n\n' +
        '**OCTAVA.** Cesión. - Queda prohibida la cesión del contrato a cualquier persona natural o jurídica.\n\n' +
        '**NOVENA. INDEMNIZACIÓN POR INCUMPLIMIENTO.** El incumplimiento por parte del **COMODATARIO** de alguna o algunas de las obligaciones derivadas del presente contrato, especialmente la no restitución de los bienes dará derecho a **LAS COMODANTES** para exigir inmediatamente, a título de pena, una suma de dinero diaria equivalente a **CINCO SALARIOS MÍNIMOS MENSUALES LEGALES VIGENTES**. Por el pago de la pena no se extingue la obligación principal de restituir el o los equipos entregados, la cual podrá ser exigida separadamente, con indemnización de perjuicios.\n\n' +
        '**DECIMA. MÉRITO EJECUTIVO.** Las partes, reconocen que el presente documento presta mérito ejecutivo para la exigencia judicial del cumplimiento de las obligaciones en él contenidas.\n\n' +
        '**DECIMA PRIMERA. CLAUSULA COMPROMISORIA.** Toda controversia o diferencia relativa a este contrato, su ejecución y cumplimiento, se resolverá inicialmente mediante la conciliación y la amigable composición conforme a la normatividad vigente sobre sistemas alternos de solución de conflictos y demás normas'),
      folios,
      { tipo: 'salto_pagina' },
      enc(5),
      t('concordantes.'),
      { tipo: 'espacio', alto: 60 },
      { tipo: 'firmas', firmas: [
        { rol: 'vacia', titulo: 'COMODANTE', lineas: [{ etiqueta: 'C.C.', valor: '77.091.109' }, { etiqueta: 'CELULAR:', valor: '3156719559' }, { etiqueta: 'Correo electrónico:', valor: 'shorbogh@hotmail.com' }] },
        { rol: 'recibe', titulo: 'COMODATARIO', lineas: [{ etiqueta: 'C.C.', valor: '{{recibe_documento}}' }, { etiqueta: 'CELULAR:', valor: '{{recibe_telefono}}' }, { etiqueta: 'Correo electrónico:', valor: '{{recibe_correo}}' }] },
      ] },
      folios,
    ],
  }
}

// F-FAM-11 versión 02 (Excel "FORMATO ENTREGA DE EQUIPOS BIOMEDICOS 2025"): una hoja
// por tipo de equipo, como el Excel. Las filas vienen impresas y cada una toma del
// préstamo lo que le corresponde (render.js → tablaFija); "OTROS" junta lo que sobra.
// Del Excel se corrigió la numeración repetida de oxígeno, "EPS:" doble, "FAMLIAR"
// y "VENTURY". Edad y meses se escriben (antes la edad salía de la fecha de nacimiento
// y los meses eran el mes de la entrega).
// filas: [texto, coincide] — la expresión mira descripción, categoría, modelo y marca
const filasFijas = filas => [...filas, ['OTROS:']].map(([texto, coincide], i) =>
  coincide ? { texto: `${i + 1}. ${texto}`, coincide, juntar: true } : { texto: `${i + 1}. ${texto}`, ...(texto === 'OTROS:' && { resto: true }) })

const HOJAS_F11 = [
  { hoja: 'CPAP - BPAP', mascara: true, equipos: [['EQUIPO CPAP', '\\bc-?pap'], ['EQUIPO BPAP', '\\bb-?i?pap']],
    insumos: [['MASCARA ORONASAL', 'oronasal|full ?face'], ['MASCARA NASAL', 'm[aá]scara\\s+nasal'], ['MANGUERA CORRUGADA PARA CPAP Y/O BPAP', 'manguera|corrugad']] },
  { hoja: 'Oxígeno',
    equipos: [
      ['CONCENTRADOR DE OXIGENO BAJO FLUJO', '^(?!.*(port[aá]til|inogen|alto flujo)).*concentrador'],
      ['CONCENTRADOR DE OXIGENO ALTO FLUJO', '^(?!.*port[aá]til).*concentrador.*alto flujo'],
      ['CONCENTRADOR DE OXIGENO PORTATIL', 'concentrador.*(port[aá]til|inogen)'],
      ['CILINDRO 6.5M3', 'cilindro.*6[.,]5\\s*m'],
      ['REGULADOR DE OXIGENO 6.5M3', 'regulador'],
      ['BALA PORTATIL 1M3', 'cilindro.*(port[aá]til|\\b1\\s*m3)'],
      ['REGULADOR BALA PORTATIL'], ['RECARGA CILINDRO 6.5M3'], ['RECARGA CILINDRO 1M3'],
    ],
    insumos: [['KIT VENTURI ADULTO', '^(?!.*pedi).*ventur[iy]'], ['KIT VENTURI PEDIATRICO', 'ventur[iy].*pedi'],
      ['CANULA NASAL ADULTO', '^(?!.*pedi).*c[aá]nula'], ['CANULA NASAL PEDIATRICO', 'c[aá]nula.*pedi'],
      ['ACOPLE', 'acople'], ['VASO HUMIDIFICADOR', 'humidificador']] },
  { hoja: 'Otros equipos',
    equipos: [['ASPIRADOR DE SECRECIONES', 'aspirador'], ['MONITOR DE SIGNOS VITALES', 'monitor'], ['NEBULIZADOR', 'nebulizador'],
      ['COLCHON ANTIESCARAS', 'colch[oó]n|antiescara'], ['BOMBA DE INFUSION', 'bomba'], ['VENTILADOR MECANICO', 'ventilador'], ['CAMA HOSPITALARIA', 'cama']],
    insumos: [['MANGUERA DE SUCCION', 'succi[oó]n'], ['CIRCUITO VENTILATORIO', 'circuito']] },
]

// Cada F-FAM-11 lleva después, en hojas aparte, el acta de entrega de equipos de
// Family; el de CPAP - BPAP también la de la máscara (así lo pidió el cliente: una
// plantilla con sus actas). Una hoja que no se use se quita en el editor.
function familyF11(base, { hoja, equipos, insumos, mascara }) {
  return {
    nombre: `Family Homecare / FOMAG — Entrega ${hoja} (F-FAM-11)`,
    descripcion: `Formato F-FAM-11 versión 02 de Family Homecare, hoja ${hoja}: paciente, equipos, insumos y quien recibe. Con el acta de entrega de equipos${mascara ? ' y la de la máscara' : ''}.`,
    bloques: [
      { tipo: 'encabezado', logos: [familyLogo(base, 58)], ancho_logo: 24,
        centro: [{ texto: 'ENTREGA DE EQUIPOS E INSUMOS\nBIOMEDICOS', estilo: 'titulo' }],
        derecha: [{ etiqueta: 'CODIGO:', valor: 'F-FAM-11' }, { etiqueta: 'VERSION:', valor: '02' }, { etiqueta: 'FECHA:', valor: '01/01/2025' }, { etiqueta: 'PAGINA', valor: '1/1' }] },
      { tipo: 'campos', titulo: 'INFORMACION DEL PACIENTE', estilo: 'tabla', columnas: 3, campos: [
        { etiqueta: 'NOMBRE DEL PACIENTE:', valor: '{{paciente_nombre}}', span: 3 },
        { etiqueta: 'IDENTIFICACION:', valor: '{{paciente_documento}}' }, { etiqueta: 'EDAD:', valor: '{{edad}}' }, { etiqueta: 'EPS:', valor: '{{paciente_eps}}' },
        { etiqueta: 'DIAGNOSTICO:', valor: '{{diagnostico}}', span: 3 },
        { etiqueta: 'DIRECCION:', valor: '{{paciente_direccion}}', span: 2 }, { etiqueta: 'TEL:', valor: '{{paciente_telefono}}' },
        { etiqueta: 'BARRIO:', valor: '{{paciente_barrio}}', span: 2 }, { etiqueta: 'CIUDAD:', valor: '{{ciudad}}' },
        { etiqueta: 'PERIODO DE ATENCIÓN: MESES:', valor: '{{meses_atencion}}', span: 2 }, { etiqueta: 'FECHA:', valor: '{{fecha}}' },
      ] },
      { tipo: 'tabla', fuente: 'equipos', titulo: 'ENTREGA DE EQUIPO BIOMEDICO', filas_fijas: filasFijas(equipos),
        columnas: [{ clave: 'descripcion', etiqueta: 'DESCRIPCION DEL EQUIPO', ancho: 44 }, { clave: 'cantidad', etiqueta: 'CANT.', ancho: 8 },
          { clave: 'marca', etiqueta: 'MARCA' }, { clave: 'serie', etiqueta: 'SERIAL' }] },
      // Insumos: libres, los escribe quien crea el préstamo (no están en el inventario)
      { tipo: 'tabla', fuente: 'insumos', titulo: 'ENTREGA DE INSUMOS', filas_fijas: filasFijas(insumos),
        columnas: [{ clave: 'descripcion', etiqueta: 'INSUMO', ancho: 44 }, { clave: 'cantidad', etiqueta: 'CANT.', ancho: 8 },
          { clave: 'lote', etiqueta: 'LOTE' }, { clave: 'invima', etiqueta: 'REG. INVIMA' }] },
      { tipo: 'campos', titulo: 'DATOS DEL PACIENTE O FAMILIAR QUE RECIBE', columnas: 1, borde: true, campos: [
        { etiqueta: 'NOMBRE:', firma: 'recibe', valor: '{{recibe_nombre}}' },
        { etiqueta: 'CEDULA:', valor: '{{recibe_documento}} DE ____' },
        { etiqueta: 'PARENTESCO:', valor: '{{recibe_parentesco}}' },
        { etiqueta: 'RECIBO CONFORME SI:', valor: 'X     NO: ____' },
      ] },
      { tipo: 'campos', titulo: 'ENTREGADO POR', columnas: 2, borde: true, campos: [
        { etiqueta: 'NOMBRE:', firma: 'entrega', valor: '{{entrega_nombre}}' }, { etiqueta: 'CARGO:', valor: '{{entrega_cargo}}' },
        { etiqueta: 'OBSERVACION:', valor: '{{observaciones}}', span: 2 },
        { etiqueta: 'FECHA:', valor: '{{fecha}}' }, { etiqueta: 'HORA:', valor: '{{hora}}' },
      ] },
      SALTO, ...hojaEntregaFamily(base),
      ...(mascara ? [SALTO, ...hojaMascaraFamily(base)] : []),
      { tipo: 'campos_propios', etiquetas: { edad: 'Edad', meses_atencion: 'Meses de atención' } },
    ],
  }
}

// Cambio de equipo de Family: igual al de Ingemedic, con el logo y el nombre de Family
export function cambioFamily(base) {
  const c = cambioIngemedic(base)
  return {
    ...c,
    nombre: 'Acta de cambio de equipo Family',
    descripcion: 'Cambio de equipos médicos domiciliarios de Family Homecare / FOMAG: el que se retira y el que se entrega.',
    es_estandar: false,
    bloques: c.bloques.map(b =>
      b.tipo === 'encabezado' ? { ...b, logos: [familyLogo(base, 62)] }
      : b.tipo === 'texto' ? { ...b, texto: b.texto.replace('INGEMEDIC DE COLOMBIA S.A.S', 'FAMILY HOMECARE S.A.S') }
      : b.tipo === 'campos' ? { ...b, campos: b.campos.map(x => ({ ...x, etiqueta: x.etiqueta.replace('en el momento de la cambio', 'en el momento del cambio') })) }
      : b),
  }
}

// ── Actas generales de Family (Excel "ACTA DE ENTREGA DE EQUIPOS FAMILY" y "ACTA DE
// ENTREGA INSUMO (MASCARA)"): hojas que van dentro de los F-FAM-11 (familyF11). Cada
// Excel trae entrega, devolución y recarga en una hoja; como las de Ingemedic, aquí va
// solo la parte de la entrega (son del préstamo). La máscara sale de los insumos del
// préstamo (contexto.js → mascara_*).
const encFamilyGeneral = base => ({ tipo: 'encabezado', logos: [familyLogo(base, 58)], ancho_logo: 24,
  centro: [{ texto: 'ACTA GENERAL DE EQUIPOS MEDICOS DOMICILIARIOS O SUMINISTRO OXIGENO DOMICILIARIO', estilo: 'titulo' }] })
const quienesFamily = () => [
  { etiqueta: 'QUIEN ENTREGA:', valor: '{{entrega_nombre}}', span: 2 }, { etiqueta: 'FIRMA:', firma: 'entrega' },
  { etiqueta: 'QUIEN RECIBE:', valor: '{{recibe_nombre}}', span: 2 }, { etiqueta: 'FIRMA:', firma: 'recibe' },
  { etiqueta: 'DIRECCION:', valor: '{{paciente_direccion}}', span: 2 }, { etiqueta: 'TELEFONO', valor: '{{recibe_telefono}}' },
  { etiqueta: 'NOMBRE DEL PACIENTE:', valor: '{{paciente_nombre}}', span: 3 },
  { etiqueta: obsGeneral('entrega'), valor: '{{observaciones}}', span: 3, arriba: true },
]

export function hojaEntregaFamily(base) {
  return [
      encFamilyGeneral(base),
      { tipo: 'campos', titulo: 'ENTREGA DE EQUIPOS', columnas: 3, borde: true, campos: [
        { etiqueta: 'CIUDAD', valor: '{{ciudad}}' }, { etiqueta: 'FECHA', valor: '{{fecha}}' }, { etiqueta: 'HORA', valor: '{{hora}}' },
        { etiqueta: 'EQUIPO ENTREGADO:', valor: '{{equipo_descripcion}}' }, { etiqueta: 'MARCA:', valor: '{{equipo_marca}}' }, { etiqueta: 'MODELO:', valor: '{{equipo_modelo}}' },
        { etiqueta: 'SERIAL', valor: '{{equipo_serie}}' }, { etiqueta: 'ACCESORIOS:', valor: '{{insumos_resumen}}', span: 2 },
        { etiqueta: 'OTROS EQUIPOS ENTREGADOS:', valor: '{{otros_equipos}}', span: 3 },
        ...quienesFamily(),
      ] },
      constanciaGeneral,
  ]
}

export function hojaMascaraFamily(base) {
  return [
      encFamilyGeneral(base),
      { tipo: 'campos', titulo: 'ENTREGA DE INSUMO', columnas: 3, borde: true, campos: [
        { etiqueta: 'CIUDAD', valor: '{{ciudad}}' }, { etiqueta: 'FECHA', valor: '{{fecha}}' }, { etiqueta: 'HORA', valor: '{{hora}}' },
        { etiqueta: 'INSUMO ENTREGADO:', valor: '{{mascara_descripcion}}' }, { etiqueta: 'MARCA:', valor: '{{mascara_marca}}' }, { etiqueta: 'MODELO:', valor: '{{mascara_modelo}}' },
        { etiqueta: 'REG. INVIMA', valor: '{{mascara_invima}}', span: 3 },
        { etiqueta: 'OTROS EQUIPOS ENTREGADOS:', valor: '{{equipos_resumen}}', span: 3 },
        ...quienesFamily(),
      ] },
      constanciaGeneral,
  ]
}

const SALTO = { tipo: 'salto_pagina' }

// Estándar + pagaré en un solo formato (como el Excel original)
function estandarConPagare(base) {
  const e = estandar(base)
  return {
    ...e,
    descripcion: 'Contrato de arriendo de suministro integral de oxígeno domiciliario, entrega y devolución de equipos, declaración de capacitación, carta de instrucciones y pagaré. Se usa con los clientes que no tienen formato propio.',
    bloques: [...e.bloques, SALTO, ...pagare(base).bloques],
  }
}

// ── Devolución y recarga Ingemedic (Excel "ACTA DE ENTREGA DE EQUIPOS INGEMEDIC",
// que trae entrega, devolución y recarga en una hoja): una plantilla por acción, cada
// una con su parte. Son las de Ingemedic para recoger y recargar.
const encGeneral = base => ({ tipo: 'encabezado', logos: [logo(base, 'logo-ingemedic.png', 50)], ancho_logo: 28,
  centro: [{ texto: 'ACTA GENERAL DE EQUIPOS MEDICOS DOMICILIARIOS O SUMINISTRO OXIGENO DOMICILIARIO', estilo: 'titulo' }] })
const obsGeneral = momento => `OBSERVACIONES: ( Especifique en este campo las observaciones que tenga acerca del estado del equipo en el momento de la ${momento})`
const tablaGeneral = titulo => ({ tipo: 'tabla', fuente: 'equipos', agrupar: 'tipo', titulo, accesorios: [{ etiqueta: 'ACCESORIOS:', valor: '{{insumos_resumen}}' }] })
const constanciaGeneral = { tipo: 'texto', tamano: 11, texto: 'Por medio de la presente acta se hace constar la entrega, devolucion, recarga y tenencia actual de los equipos biomedicos y/o suministros de oxigeno domiciliario en calidad de prestamo . La custodia y buen uso de los equipos entregados antes descritos son responsalidad del paciente o familiar, a partir de la fecha de entrega asumen el compromiso de su cuidado.' }

export function devolucionIngemedic(base) {
  return {
    nombre: 'Acta de devolución Ingemedic',
    descripcion: 'Devolución de equipos médicos domiciliarios o suministro de oxígeno. Se usa al recoger con los clientes que no tienen formato propio.',
    accion: 'devolucion', es_estandar: true,
    bloques: [
      encGeneral(base),
      { tipo: 'titulo', texto: 'DEVOLUCION DE EQUIPOS' },
      { tipo: 'campos', columnas: 3, campos: [{ etiqueta: 'CIUDAD', valor: '{{ciudad}}', span: 2 }, { etiqueta: 'FECHA', valor: '{{fecha}}' }] },
      tablaGeneral('EQUIPOS EN DEVOLUCION'),
      { tipo: 'campos', columnas: 3, campos: [
        // En la devolución recibe Ingemedic y entrega el paciente o su familiar
        { etiqueta: 'QUIEN RECIBE:', valor: '{{entrega_nombre}}', span: 2 }, { etiqueta: 'FIRMA:', firma: 'entrega' },
        { etiqueta: 'QUIEN ENTREGA:', valor: '{{recibe_nombre}}', span: 2 }, { etiqueta: 'FIRMA:', firma: 'recibe' },
        { etiqueta: 'NOMBRE DEL PACIENTE:', valor: '{{paciente_nombre}}', span: 3 },
        { etiqueta: obsGeneral('devolucion'), valor: '{{observaciones}}', span: 3, arriba: true },
      ] },
      constanciaGeneral,
    ],
  }
}

export function recargaIngemedic(base) {
  return {
    nombre: 'Acta de recarga Ingemedic',
    descripcion: 'Recarga de equipos (cilindros de oxígeno). Se usa al recargar con los clientes que no tienen formato propio.',
    accion: 'recarga', es_estandar: true,
    bloques: [
      encGeneral(base),
      { tipo: 'titulo', texto: 'RECARGA DE EQUIPOS' },
      { tipo: 'campos', columnas: 3, campos: [{ etiqueta: 'CIUDAD', valor: '{{ciudad}}', span: 2 }, { etiqueta: 'FECHA', valor: '{{fecha}}' }] },
      tablaGeneral('EQUIPOS RECARGADOS'),
      { tipo: 'campos', columnas: 3, campos: [
        { etiqueta: 'TENENCIA ACTUAL DE EQUIPOS / NOMBRE DEL PACIENTE ACTUAL:', valor: '{{paciente_nombre}}', span: 3 },
        { etiqueta: 'QUIEN RECIBE:', valor: '{{recibe_nombre}}', span: 2 }, { etiqueta: 'FIRMA:', firma: 'recibe' },
        { etiqueta: 'QUIEN ENTREGA:', valor: '{{entrega_nombre}}', span: 2 }, { etiqueta: 'FIRMA:', firma: 'entrega' },
        { etiqueta: 'DIRECCION:', valor: '{{paciente_direccion}}', span: 3 },
        { etiqueta: 'TELEFONO O CELULAR:', valor: '{{recibe_telefono}}', span: 2 }, { etiqueta: 'Correo Electronico:', valor: '{{recibe_correo}}' },
        { etiqueta: obsGeneral('recarga'), valor: '{{observaciones}}', span: 3, arriba: true },
      ] },
      constanciaGeneral,
    ],
  }
}

// Cambio de equipo: como la devolución, pero en los dos sentidos (Ingemedic recibe
// el que sale y entrega el que entra)
export function cambioIngemedic(base) {
  const tabla = (titulo, fuente) => ({ tipo: 'tabla', fuente, agrupar: 'tipo', titulo })
  return {
    nombre: 'Acta de cambio de equipo Ingemedic',
    descripcion: 'Cambio de equipos médicos domiciliarios: el que se retira y el que se entrega. Se usa al cambiar un equipo con los clientes que no tienen formato propio.',
    accion: 'cambio', es_estandar: true,
    bloques: [
      encGeneral(base),
      { tipo: 'titulo', texto: 'CAMBIO DE EQUIPOS' },
      { tipo: 'campos', columnas: 3, campos: [{ etiqueta: 'CIUDAD', valor: '{{ciudad}}' }, { etiqueta: 'FECHA', valor: '{{fecha}}' }, { etiqueta: 'HORA', valor: '{{hora}}' }] },
      tabla('EQUIPOS QUE SE RETIRAN', 'retirados'),
      tabla('EQUIPOS QUE SE ENTREGAN', 'equipos'),
      { tipo: 'campos', columnas: 3, campos: [
        { etiqueta: 'MOTIVO DEL CAMBIO:', valor: '{{motivo_cambio}}', span: 3 },
        { etiqueta: 'QUIEN ENTREGA:', valor: '{{entrega_nombre}}', span: 2 }, { etiqueta: 'FIRMA:', firma: 'entrega' },
        { etiqueta: 'QUIEN RECIBE:', valor: '{{recibe_nombre}}', span: 2 }, { etiqueta: 'FIRMA:', firma: 'recibe' },
        { etiqueta: 'DIRECCION:', valor: '{{paciente_direccion}}', span: 2 }, { etiqueta: 'TELEFONO', valor: '{{recibe_telefono}}' },
        { etiqueta: 'NOMBRE DEL PACIENTE:', valor: '{{paciente_nombre}}', span: 3 },
        { etiqueta: obsGeneral('cambio'), valor: '{{observaciones}}', span: 3, arriba: true },
      ] },
      { tipo: 'texto', tamano: 11, texto: 'Por medio de la presente acta se hace constar el cambio de los equipos biomedicos y/o suministros de oxigeno domiciliario descritos, entregados en calidad de prestamo. Los equipos que se retiran quedan bajo la custodia de INGEMEDIC DE COLOMBIA S.A.S; la custodia y buen uso de los equipos entregados son responsabilidad del paciente o familiar a partir de la fecha de este cambio.' },
    ],
  }
}

// Plantillas y a qué cliente (por nombre en `clientes`) se asignan al cargarlas
export function plantillasBase(supabaseUrl) {
  return [
    { ...estandarConPagare(supabaseUrl), clientes: [] },
    { ...solidaridad(supabaseUrl), clientes: ['SOLIDARIDAD'] },
    { ...asmedc(supabaseUrl), clientes: ['ASMEDC'] },
    // Family / FOMAG: el contrato, un F-FAM-11 por tipo de equipo (con el acta de entrega
    // de equipos y, el de CPAP, la de máscara) y su acta de cambio. Antes era un solo
    // formato con comodato, acta general y F-FAM-11.
    { ...familyComodato(supabaseUrl), clientes: FAMILY },
    ...HOJAS_F11.map(h => ({ ...familyF11(supabaseUrl, h), clientes: FAMILY })),
    { ...cambioFamily(supabaseUrl), clientes: FAMILY },
  ]
}

const FAMILY = ['FAMILY HOMECARE SAS', 'FOMAG']
