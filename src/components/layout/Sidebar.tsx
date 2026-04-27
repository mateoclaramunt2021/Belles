'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import {
  LayoutDashboard,
  Truck,
  Users,
  BarChart2,
  Fuel,
  Plus,
  List,
  X,
  Menu,
  LogOut,
  Upload,
} from 'lucide-react'

interface NavItem {
  href: string
  icon: React.ElementType
  label: string
}

interface NavSection {
  section: string
  items: NavItem[]
}

const adminNav: NavSection[] = [
  {
    section: 'Principal',
    items: [
      { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { href: '/viajes',    icon: List,            label: 'Viajes' },
      { href: '/camiones',  icon: Truck,           label: 'Camiones' },
      { href: '/choferes',  icon: Users,           label: 'Choferes' },
    ],
  },
  {
    section: 'Análisis',
    items: [
      { href: '/reportes', icon: BarChart2, label: 'Reportes' },
      { href: '/gasoil',   icon: Fuel,     label: 'Gasoil' },
    ],
  },
  {
    section: 'Herramientas',
    items: [
      { href: '/importar', icon: Upload, label: 'Importar Excel' },
    ],
  },
]

const choferNav: NavSection[] = [
  {
    section: 'Mi trabajo',
    items: [
      { href: '/dashboard',    icon: LayoutDashboard, label: 'Dashboard' },
      { href: '/viajes',       icon: List,            label: 'Mis Viajes' },
      { href: '/viajes/nuevo', icon: Plus,            label: 'Nuevo Viaje' },
    ],
  },
]

function NavLink({ item, active, onClick }: { item: NavItem; active: boolean; onClick?: () => void }) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      onClick={onClick}
      style={active ? { borderLeft: '3px solid #00d4ff', background: 'rgba(0,212,255,0.06)' } : { borderLeft: '3px solid transparent' }}
      className={`
        flex items-center gap-3 px-4 py-2.5 text-sm font-medium
        transition-all duration-150
        ${active ? 'text-accent-cyan' : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'}
      `}
    >
      <Icon size={17} className={active ? 'text-accent-cyan' : 'text-text-secondary'} style={{ opacity: active ? 1 : 0.7 }} />
      <span>{item.label}</span>
    </Link>
  )
}

// Pulse dot component
function PulseDot() {
  return (
    <span className="relative flex h-2 w-2">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
    </span>
  )
}

// ============================================================
// SIDEBAR DESKTOP (fijo a la izquierda)
// ============================================================
export function Sidebar() {
  const pathname = usePathname()
  const { profile, isAdmin, signOut } = useAuth()
  const nav = isAdmin ? adminNav : choferNav

  return (
    <aside className="hidden md:flex flex-col w-60 h-screen bg-bg-secondary border-r border-border-color fixed left-0 top-0 z-30">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-border-color flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg gradient-cyan flex items-center justify-center flex-shrink-0">
          <Truck size={18} className="text-white" />
        </div>
        <span className="text-xs font-semibold tracking-widest uppercase text-accent-cyan">Belles</span>
      </div>

      {/* Navegación */}
      <nav className="flex-1 py-3 overflow-y-auto">
        {nav.map((section) => (
          <div key={section.section} className="mb-1">
            <p className="px-5 py-2 text-xs font-semibold uppercase tracking-widest text-text-secondary/50">
              {section.section}
            </p>
            <div>
              {section.items.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  active={pathname === item.href}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-border-color">
        <div className="flex items-center gap-2 mb-1">
          <PulseDot />
          <span className="text-xs text-success font-medium">Sistema activo</span>
        </div>
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-accent-purple/20 border border-accent-purple/30 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-accent-purple uppercase">
                {profile?.nombre?.charAt(0) ?? '?'}
              </span>
            </div>
            <span className="text-xs text-text-secondary truncate max-w-[100px]">{profile?.nombre ?? 'Usuario'}</span>
          </div>
          <button
            onClick={signOut}
            title="Cerrar sesión"
            className="text-text-secondary hover:text-danger transition-colors p-1"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  )
}

// ============================================================
// DRAWER MÓVIL
// ============================================================
export function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname()
  const { profile, isAdmin, signOut } = useAuth()
  const nav = isAdmin ? adminNav : choferNav

  if (!open) return null

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/60 z-40 md:hidden animate-fade-in"
        onClick={onClose}
      />
      {/* Drawer */}
      <aside className="fixed left-0 top-0 bottom-0 w-72 bg-bg-secondary border-r border-border-color z-50 md:hidden flex flex-col animate-slide-in-left">
        {/* Header del drawer */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-color">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg gradient-cyan flex items-center justify-center">
              <Truck size={18} className="text-white" />
            </div>
            <span className="text-xs font-semibold tracking-widest uppercase text-accent-cyan">Belles</span>
          </div>
          <button onClick={onClose} className="btn-ghost p-2 rounded-lg">
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 overflow-y-auto">
          {nav.map((section) => (
            <div key={section.section} className="mb-1">
              <p className="px-5 py-2 text-xs font-semibold uppercase tracking-widest text-text-secondary/50">
                {section.section}
              </p>
              <div>
                {section.items.map((item) => (
                  <NavLink
                    key={item.href}
                    item={item}
                    active={pathname === item.href}
                    onClick={onClose}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border-color">
          <div className="flex items-center gap-2 mb-3">
            <PulseDot />
            <span className="text-xs text-success font-medium">Sistema activo</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-accent-purple/20 border border-accent-purple/30 flex items-center justify-center">
                <span className="text-xs font-bold text-accent-purple uppercase">
                  {profile?.nombre?.charAt(0) ?? '?'}
                </span>
              </div>
              <span className="text-xs text-text-secondary">{profile?.nombre ?? 'Usuario'}</span>
            </div>
            <button
              onClick={() => { signOut(); onClose() }}
              title="Cerrar sesión"
              className="text-text-secondary hover:text-danger transition-colors p-1"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}

// ============================================================
// MOBILE HEADER (top bar en pantallas pequeñas)
// ============================================================
export function MobileHeader({ onMenuClick }: { onMenuClick: () => void }) {
  return (
    <header className="md:hidden fixed top-0 left-0 right-0 z-30 bg-bg-secondary/95 backdrop-blur-sm border-b border-border-color">
      <div className="flex items-center justify-between px-4 py-3">
        <button
          onClick={onMenuClick}
          className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-all"
          aria-label="Abrir menú"
        >
          <Menu size={22} />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md gradient-cyan flex items-center justify-center">
            <Truck size={14} className="text-white" />
          </div>
          <span className="text-sm font-bold text-text-primary">TransControl</span>
        </div>
        <div className="w-10" /> {/* Spacer para centrar el logo */}
      </div>
    </header>
  )
}
