'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

interface Row {
  matricula: string
  importe: number
  gasto_gasoil: number
  litros_gasoil: number
  comision: number
  peajes: number
  count: number
}

function fmt(n: number) { return (n ?? 0).toLocaleString('es-UY', { maximumFractionDigits: 0 }) }
function fmtM(n: number) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K'
  return n.toFixed(0)
}
const tooltipStyle = {
  contentStyle: { background: '#22232f', border: '1px solid #2a2b3a', borderRadius: 8, fontSize: 11 },
  labelStyle: { color: '#9a9bb0' },
  itemStyle: { color: '#e8e9f0' },
}

function KPI({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="relative bg-bg-secondary border border-border-color rounded-xl p-5 overflow-hidden">
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: color }} />
      <p className="text-xs font-semibold uppercase tracking-widest text-text-secondary mb-2">{label}</p>
      <p className="font-mono text-xl font-bold text-text-primary">{value}</p>
    </div>
  )
}

export default function CamionesPage() {
  const supabase = createClient()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('viajes')
        .select('matricula,importe,gasto_gasoil,litros_gasoil,comision,peajes')
      const m: Record<string, Row> = {}
      ;(data ?? []).forEach((v: any) => {
        const k = v.matricula || 'Sin matrícula'
        if (!m[k]) m[k] = { matricula: k, importe: 0, gasto_gasoil: 0, litros_gasoil: 0, comision: 0, peajes: 0, count: 0 }
        m[k].importe += v.importe ?? 0
        m[k].gasto_gasoil += v.gasto_gasoil ?? 0
        m[k].litros_gasoil += v.litros_gasoil ?? 0
        m[k].comision += v.comision ?? 0
        m[k].peajes += v.peajes ?? 0
        m[k].count++
      })
      setRows(Object.values(m).sort((a, b) => b.importe - a.importe))
      setLoading(false)
    }
    load()
  }, [supabase])

  const totalTrucks = rows.length
  const topViajes   = rows.reduce((best, r) => r.count > (best?.count ?? -1) ? r : best, rows[0])
  const topInc      = rows.reduce((best, r) => r.importe > (best?.importe ?? -1) ? r : best, rows[0])
  const topGas      = rows.reduce((best, r) => r.litros_gasoil > (best?.litros_gasoil ?? -1) ? r : best, rows[0])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-accent-cyan border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-5 animate-fade-in">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI label="Total Camiones"  value={String(totalTrucks)}             color="linear-gradient(135deg,#00d4ff,#7c5fff)" />
        <KPI label="Más Viajes"      value={topViajes?.matricula ?? '—'}     color="linear-gradient(135deg,#ffa502,#ff4757)" />
        <KPI label="Mayor Ingreso"   value={topInc?.matricula ?? '—'}        color="linear-gradient(135deg,#00e89d,#00d4ff)" />
        <KPI label="Mayor Consumo"   value={topGas?.matricula ?? '—'}        color="linear-gradient(135deg,#7c5fff,#ff6b9d)" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="text-sm font-semibold mb-4 text-text-primary">Ingresos por Camión</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={rows} layout="vertical" barCategoryGap="25%">
              <defs>
                <linearGradient id="incBar" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#00d4ff" /><stop offset="100%" stopColor="#7c5fff" />
                </linearGradient>
              </defs>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="matricula" tick={{ fill: '#9a9bb0', fontSize: 9 }} width={70} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: number) => '$' + fmtM(v)} {...tooltipStyle} />
              <Bar dataKey="importe" fill="url(#incBar)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h3 className="text-sm font-semibold mb-4 text-text-primary">Consumo Gasoil por Camión (litros)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={rows} layout="vertical" barCategoryGap="25%">
              <defs>
                <linearGradient id="gasBar" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#ff4757" /><stop offset="100%" stopColor="#ff6b9d" />
                </linearGradient>
              </defs>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="matricula" tick={{ fill: '#9a9bb0', fontSize: 9 }} width={70} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: number) => fmt(v) + ' lt'} {...tooltipStyle} />
              <Bar dataKey="litros_gasoil" fill="url(#gasBar)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detail table */}
      <div className="bg-bg-secondary border border-border-color rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border-color">
          <h3 className="text-sm font-semibold text-text-primary">Detalle por Camión</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                {['Matrícula','Viajes','Ingresos','Gasoil','Comisiones','Peajes','Beneficio','Margen'].map(h => (
                  <th key={h} className="table-header text-left whitespace-nowrap px-4 py-2.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const profit = r.importe - r.gasto_gasoil - r.comision - r.peajes
                const margin = r.importe > 0 ? ((profit / r.importe) * 100).toFixed(1) : '0'
                return (
                  <tr key={r.matricula} className="table-row-hover border-b border-border-color/50">
                    <td className="table-cell px-4">
                      <span className="bg-accent-cyan/10 text-accent-cyan px-2 py-0.5 rounded font-mono text-xs font-semibold">{r.matricula}</span>
                    </td>
                    <td className="table-cell px-4 font-mono text-right">{r.count}</td>
                    <td className="table-cell px-4 font-mono text-right">${fmt(r.importe)}</td>
                    <td className="table-cell px-4 font-mono text-right text-danger">${fmt(r.gasto_gasoil)}</td>
                    <td className="table-cell px-4 font-mono text-right">${fmt(r.comision)}</td>
                    <td className="table-cell px-4 font-mono text-right">${fmt(r.peajes)}</td>
                    <td className={`table-cell px-4 font-mono text-right font-semibold ${profit >= 0 ? 'text-success' : 'text-danger'}`}>${fmt(profit)}</td>
                    <td className={`table-cell px-4 font-mono text-right ${Number(margin) >= 0 ? 'text-success' : 'text-danger'}`}>{margin}%</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
