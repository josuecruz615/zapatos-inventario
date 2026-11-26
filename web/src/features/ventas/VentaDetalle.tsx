import { AlertTriangle, Copy, MessageCircle, Pencil, Share, Trash2 } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Sheet, useConfirm } from '@/components/ui/dialog'
import { Badge, FotoProducto, Skeleton } from '@/components/ui/misc'
import { useEliminarVenta, useVenta, useVentaItems } from '@/lib/api'
import { enlaceWhatsApp, fechaHora, mensajeError, q, talla, telefonoBonito } from '@/lib/utils'
import { compartir } from '@/lib/dispositivo'
import { textoRecibo } from './recibo'

export function VentaDetalle({ id, onClose }: { id: number | null; onClose: () => void }) {
  const venta = useVenta(id)
  const items = useVentaItems(id)
  const eliminar = useEliminarVenta()
  const confirmar = useConfirm()
  const navegar = useNavigate()
  const v = venta.data

  const recibo = v && items.data ? textoRecibo({ ...v, items: items.data }) : ''

  async function borrar() {
    if (!v) return
    const ok = await confirmar({
      titulo: `¿Eliminar la venta #${v.id}?`, peligro: true, confirmar: 'Eliminar venta',
      mensaje: `Los ${v.unidades} pares regresan al inventario. Esta acción no se puede deshacer.`,
    })
    if (!ok) return
    try {
      await eliminar.mutateAsync(v.id)
      toast.success(`Venta #${v.id} eliminada`, { description: 'Las existencias se devolvieron al inventario.' })
      onClose()
    } catch (e) { toast.error(mensajeError(e)) }
  }

  return (
    <Sheet open={!!id} onOpenChange={(o) => !o && onClose()}
      title={v ? `Venta #${v.id}` : 'Venta'} description={v ? fechaHora(v.fecha) : undefined}
      footer={v && <>
        <Button variant="danger-ghost" className="mr-auto" onClick={borrar} loading={eliminar.isPending}><Trash2 /> Eliminar</Button>
        <Button variant="outline" onClick={() => navegar(`/ventas/${v.id}/editar`)}><Pencil /> Editar</Button>
      </>}>
      {venta.isLoading || items.isLoading ? <Skeleton className="h-72" /> : !v ? (
        <p className="text-sm text-muted-foreground">Esta venta no existe o fue eliminada.</p>
      ) : (
        <div className="grid gap-5">
          <Link to={`/clientes?cliente=${v.cliente_id}`} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3 hover:bg-muted/40">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Cliente</p>
              <p className="truncate font-medium">{v.cliente}</p>
              {v.cliente_telefono && <p className="text-sm text-muted-foreground">{telefonoBonito(v.cliente_telefono)}</p>}
            </div>
            {v.cliente_problemas && <Badge tone="warning"><AlertTriangle /> Con problemas</Badge>}
          </Link>

          <ul className="grid gap-2">
            {items.data?.map((i) => (
              <li key={i.id}>
                <Link to={`/inventario?producto=${i.producto_id}`} className="flex items-center gap-3 rounded-xl p-1 hover:bg-muted/40">
                  <FotoProducto src={i.imagen_url} alt={i.nombre} className="size-16 shrink-0 rounded-lg" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{i.nombre}</p>
                    <p className="text-sm text-muted-foreground">{i.marca} · {i.codigo}</p>
                    <p className="text-sm">Talla {talla(i.talla)} · {i.cantidad} × {q(i.precio_unitario)}</p>
                  </div>
                  <p className="tabular font-semibold">{q(i.subtotal)}</p>
                </Link>
              </li>
            ))}
          </ul>

          <div className="grid gap-1.5 rounded-xl bg-muted/60 p-4 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal ({v.unidades} {v.unidades === 1 ? 'par' : 'pares'})</span><span className="tabular">{q(v.subtotal)}</span></div>
            {v.ajuste !== 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{v.ajuste < 0 ? 'Descuento' : 'Recargo'}</span>
                <span className="tabular">{v.ajuste < 0 ? '−' : '+'}{q(Math.abs(v.ajuste))}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-border pt-2 text-lg font-semibold"><span>Total</span><span className="tabular">{q(v.total)}</span></div>
          </div>

          {v.nota && <div className="rounded-xl border border-border p-3 text-sm"><p className="mb-1 text-xs text-muted-foreground">Nota</p>{v.nota}</div>}

          <div className="grid gap-2 sm:grid-cols-2">
            {v.cliente_telefono && (
              <a href={enlaceWhatsApp(v.cliente_telefono, recibo)} target="_blank" rel="noreferrer">
                <Button variant="outline" className="w-full"><MessageCircle /> Recibo por WhatsApp</Button>
              </a>
            )}
            {typeof navigator.share === 'function' ? (
              <Button variant="outline" onClick={() => compartir({ text: recibo })}><Share /> Compartir recibo</Button>
            ) : (
              <Button variant="outline" onClick={() => navigator.clipboard.writeText(recibo).then(() => toast.success('Recibo copiado'))}>
                <Copy /> Copiar recibo
              </Button>
            )}
          </div>
        </div>
      )}
    </Sheet>
  )
}
