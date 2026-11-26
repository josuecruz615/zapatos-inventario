import { CircleCheckBig, MessageCircle, Plus, Receipt, Share } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { PageHeader } from '@/components/ui/misc'
import { useClientes, useInventario, useRegistrarVenta } from '@/lib/api'
import { enlaceWhatsApp, fechaVentaISO, hoyGT, q } from '@/lib/utils'
import { compartir } from '@/lib/dispositivo'
import { textoRecibo } from './recibo'
import { VentaEditor, type ValoresVenta } from './VentaEditor'

type Exito = { id: number; valores: ValoresVenta; fecha: string }

export default function NuevaVenta() {
  const [params] = useSearchParams()
  const navegar = useNavigate()
  const inventario = useInventario()
  const clientes = useClientes()
  const registrar = useRegistrarVenta()
  const [vuelta, setVuelta] = useState(0)
  const [exito, setExito] = useState<Exito | null>(null)

  const productoInicial = inventario.data?.find((p) => p.id === Number(params.get('producto'))) ?? null
  if (params.get('producto') && inventario.isLoading) return null

  async function guardar(v: ValoresVenta) {
    const fecha = fechaVentaISO(v.dia)
    const id = await registrar.mutateAsync({ clienteId: v.clienteId, items: v.items, fecha, totalFinal: v.totalFinal, nota: v.nota })
    setExito({ id, valores: v, fecha })
  }

  const cliente = exito ? clientes.data?.find((c) => c.id === exito.valores.clienteId) : null
  const subtotal = exito ? exito.valores.items.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0) : 0
  const total = exito?.valores.totalFinal ?? subtotal

  return (
    <div className="grid gap-5">
      <PageHeader title="Nueva venta" description="Elige las tallas del catálogo, el cliente y confirma." />
      <VentaEditor key={vuelta} textoBoton="Registrar venta" productoInicial={productoInicial} onGuardar={guardar}
        inicial={{ clienteId: null, dia: hoyGT(), totalFinal: '', nota: '', items: [] }} />

      <Dialog open={!!exito} onOpenChange={(v) => { if (!v) { setExito(null); setVuelta((n) => n + 1) } }} title="Venta registrada"
        footer={<>
          <Button variant="outline" onClick={() => navegar(`/ventas?venta=${exito?.id}`)}><Receipt /> Ver venta</Button>
          <Button onClick={() => { setExito(null); setVuelta((n) => n + 1) }}><Plus /> Nueva venta</Button>
        </>}>
        {exito && (
          <div className="grid justify-items-center gap-4 py-2 text-center">
            <div className="grid size-14 place-items-center rounded-full bg-success/12 text-success"><CircleCheckBig className="size-7" /></div>
            <div className="grid gap-1">
              <p className="text-3xl font-semibold tabular">{q(total)}</p>
              <p className="text-sm text-muted-foreground">Venta #{exito.id} · {cliente?.nombre} · {exito.valores.items.reduce((s, i) => s + i.cantidad, 0)} pares</p>
            </div>
            {typeof navigator.share === 'function' && (
              <Button variant="outline" className="w-full" onClick={() => compartir({ text: textoRecibo({
                id: exito.id, fecha: exito.fecha, cliente: cliente?.nombre ?? '', subtotal, ajuste: total - subtotal, total, items: exito.valores.items,
              }) })}><Share /> Compartir recibo</Button>
            )}
            {cliente?.telefono && (
              <a target="_blank" rel="noreferrer" className="w-full"
                href={enlaceWhatsApp(cliente.telefono, textoRecibo({
                  id: exito.id, fecha: exito.fecha, cliente: cliente.nombre, subtotal, ajuste: total - subtotal, total, items: exito.valores.items,
                }))}>
                <Button variant="outline" className="w-full"><MessageCircle /> Enviar recibo por WhatsApp</Button>
              </a>
            )}
          </div>
        )}
      </Dialog>
    </div>
  )
}
