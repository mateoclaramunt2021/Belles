'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { Sidebar, MobileHeader, MobileDrawer } from '@/components/layout/Sidebar'
import { useAuth } from '@/contexts/AuthContext'

const pageTitles: Record<string, string> = {
  '/dashboard':    'Dashboard General',
  '/viajes':       'Control de Viajes',
  '/viajes/nuevo': 'Nuevo Viaje',
  '/camiones':     'Flota de Camiones',
  '/choferes':     'Choferes',
  '/clientes':     'Clientes',
  '/reportes':     'Reportes y Análisis',
  '/gasoil':       'Control de Gasoil',
  '/tarifas':      'Tarifas',
  '/liquidaciones':'Liquidaciones',
  '/chat':         'Chat con Choferes',
  '/importar':     'Importar desde Excel',
}

function Topbar() {
  const pathname = usePathname()
  const { profile } = useAuth()
  const title = pageTitles[pathname] ?? 'TransControl'
  const initials = profile?.nombre?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() ?? 'TC'

  return (
    <div
      className="hidden md:flex h-14 bg-bg-secondary border-b border-border-color items-center justify-between px-7 sticky top-0 z-20"
    >
      <span className="text-sm font-semibold text-text-primary">{title}</span>
      <div className="flex items-center gap-4">
        <span
          className="text-xs font-bold px-3 py-1 rounded-full"
          style={{ background: '#00d4ff', color: '#0a0b10' }}
        >
          {(profile?.rol ?? 'ADMIN').toUpperCase()}
        </span>
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-bg-primary"
          style={{ background: 'linear-gradient(135deg, #00d4ff, #7c5fff)' }}
        >
          {initials}
        </div>
      </div>
    </div>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Sidebar fijo - solo desktop */}
      <Sidebar />

      {/* Header móvil */}
      <MobileHeader onMenuClick={() => setDrawerOpen(true)} />

      {/* Drawer móvil */}
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {/* Contenido principal */}
      <main className="md:ml-60 min-h-screen flex flex-col">
        <Topbar />
        <div className="pt-16 md:pt-0 px-4 md:px-7 py-6 flex-1">
          {children}
        </div>
      </main>
    </div>
  )
}
