import { PackageSearch, ShoppingCart, Trash2 } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field, Input, SearchInput, Stepper, Textarea } from '@/components/ui/form'
import { Badge, Card, Chip, Empty, FotoProducto, Skeleton } from '@/components/ui/misc'
import { ClienteSelector } from '@/features/clientes/ClienteSelector'
import { useInventario } from '@/lib/api'
import type { Cliente, ItemCarrito, Producto } from '@/lib/types'
import { useMediaQuery } from '@/lib/hooks'
import { cn, hoyGT, mensajeError, normalizar, q, talla } from '@/lib/utils'

export type ValoresVenta = {
  clienteId: number
  dia: string
  totalFinal: number | null
  nota: string
  items: ItemCarrito[]
}

export function VentaEditor({ inicial, apartado, productoInicial, textoBoton, onGuardar }: {
  inicial: { clienteId: number | null; dia: string; totalFinal: string; nota: string; items: ItemCarrito[] }
  /** Unidades que ya pertenecen a la venta (al editar): se suman a lo disponible. */
  apartado?: Map<number, number>
  productoInicial?: Producto | null
  textoBoton: string
  onGuardar: (v: ValoresVenta) => Promise<void>
}) {
  const inventario = useInventario()
  const escritorio = useMediaQuery('(min-width: 1024px)')
  const [items, setItems] = useState<ItemCarrito[]>(inicial.items)
  const [clienteId, setClienteId] = useState<number | null>(inicial.clienteId)
  const [dia, setDia] = useState(inicial.dia)
  const [totalTexto, setTotalTexto] = useState(inicial.totalFinal)
  const [nota, setNota] = useState(inicial.nota)
  const [busqueda, setBusqueda] = useState(productoInicial?.codigo ?? '')
  const [marca, setMarca] = useState<string | null>(null)
  const [tallaSel, setTallaSel] = useState<number | null>(null)
  const [verCarrito, setVerCarrito] = useState(false)
  const [guardando, setGuardando] = useState(false)

  const disponible = (tallaId: number, existencia: number) =>
    existencia + (apartado?.get(tallaId) ?? 0) - (items.find((i) => i.producto_talla_id === tallaId)?.cantidad ?? 0)

  const vendibles = useMemo(() => (inventario.data ?? []).filter((p) =>
    p.activo && p.tallas.some((t) => t.existencia + (apartado?.get(t.id) ?? 0) > 0)), [inventario.data, apartado])

  const marcas = useMemo(() => [...new Set(vendibles.map((p) => p.marca))].sort(), [vendibles])
  const tallasOpc = useMemo(() => [...new Set(vendibles.flatMap((p) => p.tallas.filter((t) => t.existencia > 0).map((t) => t.talla)))].sort((a, b) => a - b), [vendibles])

  const filtrados = useMemo(() => {
    const t = normalizar(busqueda)
    return vendibles.filter((p) =>
      (!t || normalizar(`${p.codigo} ${p.nombre} ${p.marca}`).includes(t)) &&
      (!marca || p.marca === marca) &&
      (tallaSel === null || p.tallas.some((x) => x.talla === tallaSel && x.existencia + (apartado?.get(x.id) ?? 0) > 0)))
  }, [vendibles, busqueda, marca, tallaSel, apartado])

  const subtotal = items.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0)
  const pares = items.reduce((s, i) => s + i.cantidad, 0)
  const totalFinal = totalTexto.trim() === '' ? null : Number(totalTexto)
  const total = totalFinal ?? subtotal
  const ajuste = total - subtotal

  function agregar(p: Producto, tallaId: number) {
    const t = p.tallas.find((x) => x.id === tallaId)!
    if (disponible(t.id, t.existencia) <= 0) return toast.error(`No quedan más pares en talla ${talla(t.talla)}`)
    setItems((xs) => {
      const ya = xs.find((i) => i.producto_talla_id === tallaId)
      if (ya) return xs.map((i) => (i === ya ? { ...i, cantidad: i.cantidad + 1 } : i))
      return [...xs, {
        producto_talla_id: t.id, producto_id: p.id, codigo: p.codigo, nombre: p.nombre, marca: p.marca, imagen_url: p.imagen_url,
        talla: t.talla, precio_unitario: p.precio, cantidad: 1, maximo: t.existencia + (apartado?.get(t.id) ?? 0),
      }]
    })
    toast.success(`${p.nombre} · talla ${talla(t.talla)} agregado`, { duration: 1500 })
  }

  async function enviar(e?: FormEvent) {
    e?.preventDefault()
    if (!clienteId) return toast.error('Selecciona el cliente')
    if (!items.length) return toast.error('Agrega al menos un producto')
    if (totalFinal !== null && (Number.isNaN(totalFinal) || totalFinal < 0)) return toast.error('El total final no es válido')
    if (!dia || dia > hoyGT()) return toast.error('Revisa la fecha de la venta')
    setGuardando(true)
    try {
      await onGuardar({ clienteId, dia, totalFinal, nota: nota.trim(), items })
    } catch (err) {
      toast.error(mensajeError(err))
    } finally {
      setGuardando(false)
    }
  }

  const resumen = (
    <form onSubmit={enviar} className="grid gap-4">
      <Field label="Cliente">
        <ClienteSelector value={clienteId} onChange={(c: Cliente) => setClienteId(c.id)} />
      </Field>

      <div className="grid gap-2">
        <p className="text-sm font-medium">Productos {pares > 0 && <span className="text-muted-foreground">· {pares} {pares === 1 ? 'par' : 'pares'}</span>}</p>
        {!items.length ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            Toca una talla en el catálogo para agregarla.
          </p>
        ) : (
          <ul className="grid gap-2">
            {items.map((i) => (
              <li key={i.producto_talla_id} className="flex items-center gap-3 rounded-xl border border-border p-2">
                <FotoProducto src={i.imagen_url} alt={i.nombre} className="size-12 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{i.nombre}</p>
                  <p className="text-xs text-muted-foreground">Talla {talla(i.talla)} · {q(i.precio_unitario)}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <Stepper size="sm" min={1} max={i.maximo} value={i.cantidad} label={`${i.nombre} talla ${talla(i.talla)}`}
                      onChange={(v) => setItems((xs) => xs.map((x) => (x === i ? { ...x, cantidad: v } : x)))} />
                    <Button variant="danger-ghost" size="icon-sm" aria-label="Quitar"
                      onClick={() => setItems((xs) => xs.filter((x) => x !== i))}><Trash2 /></Button>
                  </div>
                </div>
                <p className="tabular self-start text-sm font-semibold">{q(i.cantidad * i.precio_unitario)}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Fecha" htmlFor="dia">
          <Input id="dia" type="date" max={hoyGT()} value={dia} onChange={(e) => setDia(e.target.value)} />
        </Field>
        <Field label="Total final (Q)" htmlFor="total" hint={totalFinal === null ? 'Vacío = suma de productos' : undefined}>
          <Input id="total" type="number" inputMode="decimal" min={0} step="0.01" placeholder={subtotal.toFixed(2)}
            value={totalTexto} onChange={(e) => setTotalTexto(e.target.value)} />
        </Field>
      </div>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {[25, 50, 100].map((d) => (
            <Chip key={d} onClick={() => setTotalTexto(String(Math.max(0, subtotal - d)))}>−{q(d).replace('.00', '')}</Chip>
          ))}
          <Chip onClick={() => setTotalTexto(String(subtotal + 25))}>Envío +Q25</Chip>
          {totalFinal !== null && <Chip onClick={() => setTotalTexto('')}>Sin ajuste</Chip>}
        </div>
      )}

      <Field label="Nota (opcional)" htmlFor="nota">
        <Textarea id="nota" rows={2} placeholder="Forma de pago, envío, etc." value={nota} onChange={(e) => setNota(e.target.value)} />
      </Field>

      <div className="grid gap-1.5 rounded-xl bg-muted/60 p-3 text-sm">
        <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="tabular">{q(subtotal)}</span></div>
        {ajuste !== 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">{ajuste < 0 ? 'Descuento' : 'Recargo'}</span>
            <span className={cn('tabular', ajuste < 0 ? 'text-success' : 'text-warning')}>{ajuste < 0 ? '−' : '+'}{q(Math.abs(ajuste))}</span>
          </div>
        )}
        <div className="flex justify-between border-t border-border pt-1.5 text-base font-semibold"><span>Total</span><span className="tabular">{q(total)}</span></div>
      </div>

      <Button type="submit" size="lg" variant="accent" loading={guardando} disabled={!items.length || !clienteId}>{textoBoton}</Button>
    </form>
  )

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
      <div className="grid content-start gap-4">
        <SearchInput value={busqueda} onChange={setBusqueda} placeholder="Buscar producto por código o nombre" autoFocus={!productoInicial && escritorio} />
        <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
          <Chip active={!marca} onClick={() => setMarca(null)}>Todas</Chip>
          {marcas.map((m) => <Chip key={m} active={marca === m} onClick={() => setMarca(marca === m ? null : m)}>{m}</Chip>)}
        </div>
        <div className="scrollbar-none -mx-4 flex items-center gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
          <span className="shrink-0 text-sm text-muted-foreground">Talla</span>
          {tallasOpc.map((t) => (
            <Chip key={t} active={tallaSel === t} onClick={() => setTallaSel(tallaSel === t ? null : t)} className="tabular min-w-11 justify-center">{talla(t)}</Chip>
          ))}
        </div>

        {inventario.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}</div>
        ) : !filtrados.length ? (
          <Empty icon={PackageSearch} title="Sin productos disponibles" description="No hay existencias que coincidan con la búsqueda." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            {filtrados.slice(0, 120).map((p) => (
              <Card key={p.id} className="flex gap-3 p-3">
                <FotoProducto src={p.imagen_url} alt={p.nombre} className="size-24 shrink-0 rounded-xl" />
                <div className="grid min-w-0 flex-1 content-start gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{p.nombre}</p>
                    <p className="truncate text-xs text-muted-foreground">{p.marca} · {p.codigo}</p>
                    <p className="tabular text-sm font-semibold">{q(p.precio)}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {p.tallas.filter((t) => t.existencia + (apartado?.get(t.id) ?? 0) > 0).map((t) => {
                      const quedan = disponible(t.id, t.existencia)
                      const enCarrito = items.find((i) => i.producto_talla_id === t.id)?.cantidad ?? 0
                      return (
                        <button key={t.id} type="button" disabled={quedan <= 0} onClick={() => agregar(p, t.id)}
                          aria-label={`Agregar talla ${talla(t.talla)}, quedan ${quedan}`}
                          className={cn('relative grid h-12 min-w-12 cursor-pointer sm:h-10 sm:min-w-11 place-items-center rounded-lg border px-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                            enCarrito ? 'border-accent bg-accent/10 text-accent' : 'border-border hover:border-primary',
                            tallaSel === t.talla && !enCarrito && 'border-primary')}>
                          <span className="tabular leading-none">{talla(t.talla)}</span>
                          <span className="tabular text-[10px] leading-none font-normal text-muted-foreground">{quedan} disp.</span>
                          {enCarrito > 0 && <span className="absolute -top-1.5 -right-1.5 grid size-4.5 place-items-center rounded-full bg-accent text-[10px] text-accent-foreground">{enCarrito}</span>}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
        {filtrados.length > 120 && <p className="text-center text-sm text-muted-foreground">Mostrando 120 de {filtrados.length}. Usa la búsqueda para encontrar más.</p>}
      </div>

      {/* Resumen: columna fija en computadora */}
      {escritorio && (
        <aside>
          <Card className="sticky top-8 max-h-[calc(100dvh-4rem)] overflow-y-auto p-5">
            <h2 className="mb-4 flex items-center gap-2 font-semibold"><ShoppingCart className="size-4" /> Resumen de la venta</h2>
            {resumen}
          </Card>
        </aside>
      )}

      {/* Barra inferior en celular */}
      {!escritorio && <>
      <div className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 p-3 backdrop-blur">
        <Button size="lg" variant={items.length ? 'accent' : 'primary'} className="w-full justify-between" onClick={() => setVerCarrito(true)}>
          <span className="flex items-center gap-2"><ShoppingCart /> {items.length ? `${pares} ${pares === 1 ? 'par' : 'pares'}` : 'Carrito vacío'}</span>
          <span className="flex items-center gap-2">{items.length > 0 && <Badge className="bg-white/20 text-current">{q(total)}</Badge>} Continuar</span>
        </Button>
      </div>
      <Dialog open={verCarrito} onOpenChange={setVerCarrito} title="Resumen de la venta">{resumen}</Dialog>
      </>}
    </div>
  )
}
