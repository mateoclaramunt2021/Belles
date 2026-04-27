import type { LucideIcon } from 'lucide-react'

interface KPICardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  color?: 'cyan' | 'purple' | 'green' | 'red' | 'orange'
  trend?: {
    value: number
    label: string
  }
  isMoney?: boolean
}

const colorMap = {
  cyan:   { bg: 'bg-accent-cyan/10',   border: 'border-accent-cyan/20',   icon: 'text-accent-cyan',   text: 'text-accent-cyan' },
  purple: { bg: 'bg-accent-purple/10', border: 'border-accent-purple/20', icon: 'text-accent-purple', text: 'text-accent-purple' },
  green:  { bg: 'bg-success/10',       border: 'border-success/20',       icon: 'text-success',       text: 'text-success' },
  red:    { bg: 'bg-danger/10',        border: 'border-danger/20',        icon: 'text-danger',        text: 'text-danger' },
  orange: { bg: 'bg-warning/10',       border: 'border-warning/20',       icon: 'text-warning',       text: 'text-warning' },
}

export function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  color = 'cyan',
  trend,
  isMoney = false,
}: KPICardProps) {
  const c = colorMap[color]

  const formattedValue =
    typeof value === 'number' && isMoney
      ? `$${value.toLocaleString('es-UY', { maximumFractionDigits: 0 })}`
      : typeof value === 'number'
      ? value.toLocaleString('es-UY')
      : value

  return (
    <div className={`card border ${c.border} flex flex-col gap-4`}>
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-lg ${c.bg} ${c.border} border flex items-center justify-center flex-shrink-0`}>
          <Icon size={20} className={c.icon} />
        </div>
        {trend && (
          <span
            className={`text-xs font-medium px-2 py-1 rounded-full ${
              trend.value >= 0
                ? 'bg-success/10 text-success'
                : 'bg-danger/10 text-danger'
            }`}
          >
            {trend.value >= 0 ? '+' : ''}{trend.value}% {trend.label}
          </span>
        )}
      </div>
      <div>
        <p className="text-xs text-text-secondary font-medium uppercase tracking-wide mb-1">
          {title}
        </p>
        <p className={`text-2xl font-bold font-data ${c.text}`}>
          {formattedValue}
        </p>
        {subtitle && (
          <p className="text-xs text-text-secondary mt-1">{subtitle}</p>
        )}
      </div>
    </div>
  )
}
