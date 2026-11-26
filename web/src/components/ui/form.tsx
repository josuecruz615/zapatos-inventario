import { Minus, Plus, Search, X } from 'lucide-react'
import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const base =
  'w-full appearance-none rounded-lg border border-input bg-card px-3 text-base sm:text-sm text-foreground [&::-webkit-date-and-time-value]:text-left shadow-xs transition-colors placeholder:text-muted-foreground/70 focus:border-ring focus:ring-3 focus:ring-ring/20 focus:outline-none disabled:opacity-60 aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/20'

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(base, 'h-11 sm:h-10', className)} {...props} />
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(base, 'min-h-20 py-2', className)} {...props} />
}

export function Field({ label, error, hint, children, className, htmlFor }: {
  label: ReactNode; error?: string; hint?: ReactNode; children: ReactNode; className?: string; htmlFor?: string
}) {
  return (
    <div className={cn('grid gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium">{label}</label>
      {children}
      {error ? <p className="text-xs text-danger" role="alert">{error}</p>
        : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

export function SearchInput({ value, onChange, placeholder = 'Buscar…', className, autoFocus }: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string; autoFocus?: boolean
}) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type="search"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        enterKeyHint="search"
        className={cn(base, 'h-11 pr-9 pl-9 sm:h-10 [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden')}
      />
      {value && (
        <button type="button" aria-label="Limpiar búsqueda" onClick={() => onChange('')}
          className="absolute top-1/2 right-2 grid size-6 -translate-y-1/2 cursor-pointer place-items-center rounded-md text-muted-foreground hover:bg-muted">
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )
}

export function Stepper({ value, onChange, min = 0, max = 9999, size = 'md', label }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number; size?: 'sm' | 'md'; label?: string
}) {
  const h = size === 'sm' ? 'h-10 sm:h-8' : 'h-11 sm:h-10'
  const w = size === 'sm' ? 'w-10 sm:w-8' : 'w-11 sm:w-10'
  return (
    <div className={cn('inline-flex items-stretch overflow-hidden rounded-lg border border-input bg-card shadow-xs', h)}>
      <button type="button" aria-label={`Restar${label ? ` ${label}` : ''}`} disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
        className={cn('grid cursor-pointer place-items-center text-muted-foreground hover:bg-muted disabled:opacity-40', w)}>
        <Minus className="size-3.5" />
      </button>
      <input
        inputMode="numeric"
        aria-label={label ?? 'Cantidad'}
        value={value}
        onChange={(e) => {
          const v = parseInt(e.target.value.replace(/\D/g, '') || '0', 10)
          onChange(Math.min(max, Math.max(min, v)))
        }}
        onFocus={(e) => e.target.select()}
        className="tabular w-11 border-x border-input bg-transparent text-center text-base font-semibold focus:outline-none sm:text-sm"
      />
      <button type="button" aria-label={`Sumar${label ? ` ${label}` : ''}`} disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
        className={cn('grid cursor-pointer place-items-center text-muted-foreground hover:bg-muted disabled:opacity-40', w)}>
        <Plus className="size-3.5" />
      </button>
    </div>
  )
}

export function Switch({ checked, onChange, label, description }: {
  checked: boolean; onChange: (v: boolean) => void; label: ReactNode; description?: ReactNode
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-lg border border-border p-3 hover:bg-muted/50">
      <span className="grid gap-0.5">
        <span className="text-sm font-medium">{label}</span>
        {description && <span className="text-xs text-muted-foreground">{description}</span>}
      </span>
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={cn('relative mt-0.5 h-6 w-10 shrink-0 cursor-pointer rounded-full transition-colors', checked ? 'bg-accent' : 'bg-input')}>
        <span className={cn('absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform', checked && 'translate-x-4')} />
      </button>
    </label>
  )
}

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(base, 'h-11 cursor-pointer pr-8 sm:h-10', className)} {...props}>{children}</select>
}
