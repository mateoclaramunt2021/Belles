'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import { Truck, Scale, DollarSign, CalendarDays, ArrowRight, TrendingUp } from 'lucide-react'

/* ─── Helpers ────────────────────────────────────────────── */

function fmt(n: number) { return (n ?? 0).toLocaleString('es-UY', { maximumFractionDigits: 0 }) }
function fmtDec(n: number, d = 2) { return (n ?? 0).toLocaleString('es-UY', { minimumFractionDigits: d, maximumFractionDigits: d }) }

function getQuincena() {
  const now = new Date()
  const day = now.getDate()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  if (day <= 15) return { label: '1° Quincena', desde: `01/${m}`, hasta: `15/${m}` }
  return { label: '2° Quincena', desde: `16/${m}`, hasta: `${lastDay}/${m}` }
}

function monthRange() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const last = new Date(y, now.getMonth() + 1, 0).getDate()
  return { desde: `${y}-${m}-01`, hasta: `${y}-${m}-${last}` }
}

function last7Days() {
  const days: string[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    days.push(d.toISOString().slice(0, 10))
  }
  return days
}

function quincenaDeViaje(fecha: string) {
  const day = parseInt(fecha.slice(8, 10))
  return day <= 15 ? '1° Quincena' : '2° Quincena'
}

const COLORS = ['#00d4ff', '#7c5fff', '#00e89d', '#ffa502', '#ff4757', '#ff6b9d', '#a29bfe', '#fd9644']
const tooltipStyle = {
  contentStyle: { background: '#22232f', border: '1px solid #2a2b3a', borderRadius: 8, fontSize: 11 },
  labelStyle: { color: '#9a9bb0' },
  itemStyle: { color: '#e8e9f0' },
}

/* ─── KPI Card ───────────────────────────────────────────── */

function KPICard({
  label, value, sub, icon: Icon, gradient, iconBg,
}: {
  label: string; value: string; sub: string
  icon: React.ElementType; gradient: string; iconBg: string
}) {
  return (
    <div className="bg-bg-secondary border border-border-color rounded-2xl p-5 flex items-center gap-4 relative overflow-hidden">
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: gradient }} />
      <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: iconBg }}>
        <Icon size={22} style={{ color: gradient.includes('00d4ff') ? '#00d4ff' : gradient.includes('00e89d') ? '#00e89d' : gradient.includes('ffa502') ? '#ffa502' : '#7c5fff' }} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-text-secondary uppercase tracking-widest font-semibold truncate">{label}</p>
        <p className="font-mono text-xl font-bold text-text-primary leading-tight mt-0.5">{value}</p>
        <p className="text-xs text-text-secondary mt-0.5">{sub}</p>
      </div>
    </div>
  )
}

/* ─── Page ───────────────────────────────────────────────── */

interface ViajeRow {
  id: string; fecha: string; fecha_carga: string | null; fecha_descarga: string | null
  numero_remito: string; numero_remito_carga: string; matricula: string
  chofer_nombre: string; destino: string; toneladas: number
  tarifa_aplicada: number; importe: number; estado_cobro: string
}

