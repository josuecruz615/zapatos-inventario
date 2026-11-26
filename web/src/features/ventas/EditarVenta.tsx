import { ArrowLeft, Receipt } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Empty, PageHeader, Spinner } from '@/components/ui/misc'
import { useActualizarVenta, useInventario, useVenta, useVentaItems } from '@/lib/api'
import type { ItemCarrito } from '@/lib/types'
import { diaGT, fechaVentaISO } from '@/lib/utils'
import { VentaEditor, type ValoresVenta } from './VentaEditor'

export default function EditarVenta() {
  const id = Number(useParams().id)
  const navegar = useNavigate()
  const venta = useVenta(id)
  const items = useVentaItems(id)
  const inventario = useInventario()
  const actualizar = useActualizarVenta()

  const datos = useMemo(() => {
    if (!venta.data || !items.data || !inventario.data) return null
    const existencias = new Map(inventario.data.flatMap((p) => p.tallas.map((t) => [t.id, t.existencia] as const)))
    const apartado = new Map<number, number>()
    for (const i of items.data) apartado.set(i.producto_talla_id, (apartado.get(i.producto_talla_id) ?? 0) + i.cantidad)
    const carrito: ItemCarrito[] = items.data.map((i) => ({
      producto_talla_id: i.producto_talla_id, producto_id: i.producto_id, codigo: i.codigo, nombre: i.nombre, marca: i.marca,
      imagen_url: i.imagen_url, talla: i.talla, precio_unitario: i.precio_unitario, cantidad: i.cantidad,
      maximo: (existencias.get(i.producto_talla_id) ?? 0) + (apartado.get(i.producto_talla_id) ?? 0),
    }))
    return { carrito, apartado }
  }, [venta.data, items.data, inventario.data])

  if (venta.isLoading || items.isLoading || inventario.isLoading) return <div className="grid min-h-[50vh] place-items-center"><Spinner className="size-7" /></div>
  if (!venta.data || !datos) return <Empty icon={Receipt} title="No se encontró la venta" action={<Link to="/ventas"><Button variant="outline">Volver a ventas</Button></Link>} />

  const v = venta.data
  const diaOriginal = diaGT(v.fecha)

  async function guardar(x: ValoresVenta) {
    await actualizar.mutateAsync({
      ventaId: id, clienteId: x.clienteId, items: x.items, nota: x.nota,
      fecha: x.dia === diaOriginal ? v.fecha : fechaVentaISO(x.dia),
      totalFinal: x.totalFinal ?? x.items.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0),
    })
    toast.success(`Venta #${id} actualizada`)
    navegar(`/ventas?venta=${id}`, { replace: true })
  }

  return (
    <div className="grid gap-5">
      <PageHeader title={`Editar venta #${id}`} description="Al guardar, el inventario se ajusta solo con las diferencias."
        actions={<Button variant="ghost" onClick={() => navegar(-1)}><ArrowLeft /> Volver</Button>} />
      <VentaEditor textoBoton="Guardar cambios" apartado={datos.apartado} onGuardar={guardar}
        inicial={{ clienteId: v.cliente_id, dia: diaOriginal, totalFinal: v.ajuste !== 0 ? String(v.total) : '', nota: v.nota ?? '', items: datos.carrito }} />
    </div>
  )
}
