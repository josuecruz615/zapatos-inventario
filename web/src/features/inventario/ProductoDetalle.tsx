import * as DM from '@radix-ui/react-dropdown-menu'
import { Archive, ArchiveRestore, ArrowDownLeft, ArrowUpRight, EllipsisVertical, History, Pencil, Plus, RotateCcw, Save, Share, ShoppingBag, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Sheet, useConfirm } from '@/components/ui/dialog'
import { Input, Stepper } from '@/components/ui/form'
import { Badge, Empty, FotoProducto, Segmented, Skeleton } from '@/components/ui/misc'
import { useActualizarProducto, useEliminarProducto, useGuardarTallas, useMovimientos, useVentasDeProducto } from '@/lib/api'
import type { Movimiento, Producto } from '@/lib/types'
import { compartir, fotoComoArchivo } from '@/lib/dispositivo'
import { cn, fecha, fechaHora, mensajeError, q, talla } from '@/lib/utils'

type Pestana = 'existencias' | 'historial' | 'ventas'

export function ProductoDetalle({ producto, onClose, onEditar }: {
  producto: Producto | null; onClose: () => void; onEditar: (id: number) => void
}) {
  const [pestana, setPestana] = useState<Pestana>('existencias')
  useEffect(() => { if (producto) setPestana('existencias') }, [producto?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const actualizar = useActualizarProducto()
  const eliminar = useEliminarProducto()
  const confirmar = useConfirm()
  const navegar = useNavigate()
  // La foto se descarga al abrir, para que "Compartir" responda al instante (Safari lo exige).
  const [foto, setFoto] = useState<File | null>(null)
  useEffect(() => {
    let vigente = true
    setFoto(null)
    if (producto?.imagen_url) fotoComoArchivo(producto.imagen_url, `${producto.codigo} ${producto.nombre}`).then((f) => vigente && setFoto(f))
    return () => { vigente = false }
  }, [producto?.imagen_url, producto?.codigo, producto?.nombre])

  if (!producto) return <Sheet open={false} onOpenChange={() => {}} title="" />
  const p = producto

  async function archivar() {
    try {
      await actualizar.mutateAsync({ id: p.id, activo: !p.activo })
      toast.success(p.activo ? 'Producto archivado' : 'Producto reactivado')
    } catch (e) { toast.error(mensajeError(e)) }
  }

  async function borrar() {
    const ok = await confirmar({
      titulo: `¿Eliminar ${p.nombre}?`, peligro: true, confirmar: 'Eliminar',
      mensaje: 'Se borra el producto con todas sus tallas e historial. Si ya tiene ventas no se podrá eliminar; en ese caso archívalo.',
    })
    if (!ok) return
    try {
      await eliminar.mutateAsync(p.id)
      toast.success('Producto eliminado')
      onClose()
    } catch (e) {
      toast.error(mensajeError(e), { description: 'Puedes archivarlo para ocultarlo del inventario.' })
    }
  }

  async function compartirProducto() {
    const disponibles = p.tallas.filter((t) => t.existencia > 0).map((t) => talla(t.talla))
    const texto = `${p.nombre} (${p.marca})
Código: ${p.codigo}
Precio: ${q(p.precio)}
${disponibles.length ? `Tallas disponibles: ${disponibles.join(', ')}` : 'Agotado'}`
    const ok = await compartir(foto ? { files: [foto], text: texto } : { text: texto })
    if (!ok && typeof navigator.share !== 'function') {
      await navigator.clipboard.writeText(texto)
      toast.success('Datos del producto copiados')
    }
  }

  const item = 'flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm outline-none data-highlighted:bg-muted [&_svg]:size-4'

  return (
    <Sheet open onOpenChange={(v) => !v && onClose()} title={p.nombre} description={`${p.marca} · ${p.codigo}`}>
      <div className="grid gap-5">
        <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
          <FotoProducto src={p.imagen_url} alt={p.nombre} className="aspect-[4/3] w-full rounded-xl sm:aspect-square" />
          <div className="grid content-start gap-3">
            <div className="flex flex-wrap gap-2">
              {!p.activo && <Badge tone="neutral"><Archive /> Archivado</Badge>}
              <Badge tone={p.existencia_total ? 'success' : 'danger'}>{p.existencia_total} pares en existencia</Badge>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-muted-foreground">Precio</dt><dd className="tabular text-lg font-semibold">{q(p.precio)}</dd></div>
              <div><dt className="text-muted-foreground">Costo</dt><dd className="tabular text-lg font-semibold">{p.costo != null ? q(p.costo) : '—'}</dd></div>
              {p.costo != null && p.costo > 0 && (
                <div className="col-span-2"><dt className="text-muted-foreground">Ganancia por par</dt>
                  <dd className="tabular font-medium text-success">{q(p.precio - p.costo)} ({Math.round(((p.precio - p.costo) / p.precio) * 100)}%)</dd></div>
              )}
            </dl>
            {p.descripcion && <p className="text-sm text-muted-foreground">{p.descripcion}</p>}
            <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 sm:flex sm:flex-wrap">
              <Button variant="accent" size="sm" disabled={!p.existencia_total || !p.activo}
                onClick={() => navegar(`/ventas/nueva?producto=${p.id}`)}><ShoppingBag /> Vender</Button>
              <Button variant="outline" size="sm" onClick={() => onEditar(p.id)}><Pencil /> Editar</Button>
              <Button variant="outline" size="sm" onClick={compartirProducto} aria-label="Compartir producto"><Share /> <span className="sm:hidden">Compartir</span></Button>
              <DM.Root>
                <DM.Trigger asChild><Button variant="outline" size="icon-sm" aria-label="Más acciones"><EllipsisVertical /></Button></DM.Trigger>
                <DM.Portal>
                  <DM.Content align="end" sideOffset={6} className="z-50 min-w-48 animate-in rounded-xl border border-border bg-card p-1 shadow-lg">
                    <DM.Item className={item} onSelect={archivar}>
                      {p.activo ? <><Archive /> Archivar</> : <><ArchiveRestore /> Reactivar</>}
                    </DM.Item>
                    <DM.Item className={cn(item, 'text-danger')} onSelect={borrar}><Trash2 /> Eliminar</DM.Item>
                  </DM.Content>
                </DM.Portal>
              </DM.Root>
            </div>
          </div>
        </div>

        <Segmented value={pestana} onChange={setPestana} className="w-full [&>button]:flex-1"
          options={[{ value: 'existencias', label: 'Existencias' }, { value: 'historial', label: 'Movimientos' }, { value: 'ventas', label: 'Ventas' }]} />

        {pestana === 'existencias' && <EditorExistencias key={p.id + p.updated_at + p.existencia_total} producto={p} />}
        {pestana === 'historial' && <Historial productoId={p.id} />}
        {pestana === 'ventas' && <VentasProducto productoId={p.id} />}
      </div>
    </Sheet>
  )
}

function EditorExistencias({ producto }: { producto: Producto }) {
  const guardar = useGuardarTallas()
  const inicial = useMemo(() => Object.fromEntries(producto.tallas.map((t) => [t.talla, t.existencia])), [producto.tallas])
  const [valores, setValores] = useState<Record<number, number>>(inicial)
  const [nueva, setNueva] = useState('')
  const [nota, setNota] = useState('')

  const tallas = Object.keys(valores).map(Number).sort((a, b) => a - b)
  const cambios = tallas.filter((t) => valores[t] !== (inicial[t] ?? -1))
  const total = tallas.reduce((s, t) => s + valores[t], 0)

  function agregarTalla() {
    const t = Number(nueva.replace(',', '.'))
    if (!t || t <= 0 || t > 60 || (t * 2) % 1 !== 0) return toast.error('Escribe una talla válida, por ejemplo 26 o 26.5')
    if (t in valores) return toast.error('Esa talla ya existe')
    setValores((v) => ({ ...v, [t]: 0 }))
    setNueva('')
  }

  async function enviar() {
    try {
      await guardar.mutateAsync({
        productoId: producto.id,
        tallas: cambios.map((t) => ({ talla: t, existencia: valores[t] })),
        nota: nota.trim() || 'Ajuste manual de existencias',
      })
      toast.success('Existencias actualizadas')
      setNota('')
    } catch (e) { toast.error(mensajeError(e)) }
  }

  return (
    <div className="grid gap-4">
      <ul className="grid gap-2 sm:grid-cols-2">
        {tallas.map((t) => {
          const cambio = valores[t] - (inicial[t] ?? 0)
          return (
            <li key={t} className={cn('flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2', cambio !== 0 && 'border-accent/50 bg-accent/5')}>
              <div>
                <p className="text-sm font-semibold">Talla {talla(t)}</p>
                <p className={cn('text-xs', cambio > 0 ? 'text-success' : cambio < 0 ? 'text-danger' : 'text-muted-foreground')}>
                  {cambio === 0 ? (valores[t] ? 'Disponible' : 'Agotada') : `${cambio > 0 ? '+' : ''}${cambio} (antes ${inicial[t] ?? 0})`}
                </p>
              </div>
              <Stepper size="sm" value={valores[t]} onChange={(v) => setValores((x) => ({ ...x, [t]: v }))} label={`talla ${talla(t)}`} />
            </li>
          )
        })}
      </ul>
      <div className="flex gap-2">
        <Input placeholder="Agregar talla (ej. 26)" inputMode="decimal" value={nueva} onChange={(e) => setNueva(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), agregarTalla())} className="max-w-48" />
        <Button variant="outline" onClick={agregarTalla}><Plus /> Talla</Button>
      </div>
      {cambios.length > 0 && (
        <div className="sticky bottom-0 grid animate-in gap-3 rounded-xl border border-border bg-card p-3 shadow-lg">
          <Input placeholder="Motivo (opcional): reabastecimiento, conteo, daño…" value={nota} onChange={(e) => setNota(e.target.value)} />
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">{cambios.length} {cambios.length === 1 ? 'talla cambiada' : 'tallas cambiadas'} · total {total} pares</p>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setValores(inicial)}><RotateCcw /> Deshacer</Button>
              <Button size="sm" onClick={enviar} loading={guardar.isPending}><Save /> Guardar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const etiquetas: Record<Movimiento['tipo'], string> = {
  migracion: 'Saldo inicial', entrada: 'Entrada', ajuste: 'Ajuste', venta: 'Venta', devolucion: 'Devolución',
}

function Historial({ productoId }: { productoId: number }) {
  const { data, isLoading } = useMovimientos(productoId)
  if (isLoading) return <Skeleton className="h-48" />
  if (!data?.length) return <Empty icon={History} title="Sin movimientos" description="Aquí verás cada entrada, venta y ajuste de este producto." />
  return (
    <ul className="divide-y divide-border">
      {data.map((m) => (
        <li key={m.id} className="flex items-center gap-3 py-2.5">
          <div className={cn('grid size-8 shrink-0 place-items-center rounded-lg', m.cantidad > 0 ? 'bg-success/12 text-success' : 'bg-danger/12 text-danger')}>
            {m.cantidad > 0 ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">
              {etiquetas[m.tipo]} · talla {talla(m.talla)}
              {m.venta_id && <Link to={`/ventas?venta=${m.venta_id}`} className="ml-1 text-accent hover:underline">#{m.venta_id}</Link>}
            </p>
            <p className="truncate text-xs text-muted-foreground">{fechaHora(m.created_at)}{m.nota ? ` · ${m.nota}` : ''}</p>
          </div>
          <div className="text-right">
            <p className={cn('tabular text-sm font-semibold', m.cantidad > 0 ? 'text-success' : 'text-danger')}>{m.cantidad > 0 ? '+' : ''}{m.cantidad}</p>
            <p className="tabular text-xs text-muted-foreground">quedan {m.existencia_resultante}</p>
          </div>
        </li>
      ))}
    </ul>
  )
}

function VentasProducto({ productoId }: { productoId: number }) {
  const { data, isLoading } = useVentasDeProducto(productoId)
  if (isLoading) return <Skeleton className="h-48" />
  if (!data?.length) return <Empty icon={ShoppingBag} title="Todavía no se ha vendido" />
  const unidades = data.reduce((s, v) => s + Number(v.cantidad), 0)
  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">{unidades} pares vendidos en {new Set(data.map((d) => d.venta_id)).size} ventas</p>
      <ul className="divide-y divide-border">
        {data.map((v, i) => (
          <li key={i}>
            <Link to={`/ventas?venta=${v.venta_id}`} className="flex items-center justify-between gap-3 py-2.5 hover:bg-muted/40">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{v.ventas?.clientes?.nombre ?? 'Cliente'}</p>
                <p className="text-xs text-muted-foreground">{v.ventas ? fecha(v.ventas.fecha) : ''} · talla {talla(Number(v.talla))} · {v.cantidad} par{Number(v.cantidad) > 1 ? 'es' : ''}</p>
              </div>
              <p className="tabular text-sm font-semibold">{q(Number(v.precio_unitario) * Number(v.cantidad))}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
