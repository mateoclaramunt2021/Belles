type BadgeVariant = 'success' | 'danger' | 'warning' | 'cyan' | 'purple' | 'neutral'

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  size?: 'sm' | 'md'
  dot?: boolean
}

const variantMap: Record<BadgeVariant, string> = {
  success: 'bg-success/10 text-success border-success/30',
  danger:  'bg-danger/10 text-danger border-danger/30',
  warning: 'bg-warning/10 text-warning border-warning/30',
  cyan:    'bg-accent-cyan/10 text-accent-cyan border-accent-cyan/30',
  purple:  'bg-accent-purple/10 text-accent-purple border-accent-purple/30',
  neutral: 'bg-bg-tertiary text-text-secondary border-border-color',
}

const dotColorMap: Record<BadgeVariant, string> = {
  success: 'bg-success',
  danger:  'bg-danger',
  warning: 'bg-warning',
  cyan:    'bg-accent-cyan',
  purple:  'bg-accent-purple',
  neutral: 'bg-text-secondary',
}

export function Badge({ children, variant = 'neutral', size = 'sm', dot = false }: BadgeProps) {
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1'

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 font-medium rounded-full border
        ${variantMap[variant]} ${sizeClass}
      `}
    >
      {dot && (
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColorMap[variant]}`} />
      )}
      {children}
    </span>
  )
}

// Badges específicos del sistema
export function EstadoCobro({ estado }: { estado: 'pendiente' | 'cobrado' }) {
  return (
    <Badge variant={estado === 'cobrado' ? 'success' : 'warning'} dot>
      {estado === 'cobrado' ? 'Cobrado' : 'Pendiente'}
    </Badge>
  )
}

export function EstadoCamion({ estado }: { estado: 'activo' | 'taller' | 'inactivo' }) {
  const variants: Record<string, BadgeVariant> = {
    activo:   'success',
    taller:   'warning',
    inactivo: 'danger',
  }
  const labels: Record<string, string> = {
    activo: 'Activo', taller: 'En taller', inactivo: 'Inactivo'
  }
  return <Badge variant={variants[estado]} dot>{labels[estado]}</Badge>
}

export function EstadoLiquidacion({ estado }: { estado: 'abierta' | 'cerrada' | 'cobrada' }) {
  const variants: Record<string, BadgeVariant> = {
    abierta:  'cyan',
    cerrada:  'purple',
    cobrada:  'success',
  }
  const labels: Record<string, string> = {
    abierta: 'Abierta', cerrada: 'Cerrada', cobrada: 'Cobrada'
  }
  return <Badge variant={variants[estado]} dot>{labels[estado]}</Badge>
}
