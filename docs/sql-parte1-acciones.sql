-- ═══ Parte 1: cada plantilla es de una acción (préstamo, devolución, recarga, cambio) ═══

-- 1) Deshacer el SQL anterior (versión descartada). Los bloques originales salen
--    del respaldo bkp_plantillas_acta_20261022, que se hizo antes de ese SQL.
UPDATE plantillas_acta p SET bloques = b.bloques
FROM bkp_plantillas_acta_20261022 b
WHERE p.id = b.id AND p.id IN ('2d7888d6-c2fb-4d0c-9303-7e1699326733', '767e1608-91a3-4804-a345-60b031cb4229');

DELETE FROM plantillas_acta WHERE nombre = 'Acta general Ingemedic (entrega, devolución y recarga)'
  AND NOT EXISTS (SELECT 1 FROM actas a WHERE a.plantilla_id = plantillas_acta.id);

DELETE FROM cliente_plantillas_acta WHERE accion <> 'prestamo';
ALTER TABLE cliente_plantillas_acta DROP CONSTRAINT IF EXISTS cliente_plantillas_acta_pkey;
ALTER TABLE cliente_plantillas_acta DROP COLUMN IF EXISTS accion;
ALTER TABLE cliente_plantillas_acta ADD PRIMARY KEY (cliente_id, plantilla_id);

ALTER TABLE plantillas_acta DROP COLUMN IF EXISTS acciones;
ALTER TABLE plantillas_acta DROP COLUMN IF EXISTS estandar_en;

-- 2) Columnas nuevas (las plantillas que ya existen quedan como de préstamo)
ALTER TABLE plantillas_acta ADD COLUMN IF NOT EXISTS accion text NOT NULL DEFAULT 'prestamo';
ALTER TABLE actas ADD COLUMN IF NOT EXISTS accion text NOT NULL DEFAULT 'prestamo';

-- La de Ingemedic (es_estandar) pasa de ser una sola en total a una por acción
DROP INDEX IF EXISTS plantillas_acta_una_estandar;
CREATE UNIQUE INDEX plantillas_acta_una_estandar ON plantillas_acta (accion) WHERE es_estandar AND activo;

-- 3) Plantillas de Ingemedic para devolución y recarga (del Excel ACTA DE ENTREGA DE EQUIPOS INGEMEDIC)
INSERT INTO plantillas_acta (nombre, descripcion, bloques, accion, tipo, es_estandar, uso_general, activo)
SELECT 'Acta de devolución Ingemedic', 'Devolución de equipos médicos domiciliarios o suministro de oxígeno. Se usa al recoger con los clientes que no tienen formato propio.', $bloques$[{"tipo": "encabezado", "logos": [{"url": "https://olxkbdomwvdrcjhwppec.supabase.co/storage/v1/object/public/logos/logo-ingemedic.png", "alto": 50}], "ancho_logo": 28, "centro": [{"texto": "ACTA GENERAL DE EQUIPOS MEDICOS DOMICILIARIOS O SUMINISTRO OXIGENO DOMICILIARIO", "estilo": "titulo"}]}, {"tipo": "titulo", "texto": "DEVOLUCION DE EQUIPOS"}, {"tipo": "campos", "columnas": 3, "campos": [{"etiqueta": "CIUDAD", "valor": "{{ciudad}}", "span": 2}, {"etiqueta": "FECHA", "valor": "{{fecha}}"}]}, {"tipo": "tabla", "fuente": "equipos", "agrupar": "tipo", "titulo": "EQUIPOS EN DEVOLUCION", "accesorios": [{"etiqueta": "ACCESORIOS:", "valor": "{{insumos_resumen}}"}]}, {"tipo": "campos", "columnas": 3, "campos": [{"etiqueta": "QUIEN RECIBE:", "valor": "{{entrega_nombre}}", "span": 2}, {"etiqueta": "FIRMA:", "firma": "entrega"}, {"etiqueta": "QUIEN ENTREGA:", "valor": "{{recibe_nombre}}", "span": 2}, {"etiqueta": "FIRMA:", "firma": "recibe"}, {"etiqueta": "NOMBRE DEL PACIENTE:", "valor": "{{paciente_nombre}}", "span": 3}, {"etiqueta": "OBSERVACIONES: ( Especifique en este campo las observaciones que tenga acerca del estado del equipo en el momento de la devolucion)", "valor": "{{observaciones}}", "span": 3, "arriba": true}]}, {"tipo": "texto", "tamano": 11, "texto": "Por medio de la presente acta se hace constar la entrega, devolucion, recarga y tenencia actual de los equipos biomedicos y/o suministros de oxigeno domiciliario en calidad de prestamo . La custodia y buen uso de los equipos entregados antes descritos son responsalidad del paciente o familiar, a partir de la fecha de entrega asumen el compromiso de su cuidado."}]$bloques$::jsonb,
  'devolucion', 'entrega', true, false, true
