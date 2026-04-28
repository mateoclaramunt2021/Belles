-- ============================================================
-- TransControl Belles — Migración v2
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- ============================================================
-- NUEVOS ENUMS
-- ============================================================
DO $$ BEGIN
  CREATE TYPE precio_tipo AS ENUM ('tonelada', 'unidad', 'viaje');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE incidente_tipo AS ENUM ('averia', 'accidente', 'demora', 'gasto_extra', 'otro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE mensaje_tipo AS ENUM ('texto', 'foto', 'documento');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- AMPLIAR TABLA viajes — nuevos campos
-- ============================================================

-- Flota
ALTER TABLE viajes ADD COLUMN IF NOT EXISTS mat_zorra TEXT NOT NULL DEFAULT '';

-- Fechas separadas (carga y descarga)
ALTER TABLE viajes ADD COLUMN IF NOT EXISTS fecha_carga DATE;
ALTER TABLE viajes ADD COLUMN IF NOT EXISTS fecha_descarga DATE;

-- Horas de entrada/salida
ALTER TABLE viajes ADD COLUMN IF NOT EXISTS hora_entrada_carga TIME;
ALTER TABLE viajes ADD COLUMN IF NOT EXISTS hora_salida_carga TIME;
ALTER TABLE viajes ADD COLUMN IF NOT EXISTS hora_entrada_descarga TIME;
ALTER TABLE viajes ADD COLUMN IF NOT EXISTS hora_salida_descarga TIME;

-- Kilómetros de odómetro
ALTER TABLE viajes ADD COLUMN IF NOT EXISTS km_carga NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE viajes ADD COLUMN IF NOT EXISTS km_descarga NUMERIC NOT NULL DEFAULT 0;

-- Pesos
ALTER TABLE viajes ADD COLUMN IF NOT EXISTS kg_bruto NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE viajes ADD COLUMN IF NOT EXISTS kg_tara NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE viajes ADD COLUMN IF NOT EXISTS kg_neto NUMERIC NOT NULL DEFAULT 0;

-- Remitos (carga y descarga)
ALTER TABLE viajes ADD COLUMN IF NOT EXISTS numero_remito_carga TEXT NOT NULL DEFAULT '';
ALTER TABLE viajes ADD COLUMN IF NOT EXISTS numero_remito_descarga TEXT NOT NULL DEFAULT '';

-- Número de planilla interna
ALTER TABLE viajes ADD COLUMN IF NOT EXISTS numero_planilla TEXT NOT NULL DEFAULT '';

-- Facturación
ALTER TABLE viajes ADD COLUMN IF NOT EXISTS tipo_precio precio_tipo NOT NULL DEFAULT 'tonelada';
ALTER TABLE viajes ADD COLUMN IF NOT EXISTS precio_por_unidad NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE viajes ADD COLUMN IF NOT EXISTS imprevistos NUMERIC NOT NULL DEFAULT 0;

-- Cobro
ALTER TABLE viajes ADD COLUMN IF NOT EXISTS medio_pago TEXT;
ALTER TABLE viajes ADD COLUMN IF NOT EXISTS fecha_cobro DATE;
ALTER TABLE viajes ADD COLUMN IF NOT EXISTS numero_factura TEXT;

-- Segunda foto (remito descarga)
ALTER TABLE viajes ADD COLUMN IF NOT EXISTS foto_remito_descarga_url TEXT;

-- Migrar numero_remito → numero_remito_carga en registros existentes
UPDATE viajes
SET numero_remito_carga = numero_remito
WHERE numero_remito_carga = '' AND numero_remito != '';

-- Migrar fecha → fecha_carga en registros existentes
UPDATE viajes
SET fecha_carga = fecha
WHERE fecha_carga IS NULL;

-- ============================================================
-- NUEVA TABLA: viaje_gasoil (múltiples cargas por viaje)
-- ============================================================
CREATE TABLE IF NOT EXISTS viaje_gasoil (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  viaje_id  UUID NOT NULL REFERENCES viajes(id) ON DELETE CASCADE,
  litros    NUMERIC NOT NULL DEFAULT 0,
  km        NUMERIC NOT NULL DEFAULT 0,
  estacion  TEXT NOT NULL DEFAULT '',
  importe   NUMERIC NOT NULL DEFAULT 0,
  orden     INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_viaje_gasoil_viaje ON viaje_gasoil(viaje_id);

-- Migrar registros de gasoil existentes a la nueva tabla
INSERT INTO viaje_gasoil (viaje_id, litros, km, estacion, importe, orden)
SELECT id, litros_gasoil, km_descarga, '', gasto_gasoil, 1
FROM viajes
WHERE litros_gasoil > 0
ON CONFLICT DO NOTHING;

-- ============================================================
-- NUEVA TABLA: incidentes (gastos imprevistos por viaje)
-- ============================================================
CREATE TABLE IF NOT EXISTS incidentes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  viaje_id    UUID NOT NULL REFERENCES viajes(id) ON DELETE CASCADE,
  tipo        incidente_tipo NOT NULL DEFAULT 'otro',
  descripcion TEXT NOT NULL DEFAULT '',
  importe     NUMERIC NOT NULL DEFAULT 0,
  foto_url    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incidentes_viaje ON incidentes(viaje_id);

-- ============================================================
-- NUEVA TABLA: mensajes (chat interno)
-- ============================================================
CREATE TABLE IF NOT EXISTS mensajes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  de_usuario_id   UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  para_usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
  contenido       TEXT NOT NULL DEFAULT '',
  tipo            mensaje_tipo NOT NULL DEFAULT 'texto',
  archivo_url     TEXT,
  leido           BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mensajes_de    ON mensajes(de_usuario_id);
CREATE INDEX IF NOT EXISTS idx_mensajes_para  ON mensajes(para_usuario_id);
CREATE INDEX IF NOT EXISTS idx_mensajes_fecha ON mensajes(created_at);

-- Activar Realtime para mensajes
ALTER PUBLICATION supabase_realtime ADD TABLE mensajes;

-- ============================================================
-- NUEVA TABLA: zorras (semi-remolques)
-- ============================================================
CREATE TABLE IF NOT EXISTS zorras (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  matricula  TEXT NOT NULL UNIQUE,
  estado     camion_estado NOT NULL DEFAULT 'activo',
  notas      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- AMPLIAR TABLA camiones — agregar tipo
-- ============================================================
ALTER TABLE camiones ADD COLUMN IF NOT EXISTS marca TEXT;
ALTER TABLE camiones ADD COLUMN IF NOT EXISTS modelo TEXT;
ALTER TABLE camiones ADD COLUMN IF NOT EXISTS anio INTEGER;
ALTER TABLE camiones ADD COLUMN IF NOT EXISTS km_mantenimiento NUMERIC NOT NULL DEFAULT 0;

-- ============================================================
-- AMPLIAR TABLA clientes — agregar campos útiles
-- ============================================================
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS direccion TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS ciudad TEXT;

-- ============================================================
-- AMPLIAR TABLA choferes_detalle — campos útiles
-- ============================================================
ALTER TABLE choferes_detalle ADD COLUMN IF NOT EXISTS cedula TEXT;
ALTER TABLE choferes_detalle ADD COLUMN IF NOT EXISTS fecha_venc_licencia DATE;
ALTER TABLE choferes_detalle ADD COLUMN IF NOT EXISTS notas TEXT;

-- ============================================================
-- ÍNDICES adicionales para performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_viajes_fecha_carga    ON viajes(fecha_carga);
CREATE INDEX IF NOT EXISTS idx_viajes_fecha_descarga ON viajes(fecha_descarga);
CREATE INDEX IF NOT EXISTS idx_viajes_mat_zorra      ON viajes(mat_zorra);
CREATE INDEX IF NOT EXISTS idx_viajes_planilla       ON viajes(numero_planilla);

-- ============================================================
-- RLS — nuevas tablas
-- ============================================================

-- viaje_gasoil
ALTER TABLE viaje_gasoil ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "viaje_gasoil_select" ON viaje_gasoil;
CREATE POLICY "viaje_gasoil_select" ON viaje_gasoil
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM viajes v
      WHERE v.id = viaje_gasoil.viaje_id
        AND (v.chofer_id = auth.uid() OR get_user_role() = 'admin')
    )
  );

DROP POLICY IF EXISTS "viaje_gasoil_insert" ON viaje_gasoil;
CREATE POLICY "viaje_gasoil_insert" ON viaje_gasoil
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "viaje_gasoil_update" ON viaje_gasoil;
CREATE POLICY "viaje_gasoil_update" ON viaje_gasoil
  FOR UPDATE USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "viaje_gasoil_delete" ON viaje_gasoil;
CREATE POLICY "viaje_gasoil_delete" ON viaje_gasoil
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- incidentes
ALTER TABLE incidentes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "incidentes_select" ON incidentes;
CREATE POLICY "incidentes_select" ON incidentes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM viajes v
      WHERE v.id = incidentes.viaje_id
        AND (v.chofer_id = auth.uid() OR get_user_role() = 'admin')
    )
  );

