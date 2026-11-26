import * as D from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Button } from './button'

const overlay = 'fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-in'

/** Ventana centrada en escritorio; en celular sube desde abajo. */
export function Dialog({ open, onOpenChange, title, description, children, footer, className }: {
  open: boolean; onOpenChange: (v: boolean) => void; title: ReactNode; description?: ReactNode
  children?: ReactNode; footer?: ReactNode; className?: string
}) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className={overlay} />
        <D.Content
          className={cn(
            'fixed z-50 flex max-h-[92dvh] w-full flex-col bg-card shadow-2xl outline-none',
            'inset-x-0 bottom-0 animate-slide-up rounded-t-2xl',
            'sm:inset-auto sm:top-1/2 sm:left-1/2 sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:animate-in sm:rounded-2xl',
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div className="grid gap-1">
              <D.Title className="text-base font-semibold">{title}</D.Title>
              {description ? <D.Description className="text-sm text-muted-foreground">{description}</D.Description>
                : <D.Description className="sr-only">{typeof title === 'string' ? title : ''}</D.Description>}
            </div>
            <D.Close asChild><Button variant="ghost" size="icon-sm" aria-label="Cerrar"><X /></Button></D.Close>
          </div>
          <div className={cn('flex-1 overscroll-contain overflow-y-auto px-5 py-4', !footer && 'pb-[max(1rem,env(safe-area-inset-bottom))]')}>{children}</div>
          {footer && <div className="pb-safe flex flex-wrap justify-end gap-2 border-t border-border px-5 py-3">{footer}</div>}
        </D.Content>
      </D.Portal>
    </D.Root>
  )
}

/** Panel lateral (detalle). En celular ocupa la pantalla. */
export function Sheet({ open, onOpenChange, title, description, children, footer, className }: {
  open: boolean; onOpenChange: (v: boolean) => void; title: ReactNode; description?: ReactNode
  children?: ReactNode; footer?: ReactNode; className?: string
}) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className={overlay} />
        <D.Content className={cn(
          'pt-safe fixed inset-y-0 right-0 z-50 flex w-full animate-slide-in flex-col bg-card shadow-2xl outline-none sm:max-w-xl sm:border-l sm:border-border',
          className,
        )}>
          <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div className="grid min-w-0 gap-1">
              <D.Title className="truncate text-base font-semibold">{title}</D.Title>
              {description ? <D.Description className="text-sm text-muted-foreground">{description}</D.Description>
                : <D.Description className="sr-only">Detalle</D.Description>}
            </div>
            <D.Close asChild><Button variant="ghost" size="icon-sm" aria-label="Cerrar"><X /></Button></D.Close>
          </div>
          <div className={cn('flex-1 overscroll-contain overflow-y-auto px-5 py-5', !footer && 'pb-[max(1.25rem,env(safe-area-inset-bottom))]')}>{children}</div>
          {footer && <div className="pb-safe flex flex-wrap justify-end gap-2 border-t border-border px-5 py-3">{footer}</div>}
        </D.Content>
      </D.Portal>
    </D.Root>
  )
}

// ---------------------------------------------------------------- Confirmación
type Opciones = { titulo: string; mensaje?: ReactNode; confirmar?: string; peligro?: boolean }
const ConfirmCtx = createContext<(o: Opciones) => Promise<boolean>>(async () => false)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opciones, setOpciones] = useState<Opciones | null>(null)
  const resolver = useRef<(v: boolean) => void>(null)
  const preguntar = useCallback((o: Opciones) => new Promise<boolean>((res) => {
    resolver.current = res
    setOpciones(o)
  }), [])
  const cerrar = (v: boolean) => { resolver.current?.(v); setOpciones(null) }
  return (
    <ConfirmCtx.Provider value={preguntar}>
      {children}
      <Dialog
        open={!!opciones}
        onOpenChange={(v) => !v && cerrar(false)}
        title={opciones?.titulo}
        footer={<>
          <Button variant="outline" onClick={() => cerrar(false)}>Cancelar</Button>
          <Button variant={opciones?.peligro ? 'danger' : 'primary'} onClick={() => cerrar(true)} autoFocus>
            {opciones?.confirmar ?? 'Confirmar'}
          </Button>
        </>}
      >
        <div className="text-sm text-muted-foreground">{opciones?.mensaje}</div>
      </Dialog>
    </ConfirmCtx.Provider>
  )
}

export const useConfirm = () => useContext(ConfirmCtx)
