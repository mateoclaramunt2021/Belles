'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import {
  LayoutDashboard,
  Truck,
  Users,
  DollarSign,
  FileText,
  BarChart2,
  Fuel,
  Plus,
  List,
  X,
  Menu,
  LogOut,
  ChevronRight,
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
      { href: '/dashboard',      icon: LayoutDashboard, label: 'Dashboard' },
      { href: '/viajes',         icon: List,            label: 'Viajes' },
      { href: '/camiones',       icon: Truck,           label: 'Camiones' },
      { href: '/choferes',       icon: Users,           label: 'Choferes' },
    ],
  },
  {
    section: 'Gestión',
    items: [
      { href: '/tarifas',        icon: DollarSign,      label: 'Tarifas' },
      { href: '/liquidaciones',  icon: FileText,        label: 'Liquidaciones' },
    ],
  },
  {
    section: 'Análisis',
    items: [
      { href: '/reportes',       icon: BarChart2,       label: 'Reportes' },
      { href: '/gasoil',         icon: Fuel,            label: 'Gasoil' },
    ],
  },
]

const choferNav: NavSection[] = [
  {
    section: 'Mi trabajo',
    items: [
      { href: '/dashboard',      icon: LayoutDashboard, label: 'Dashboard' },
      { href: '/viajes',         icon: List,            label: 'Mis Viajes' },
      { href: '/viajes/nuevo',   icon: Plus,            label: 'Nuevo Viaje' },
    ],
  },
]

function NavLink({ item, active, onClick }: { item: NavItem; active: boolean; onClick?: () => void }) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={`
        flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
        transition-all duration-150 group
        ${active
          ? 'bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/20'
          : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
        }
      `}
    >
      <Icon size={18} className={active ? 'text-accent-cyan' : 'text-text-secondary group-hover:text-text-primary'} />
      <span className="flex-1">{item.label}</span>
      {active && <ChevronRight size={14} className="text-accent-cyan/60" />}
    </Link>
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
      <div className="px-5 py-5 border-b border-border-color">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg gradient-cyan flex items-center justify-center flex-shrink-0">
            <Truck size={20} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-text-primary leading-tight">TransControl</p>
            <p className="text-xs text-text-secondary leading-tight">Belles Uruguay</p>
          </div>
        </div>
      </div>

      {/* Navegación */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-5">
        {nav.map((section) => (
          <div key={section.section}>
            <p className="section-title px-3 mb-2">{section.section}</p>
            <div className="space-y-0.5">
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
      <div className="px-3 pb-4 border-t border-border-color pt-3">
        {/* Usuario actual */}
        <div className="flex items-center gap-3 px-3 py-2.5 mb-1">
          <div className="w-8 h-8 rounded-full bg-accent-purple/20 border border-accent-purple/30 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-accent-purple uppercase">
              {profile?.nombre?.charAt(0) ?? '?'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-text-primary truncate">{profile?.nombre ?? 'Usuario'}</p>
            <p className="text-xs text-text-secondary capitalize">{profile?.rol ?? ''}</p>
          </div>
        </div>
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm
                     text-text-secondary hover:text-danger hover:bg-danger/10
                     transition-all duration-150"
        >
          <LogOut size={16} />
          <span>Cerrar sesión</span>
        </button>
        <p className="text-center text-xs text-text-secondary/40 mt-3">
          Powered by Neuriax
        </p>
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
            <span className="text-sm font-bold text-text-primary">TransControl Belles</span>
          </div>
          <button onClick={onClose} className="btn-ghost p-2 rounded-lg">
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-5">
          {nav.map((section) => (
            <div key={section.section}>
              <p className="section-title px-3 mb-2">{section.section}</p>
              <div className="space-y-0.5">
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
        <div className="px-3 pb-5 border-t border-border-color pt-3">
          <div className="flex items-center gap-3 px-3 py-2.5 mb-1">
            <div className="w-9 h-9 rounded-full bg-accent-purple/20 border border-accent-purple/30 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-bold text-accent-purple uppercase">
                {profile?.nombre?.charAt(0) ?? '?'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-text-primary truncate">{profile?.nombre ?? 'Usuario'}</p>
              <p className="text-xs text-text-secondary capitalize">{profile?.rol ?? ''}</p>
            </div>
          </div>
          <button
            onClick={() => { signOut(); onClose() }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm
                       text-text-secondary hover:text-danger hover:bg-danger/10
                       transition-all duration-150"
          >
            <LogOut size={16} />
            <span>Cerrar sesión</span>
          </button>
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
