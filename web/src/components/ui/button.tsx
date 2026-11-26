import { LoaderCircle } from 'lucide-react'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const variantes = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm',
  accent: 'bg-accent text-accent-foreground hover:bg-accent/90 shadow-sm',
  secondary: 'bg-muted text-foreground hover:bg-muted/70',
  outline: 'border border-input bg-card hover:bg-muted text-foreground shadow-xs',
  ghost: 'hover:bg-muted text-foreground',
  danger: 'bg-danger text-white hover:bg-danger/90 shadow-sm',
  'danger-ghost': 'text-danger hover:bg-danger/10',
} as const

const tamanos = {
  sm: 'h-10 sm:h-8 px-3 text-sm gap-1.5 rounded-lg',
  md: 'h-11 sm:h-10 px-4 text-sm gap-2 rounded-lg',
  lg: 'h-12 px-5 text-base gap-2 rounded-xl',
  icon: 'size-11 sm:size-10 rounded-lg',
  'icon-sm': 'size-10 sm:size-8 rounded-lg',
} as const

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variantes
  size?: keyof typeof tamanos
  loading?: boolean
}

export function Button({ variant = 'primary', size = 'md', loading, className, children, disabled, type = 'button', ...props }: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex shrink-0 cursor-pointer items-center justify-center font-medium whitespace-nowrap transition-[background-color,box-shadow,transform] select-none active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
        variantes[variant], tamanos[size], className,
      )}
      {...props}
    >
      {loading && <LoaderCircle className="animate-spin" />}
      {children}
    </button>
  )
}
