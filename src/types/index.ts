// ============================================
// TransControl Belles — Tipos TypeScript
// ============================================

export type UserRole = 'chofer' | 'admin'

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
  notas: string | null
  created_at: string
  chofer?: Usuario
}

export interface ChoferDetalle {
  id: string
  usuario_id: string
  nombre_completo: string
  telefono: string
  licencia: string
  camion_asignado_id: string | null
  activo: boolean
  created_at: string
  usuario?: Usuario
  camion?: Camion
}

export interface Cliente {
  id: string
  nombre: string
  rut: string | null
  contacto: string | null
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

export interface Viaje {
  id: string
  fecha: string
  numero_remito: string
  matricula: string
  camion_id: string | null
  chofer_id: string | null
  chofer_nombre: string
  cliente_id: string | null
  cliente_nombre: string
  origen: string
  destino: string
  mercaderia: string
  km: number
  toneladas: number
  tarifa_aplicada: number
  importe: number
  gasto_gasoil: number
  litros_gasoil: number
  comision: number
  peajes: number
  estado_cobro: 'pendiente' | 'cobrado'
  foto_url: string | null
  notas: string | null
  created_by: string | null
  created_at: string
  camion?: Camion
  chofer?: Usuario
  cliente?: Cliente
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

export interface DashboardKPIs {
  ingresos_mes: number
  beneficio_neto: number
  total_viajes_mes: number
  gasto_gasoil_mes: number
  toneladas_mes: number
  pendientes_cobro: number
}

export interface OCRResult {
  fecha?: string
  numero_remito?: string
  matricula?: string
  chofer?: string
  destino?: string
  toneladas?: number
  cliente?: string
  mercaderia?: string
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
