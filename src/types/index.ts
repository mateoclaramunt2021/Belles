export type UserRole = 'chofer' | 'admin'
export type TipoPrecio = 'tonelada' | 'unidad' | 'viaje'
export type IncidenteTipo = 'averia' | 'accidente' | 'demora' | 'gasto_extra' | 'otro'
export type MensajeTipo = 'texto' | 'foto' | 'documento'

export interface Usuario {
  id: string
  email: string
  nombre: string
  rol: UserRole
  activo: boolean
  created_at: string
}

export interface Camion {
  id: string
  matricula: string
  remolque: string | null
  estado: 'activo' | 'taller' | 'inactivo'
  chofer_asignado_id: string | null
  km_actual: number
  km_mantenimiento: number
  marca: string | null
  modelo: string | null
  anio: number | null
  notas: string | null
  created_at: string
  chofer?: Usuario
}

export interface Zorra {
  id: string
  matricula: string
  estado: 'activo' | 'taller' | 'inactivo'
  notas: string | null
  created_at: string
}

export interface ChoferDetalle {
  id: string
  usuario_id: string
  nombre_completo: string
  telefono: string
  licencia: string
  cedula: string | null
  fecha_venc_licencia: string | null
  camion_asignado_id: string | null
  activo: boolean
  notas: string | null
  created_at: string
  usuario?: Usuario
  camion?: Camion
}

export interface Cliente {
  id: string
  nombre: string
  rut: string | null
  contacto: string | null
  direccion: string | null
  email: string | null
  ciudad: string | null
  activo: boolean
  created_at: string
}

export interface Tarifa {
  id: string
  cliente_id: string
  destino: string
  precio_por_tonelada: number
  vigente_desde: string
  activo: boolean
  created_at: string
  cliente?: Cliente
}

export interface ViajeGasoil {
  id: string
  viaje_id: string
  litros: number
  km: number
  estacion: string
  importe: number
  orden: number
  created_at: string
}

export interface Incidente {
  id: string
  viaje_id: string
  tipo: IncidenteTipo
  descripcion: string
  importe: number
  foto_url: string | null
  created_at: string
}

export interface Viaje {
  id: string
  // Fechas
  fecha: string
  fecha_carga: string | null
  fecha_descarga: string | null
  hora_entrada_carga: string | null
  hora_salida_carga: string | null
  hora_entrada_descarga: string | null
  hora_salida_descarga: string | null
  // Identificación
  numero_remito: string
  numero_remito_carga: string
  numero_remito_descarga: string
  numero_planilla: string
  // Flota
  matricula: string
  mat_zorra: string
  camion_id: string | null
  chofer_id: string | null
  chofer_nombre: string
  // Cliente y ruta
  cliente_id: string | null
  cliente_nombre: string
  origen: string
  destino: string
  mercaderia: string
  // Km odómetro
  km: number
  km_carga: number
  km_descarga: number
  // Pesos
  kg_bruto: number
  kg_tara: number
  kg_neto: number
  toneladas: number
  // Facturación
  tipo_precio: TipoPrecio
  tarifa_aplicada: number
  precio_por_unidad: number
  importe: number
  // Gastos
  gasto_gasoil: number
  litros_gasoil: number
  comision: number
  peajes: number
  imprevistos: number
  // Cobro
  estado_cobro: 'pendiente' | 'cobrado'
  medio_pago: string | null
  fecha_cobro: string | null
  numero_factura: string | null
  // Fotos
  foto_url: string | null
  foto_remito_descarga_url: string | null
  notas: string | null
  created_by: string | null
  created_at: string
  // Relations
  camion?: Camion
  chofer?: Usuario
  cliente?: Cliente
  gasoil?: ViajeGasoil[]
  incidentes_detalle?: Incidente[]
}

export interface Liquidacion {
  id: string
  periodo: string
  fecha_inicio: string
  fecha_fin: string
  total_importe: number
  total_viajes: number
  estado: 'abierta' | 'cerrada' | 'cobrada'
  created_at: string
}

export interface Mensaje {
  id: string
  de_usuario_id: string
  para_usuario_id: string | null
  contenido: string
  tipo: MensajeTipo
  archivo_url: string | null
  leido: boolean
  created_at: string
  de_usuario?: Usuario
  para_usuario?: Usuario
}

export interface DashboardKPIs {
  ingresos_mes: number
  beneficio_neto: number
  total_viajes_mes: number
  gasto_gasoil_mes: number
  toneladas_mes: number
  pendientes_cobro: number
  pendientes_monto: number
}

export interface OCRResult {
  fecha?: string
  numero_remito?: string
  matricula?: string
  mat_zorra?: string
  chofer?: string
  destino?: string
  origen?: string
  toneladas?: number
  kg_bruto?: number
  kg_tara?: number
  kg_neto?: number
  cliente?: string
  mercaderia?: string
  litros_gasoil?: number
  km_carga?: number
  km_descarga?: number
}

export interface GraficoMensual {
  mes: string
  ingresos: number
  gastos: number
}

export interface GraficoCamion {
  matricula: string
  ingresos: number
  viajes: number
}

export interface TableColumn<T> {
  key: keyof T | string
  header: string
  render?: (value: unknown, row: T) => React.ReactNode
  className?: string
}
