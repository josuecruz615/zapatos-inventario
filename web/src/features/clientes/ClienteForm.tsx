import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field, Input, Switch, Textarea } from '@/components/ui/form'
import { useGuardarCliente } from '@/lib/api'
import type { Cliente } from '@/lib/types'
import { mensajeError } from '@/lib/utils'

const esquema = z.object({
  nombre: z.string().trim().min(2, 'Escribe el nombre completo'),
  telefono: z.string().trim().refine((v) => v === '' || v.replace(/\D/g, '').length >= 8, 'El teléfono debe tener al menos 8 dígitos'),
  direccion: z.string().trim(),
  notas: z.string().trim(),
  problemas: z.boolean(),
})
type Valores = z.infer<typeof esquema>

export function ClienteForm({ open, cliente, onClose, nombreInicial }: {
  open: boolean; cliente: Cliente | null; onClose: (guardado?: Cliente) => void; nombreInicial?: string
}) {
  const guardar = useGuardarCliente()
  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<Valores>({ resolver: zodResolver(esquema) })

  useEffect(() => {
    if (open) reset({
      nombre: cliente?.nombre ?? nombreInicial ?? '', telefono: cliente?.telefono ?? '', direccion: cliente?.direccion ?? '',
      notas: cliente?.notas ?? '', problemas: cliente?.problemas ?? false,
    })
  }, [open, cliente, nombreInicial, reset])

  const enviar = handleSubmit(async (v) => {
    try {
      const c = await guardar.mutateAsync({
        id: cliente?.id, nombre: v.nombre, telefono: v.telefono || null, direccion: v.direccion || null, notas: v.notas || null, problemas: v.problemas,
      })
      toast.success(cliente ? 'Cliente actualizado' : 'Cliente creado')
      onClose(c)
    } catch (e) { toast.error(mensajeError(e)) }
  })

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()} title={cliente ? 'Editar cliente' : 'Nuevo cliente'}
      footer={<>
        <Button variant="outline" onClick={() => onClose()}>Cancelar</Button>
        <Button onClick={enviar} loading={guardar.isPending}>{cliente ? 'Guardar cambios' : 'Crear cliente'}</Button>
      </>}>
      <form onSubmit={enviar} className="grid gap-4">
        <Field label="Nombre completo" error={errors.nombre?.message} htmlFor="c-nombre">
          <Input id="c-nombre" autoFocus autoComplete="off" aria-invalid={!!errors.nombre} {...register('nombre')} />
        </Field>
        <Field label="Teléfono" error={errors.telefono?.message} hint="Se usa para enviarle el recibo por WhatsApp." htmlFor="c-tel">
          <Input id="c-tel" type="tel" inputMode="tel" placeholder="5555-1234" aria-invalid={!!errors.telefono} {...register('telefono')} />
        </Field>
        <Field label="Dirección" htmlFor="c-dir">
          <Textarea id="c-dir" rows={2} placeholder="Zona, municipio, referencias" {...register('direccion')} />
        </Field>
        <Field label="Notas" hint="Talla que usa, preferencias, etc." htmlFor="c-notas">
          <Textarea id="c-notas" rows={2} {...register('notas')} />
        </Field>
        <Controller control={control} name="problemas" render={({ field }) => (
          <Switch checked={field.value} onChange={field.onChange} label="Cliente con problemas"
            description="Se mostrará una alerta al venderle (pagos pendientes, devoluciones, etc.)." />
        )} />
      </form>
    </Dialog>
  )
}
