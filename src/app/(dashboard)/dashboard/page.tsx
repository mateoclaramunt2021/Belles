'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'

interface Viaje {
  id: string
  fecha: string
  matricula: string
  chofer_nombre: string
  cliente_nombre: string
  origen: string
  destino: string
  mercaderia: string
  importe: number
  gasto_gasoil: number
  litros_gasoil: number
  comision: number
  peajes: number
  imprevistos: number
  toneladas: number
  km: number
  estado_cobro: 'pendiente' | 'cobrado'
}

const COLORS = ['#00d4ff','#7c5fff','#00e89d','#ffa502','#ff4757','#ff6b9d','#a29bfe','#fd9644','#45aaf2','#26de81']

function fmtM(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K'
  return n.toFixed(0)
}
function fmt(n: number): string {
  return n.toLocaleString('es-UY', { maximumFractionDigits: 0 })
}

function KPI({ label, value, sub, color }: {
  label: string; value: string; sub?: string
  color: 'blue' | 'green' | 'orange' | 'purple'
}) {
  const top: Record<string, string> = {
    blue: 'linear-gradient(135deg,#00d4ff,#7c5fff)',
    green: 'linear-gradient(135deg,#00e89d,#00d4ff)',
    orange: 'linear-gradient(135deg,#ffa502,#ff4757)',
    purple: 'linear-gradient(135deg,#7c5fff,#ff6b9d)',
  }
  const clr: Record<string, string> = {
    blue: '#00d4ff', green: '#00e89d', orange: '#ffa502', purple: '#7c5fff',
  }
  return (
    <div className="relative bg-bg-secondary border border-border-color rounded-xl p-5 overflow-hidden">
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: top[color] }} />
      <p className="text-xs font-semibold uppercase tracking-widest text-text-secondary mb-2">{label}</p>
      <p className="font-mono text-2xl font-bold" style={{ color: clr[color] }}>{value}</p>
      {sub && <p className="font-mono text-xs text-text-secondary mt-1">{sub}</p>}
    </div>
  )
}

const tooltipStyle = {
  contentStyle: { background: '#22232f', border: '1px solid #2a2b3a', borderRadius: 8, fontSize: 11 },
  labelStyle: { color: '#9a9bb0' },
  itemStyle: { color: '#e8e9f0' },
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{label}</label>
      {children}
    </div>
  )
}

