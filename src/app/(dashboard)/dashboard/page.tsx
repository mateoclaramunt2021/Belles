import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getDashboardKPIs, getGraficoMensual, getGraficoCamiones, getUltimosViajes } from '@/lib/queries/dashboard'
import { KPICard } from '@/components/ui/KPICard'
import { EstadoCobro } from '@/components/ui/Badge'
import DashboardCharts from './DashboardCharts'
import {
  TrendingUp, Wallet, Truck, Fuel, Weight, Clock, Plus
} from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const DEMO_MODE = !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL.includes('TU-PROYECTO')

export default async function DashboardPage() {
  // En demo mode, mostrar dashboard con datos vacíos sin Supabase
  if (DEMO_MODE) {
    const { default: DashboardCharts } = await import('./DashboardCharts')
    const mesActual = format(new Date(), 'MMMM yyyy', { locale: es })
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="text-text-secondary text-sm mt-0.5 capitalize">{mesActual}</p>
          </div>
          <Link href="/viajes/nuevo" className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={16} />
            <span className="hidden sm:inline">Nuevo Viaje</span>
          </Link>
        </div>
        <div className="card text-center py-8">
          <p className="text-text-secondary text-sm mb-2">Modo demo — conectá Supabase para ver datos reales</p>
          <p className="text-xs text-text-secondary/60">Configurá el archivo .env.local con tus credenciales</p>
        </div>
        <DashboardCharts graficoMensual={[]} graficoCamiones={[]} isAdmin={true} />
      </div>
    )
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('usuarios')
    .select('rol, nombre')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.rol === 'admin'

  const [kpis, graficoMensual, graficoCamiones, ultimosViajes] = await Promise.all([
    getDashboardKPIs(user.id, isAdmin),
    getGraficoMensual(user.id, isAdmin),
    isAdmin ? getGraficoCamiones() : Promise.resolve([]),
    getUltimosViajes(10, user.id, isAdmin),
  ])

  const mesActual = format(new Date(), 'MMMM yyyy', { locale: es })

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="text-text-secondary text-sm mt-0.5 capitalize">{mesActual}</p>
        </div>
        <Link href="/viajes/nuevo" className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={16} />
          <span className="hidden sm:inline">Nuevo Viaje</span>
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
        <KPICard
          title="Ingresos del mes"
          value={kpis.ingresos_mes}
          icon={TrendingUp}
          color="cyan"
          isMoney
        />
        <KPICard
          title="Beneficio neto"
          value={kpis.beneficio_neto}
          icon={Wallet}
          color={kpis.beneficio_neto >= 0 ? 'green' : 'red'}
          isMoney
        />
        <KPICard
          title="Viajes del mes"
          value={kpis.total_viajes_mes}
          icon={Truck}
          color="purple"
        />
        <KPICard
          title="Gasoil del mes"
          value={kpis.gasto_gasoil_mes}
          icon={Fuel}
          color="orange"
          isMoney
        />
        <KPICard
          title="Toneladas"
          value={kpis.toneladas_mes.toFixed(1)}
          icon={Weight}
          color="cyan"
          subtitle="toneladas movidas"
        />
        <KPICard
          title="Pendiente cobro"
          value={kpis.pendientes_cobro}
          icon={Clock}
          color="red"
          isMoney
        />
      </div>

      {/* Gráficos */}
      <DashboardCharts
        graficoMensual={graficoMensual}
        graficoCamiones={graficoCamiones}
        isAdmin={isAdmin}
      />

      {/* Tabla de últimos viajes */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-text-primary">
            {isAdmin ? 'Últimos viajes' : 'Mis últimos viajes'}
          </h2>
          <Link href="/viajes" className="text-xs text-accent-cyan hover:underline">
            Ver todos →
          </Link>
        </div>

        <div className="overflow-x-auto -mx-5">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="table-header text-left pl-5">Fecha</th>
                <th className="table-header text-left">Remito</th>
                <th className="table-header text-left">Matrícula</th>
                {isAdmin && <th className="table-header text-left hidden md:table-cell">Chofer</th>}
                <th className="table-header text-left hidden lg:table-cell">Destino</th>
                <th className="table-header text-right">Toneladas</th>
                <th className="table-header text-right">Importe</th>
                <th className="table-header text-left pr-5">Estado</th>
              </tr>
            </thead>
            <tbody>
              {ultimosViajes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-text-secondary">
                    No hay viajes registrados aún
                  </td>
                </tr>
              ) : (
                ultimosViajes.map((v) => (
                  <tr key={v.id} className="table-row-hover">
                    <td className="table-cell pl-5 font-data text-xs">{v.fecha}</td>
                    <td className="table-cell font-data text-xs text-accent-cyan">{v.numero_remito}</td>
                    <td className="table-cell font-data text-xs font-medium">{v.matricula}</td>
                    {isAdmin && (
                      <td className="table-cell hidden md:table-cell text-text-secondary">{v.chofer_nombre}</td>
                    )}
                    <td className="table-cell hidden lg:table-cell text-text-secondary">{v.destino}</td>
                    <td className="table-cell text-right font-data text-xs">
                      {v.toneladas?.toFixed(3)} t
                    </td>
                    <td className="table-cell text-right font-data text-xs font-medium text-success">
                      ${v.importe?.toLocaleString('es-UY')}
                    </td>
                    <td className="table-cell pr-5">
                      <EstadoCobro estado={v.estado_cobro} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
