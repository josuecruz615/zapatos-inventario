import { zodResolver } from '@hookform/resolvers/zod'
import { Camera, ImagePlus, Plus, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field, Input, Stepper, Textarea } from '@/components/ui/form'
import { subirFoto, useActualizarProducto, useCrearProducto, useMarcas } from '@/lib/api'
import type { Producto } from '@/lib/types'
import { mensajeError, talla } from '@/lib/utils'

const esquema = z.object({
  codigo: z.string().trim().min(1, 'Escribe el código'),
  nombre: z.string().trim().min(1, 'Escribe el nombre'),
  marca: z.string().trim().min(1, 'Escribe la marca'),
  precio: z.coerce.number<string>({ error: 'Precio inválido' }).min(0, 'Precio inválido'),
  costo: z.string().trim().refine((v) => v === '' || Number(v) >= 0, 'Costo inválido'),
  descripcion: z.string().trim(),
})
type Valores = z.input<typeof esquema>

const TALLAS_BASE = [22, 22.5, 23, 23.5, 24, 24.5, 25, 25.5]

export function ProductoForm({ open, producto, onClose }: {
  open: boolean; producto: Producto | null; onClose: (creadoId?: number) => void
}) {
  const editando = !!producto
  const marcas = useMarcas()
  const crear = useCrearProducto()
  const actualizar = useActualizarProducto()
  const [archivo, setArchivo] = useState<File | null>(null)
  const [vista, setVista] = useState<string | null>(null)
  const [tallas, setTallas] = useState<Record<number, number>>({})
  const [nuevaTalla, setNuevaTalla] = useState('')
  const [guardando, setGuardando] = useState(false)

  const { register, handleSubmit, reset, formState: { errors } } = useForm<Valores, unknown, z.output<typeof esquema>>({ resolver: zodResolver(esquema) })

  useEffect(() => {
    if (!open) return
    reset({
      codigo: producto?.codigo ?? '', nombre: producto?.nombre ?? '', marca: producto?.marca ?? '',
      precio: producto ? String(producto.precio) : '', costo: producto?.costo != null ? String(producto.costo) : '',
      descripcion: producto?.descripcion ?? '',
    })
    setArchivo(null)
    setVista(producto?.imagen_url ?? null)
    setTallas(Object.fromEntries(TALLAS_BASE.map((t) => [t, 0])))
  }, [open, producto, reset])

  useEffect(() => () => { if (vista?.startsWith('blob:')) URL.revokeObjectURL(vista) }, [vista])

  function elegirFoto(f: File | undefined) {
    if (!f) return
    if (!f.type.startsWith('image/')) return toast.error('El archivo debe ser una imagen')
    if (f.size > 15 * 1024 * 1024) return toast.error('La imagen pesa más de 15 MB')
    setArchivo(f)
    setVista(URL.createObjectURL(f))
  }

  function agregarTalla() {
    const t = Number(nuevaTalla.replace(',', '.'))
    if (!t || t <= 0 || t > 60 || (t * 2) % 1 !== 0) return toast.error('Escribe una talla válida, por ejemplo 26 o 26.5')
    setTallas((x) => ({ ...x, [t]: x[t] ?? 0 }))
    setNuevaTalla('')
  }

  const enviar = handleSubmit(async (d) => {
    setGuardando(true)
    try {
      const imagen_url = archivo ? await subirFoto(archivo, d.codigo) : (producto?.imagen_url ?? null)
      const datos = {
        codigo: d.codigo, nombre: d.nombre, marca: d.marca, precio: d.precio,
        costo: d.costo === '' ? null : Number(d.costo), descripcion: d.descripcion || null, imagen_url,
      }
      if (producto) {
        await actualizar.mutateAsync({ id: producto.id, ...datos })
        toast.success('Producto actualizado')
        onClose()
      } else {
        const id = await crear.mutateAsync({
          ...datos,
          tallas: Object.entries(tallas).map(([t, e]) => ({ talla: Number(t), existencia: e })).sort((a, b) => a.talla - b.talla),
        })
        toast.success('Producto creado')
        onClose(id)
      }
    } catch (e) {
      toast.error(mensajeError(e))
    } finally {
      setGuardando(false)
    }
  })

  const listaTallas = Object.keys(tallas).map(Number).sort((a, b) => a - b)
  const totalPares = listaTallas.reduce((s, t) => s + tallas[t], 0)

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()} className="sm:max-w-2xl"
      title={editando ? 'Editar producto' : 'Nuevo producto'}
      description={editando ? 'Las existencias se ajustan desde el detalle del producto.' : 'Registra el modelo con su foto y las existencias por talla.'}
      footer={<>
        <Button variant="outline" onClick={() => onClose()}>Cancelar</Button>
        <Button onClick={enviar} loading={guardando}>{editando ? 'Guardar cambios' : 'Crear producto'}</Button>
      </>}>
      <form onSubmit={enviar} className="grid gap-5">
        <div className="grid gap-5 sm:grid-cols-[200px_1fr]">
          <div className="grid content-start gap-2">
            <label
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); elegirFoto(e.dataTransfer.files[0]) }}
              className="group relative grid aspect-square cursor-pointer place-items-center overflow-hidden rounded-xl border-2 border-dashed border-input bg-muted/40 hover:border-ring">
              {vista ? <img src={vista} alt="Vista previa" className="size-full object-cover" /> : (
                <span className="grid justify-items-center gap-2 p-4 text-center text-sm text-muted-foreground">
                  <ImagePlus className="size-7" /> Toca o arrastra una foto
                </span>
              )}
              {vista && <span className="absolute inset-x-0 bottom-0 bg-black/50 py-1.5 text-center text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">Cambiar foto</span>}
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => elegirFoto(e.target.files?.[0])} />
            </label>
            <label className="sm:hidden">
              <span className="flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg border border-input text-sm font-medium"><Camera className="size-4" /> Tomar foto</span>
              <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => elegirFoto(e.target.files?.[0])} />
            </label>
            {vista && archivo && (
              <Button variant="ghost" size="sm" onClick={() => { setArchivo(null); setVista(producto?.imagen_url ?? null) }}><X /> Quitar foto nueva</Button>
            )}
          </div>

          <div className="grid content-start gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Código" error={errors.codigo?.message} htmlFor="codigo">
                <Input id="codigo" autoCapitalize="characters" placeholder="Ej. 389390-30" aria-invalid={!!errors.codigo} {...register('codigo')} />
              </Field>
              <Field label="Marca" error={errors.marca?.message} htmlFor="marca">
                <Input id="marca" list="lista-marcas" placeholder="Ej. PUMA" aria-invalid={!!errors.marca} {...register('marca')} />
                <datalist id="lista-marcas">{marcas.data?.map((m) => <option key={m.id} value={m.nombre} />)}</datalist>
              </Field>
            </div>
            <Field label="Nombre del modelo" error={errors.nombre?.message} htmlFor="nombre">
              <Input id="nombre" placeholder="Ej. Carina Street" aria-invalid={!!errors.nombre} {...register('nombre')} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Precio de venta (Q)" error={errors.precio?.message} htmlFor="precio">
                <Input id="precio" type="number" step="0.01" min="0" inputMode="decimal" aria-invalid={!!errors.precio} {...register('precio')} />
              </Field>
              <Field label="Costo (Q)" hint="Opcional. Sirve para ver la ganancia." error={errors.costo?.message} htmlFor="costo">
                <Input id="costo" type="number" step="0.01" min="0" inputMode="decimal" {...register('costo')} />
              </Field>
            </div>
            <Field label="Descripción" hint="Opcional: color, material, detalles." htmlFor="descripcion">
              <Textarea id="descripcion" rows={2} {...register('descripcion')} />
            </Field>
          </div>
        </div>

        {!editando && (
          <div className="grid gap-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Existencias por talla</p>
              <p className="text-sm text-muted-foreground">{totalPares} pares</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {listaTallas.map((t) => (
                <div key={t} className="grid justify-items-center gap-1.5 rounded-xl border border-border p-2">
                  <span className="text-sm font-semibold">Talla {talla(t)}</span>
                  <Stepper size="sm" value={tallas[t]} onChange={(v) => setTallas((x) => ({ ...x, [t]: v }))} label={`talla ${talla(t)}`} />
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input placeholder="Otra talla (ej. 26)" inputMode="decimal" value={nuevaTalla} onChange={(e) => setNuevaTalla(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), agregarTalla())} className="max-w-48" />
              <Button variant="outline" onClick={agregarTalla}><Plus /> Talla</Button>
            </div>
          </div>
        )}
      </form>
    </Dialog>
  )
}