export default function DashboardPage() {
  const supabase = createClient()
  const { isAdmin, profile } = useAuth()

  const [viajes, setViajes] = useState<Viaje[]>([])
  const [loading, setLoading] = useState(true)

  const [fMat, setFMat] = useState('')
  const [fCho, setFCho] = useState('')
  const [fCli, setFCli] = useState('')
  const [fFrom, setFFrom] = useState('')
  const [fTo, setFTo] = useState('')

  useEffect(() => {
    const load = async () => {
      let q = supabase
        .from('viajes')
        .select('id,fecha,matricula,chofer_nombre,cliente_nombre,origen,destino,mercaderia,importe,gasto_gasoil,litros_gasoil,comision,peajes,imprevistos,toneladas,km,estado_cobro')
        .order('fecha', { ascending: false })
      if (!isAdmin && profile?.id) q = (q as any).eq('chofer_id', profile.id)
      const { data } = await q
      setViajes((data ?? []) as Viaje[])
      setLoading(false)
    }
    load()
  }, [supabase, isAdmin, profile?.id])

  const filtered = useMemo(() => viajes.filter(v => {
    if (fMat && v.matricula !== fMat) return false
    if (fCho && v.chofer_nombre !== fCho) return false
    if (fCli && v.cliente_nombre !== fCli) return false
    if (fFrom && v.fecha < fFrom) return false
    if (fTo && v.fecha > fTo) return false
    return true
  }), [viajes, fMat, fCho, fCli, fFrom, fTo])

  const matriculas = useMemo(() => [...new Set(viajes.map(v => v.matricula))].sort(), [viajes])
  const choferes   = useMemo(() => [...new Set(viajes.map(v => v.chofer_nombre).filter(Boolean))].sort(), [viajes])
  const clientes   = useMemo(() => [...new Set(viajes.map(v => v.cliente_nombre).filter(Boolean))].sort(), [viajes])

  const totalInc      = useMemo(() => filtered.reduce((s, v) => s + (v.importe ?? 0), 0), [filtered])
  const totalGas      = useMemo(() => filtered.reduce((s, v) => s + (v.gasto_gasoil ?? 0), 0), [filtered])
  const totalCom      = useMemo(() => filtered.reduce((s, v) => s + (v.comision ?? 0), 0), [filtered])
  const totalPj       = useMemo(() => filtered.reduce((s, v) => s + (v.peajes ?? 0), 0), [filtered])
  const totalImp      = useMemo(() => filtered.reduce((s, v) => s + (v.imprevistos ?? 0), 0), [filtered])
  const totalProfit   = totalInc - totalGas - totalCom - totalPj - totalImp
  const totalLts      = useMemo(() => filtered.reduce((s, v) => s + (v.litros_gasoil ?? 0), 0), [filtered])
  const totalTons     = useMemo(() => filtered.reduce((s, v) => s + (v.toneladas ?? 0), 0), [filtered])
  const totalKm       = useMemo(() => filtered.reduce((s, v) => s + (v.km ?? 0), 0), [filtered])
  const pendientes    = useMemo(() => filtered.filter(v => v.estado_cobro === 'pendiente'), [filtered])
  const pendientesMonto = useMemo(() => pendientes.reduce((s, v) => s + (v.importe ?? 0), 0), [pendientes])
  const margin        = totalInc > 0 ? ((totalProfit / totalInc) * 100).toFixed(1) : '0'

  const barData = useMemo(() => {
    const m: Record<string, { inc: number; exp: number }> = {}
    filtered.forEach(v => {
      const ym = v.fecha.substring(0, 7)
      if (!m[ym]) m[ym] = { inc: 0, exp: 0 }
      m[ym].inc += v.importe ?? 0
      m[ym].exp += (v.gasto_gasoil ?? 0) + (v.comision ?? 0) + (v.peajes ?? 0)
    })
    return Object.keys(m).sort().slice(-12).map(k => ({
      mes: k.substring(5), ingresos: m[k].inc, gastos: m[k].exp,
    }))
  }, [filtered])

  const donutData = useMemo(() => {
    const m: Record<string, number> = {}
    filtered.forEach(v => { m[v.matricula] = (m[v.matricula] ?? 0) + (v.importe ?? 0) })
    return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }))
  }, [filtered])

  const tableData = useMemo(() =>
    [...filtered].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 100),
    [filtered]
  )

  const clearFilters = () => { setFMat(''); setFCho(''); setFCli(''); setFFrom(''); setFTo('') }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-accent-cyan border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KPI label="Ingresos Totales"    value={'$' + fmtM(totalInc)}         sub={fmt(filtered.length) + ' viajes'}             color="blue"   />
        <KPI label="Beneficio Neto"      value={'$' + fmtM(totalProfit)}      sub={'Margen: ' + margin + '%'}                    color="green"  />
        <KPI label="Pendientes Cobro"    value={'$' + fmtM(pendientesMonto)}  sub={pendientes.length + ' viajes sin cobrar'}     color="orange" />
        <KPI label="Gasto Gasoil"        value={'$' + fmtM(totalGas)}         sub={fmt(Math.round(totalLts)) + ' litros'}        color="purple" />
        <KPI label="Km Recorridos"       value={fmtM(totalKm) + ' km'}        sub={'Promedio ' + (filtered.length > 0 ? fmt(Math.round(totalKm / filtered.length)) : '0') + ' km/viaje'} color="blue"   />
        <KPI label="Toneladas Transportadas" value={fmt(Math.round(totalTons)) + ' t'} sub={'Comisiones: $' + fmtM(totalCom)}   color="green"  />
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex items-center gap-2 mb-3">
          <svg className="w-3.5 h-3.5 text-accent-cyan flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
          </svg>
          <span className="text-xs font-semibold uppercase tracking-widest text-text-secondary">Filtros</span>
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          <FilterGroup label="Matrícula">
            <select className="input text-xs" value={fMat} onChange={e => setFMat(e.target.value)}>
              <option value="">Todas</option>
              {matriculas.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </FilterGroup>
          <FilterGroup label="Chofer">
            <select className="input text-xs" value={fCho} onChange={e => setFCho(e.target.value)}>
              <option value="">Todos</option>
              {choferes.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </FilterGroup>
          <FilterGroup label="Cliente">
            <select className="input text-xs" value={fCli} onChange={e => setFCli(e.target.value)}>
              <option value="">Todos</option>
              {clientes.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </FilterGroup>
          <FilterGroup label="Desde">
            <input type="date" className="input text-xs" value={fFrom} onChange={e => setFFrom(e.target.value)} />
          </FilterGroup>
          <FilterGroup label="Hasta">
            <input type="date" className="input text-xs" value={fTo} onChange={e => setFTo(e.target.value)} />
          </FilterGroup>
          <button className="btn-ghost text-xs self-end" onClick={clearFilters}>Limpiar</button>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Bar chart */}
        <div className="lg:col-span-2 card">
          <h3 className="text-sm font-semibold mb-4 text-text-primary">Ingresos vs Gastos por Mes</h3>
          {barData.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-text-secondary text-xs">Sin datos</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barData} barGap={3} barCategoryGap="30%">
                <defs>
                  <linearGradient id="incGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00d4ff" />
                    <stop offset="100%" stopColor="#7c5fff" />
                  </linearGradient>
                </defs>
                <XAxis dataKey="mes" tick={{ fill: '#6a6b80', fontSize: 9, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  formatter={(value: number, name: string) => ['$' + fmtM(value), name === 'ingresos' ? 'Ingresos' : 'Gastos']}
                  contentStyle={tooltipStyle.contentStyle}
                  labelStyle={tooltipStyle.labelStyle}
                  itemStyle={tooltipStyle.itemStyle}
                />
                <Bar dataKey="ingresos" fill="url(#incGrad)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="gastos"   fill="#ff4757"        radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
          <div className="flex gap-4 mt-2">
            <span className="flex items-center gap-1.5 text-xs text-text-secondary">
              <span className="w-3 h-2 rounded-sm inline-block" style={{ background: 'linear-gradient(135deg,#00d4ff,#7c5fff)' }} />
              Ingresos
            </span>
            <span className="flex items-center gap-1.5 text-xs text-text-secondary">
              <span className="w-3 h-2 rounded-sm bg-danger inline-block" />
              Gastos
            </span>
          </div>
        </div>

        {/* Donut chart */}
        <div className="card">
          <h3 className="text-sm font-semibold mb-4 text-text-primary">Distribución por Camión</h3>
          {donutData.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-text-secondary text-xs">Sin datos</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={donutData} cx="50%" cy="50%" innerRadius={45} outerRadius={72} dataKey="value" paddingAngle={2}>
                    {donutData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => '$' + fmtM(v)} contentStyle={tooltipStyle.contentStyle} itemStyle={tooltipStyle.itemStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 space-y-1.5">
                {donutData.slice(0, 6).map((d, i) => {
                  const total = donutData.reduce((s, x) => s + x.value, 0)
                  const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : '0'
                  return (
                    <div key={d.name} className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="text-xs text-text-secondary flex-1 truncate">{d.name}</span>
                      <span className="font-mono text-xs text-text-secondary">{pct}%</span>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Trips table */}
      <div className="bg-bg-secondary border border-border-color rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-color">
          <h3 className="text-sm font-semibold text-text-primary">Últimos Viajes</h3>
          <span className="font-mono text-xs text-text-secondary">{filtered.length} registros</span>
        </div>
        <div className="overflow-x-auto" style={{ maxHeight: 480 }}>
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 z-10">
              <tr>
                {['Fecha','Matrícula','Chofer','Cliente','Origen → Destino','Mercadería','Importe','Gasoil','Beneficio'].map(h => (
                  <th key={h} className="table-header text-left whitespace-nowrap px-4 py-2.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableData.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-text-secondary">Sin viajes registrados</td>
                </tr>
              ) : tableData.map(v => {
                const profit = (v.importe ?? 0) - (v.gasto_gasoil ?? 0) - (v.comision ?? 0) - (v.peajes ?? 0) - (v.imprevistos ?? 0)
                return (
                  <tr key={v.id} className="table-row-hover border-b border-border-color/50">
                    <td className="table-cell font-mono whitespace-nowrap">{v.fecha}</td>
                    <td className="table-cell whitespace-nowrap">
                      <span className="bg-accent-cyan/10 text-accent-cyan px-2 py-0.5 rounded font-mono text-xs font-semibold">
                        {v.matricula}
                      </span>
                    </td>
                    <td className="table-cell whitespace-nowrap">{v.chofer_nombre}</td>
                    <td className="table-cell whitespace-nowrap">{v.cliente_nombre}</td>
                    <td className="table-cell whitespace-nowrap">{v.origen} → {v.destino}</td>
                    <td className="table-cell">{v.mercaderia}</td>
                    <td className="table-cell text-right font-mono whitespace-nowrap">${fmt(v.importe ?? 0)}</td>
                    <td className="table-cell text-right font-mono text-danger whitespace-nowrap">${fmt(v.gasto_gasoil ?? 0)}</td>
                    <td className={`table-cell text-right font-mono font-semibold whitespace-nowrap ${profit >= 0 ? 'text-success' : 'text-danger'}`}>
                      ${fmt(profit)}
                    </td>
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
