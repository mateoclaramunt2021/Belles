'use client'

import { useState } from 'react'
import { Sidebar, MobileHeader, MobileDrawer } from '@/components/layout/Sidebar'

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
      <main className="md:ml-60 min-h-screen">
        <div className="pt-16 md:pt-0 px-4 md:px-8 py-6 md:py-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
