-- ============================================================
-- TransControl Belles — Schema completo de Supabase
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- Extensión UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUMS
-- ============================================================
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('chofer', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE camion_estado AS ENUM ('activo', 'taller', 'inactivo');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE cobro_estado AS ENUM ('pendiente', 'cobrado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE liquidacion_estado AS ENUM ('abierta', 'cerrada', 'cobrada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- TABLA: usuarios
-- Se llena automáticamente al crear usuario en Auth
-- ============================================================
CREATE TABLE IF NOT EXISTS usuarios (
  id        UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email     TEXT NOT NULL,
  nombre    TEXT NOT NULL,
  rol       user_role NOT NULL DEFAULT 'chofer',
  activo    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: camiones
-- ============================================================
CREATE TABLE IF NOT EXISTS camiones (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  matricula           TEXT NOT NULL UNIQUE,
  remolque            TEXT,
  estado              camion_estado NOT NULL DEFAULT 'activo',
  chofer_asignado_id  UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  km_actual           NUMERIC NOT NULL DEFAULT 0,
  notas               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: choferes_detalle
-- ============================================================
CREATE TABLE IF NOT EXISTS choferes_detalle (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id         UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nombre_completo    TEXT NOT NULL,
  telefono           TEXT NOT NULL DEFAULT '',
  licencia           TEXT NOT NULL DEFAULT '',
  camion_asignado_id UUID REFERENCES camiones(id) ON DELETE SET NULL,
  activo             BOOLEAN NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: clientes
-- ============================================================
CREATE TABLE IF NOT EXISTS clientes (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre     TEXT NOT NULL,
  rut        TEXT,
  contacto   TEXT,
  activo     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: tarifas
-- ============================================================
CREATE TABLE IF NOT EXISTS tarifas (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente_id          UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  destino             TEXT NOT NULL,
  precio_por_tonelada NUMERIC NOT NULL CHECK (precio_por_tonelada > 0),
  vigente_desde       DATE NOT NULL DEFAULT CURRENT_DATE,
  activo              BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: viajes
-- ============================================================
CREATE TABLE IF NOT EXISTS viajes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fecha           DATE NOT NULL,
  numero_remito   TEXT NOT NULL,
  matricula       TEXT NOT NULL,
  camion_id       UUID REFERENCES camiones(id) ON DELETE SET NULL,
  chofer_id       UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  chofer_nombre   TEXT NOT NULL DEFAULT '',
  cliente_id      UUID REFERENCES clientes(id) ON DELETE SET NULL,
  cliente_nombre  TEXT NOT NULL DEFAULT '',
  origen          TEXT NOT NULL DEFAULT '',
  destino         TEXT NOT NULL DEFAULT '',
  mercaderia      TEXT NOT NULL DEFAULT '',
  km              NUMERIC NOT NULL DEFAULT 0,
  toneladas       NUMERIC NOT NULL CHECK (toneladas > 0),
  tarifa_aplicada NUMERIC NOT NULL DEFAULT 0,
  importe         NUMERIC NOT NULL DEFAULT 0,
  gasto_gasoil    NUMERIC NOT NULL DEFAULT 0,
  litros_gasoil   NUMERIC NOT NULL DEFAULT 0,
  comision        NUMERIC NOT NULL DEFAULT 0,
  peajes          NUMERIC NOT NULL DEFAULT 0,
  estado_cobro    cobro_estado NOT NULL DEFAULT 'pendiente',
  foto_url        TEXT,
  notas           TEXT,
  created_by      UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: liquidaciones
-- ============================================================
CREATE TABLE IF NOT EXISTS liquidaciones (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  periodo       TEXT NOT NULL UNIQUE,
  fecha_inicio  DATE NOT NULL,
  fecha_fin     DATE NOT NULL,
  total_importe NUMERIC NOT NULL DEFAULT 0,
  total_viajes  INTEGER NOT NULL DEFAULT 0,
  estado        liquidacion_estado NOT NULL DEFAULT 'abierta',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES para performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_viajes_fecha        ON viajes(fecha);
CREATE INDEX IF NOT EXISTS idx_viajes_chofer_id    ON viajes(chofer_id);
CREATE INDEX IF NOT EXISTS idx_viajes_cliente_id   ON viajes(cliente_id);
CREATE INDEX IF NOT EXISTS idx_viajes_camion_id    ON viajes(camion_id);
CREATE INDEX IF NOT EXISTS idx_viajes_estado_cobro ON viajes(estado_cobro);
CREATE INDEX IF NOT EXISTS idx_viajes_matricula    ON viajes(matricula);

-- ============================================================
-- FUNCIÓN: obtener rol del usuario
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT rol FROM usuarios WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE usuarios        ENABLE ROW LEVEL SECURITY;
ALTER TABLE camiones        ENABLE ROW LEVEL SECURITY;
ALTER TABLE choferes_detalle ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE tarifas         ENABLE ROW LEVEL SECURITY;
ALTER TABLE viajes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE liquidaciones   ENABLE ROW LEVEL SECURITY;

-- Políticas: usuarios
DROP POLICY IF EXISTS "usuarios_select" ON usuarios;
CREATE POLICY "usuarios_select" ON usuarios
  FOR SELECT USING (id = auth.uid() OR get_user_role() = 'admin');

DROP POLICY IF EXISTS "usuarios_insert" ON usuarios;
CREATE POLICY "usuarios_insert" ON usuarios
  FOR INSERT WITH CHECK (true); -- Trigger maneja el insert

DROP POLICY IF EXISTS "usuarios_update" ON usuarios;
CREATE POLICY "usuarios_update" ON usuarios
  FOR UPDATE USING (id = auth.uid() OR get_user_role() = 'admin');

-- Políticas: camiones (todos ven, solo admin modifica)
DROP POLICY IF EXISTS "camiones_select" ON camiones;
CREATE POLICY "camiones_select" ON camiones
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "camiones_modify" ON camiones;
CREATE POLICY "camiones_modify" ON camiones
  FOR ALL USING (get_user_role() = 'admin');

-- Políticas: choferes_detalle
DROP POLICY IF EXISTS "choferes_select" ON choferes_detalle;
CREATE POLICY "choferes_select" ON choferes_detalle
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "choferes_modify" ON choferes_detalle;
CREATE POLICY "choferes_modify" ON choferes_detalle
  FOR ALL USING (get_user_role() = 'admin');

-- Políticas: clientes
DROP POLICY IF EXISTS "clientes_select" ON clientes;
CREATE POLICY "clientes_select" ON clientes
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "clientes_modify" ON clientes;
CREATE POLICY "clientes_modify" ON clientes
  FOR ALL USING (get_user_role() = 'admin');

-- Políticas: tarifas
DROP POLICY IF EXISTS "tarifas_select" ON tarifas;
CREATE POLICY "tarifas_select" ON tarifas
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "tarifas_modify" ON tarifas;
CREATE POLICY "tarifas_modify" ON tarifas
  FOR ALL USING (get_user_role() = 'admin');

-- Políticas: viajes
DROP POLICY IF EXISTS "viajes_select" ON viajes;
CREATE POLICY "viajes_select" ON viajes
  FOR SELECT USING (
    chofer_id = auth.uid() OR get_user_role() = 'admin'
  );

DROP POLICY IF EXISTS "viajes_insert" ON viajes;
CREATE POLICY "viajes_insert" ON viajes
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "viajes_update" ON viajes;
CREATE POLICY "viajes_update" ON viajes
  FOR UPDATE USING (
    chofer_id = auth.uid() OR get_user_role() = 'admin'
  );

DROP POLICY IF EXISTS "viajes_delete" ON viajes;
CREATE POLICY "viajes_delete" ON viajes
  FOR DELETE USING (get_user_role() = 'admin');

-- Políticas: liquidaciones (solo admin)
DROP POLICY IF EXISTS "liquidaciones_select" ON liquidaciones;
CREATE POLICY "liquidaciones_select" ON liquidaciones
  FOR SELECT USING (get_user_role() = 'admin');

DROP POLICY IF EXISTS "liquidaciones_modify" ON liquidaciones;
CREATE POLICY "liquidaciones_modify" ON liquidaciones
  FOR ALL USING (get_user_role() = 'admin');

-- ============================================================
-- STORAGE: bucket para fotos de remitos
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'remitos', 
  'remitos', 
  true,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "remitos_upload" ON storage.objects;
CREATE POLICY "remitos_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'remitos' AND auth.uid() IS NOT NULL
  );

DROP POLICY IF EXISTS "remitos_select" ON storage.objects;
CREATE POLICY "remitos_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'remitos');

DROP POLICY IF EXISTS "remitos_delete" ON storage.objects;
CREATE POLICY "remitos_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'remitos' AND get_user_role() = 'admin'
  );

-- ============================================================
-- TRIGGER: crear perfil al registrar usuario en Auth
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO usuarios (id, email, nombre, rol)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)),
    COALESCE((NEW.raw_user_meta_data->>'rol')::user_role, 'chofer')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
