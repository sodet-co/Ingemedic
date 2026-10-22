-- ═══ Partes 2 a 5: recoger, recargar y cambiar equipos con acta ═══
-- Cada acción (recogida, recarga, cambio) es una fila de `entregas`, igual que
-- la entrega de un préstamo: a domicilio la hace el repartidor desde su lista;
-- en oficina queda registrada y completada en el momento.
-- Solo agrega columnas: no modifica datos existentes.

-- 1) entregas: qué acción, cómo y con qué equipos
ALTER TABLE entregas ADD COLUMN IF NOT EXISTS modo text NOT NULL DEFAULT 'domicilio';      -- 'domicilio' | 'oficina'
ALTER TABLE entregas ADD COLUMN IF NOT EXISTS fecha_programada timestamptz;               -- cuándo debe ir el repartidor
ALTER TABLE entregas ADD COLUMN IF NOT EXISTS datos jsonb NOT NULL DEFAULT '{}'::jsonb;    -- equipos, cambios, motivo, formatos

-- tipo: 'entrega' (préstamo), 'retiro' (recogida), 'recarga', 'cambio'
DO $$
DECLARE c record;
BEGIN
  FOR c IN SELECT conname FROM pg_constraint
           WHERE conrelid = 'entregas'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%tipo%'
  LOOP
    EXECUTE format('ALTER TABLE entregas DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE entregas ADD CONSTRAINT entregas_tipo_check CHECK (tipo IN ('entrega', 'retiro', 'recarga', 'cambio'));
ALTER TABLE entregas ADD CONSTRAINT entregas_modo_check CHECK (modo IN ('domicilio', 'oficina'));

CREATE INDEX IF NOT EXISTS entregas_orden_tipo_idx ON entregas (orden_id, tipo);

-- 2) ordenes_servicio: recarga periódica
ALTER TABLE ordenes_servicio ADD COLUMN IF NOT EXISTS recarga_cada_dias integer CHECK (recarga_cada_dias IS NULL OR recarga_cada_dias > 0);
ALTER TABLE ordenes_servicio ADD COLUMN IF NOT EXISTS ultima_recarga timestamptz;

-- 3) Verificación
--    a) las 5 columnas nuevas
SELECT table_name, column_name FROM information_schema.columns
WHERE (table_name = 'entregas' AND column_name IN ('modo', 'fecha_programada', 'datos'))
   OR (table_name = 'ordenes_servicio' AND column_name IN ('recarga_cada_dias', 'ultima_recarga'))
ORDER BY table_name, column_name;
--    b) RLS y políticas de las tablas que tocan estos flujos (el repartidor actualiza
--       entregas, orden_equipos, equipos y ordenes_servicio al completar una recogida o un cambio)
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename IN ('entregas', 'orden_equipos', 'equipos', 'ordenes_servicio', 'actas');
SELECT tablename, policyname, cmd, roles FROM pg_policies
WHERE tablename IN ('entregas', 'orden_equipos', 'equipos', 'ordenes_servicio', 'actas') ORDER BY tablename, cmd;
