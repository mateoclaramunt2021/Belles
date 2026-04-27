'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'

function fmt(n: number) { return (n ?? 0).toLocaleString('es-UY', { maximumFractionDigits: 0 }) }
const tooltipStyle = {
  contentStyle: { background: '#22232f', border: '1px solid #2a2b3a', borderRadius: 8, fontSize: 11 },
  labelStyle: { color: '#9a9bb0' },
  itemStyle: { color: '#e8e9f0' },
}

interface Item { name: string; value: number }

function HBarChart({ data, gradient, label }: { data: Item[]; gradient: string; label: string }) {
  const [c1, c2] = gradient.split(',')
  const id = gradient.replace(/[^a-z]/gi, '')
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 28)}>
      <BarChart data={data} layout="vertical" barCategoryGap="20%">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={c1.trim()} /><stop offset="100%" stopColor={c2.trim()} />
          </linearGradient>
        </defs>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="name" tick={{ fill: '#9a9bb0', fontSize: 9 }} width={120} axisLine={false} tickLine={false} />
        <Tooltip
          formatter={(v: number) => [label === 'ingresos' ? '$' + fmt(v) : String(v), label === 'ingresos' ? 'Ingresos' : 'Viajes']}
          {...tooltipStyle}
        />
        <Bar dataKey="value" fill={`url(#${id})`} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export default function ReportesPage() {
  const supabase = createClient()
  const [clientes, setClientes] = useState<Item[]>([])
  const [rutas, setRutas] = useState<Item[]>([])
  const [mercs, setMercs] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('viajes')
        .select('cliente_nombre,origen,destino,mercaderia,importe')

      const cliM: Record<string, number> = {}
      const rutaM: Record<string, number> = {}
      const mercM: Record<string, number> = {}

      ;(data ?? []).forEach((v: any) => {
        if (v.cliente_nombre) cliM[v.cliente_nombre] = (cliM[v.cliente_nombre] ?? 0) + (v.importe ?? 0)
        const ruta = `${v.origen || '?'} → ${v.destino || '?'}`
        rutaM[ruta] = (rutaM[ruta] ?? 0) + 1
        if (v.mercaderia) mercM[v.mercaderia] = (mercM[v.mercaderia] ?? 0) + 1
      })

      setClientes(Object.entries(cliM).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, value]) => ({ name, value })))
      setRutas(Object.entries(rutaM).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, value]) => ({ name, value })))
      setMercs(Object.entries(mercM).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, value]) => ({ name, value })))
      setLoading(false)
    }
    load()
  }, [supabase])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-accent-cyan border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="card">
          <h3 className="text-sm font-semibold mb-4 text-text-primary">Top 10 Clientes por Ingresos</h3>
          {clientes.length === 0
            ? <p className="text-xs text-text-secondary">Sin datos</p>
            : <HBarChart data={clientes} gradient="#00d4ff,#7c5fff" label="ingresos" />}
        </div>
        <div className="card">
          <h3 className="text-sm font-semibold mb-4 text-text-primary">Top 10 Rutas más Frecuentes</h3>
          {rutas.length === 0
            ? <p className="text-xs text-text-secondary">Sin datos</p>
            : <HBarChart data={rutas} gradient="#00e89d,#00d4ff" label="viajes" />}
        </div>
        <div className="card">
          <h3 className="text-sm font-semibold mb-4 text-text-primary">Mercaderías Transportadas</h3>
          {mercs.length === 0
            ? <p className="text-xs text-text-secondary">Sin datos</p>
            : <HBarChart data={mercs} gradient="#ffa502,#ff4757" label="viajes" />}
        </div>
      </div>
    </div>
  )
}
