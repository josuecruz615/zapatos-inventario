import * as P from '@radix-ui/react-popover'
import { Command } from 'cmdk'
import { AlertTriangle, Check, ChevronsUpDown, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { useClientes } from '@/lib/api'
import type { Cliente } from '@/lib/types'
import { cn, normalizar, telefonoBonito } from '@/lib/utils'
import { ClienteForm } from './ClienteForm'

export function ClienteSelector({ value, onChange }: { value: number | null; onChange: (c: Cliente) => void }) {
  const { data, isLoading } = useClientes()
  const [abierto, setAbierto] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [crear, setCrear] = useState(false)
  const actual = data?.find((c) => c.id === value) ?? null

  return (
    <>
      <P.Root open={abierto} onOpenChange={setAbierto}>
        <P.Trigger asChild>
          <button type="button" role="combobox" aria-expanded={abierto}
            className={cn('flex h-11 w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-input bg-card px-3 text-left text-sm shadow-xs hover:bg-muted/40',
              actual?.problemas && 'border-warning')}>
            {actual ? (
              <span className="min-w-0">
                <span className="block truncate font-medium">{actual.nombre}</span>
                {actual.telefono && <span className="block text-xs text-muted-foreground">{telefonoBonito(actual.telefono)}</span>}
              </span>
            ) : <span className="text-muted-foreground">{isLoading ? 'Cargando clientes…' : 'Selecciona un cliente'}</span>}
            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
          </button>
        </P.Trigger>
        <P.Portal>
          <P.Content align="start" sideOffset={6} collisionPadding={12}
            className="z-50 w-(--radix-popover-trigger-width) min-w-72 animate-in overflow-hidden rounded-xl border border-border bg-card shadow-xl">
            <Command filter={(valor, buscar) => (normalizar(valor).includes(normalizar(buscar)) ? 1 : 0)}>
              <Command.Input value={busqueda} onValueChange={setBusqueda} autoFocus placeholder="Buscar por nombre o teléfono…"
                className="h-12 w-full border-b border-border bg-transparent px-3 text-base outline-none sm:h-11 sm:text-sm placeholder:text-muted-foreground" />
              <Command.List className="max-h-72 overflow-y-auto p-1">
                <Command.Empty className="px-3 py-6 text-center text-sm text-muted-foreground">No se encontró “{busqueda}”.</Command.Empty>
                {data?.map((c) => (
                  <Command.Item key={c.id} value={`${c.nombre} ${c.telefono ?? ''} #${c.id}`}
                    onSelect={() => { onChange(c); setAbierto(false); setBusqueda('') }}
                    className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm data-[selected=true]:bg-muted">
                    <Check className={cn('size-4 shrink-0', c.id === value ? 'opacity-100' : 'opacity-0')} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{c.nombre}</span>
                      {c.telefono && <span className="block text-xs text-muted-foreground">{telefonoBonito(c.telefono)}</span>}
                    </span>
                    {c.problemas && <AlertTriangle className="size-4 text-warning" aria-label="Cliente con problemas" />}
                  </Command.Item>
                ))}
              </Command.List>
              <button type="button" onClick={() => { setAbierto(false); setCrear(true) }}
                className="flex w-full cursor-pointer items-center gap-2 border-t border-border px-3 py-2.5 text-sm font-medium text-accent hover:bg-muted">
                <UserPlus className="size-4" /> Nuevo cliente{busqueda ? `: “${busqueda}”` : ''}
              </button>
            </Command>
          </P.Content>
        </P.Portal>
      </P.Root>
      {actual?.problemas && (
        <p className="mt-2 flex items-start gap-2 rounded-lg bg-warning/15 px-3 py-2 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
          <span>Este cliente está marcado <strong>con problemas</strong>.{actual.notas ? ` ${actual.notas}` : ''}</span>
        </p>
      )}
      <ClienteForm open={crear} cliente={null} nombreInicial={busqueda}
        onClose={(c) => { setCrear(false); if (c) onChange(c); setBusqueda('') }} />
    </>
  )
}
