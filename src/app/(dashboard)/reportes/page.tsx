'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { KPICard } from '@/components/ui/KPICard'
import { IngresosGastosChart, CamionDonutChart } from '@/components/ui/Chart'
import { BarChart2, TrendingUp, Truck, MapPin, Package } from 'lucide-react'
import { subMonths, format } from 'date-fns'
import type { Viaje } from '@/types'

interface TopCliente  { nombre: string; total: number; viajes: number }
interface TopRuta     { ruta: string; viajes: number; toneladas: number }
interface TopMercad   { mercaderia: string; toneladas: number; viajes: number }
interface TopCamion   { matricula: string; viajes: number; ingresos: number; promedio: number }

export default function ReportesPage() {
  const supabase = createClient()
  const [clientes, setClientes]   = useState<TopCliente[]>([])
  const [rutas, setRutas]         = useState<TopRuta[]>([])
  const [mercaderias, setMercad]  = useState<TopMercad[]>([])
  const [camiones, setCamiones]   = useState<TopCamion[]>([])
  const [graficoData, setGrafico] = useState<any[]>([])
  const [donutData, setDonut]     = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [rangoMeses, setRango]    = useState(3)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const fechaMin = format(subMonths(new Date(), rangoMeses), 'yyyy-MM-dd')

    const { data } = await supabase
      .from('viajes')
      .select('*')
      .gte('fecha', fechaMin)
      .order('fecha')

    const viajes: Viaje[] = data ?? []

    // Top clientes por ingresos
    const mapClientes: Record<string, TopCliente> = {}
    viajes.forEach((v) => {
      const k = v.cliente_nombre ?? 'Desconocido'
      if (!mapClientes[k]) mapClientes[k] = { nombre: k, total: 0, viajes: 0 }
      mapClientes[k].total  += v.importe ?? 0
      mapClientes[k].viajes += 1
    })
    setClientes(Object.values(mapClientes).sort((a, b) => b.total - a.total).slice(0, 10))

    // Top rutas
    const mapRutas: Record<string, TopRuta> = {}
    viajes.forEach((v) => {
      const k = `${v.origen ?? '?'} → ${v.destino ?? '?'}`
      if (!mapRutas[k]) mapRutas[k] = { ruta: k, viajes: 0, toneladas: 0 }
      mapRutas[k].viajes     += 1
      mapRutas[k].toneladas  += v.toneladas ?? 0
    })
    setRutas(Object.values(mapRutas).sort((a, b) => b.viajes - a.viajes).slice(0, 10))

    // Top mercaderías
    const mapMerc: Record<string, TopMercad> = {}
    viajes.forEach((v) => {
      if (!v.mercaderia) return
      const k = v.mercaderia
      if (!mapMerc[k]) mapMerc[k] = { mercaderia: k, toneladas: 0, viajes: 0 }
      mapMerc[k].toneladas += v.toneladas ?? 0
      mapMerc[k].viajes    += 1
    })
    setMercad(Object.values(mapMerc).sort((a, b) => b.toneladas - a.toneladas).slice(0, 10))

    // Rendimiento por camión
    const mapCam: Record<string, TopCamion> = {}
    viajes.forEach((v) => {
      const k = v.matricula ?? 'Sin matricula'
      if (!mapCam[k]) mapCam[k] = { matricula: k, viajes: 0, ingresos: 0, promedio: 0 }
      mapCam[k].viajes   += 1
      mapCam[k].ingresos += v.importe ?? 0
    })
    const camarr = Object.values(mapCam).map((c) => ({ ...c, promedio: c.viajes > 0 ? c.ingresos / c.viajes : 0 }))
      .sort((a, b) => b.ingresos - a.ingresos)
    setCamiones(camarr)

    // Gráfico de barras mensual (ingresos vs gastos)
    const mapMes: Record<string, { ingresos: number; gastos: number }> = {}
    viajes.forEach((v) => {
      const mes = v.fecha.substring(0, 7)
      if (!mapMes[mes]) mapMes[mes] = { ingresos: 0, gastos: 0 }
      mapMes[mes].ingresos += v.importe ?? 0
      mapMes[mes].gastos   += (v.gasto_gasoil ?? 0) + (v.comision ?? 0) + (v.peajes ?? 0)
    })
    setGrafico(Object.entries(mapMes).sort(([a], [b]) => a.localeCompare(b)).map(([mes, v]) => ({ name: mes.substring(5), ...v })))

    // Donut por camión
    setDonut(camarr.slice(0, 8).map((c) => ({ name: c.matricula, value: c.ingresos })))

    setLoading(false)
  }, [supabase, rangoMeses])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-6 h-6 border-2 border-accent-cyan/30 border-t-accent-cyan rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Reportes</h1>
          <p className="text-text-secondary text-sm mt-0.5">Análisis de rendimiento operativo</p>
        </div>
        <select className="input w-auto text-sm" value={rangoMeses} onChange={(e) => setRango(parseInt(e.target.value))}>
          <option value={1}>Último mes</option>
          <option value={3}>Últimos 3 meses</option>
          <option value={6}>Últimos 6 meses</option>
          <option value={12}>Último año</option>
        </select>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-sm font-semibold text-text-primary mb-4">Ingresos vs Gastos</h2>
          <IngresosGastosChart data={graficoData} />
        </div>
        <div className="card">
          <h2 className="text-sm font-semibold text-text-primary mb-4">Ingresos por camión</h2>
          <CamionDonutChart data={donutData} />
        </div>
      </div>

      {/* Top Clientes */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <BarChart2 size={16} className="text-accent-cyan" />
          <h2 className="text-sm font-semibold text-text-primary">Top clientes por ingresos</h2>
        </div>
        {clientes.length === 0 ? (
          <p className="text-text-secondary text-sm text-center py-4">Sin datos</p>
        ) : (
          <div className="space-y-3">
            {clientes.map((c, i) => {
              const maxVal = clientes[0].total
              return (
                <div key={c.nombre} className="flex items-center gap-3">
                  <span className="text-xs font-data text-text-secondary w-5 text-right">{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-text-primary">{c.nombre}</span>
                      <span className="font-data text-sm text-success">${c.total.toLocaleString('es-UY')}</span>
                    </div>
                    <div className="w-full bg-bg-primary rounded-full h-1.5">
                      <div
                        className="bg-gradient-to-r from-accent-cyan to-accent-purple h-1.5 rounded-full"
                        style={{ width: `${(c.total / maxVal) * 100}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-xs text-text-secondary w-16 text-right">{c.viajes} viajes</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Top Rutas + Top Mercaderías */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <MapPin size={16} className="text-accent-purple" />
            <h2 className="text-sm font-semibold text-text-primary">Rutas más frecuentes</h2>
          </div>
          {rutas.length === 0 ? (
            <p className="text-text-secondary text-sm text-center py-4">Sin datos</p>
          ) : (
            <div className="space-y-2">
              {rutas.map((r, i) => (
                <div key={r.ruta} className="flex items-center justify-between py-2 border-b border-border-color/30 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-data text-text-secondary">{i + 1}</span>
                    <span className="text-sm text-text-primary">{r.ruta}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-accent-cyan font-data">{r.viajes}</span>
                    <span className="text-xs text-text-secondary ml-1">viajes</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Package size={16} className="text-success" />
            <h2 className="text-sm font-semibold text-text-primary">Mercaderías más transportadas</h2>
          </div>
          {mercaderias.length === 0 ? (
            <p className="text-text-secondary text-sm text-center py-4">Sin datos</p>
          ) : (
            <div className="space-y-2">
              {mercaderias.map((m, i) => (
                <div key={m.mercaderia} className="flex items-center justify-between py-2 border-b border-border-color/30 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-data text-text-secondary">{i + 1}</span>
                    <span className="text-sm text-text-primary">{m.mercaderia}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-success font-data">{m.toneladas.toFixed(1)} t</span>
                    <span className="text-xs text-text-secondary ml-1">({m.viajes} viajes)</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Rendimiento por camión */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Truck size={16} className="text-warning" />
          <h2 className="text-sm font-semibold text-text-primary">Rendimiento por camión</h2>
        </div>
        {camiones.length === 0 ? (
          <p className="text-text-secondary text-sm text-center py-4">Sin datos</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="table-header text-left">Matrícula</th>
                  <th className="table-header text-right">Viajes</th>
                  <th className="table-header text-right">Ingresos</th>
                  <th className="table-header text-right hidden md:table-cell">Promedio/viaje</th>
                  <th className="table-header hidden md:table-cell">Participación</th>
                </tr>
              </thead>
              <tbody>
                {camiones.map((c) => {
                  const totalIngresos = camiones.reduce((s, x) => s + x.ingresos, 0)
                  const pct = totalIngresos > 0 ? (c.ingresos / totalIngresos) * 100 : 0
                  return (
                    <tr key={c.matricula} className="table-row-hover">
                      <td className="table-cell font-data font-bold text-accent-cyan">{c.matricula}</td>
                      <td className="table-cell text-right font-data">{c.viajes}</td>
                      <td className="table-cell text-right font-data text-success">${c.ingresos.toLocaleString('es-UY')}</td>
                      <td className="table-cell text-right font-data text-text-secondary hidden md:table-cell">${Math.round(c.promedio).toLocaleString('es-UY')}</td>
                      <td className="table-cell hidden md:table-cell">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-bg-primary rounded-full h-1.5">
                            <div className="bg-accent-cyan h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs font-data text-text-secondary w-10">{pct.toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
