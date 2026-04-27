'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

interface ViajeGas { fecha: string; gasto_gasoil: number; litros_gasoil: number }

function fmt(n: number) { return (n ?? 0).toLocaleString('es-UY', { maximumFractionDigits: 0 }) }
function fmtM(n: number) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K'
  return n.toFixed(0)
}
const tooltipStyle = { contentStyle: { background: '#22232f', border: '1px solid #2a2b3a', borderRadius: 8, fontSize: 11 }, labelStyle: { color: '#9a9bb0' }, itemStyle: { color: '#e8e9f0' } }

function KPI({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="relative bg-bg-secondary border border-border-color rounded-xl p-5 overflow-hidden">
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: color }} />
      <p className="text-xs font-semibold uppercase tracking-widest text-text-secondary mb-2">{label}</p>
      <p className="font-mono text-2xl font-bold text-text-primary">{value}</p>
      {sub && <p className="font-mono text-xs text-text-secondary mt-1">{sub}</p>}
    </div>
  )
}

export default function GasoilPage() {
  const supabase = createClient()
  const [viajes, setViajes] = useState<ViajeGas[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('viajes').select('fecha,gasto_gasoil,litros_gasoil').gt('gasto_gasoil', 0)
      setViajes(data ?? [])
      setLoading(false)
    }
    load()
  }, [supabase])

  const totalGasto  = useMemo(() => viajes.reduce((s, v) => s + (v.gasto_gasoil ?? 0), 0), [viajes])
  const totalLitros = useMemo(() => viajes.reduce((s, v) => s + (v.litros_gasoil ?? 0), 0), [viajes])
  const precioAvg   = totalLitros > 0 ? totalGasto / totalLitros : 0

  const barData = useMemo(() => {
    const m: Record<string, { gasto: number; litros: number }> = {}
    viajes.forEach(v => {
      const ym = v.fecha.substring(0, 7)
      if (!m[ym]) m[ym] = { gasto: 0, litros: 0 }
      m[ym].gasto  += v.gasto_gasoil ?? 0
      m[ym].litros += v.litros_gasoil ?? 0
    })
    return Object.keys(m).sort().slice(-18).map(k => ({ mes: k.substring(5), gasto: m[k].gasto, litros: m[k].litros }))
  }, [viajes])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-accent-cyan border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPI label="Gasto Total Gasoil" value={'$' + fmtM(totalGasto)} sub={viajes.length + ' registros'} color="linear-gradient(135deg,#00d4ff,#7c5fff)" />
        <KPI label="Litros Totales" value={fmt(Math.round(totalLitros)) + ' lt'} color="linear-gradient(135deg,#00e89d,#00d4ff)" />
        <KPI label="Precio Prom./Lt" value={'$' + precioAvg.toFixed(2)} color="linear-gradient(135deg,#ffa502,#ff4757)" />
      </div>
      <div className="card">
        <h3 className="text-sm font-semibold mb-4 text-text-primary">Consumo de Gasoil por Mes</h3>
        {barData.length === 0 ? (
          <div className="h-52 flex items-center justify-center text-text-secondary text-xs">Sin datos</div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={barData} barGap={3} barCategoryGap="30%">
              <defs>
                <linearGradient id="gasGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ff4757" />
                  <stop offset="100%" stopColor="#7c5fff" />
                </linearGradient>
              </defs>
              <XAxis dataKey="mes" tick={{ fill: '#6a6b80', fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip
                formatter={(value: number, name: string) => [name === 'gasto' ? '$' + fmtM(value) : fmt(value) + ' lt', name === 'gasto' ? 'Gasto' : 'Litros']}
                contentStyle={tooltipStyle.contentStyle}
                labelStyle={tooltipStyle.labelStyle}
                itemStyle={tooltipStyle.itemStyle}
              />
              <Bar dataKey="gasto"  fill="url(#gasGrad)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="litros" fill="#00e89d"        radius={[3, 3, 0, 0]} opacity={0.7} />
            </BarChart>
          </ResponsiveContainer>
        )}
        <div className="flex gap-4 mt-2">
          <span className="flex items-center gap-1.5 text-xs text-text-secondary">
            <span className="w-3 h-2 rounded-sm inline-block" style={{ background: 'linear-gradient(135deg,#ff4757,#7c5fff)' }} />Gasto ($)
          </span>
          <span className="flex items-center gap-1.5 text-xs text-text-secondary">
            <span className="w-3 h-2 rounded-sm bg-success inline-block" />Litros
          </span>
        </div>
      </div>
    </div>
  )
}