'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'

// ============================================================
// TOOLTIP PERSONALIZADO
// ============================================================
function CustomTooltip({ active, payload, label, isMoney = false }: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
  isMoney?: boolean
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-bg-tertiary border border-border-color rounded-lg p-3 text-sm shadow-xl">
      {label && <p className="text-text-secondary font-medium mb-1.5">{label}</p>}
      {payload.map((entry, i) => (
        <p key={i} style={{ color: entry.color }} className="font-data font-medium">
          {entry.name}: {isMoney ? `$${entry.value.toLocaleString('es-UY')}` : entry.value.toLocaleString('es-UY')}
        </p>
      ))}
    </div>
  )
}

// ============================================================
// GRÁFICO DE BARRAS — Ingresos vs Gastos
// ============================================================
interface BarData {
  mes: string
  ingresos: number
  gastos: number
}

interface BarChartProps {
  data: BarData[]
  height?: number
}

export function IngresosGastosChart({ data, height = 260 }: BarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }} barGap={3}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2b3a" vertical={false} />
        <XAxis
          dataKey="mes"
          tick={{ fill: '#9a9bb0', fontSize: 11, fontFamily: 'DM Sans' }}
          axisLine={{ stroke: '#2a2b3a' }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: '#9a9bb0', fontSize: 11, fontFamily: 'JetBrains Mono' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
          width={50}
        />
        <Tooltip content={<CustomTooltip isMoney />} cursor={{ fill: '#2a2b3a', radius: 4 }} />
        <Legend
          wrapperStyle={{ color: '#9a9bb0', fontSize: 12, paddingTop: 8 }}
        />
        <Bar dataKey="ingresos" name="Ingresos" fill="#00d4ff" radius={[4, 4, 0, 0]} maxBarSize={32} />
        <Bar dataKey="gastos"   name="Gastos"   fill="#7c5fff" radius={[4, 4, 0, 0]} maxBarSize={32} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ============================================================
// GRÁFICO DONUT — Distribución por camión
// ============================================================
interface DonutData {
  matricula: string
  ingresos: number
  viajes: number
}

const DONUT_COLORS = ['#00d4ff', '#7c5fff', '#00e89d', '#ffa502', '#ff4757', '#00b4d8', '#9b5de5', '#06d6a0']

export function CamionDonutChart({ data, height = 260 }: { data: DonutData[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={65}
          outerRadius={95}
          paddingAngle={3}
          dataKey="ingresos"
          nameKey="matricula"
        >
          {data.map((_, index) => (
            <Cell
              key={`cell-${index}`}
              fill={DONUT_COLORS[index % DONUT_COLORS.length]}
              stroke="transparent"
            />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: number) => [`$${value.toLocaleString('es-UY')}`, 'Ingresos']}
          contentStyle={{
            background: '#1a1b25',
            border: '1px solid #2a2b3a',
            borderRadius: 8,
            color: '#e8e9f0',
            fontSize: 12,
          }}
        />
        <Legend
          formatter={(value) => <span style={{ color: '#9a9bb0', fontSize: 11 }}>{value}</span>}
          wrapperStyle={{ paddingTop: 8 }}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}

// ============================================================
// GRÁFICO DE BARRAS SIMPLE — Gasoil
// ============================================================
interface GasoilData {
  mes: string
  litros: number
  gasto: number
}

export function GasoilChart({ data, height = 220 }: { data: GasoilData[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2b3a" vertical={false} />
        <XAxis
          dataKey="mes"
          tick={{ fill: '#9a9bb0', fontSize: 11 }}
          axisLine={{ stroke: '#2a2b3a' }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: '#9a9bb0', fontSize: 11, fontFamily: 'JetBrains Mono' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `${(v / 1000).toFixed(0)}kL`}
          width={45}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#2a2b3a', radius: 4 }} />
        <Bar dataKey="litros" name="Litros" fill="#ffa502" radius={[4, 4, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  )
}
