import { ImageOff, type LucideIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('min-w-0 rounded-2xl border border-border bg-card shadow-xs', className)}>{children}</div>
}

export function Badge({ tone = 'neutral', className, children }: {
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'accent' | 'outline'; className?: string; children: ReactNode
}) {
  const tonos = {
    neutral: 'bg-muted text-muted-foreground',
    success: 'bg-success/12 text-success',
    warning: 'bg-warning/18 text-[color-mix(in_oklch,var(--warning),black_35%)] dark:text-warning',
    danger: 'bg-danger/12 text-danger',
    accent: 'bg-accent/12 text-accent',
    outline: 'border border-border text-muted-foreground',
  }
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap [&_svg]:size-3', tonos[tone], className)}>
      {children}
    </span>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-muted', className)} />
}

export function Spinner({ className }: { className?: string }) {
  return <div className={cn('size-5 animate-spin rounded-full border-2 border-muted border-t-accent', className)} />
}

export function Empty({ icon: Icon, title, description, action }: {
  icon: LucideIcon; title: string; description?: ReactNode; action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border px-6 py-14 text-center">
      <div className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground"><Icon className="size-6" /></div>
      <div className="grid gap-1">
        <p className="font-semibold">{title}</p>
        {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function Segmented<T extends string>({ value, onChange, options, className }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; className?: string
}) {
  return (
    <div role="radiogroup" className={cn('inline-flex rounded-lg bg-muted p-1', className)}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
          className={cn('h-9 sm:h-8 cursor-pointer rounded-md px-3 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors',
            value === o.value && 'bg-card text-foreground shadow-sm')}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Chip({ active, onClick, children, className, disabled }: {
  active?: boolean; onClick?: () => void; children: ReactNode; className?: string; disabled?: boolean
}) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick} disabled={disabled}
      className={cn('inline-flex h-10 sm:h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 sm:px-3 text-sm font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:bg-muted', className)}>
      {children}
    </button>
  )
}

/** Foto de producto con carga diferida y respaldo si la imagen no existe. */
export function FotoProducto({ src, alt, className }: { src: string | null; alt: string; className?: string }) {
  const [fallo, setFallo] = useState(false)
  const [cargada, setCargada] = useState(false)
  if (!src || fallo) {
    return (
      <div className={cn('grid place-items-center bg-muted text-muted-foreground', className)}>
        <ImageOff className="size-6" aria-label="Sin foto" />
      </div>
    )
  }
  return (
    <img src={src} alt={alt} loading="lazy" decoding="async" onError={() => setFallo(true)} onLoad={() => setCargada(true)}
      className={cn('bg-muted object-cover transition-opacity', cargada ? 'opacity-100' : 'opacity-0', className)} />
  )
}

/** Color según existencia: 0 agotado, 1-2 bajo, 3+ bien. */
export function tonoExistencia(n: number): 'danger' | 'warning' | 'success' {
  return n <= 0 ? 'danger' : n <= 2 ? 'warning' : 'success'
}

export function Stat({ label, value, hint, icon: Icon, tone }: {
  label: string; value: ReactNode; hint?: ReactNode; icon?: LucideIcon; tone?: 'accent' | 'success' | 'warning' | 'danger'
}) {
  const tonos = { accent: 'bg-accent/12 text-accent', success: 'bg-success/12 text-success', warning: 'bg-warning/18 text-warning', danger: 'bg-danger/12 text-danger' }
  return (
    <Card className="grid gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {Icon && <div className={cn('grid size-8 place-items-center rounded-lg', tone ? tonos[tone] : 'bg-muted text-muted-foreground')}><Icon className="size-4" /></div>}
      </div>
      <p className="tabular text-2xl font-semibold tracking-tight">{value}</p>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </Card>
  )
}
