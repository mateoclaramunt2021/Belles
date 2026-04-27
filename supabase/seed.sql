-- ============================================================
-- TransControl Belles — Datos iniciales (seed)
-- Ejecutar DESPUÉS del schema.sql
-- IMPORTANTE: Primero crear el usuario admin en Auth de Supabase,
--             luego ejecutar este archivo, luego actualizar su rol.
-- ============================================================

-- ============================================================
-- CLIENTES
-- ============================================================
INSERT INTO clientes (nombre, rut, activo) VALUES
  ('Urufor SA',       '210145670018', true),
  ('Altercargo SRL',  NULL,           true),
  ('Ciemsa SA',       NULL,           true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- CAMIONES (9 camiones de la flota)
-- ============================================================
INSERT INTO camiones (matricula, estado, km_actual) VALUES
  ('FTP2558', 'activo', 0),
  ('FTP3448', 'activo', 0),
  ('FTP3556', 'activo', 0),
  ('FTP4123', 'activo', 0),
  ('FTP4456', 'activo', 0),
  ('FTP5001', 'activo', 0),
  ('FTP5234', 'activo', 0),
  ('FTP6001', 'activo', 0),
  ('FTP6789', 'activo', 0)
ON CONFLICT (matricula) DO NOTHING;

-- ============================================================
-- TARIFAS — Urufor SA
-- ============================================================
INSERT INTO tarifas (cliente_id, destino, precio_por_tonelada, vigente_desde, activo)
SELECT c.id, 'Durazno', 670,  '2026-01-01', true FROM clientes c WHERE c.nombre = 'Urufor SA'
ON CONFLICT DO NOTHING;

INSERT INTO tarifas (cliente_id, destino, precio_por_tonelada, vigente_desde, activo)
SELECT c.id, 'Tecomar', 1075, '2026-01-01', true FROM clientes c WHERE c.nombre = 'Urufor SA'
ON CONFLICT DO NOTHING;

INSERT INTO tarifas (cliente_id, destino, precio_por_tonelada, vigente_desde, activo)
SELECT c.id, 'La Punta', 1075, '2026-01-01', true FROM clientes c WHERE c.nombre = 'Urufor SA'
ON CONFLICT DO NOTHING;

INSERT INTO tarifas (cliente_id, destino, precio_por_tonelada, vigente_desde, activo)
SELECT c.id, 'Schandy', 1075, '2026-01-01', true FROM clientes c WHERE c.nombre = 'Urufor SA'
ON CONFLICT DO NOTHING;

-- ============================================================
-- INSTRUCCIONES FINALES:
-- 1. Ir a Authentication > Users en Supabase
-- 2. Crear usuario admin con email + contraseña
-- 3. Ejecutar esto para darle rol admin:
--    UPDATE usuarios SET rol = 'admin' WHERE email = 'tu-email@ejemplo.com';
-- 4. Crear los 9 choferes de la misma forma
-- ============================================================