WHERE NOT EXISTS (SELECT 1 FROM plantillas_acta WHERE nombre = 'Acta de devolución Ingemedic');
INSERT INTO plantillas_acta (nombre, descripcion, bloques, accion, tipo, es_estandar, uso_general, activo)
SELECT 'Acta de recarga Ingemedic', 'Recarga de equipos (cilindros de oxígeno). Se usa al recargar con los clientes que no tienen formato propio.', $bloques$[{"tipo": "encabezado", "logos": [{"url": "https://olxkbdomwvdrcjhwppec.supabase.co/storage/v1/object/public/logos/logo-ingemedic.png", "alto": 50}], "ancho_logo": 28, "centro": [{"texto": "ACTA GENERAL DE EQUIPOS MEDICOS DOMICILIARIOS O SUMINISTRO OXIGENO DOMICILIARIO", "estilo": "titulo"}]}, {"tipo": "titulo", "texto": "RECARGA DE EQUIPOS"}, {"tipo": "campos", "columnas": 3, "campos": [{"etiqueta": "CIUDAD", "valor": "{{ciudad}}", "span": 2}, {"etiqueta": "FECHA", "valor": "{{fecha}}"}]}, {"tipo": "tabla", "fuente": "equipos", "agrupar": "tipo", "titulo": "EQUIPOS RECARGADOS", "accesorios": [{"etiqueta": "ACCESORIOS:", "valor": "{{insumos_resumen}}"}]}, {"tipo": "campos", "columnas": 3, "campos": [{"etiqueta": "TENENCIA ACTUAL DE EQUIPOS / NOMBRE DEL PACIENTE ACTUAL:", "valor": "{{paciente_nombre}}", "span": 3}, {"etiqueta": "QUIEN RECIBE:", "valor": "{{recibe_nombre}}", "span": 2}, {"etiqueta": "FIRMA:", "firma": "recibe"}, {"etiqueta": "QUIEN ENTREGA:", "valor": "{{entrega_nombre}}", "span": 2}, {"etiqueta": "FIRMA:", "firma": "entrega"}, {"etiqueta": "DIRECCION:", "valor": "{{paciente_direccion}}", "span": 3}, {"etiqueta": "TELEFONO O CELULAR:", "valor": "{{recibe_telefono}}", "span": 2}, {"etiqueta": "Correo Electronico:", "valor": "{{recibe_correo}}"}, {"etiqueta": "OBSERVACIONES: ( Especifique en este campo las observaciones que tenga acerca del estado del equipo en el momento de la recarga)", "valor": "{{observaciones}}", "span": 3, "arriba": true}]}, {"tipo": "texto", "tamano": 11, "texto": "Por medio de la presente acta se hace constar la entrega, devolucion, recarga y tenencia actual de los equipos biomedicos y/o suministros de oxigeno domiciliario en calidad de prestamo . La custodia y buen uso de los equipos entregados antes descritos son responsalidad del paciente o familiar, a partir de la fecha de entrega asumen el compromiso de su cuidado."}]$bloques$::jsonb,
  'recarga', 'entrega', true, false, true
WHERE NOT EXISTS (SELECT 1 FROM plantillas_acta WHERE nombre = 'Acta de recarga Ingemedic');

-- 4) Verificación
--    a) estándar: prestamo / true; las dos nuevas: devolucion / true y recarga / true
--    b) el estándar y Family sin marcas de acción (debe salir 0 en las dos)
--    c) asignaciones: 7 filas
SELECT nombre, accion, es_estandar FROM plantillas_acta WHERE activo ORDER BY accion, nombre;
SELECT nombre, (bloques::text LIKE '%"accion"%')::int AS marcas FROM plantillas_acta
WHERE id IN ('2d7888d6-c2fb-4d0c-9303-7e1699326733', '767e1608-91a3-4804-a345-60b031cb4229');
SELECT count(*) AS asignaciones FROM cliente_plantillas_acta;