DROP POLICY IF EXISTS "incidentes_insert" ON incidentes;
CREATE POLICY "incidentes_insert" ON incidentes
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "incidentes_modify" ON incidentes;
CREATE POLICY "incidentes_modify" ON incidentes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM viajes v
      WHERE v.id = incidentes.viaje_id
        AND (v.chofer_id = auth.uid() OR get_user_role() = 'admin')
    )
  );

-- mensajes
ALTER TABLE mensajes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mensajes_select" ON mensajes;
CREATE POLICY "mensajes_select" ON mensajes
  FOR SELECT USING (
    de_usuario_id = auth.uid() OR
    para_usuario_id = auth.uid() OR
    get_user_role() = 'admin'
  );

DROP POLICY IF EXISTS "mensajes_insert" ON mensajes;
CREATE POLICY "mensajes_insert" ON mensajes
  FOR INSERT WITH CHECK (de_usuario_id = auth.uid());

DROP POLICY IF EXISTS "mensajes_update" ON mensajes;
CREATE POLICY "mensajes_update" ON mensajes
  FOR UPDATE USING (
    de_usuario_id = auth.uid() OR get_user_role() = 'admin'
  );

-- zorras
ALTER TABLE zorras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "zorras_select" ON zorras;
CREATE POLICY "zorras_select" ON zorras
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "zorras_modify" ON zorras;
CREATE POLICY "zorras_modify" ON zorras
  FOR ALL USING (get_user_role() = 'admin');

-- ============================================================
-- STORAGE — bucket viajes-fotos (fotos de remitos e incidentes)
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'viajes-fotos',
  'viajes-fotos',
  true,
  20971520, -- 20MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "viajes_fotos_upload" ON storage.objects;
CREATE POLICY "viajes_fotos_upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'viajes-fotos' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "viajes_fotos_select" ON storage.objects;
CREATE POLICY "viajes_fotos_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'viajes-fotos');

DROP POLICY IF EXISTS "viajes_fotos_delete" ON storage.objects;
CREATE POLICY "viajes_fotos_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'viajes-fotos' AND get_user_role() = 'admin');
