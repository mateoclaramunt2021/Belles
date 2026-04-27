'use client'

import { IngresosGastosChart, CamionDonutChart } from '@/components/ui/Chart'
import type { GraficoMensual, GraficoCamion } from '@/types'

interface Props {
  graficoMensual: GraficoMensual[]
  graficoCamiones: GraficoCamion[]
  isAdmin: boolean
}

export default function DashboardCharts({ graficoMensual, graficoCamiones, isAdmin }: Props) {
  return (
    <div className={`grid gap-4 ${isAdmin && graficoCamiones.length > 0 ? 'lg:grid-cols-3' : 'grid-cols-1'}`}>
      {/* Ingresos vs Gastos */}
      <div className={`card ${isAdmin && graficoCamiones.length > 0 ? 'lg:col-span-2' : ''}`}>
        <h2 className="text-base font-semibold text-text-primary mb-4">Ingresos vs Gastos</h2>
        {graficoMensual.every((m) => m.ingresos === 0 && m.gastos === 0) ? (
          <div className="flex items-center justify-center h-52 text-text-secondary text-sm">
            Sin datos suficientes para el gráfico
          </div>
        ) : (
          <IngresosGastosChart data={graficoMensual} height={240} />
        )}
      </div>

      {/* Distribución por camión — solo admin */}
      {isAdmin && graficoCamiones.length > 0 && (
        <div className="card">
          <h2 className="text-base font-semibold text-text-primary mb-4">Por camión</h2>
          <CamionDonutChart data={graficoCamiones} height={240} />
        </div>
      )}
    </div>
  )
}
