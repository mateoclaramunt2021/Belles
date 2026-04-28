import { createClient } from '@/lib/supabase/server'
import { startOfMonth, endOfMonth, format, subMonths } from 'date-fns'
import type { DashboardKPIs, GraficoMensual, GraficoCamion } from '@/types'

// ============================================================
// KPIs del dashboard
// ============================================================
export async function getDashboardKPIs(userId?: string, isAdmin = false): Promise<DashboardKPIs> {
  const supabase = await createClient()
  const now = new Date()
  const mesInicio = format(startOfMonth(now), 'yyyy-MM-dd')
  const mesFin    = format(endOfMonth(now),   'yyyy-MM-dd')

  let query = supabase
    .from('viajes')
    .select('importe, gasto_gasoil, comision, peajes, toneladas, estado_cobro')
    .gte('fecha', mesInicio)
    .lte('fecha', mesFin)

  if (!isAdmin && userId) {
    query = query.eq('chofer_id', userId)
  }

  const { data: viajes } = await query

  if (!viajes) return {
    ingresos_mes: 0, beneficio_neto: 0, total_viajes_mes: 0,
    gasto_gasoil_mes: 0, toneladas_mes: 0, pendientes_cobro: 0, pendientes_monto: 0,
  }

  const ingresos_mes    = viajes.reduce((s, v) => s + (v.importe ?? 0), 0)
  const gasto_gasoil    = viajes.reduce((s, v) => s + (v.gasto_gasoil ?? 0), 0)
  const comisiones      = viajes.reduce((s, v) => s + (v.comision ?? 0), 0)
  const peajes          = viajes.reduce((s, v) => s + (v.peajes ?? 0), 0)
  const beneficio_neto  = ingresos_mes - gasto_gasoil - comisiones - peajes
  const toneladas_mes   = viajes.reduce((s, v) => s + (v.toneladas ?? 0), 0)
  const pendientesList = viajes.filter((v) => v.estado_cobro === 'pendiente')
  const pendientes_cobro = pendientesList.length
  const pendientes_monto = pendientesList.reduce((s, v) => s + (v.importe ?? 0), 0)

  return {
    ingresos_mes,
    beneficio_neto,
    total_viajes_mes: viajes.length,
    gasto_gasoil_mes: gasto_gasoil,
    toneladas_mes,
    pendientes_cobro,
    pendientes_monto,
  }
}

// ============================================================
// Gráfico ingresos vs gastos — últimos 12 meses
// ============================================================
export async function getGraficoMensual(userId?: string, isAdmin = false): Promise<GraficoMensual[]> {
  const supabase = await createClient()
  const meses: GraficoMensual[] = []
  const now = new Date()

  for (let i = 11; i >= 0; i--) {
    const fecha    = subMonths(now, i)
    const inicio   = format(startOfMonth(fecha), 'yyyy-MM-dd')
    const fin      = format(endOfMonth(fecha),   'yyyy-MM-dd')
    const mesLabel = format(fecha, 'MMM')

    let q = supabase
      .from('viajes')
      .select('importe, gasto_gasoil, comision, peajes')
      .gte('fecha', inicio)
      .lte('fecha', fin)

    if (!isAdmin && userId) q = q.eq('chofer_id', userId)

    const { data } = await q

    if (data) {
      const ingresos = data.reduce((s, v) => s + (v.importe ?? 0), 0)
      const gastos   = data.reduce((s, v) => s + (v.gasto_gasoil ?? 0) + (v.comision ?? 0) + (v.peajes ?? 0), 0)
      meses.push({ mes: mesLabel, ingresos, gastos })
    } else {
      meses.push({ mes: mesLabel, ingresos: 0, gastos: 0 })
    }
  }

  return meses
}

// ============================================================
// Gráfico distribución por camión (solo admin)
// ============================================================
export async function getGraficoCamiones(): Promise<GraficoCamion[]> {
  const supabase = await createClient()
  const now = new Date()
  const inicio = format(startOfMonth(now), 'yyyy-MM-dd')
  const fin    = format(endOfMonth(now),   'yyyy-MM-dd')

  const { data } = await supabase
    .from('viajes')
    .select('matricula, importe')
    .gte('fecha', inicio)
    .lte('fecha', fin)

  if (!data) return []

  const grouped: Record<string, { ingresos: number; viajes: number }> = {}
  for (const v of data) {
    if (!grouped[v.matricula]) grouped[v.matricula] = { ingresos: 0, viajes: 0 }
    grouped[v.matricula].ingresos += v.importe ?? 0
    grouped[v.matricula].viajes   += 1
  }

  return Object.entries(grouped)
    .map(([matricula, val]) => ({ matricula, ...val }))
    .sort((a, b) => b.ingresos - a.ingresos)
    .slice(0, 8)
}

// ============================================================
// Últimos viajes
// ============================================================
export async function getUltimosViajes(limit = 10, userId?: string, isAdmin = false) {
  const supabase = await createClient()

  let q = supabase
    .from('viajes')
    .select('id, fecha, numero_remito, matricula, chofer_nombre, cliente_nombre, destino, toneladas, importe, estado_cobro')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (!isAdmin && userId) q = q.eq('chofer_id', userId)

  const { data } = await q
  return data ?? []
}