export default function DashboardPage() {
  const supabase = createClient()
  const { isAdmin, profile } = useAuth()

  const [viajes, setViajes] = useState<ViajeRow[]>([])
  const [loading, setLoading] = useState(true)
  const quincena = getQuincena()
  const { desde: mesDesde, hasta: mesHasta } = monthRange()

  useEffect(() => {
    const load = async () => {
      let q = supabase
        .from('viajes')
        .select('id,fecha,fecha_carga,fecha_descarga,numero_remito,numero_remito_carga,matricula,chofer_nombre,destino,toneladas,tarifa_aplicada,importe,estado_cobro')
        .order('fecha', { ascending: false })
        .limit(300)
      if (!isAdmin && profile?.id) q = (q as any).eq('chofer_id', profile.id)
      const { data } = await q
      setViajes((data ?? []) as ViajeRow[])
      setLoading(false)
    }
    load()
  }, [supabase, isAdmin, profile?.id])

  /* ── KPIs del mes ── */
  const viajesMes = useMemo(() =>
    viajes.filter(v => (v.fecha_carga ?? v.fecha) >= mesDesde && (v.fecha_carga ?? v.fecha) <= mesHasta),
    [viajes, mesDesde, mesHasta]
  )
  const totalViajes   = viajesMes.length
  const totalTons     = viajesMes.reduce((s, v) => s + (v.toneladas ?? 0), 0)
  const totalCobrar   = viajesMes.reduce((s, v) => s + (v.importe ?? 0), 0)
  const pendientesCnt = viajesMes.filter(v => v.estado_cobro === 'pendiente').length

  /* ── Últimos 10 viajes ── */
  const ultimosViajes = useMemo(() => viajes.slice(0, 10), [viajes])

  /* ── Línea: toneladas últimos 7 días ── */
  const lineData = useMemo(() => {
    const days = last7Days()
    const map: Record<string, number> = {}
    viajes.forEach(v => {
      const f = v.fecha_carga ?? v.fecha
      if (days.includes(f)) map[f] = (map[f] ?? 0) + (v.toneladas ?? 0)
    })
    return days.map(d => ({
      dia: d.slice(5).replace('-', '/'),
      toneladas: parseFloat((map[d] ?? 0).toFixed(2)),
    }))
  }, [viajes])

  /* ── Donut: distribución por destino ── */
  const donutData = useMemo(() => {
    const map: Record<string, number> = {}
    viajesMes.forEach(v => { if (v.destino) map[v.destino] = (map[v.destino] ?? 0) + (v.toneladas ?? 0) })
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([name, value]) => ({ name, value: parseFloat(value.toFixed(2)) }))
  }, [viajesMes])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-accent-cyan border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-5 animate-fade-in">

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard
          label="Viajes (mes actual)"
          value={String(totalViajes)}
          sub="Todos los viajes realizados"
          icon={Truck}
          gradient="linear-gradient(135deg,#00d4ff,#7c5fff)"
          iconBg="rgba(0,212,255,0.12)"
        />
        <KPICard
          label="Toneladas (mes actual)"
          value={fmtDec(totalTons, 2) + ' tn'}
          sub="Total de toneladas"
          icon={Scale}
          gradient="linear-gradient(135deg,#00e89d,#00d4ff)"
          iconBg="rgba(0,232,157,0.12)"
        />
        <KPICard
          label="Total a cobrar (mes actual)"
          value={'$ ' + fmt(totalCobrar)}
          sub="Importe total generado"
          icon={DollarSign}
          gradient="linear-gradient(135deg,#ffa502,#ff4757)"
          iconBg="rgba(255,165,2,0.12)"
        />
        <KPICard
          label="Quincena actual"
          value={quincena.label}
          sub={`Del ${quincena.desde} al ${quincena.hasta}`}
          icon={CalendarDays}
          gradient="linear-gradient(135deg,#7c5fff,#ff6b9d)"
          iconBg="rgba(124,95,255,0.12)"
        />
      </div>

      {/* ── Últimos viajes cargados ── */}
      <div className="bg-bg-secondary border border-border-color rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-color">
          <h3 className="text-sm font-semibold text-text-primary">Últimos viajes cargados</h3>
          <Link href="/viajes" className="flex items-center gap-1 text-xs text-accent-cyan hover:underline">
            Ver todos los viajes <ArrowRight size={12} />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                {['Fecha','Remito','Matrícula','Chofer','Destino','Toneladas','Tarifa/Tn','Total a cobrar','Quincena'].map(h => (
                  <th key={h} className="table-header text-left whitespace-nowrap px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ultimosViajes.length === 0 ? (
                <tr><td colSpan={9} className="py-12 text-center text-text-secondary">Sin viajes registrados</td></tr>
              ) : ultimosViajes.map(v => {
                const fecha = v.fecha_descarga ?? v.fecha_carga ?? v.fecha
                const remito = v.numero_remito_carga || v.numero_remito
                const qLabel = quincenaDeViaje(v.fecha_carga ?? v.fecha)
                return (
                  <tr key={v.id} className="table-row-hover border-b border-border-color/40">
                    <td className="table-cell px-4 font-mono whitespace-nowrap">{fecha}</td>
                    <td className="table-cell px-4 font-mono text-accent-cyan">{remito}</td>
                    <td className="table-cell px-4">
                      <span className="bg-accent-cyan/10 text-accent-cyan px-2 py-0.5 rounded font-mono font-semibold">{v.matricula}</span>
                    </td>
                    <td className="table-cell px-4 whitespace-nowrap font-medium text-text-primary">{v.chofer_nombre}</td>
                    <td className="table-cell px-4">
                      <span className="bg-bg-tertiary border border-border-color px-2 py-0.5 rounded text-text-primary">{v.destino}</span>
                    </td>
                    <td className="table-cell px-4 font-mono text-right">{fmtDec(v.toneladas, 2)}</td>
                    <td className="table-cell px-4 font-mono text-right">${fmt(v.tarifa_aplicada)}</td>
                    <td className="table-cell px-4 font-mono text-right text-success font-semibold">$ {fmt(v.importe)}</td>
                    <td className="table-cell px-4">
                      <span className="bg-success/10 text-success border border-success/20 px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap">
                        {qLabel}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {pendientesCnt > 0 && (
          <div className="px-6 py-3 border-t border-border-color flex items-center gap-2 text-xs text-warning">
            <span className="w-1.5 h-1.5 rounded-full bg-warning inline-block" />
            {pendientesCnt} {pendientesCnt === 1 ? 'viaje pendiente' : 'viajes pendientes'} de cobro este mes
          </div>
        )}
      </div>

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Donut destinos */}
        <div className="lg:col-span-2 bg-bg-secondary border border-border-color rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-4">Total por destino (mes actual)</h3>
          {donutData.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-text-secondary text-xs">Sin datos este mes</div>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={140} height={140}>
                <PieChart>
                  <Pie data={donutData} cx="50%" cy="50%" innerRadius={40} outerRadius={65}
                    dataKey="value" paddingAngle={2}>
                    {donutData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip
                    formatter={(v: number) => [fmtDec(v, 2) + ' tn', '']}
                    contentStyle={tooltipStyle.contentStyle}
                    itemStyle={tooltipStyle.itemStyle}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-2 flex-1 min-w-0">
                {donutData.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="text-xs text-text-secondary truncate flex-1">{d.name}</span>
                    <span className="font-mono text-xs text-text-primary flex-shrink-0">{fmtDec(d.value, 1)} tn</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Line chart 7 días */}
        <div className="lg:col-span-3 bg-bg-secondary border border-border-color rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={15} className="text-accent-cyan" />
            <h3 className="text-sm font-semibold text-text-primary">Evolución de toneladas (últimos 7 días)</h3>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={lineData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#00d4ff" />
                  <stop offset="100%" stopColor="#00e89d" />
                </linearGradient>
              </defs>
              <XAxis dataKey="dia" tick={{ fill: '#6a6b80', fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip
                formatter={(v: number) => [fmtDec(v, 2) + ' tn', 'Toneladas']}
                contentStyle={tooltipStyle.contentStyle}
                labelStyle={tooltipStyle.labelStyle}
                itemStyle={tooltipStyle.itemStyle}
              />
              <Line
                type="monotone" dataKey="toneladas"
                stroke="url(#lineGrad)" strokeWidth={2.5}
                dot={{ r: 4, fill: '#00d4ff', strokeWidth: 0 }}
                activeDot={{ r: 6, fill: '#00e89d' }}
              />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-border-color">
            <span className="text-xs text-text-secondary">
              Total 7 días: <span className="font-mono text-text-primary font-semibold">
                {fmtDec(lineData.reduce((s, d) => s + d.toneladas, 0), 2)} tn
              </span>
            </span>
            <span className="text-xs text-text-secondary">
              Prom/día: <span className="font-mono text-text-primary font-semibold">
                {fmtDec(lineData.reduce((s, d) => s + d.toneladas, 0) / 7, 2)} tn
              </span>
            </span>
          </div>
        </div>
      </div>

    </div>
  )
}
