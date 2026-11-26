import { AlertTriangle, MapPin, MessageCircle, Pencil, Phone, ShoppingBag, StickyNote, Trash2, UserPlus, Users } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Sheet, useConfirm } from '@/components/ui/dialog'
import { SearchInput } from '@/components/ui/form'
import { Badge, Card, Empty, PageHeader, Segmented, Skeleton } from '@/components/ui/misc'
import { useClientes, useEliminarCliente, useVentas, useVentasDeCliente } from '@/lib/api'
import type { Cliente } from '@/lib/types'
import { enlaceWhatsApp, fecha, mensajeError, normalizar, num, q, telefonoBonito } from '@/lib/utils'
import { ClienteForm } from './ClienteForm'

type Orden = 'nombre' | 'compras' | 'reciente'

export default function Clientes() {
  const { data, isLoading, error } = useClientes()
  const ventas = useVentas()
  const [params, setParams] = useSearchParams()
  const busqueda = params.get('q') ?? ''
  const soloProblemas = params.get('problemas') === '1'
  const orden = (params.get('orden') as Orden) || 'nombre'
  const clienteId = Number(params.get('cliente')) || null
  const editarId = Number(params.get('editar')) || null
  const nuevo = params.get('nuevo') === '1'

  const set = (cambios: Record<string, string | null>, reemplazar = true) => {
    const p = new URLSearchParams(params)
    for (const [k, v] of Object.entries(cambios)) {
      if (v === null || v === '') p.delete(k)
      else p.set(k, v)
    }
    setParams(p, { replace: reemplazar })
  }

  const estadisticas = useMemo(() => {
    const m = new Map<number, { compras: number; total: number; ultima: string }>()
    for (const v of ventas.data ?? []) {
      const e = m.get(v.cliente_id) ?? { compras: 0, total: 0, ultima: v.fecha }
      e.compras++
      e.total += v.total
      if (v.fecha > e.ultima) e.ultima = v.fecha
      m.set(v.cliente_id, e)
    }
    return m
  }, [ventas.data])

  const filtrados = useMemo(() => {
    const t = normalizar(busqueda)
    const tDig = busqueda.replace(/\D/g, '')
    const res = (data ?? []).filter((c) =>
      (!soloProblemas || c.problemas) &&
      (!t || normalizar(c.nombre).includes(t) || (tDig.length >= 3 && (c.telefono ?? '').includes(tDig))))
    const est = (c: Cliente) => estadisticas.get(c.id)
    if (orden === 'compras') res.sort((a, b) => (est(b)?.total ?? 0) - (est(a)?.total ?? 0))
    else if (orden === 'reciente') res.sort((a, b) => (est(b)?.ultima ?? '').localeCompare(est(a)?.ultima ?? ''))
    return res
  }, [data, busqueda, soloProblemas, orden, estadisticas])

  const abierto = data?.find((c) => c.id === clienteId) ?? null
  const editando = data?.find((c) => c.id === editarId) ?? null

  return (
    <div className="grid gap-5">
      <PageHeader title="Clientes" description={isLoading ? 'Cargando…' : `${num(data?.length ?? 0)} clientes registrados`}
        actions={<Button variant="accent" onClick={() => set({ nuevo: '1' }, false)}><UserPlus /> Nuevo cliente</Button>} />

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={busqueda} onChange={(v) => set({ q: v })} placeholder="Buscar por nombre o teléfono" className="min-w-60 flex-1" />
        <Segmented value={orden} onChange={(v) => set({ orden: v === 'nombre' ? null : v })}
          options={[{ value: 'nombre', label: 'A–Z' }, { value: 'compras', label: 'Mejores' }, { value: 'reciente', label: 'Recientes' }]} />
        <Button variant={soloProblemas ? 'primary' : 'outline'} onClick={() => set({ problemas: soloProblemas ? null : '1' })}>
          <AlertTriangle /> Con problemas
        </Button>
      </div>

      {error ? <Empty icon={Users} title="No se pudieron cargar los clientes" description={(error as Error).message} />
        : isLoading ? <Skeleton className="h-96 rounded-2xl" />
        : !filtrados.length ? (
          <Empty icon={Users} title={busqueda ? `No hay clientes que coincidan con “${busqueda}”` : 'No hay clientes'}
            action={<Button variant="outline" onClick={() => set({ nuevo: '1' }, false)}><UserPlus /> Crear cliente</Button>} />
        ) : (
          <Card className="overflow-hidden">
            <ul className="divide-y divide-border">
              {filtrados.map((c) => {
                const e = estadisticas.get(c.id)
                return (
                  <li key={c.id}>
                    <button type="button" onClick={() => set({ cliente: String(c.id) }, false)}
                      className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left hover:bg-muted/50">
                      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent/12 text-sm font-semibold text-accent">
                        {c.nombre.split(' ').slice(0, 2).map((x) => x[0]).join('')}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 truncate font-medium">
                          {c.nombre}
                          {c.problemas && <AlertTriangle className="size-4 shrink-0 text-warning" aria-label="Con problemas" />}
                        </p>
                        <p className="truncate text-sm text-muted-foreground">
                          {telefonoBonito(c.telefono) || 'Sin teléfono'}{e ? ` · última compra ${fecha(e.ultima)}` : ''}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="tabular text-sm font-semibold">{e ? q(e.total) : '—'}</p>
                        <p className="text-xs text-muted-foreground">{e ? `${e.compras} ${e.compras === 1 ? 'compra' : 'compras'}` : 'Sin compras'}</p>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          </Card>
        )}

      <ClienteDetalle cliente={abierto} onClose={() => set({ cliente: null })} onEditar={(id) => set({ editar: String(id) }, false)} />
      <ClienteForm open={nuevo || !!editando} cliente={editando}
        onClose={(c) => set({ nuevo: null, editar: null, ...(c && !editando ? { cliente: String(c.id) } : {}) })} />
    </div>
  )
}

function ClienteDetalle({ cliente, onClose, onEditar }: { cliente: Cliente | null; onClose: () => void; onEditar: (id: number) => void }) {
  const ventas = useVentasDeCliente(cliente?.id ?? null)
  const eliminar = useEliminarCliente()
  const confirmar = useConfirm()
  const navegar = useNavigate()
  const c = cliente
  const total = (ventas.data ?? []).reduce((s, v) => s + v.total, 0)
  const pares = (ventas.data ?? []).reduce((s, v) => s + v.unidades, 0)

  async function borrar() {
    if (!c) return
    const ok = await confirmar({ titulo: `¿Eliminar a ${c.nombre}?`, peligro: true, confirmar: 'Eliminar', mensaje: 'Solo se puede eliminar un cliente sin ventas.' })
    if (!ok) return
    try {
      await eliminar.mutateAsync(c.id)
      toast.success('Cliente eliminado')
      onClose()
    } catch (e) { toast.error(mensajeError(e)) }
  }

  return (
    <Sheet open={!!c} onOpenChange={(o) => !o && onClose()} title={c?.nombre ?? ''} description={c ? `Cliente desde ${fecha(c.created_at)}` : undefined}
      footer={c && <>
        <Button variant="danger-ghost" className="mr-auto" onClick={borrar} disabled={!!ventas.data?.length}
          title={ventas.data?.length ? 'Tiene ventas registradas' : undefined}><Trash2 /> Eliminar</Button>
        <Button variant="outline" onClick={() => onEditar(c.id)}><Pencil /> Editar</Button>
        <Button variant="accent" onClick={() => navegar('/ventas/nueva')}><ShoppingBag /> Venderle</Button>
      </>}>
      {c && (
        <div className="grid gap-5">
          {c.problemas && (
            <p className="flex items-start gap-2 rounded-xl bg-warning/15 px-3 py-2.5 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" /> Este cliente está marcado con problemas.
            </p>
          )}
          <div className="grid gap-3 text-sm">
            {c.telefono && (
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2"><Phone className="size-4 text-muted-foreground" /> {telefonoBonito(c.telefono)}</span>
                <div className="flex gap-2">
                  <a href={`tel:${c.telefono}`}><Button variant="outline" size="sm"><Phone /> Llamar</Button></a>
                  <a href={enlaceWhatsApp(c.telefono, `Hola ${c.nombre.split(' ')[0]}, `)} target="_blank" rel="noreferrer">
                    <Button variant="outline" size="sm"><MessageCircle /> WhatsApp</Button>
                  </a>
                </div>
              </div>
            )}
            {c.direccion && <p className="flex items-start gap-2"><MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" /> {c.direccion}</p>}
            {c.notas && <p className="flex items-start gap-2"><StickyNote className="mt-0.5 size-4 shrink-0 text-muted-foreground" /> {c.notas}</p>}
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[['Compras', num(ventas.data?.length ?? 0)], ['Pares', num(pares)], ['Total', q(total)]].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-muted/60 p-3">
                <p className="text-xs text-muted-foreground">{k}</p>
                <p className="tabular truncate font-semibold">{v}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-2">
            <h3 className="text-sm font-semibold">Historial de compras</h3>
            {ventas.isLoading ? <Skeleton className="h-32" /> : !ventas.data?.length ? (
              <p className="text-sm text-muted-foreground">Todavía no ha comprado.</p>
            ) : (
              <ul className="divide-y divide-border">
                {ventas.data.map((v) => (
                  <li key={v.id}>
                    <Link to={`/ventas?venta=${v.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:bg-muted/40">
                      <div>
                        <p className="text-sm font-medium">Venta #{v.id}</p>
                        <p className="text-xs text-muted-foreground">{fecha(v.fecha)} · {v.unidades} {v.unidades === 1 ? 'par' : 'pares'}</p>
                      </div>
                      <div className="text-right">
                        <p className="tabular text-sm font-semibold">{q(v.total)}</p>
                        {v.ajuste !== 0 && <Badge tone={v.ajuste < 0 ? 'success' : 'warning'}>{v.ajuste < 0 ? 'Descuento' : 'Recargo'}</Badge>}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Sheet>
  )
}
