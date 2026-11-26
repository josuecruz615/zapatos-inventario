import { q, talla } from '@/lib/utils'

type Linea = { nombre: string; codigo: string; talla: number; cantidad: number; precio_unitario: number }

export function textoRecibo(v: {
  id: number; fecha: string; cliente: string; subtotal: number; ajuste: number; total: number; items: Linea[]
}) {
  const dia = new Intl.DateTimeFormat('es-GT', { timeZone: 'America/Guatemala', dateStyle: 'long' }).format(new Date(v.fecha))
  const lineas = v.items.map((i) => `• ${i.cantidad} × ${i.nombre} (${i.codigo}) talla ${talla(i.talla)} — ${q(i.cantidad * i.precio_unitario)}`)
  const partes = [
    `*ZAPATONGT* — Venta #${v.id}`,
    `${dia}`,
    `Cliente: ${v.cliente}`,
    '',
    ...lineas,
    '',
  ]
  if (v.ajuste !== 0) {
    partes.push(`Subtotal: ${q(v.subtotal)}`)
    partes.push(`${v.ajuste < 0 ? 'Descuento' : 'Recargo'}: ${q(Math.abs(v.ajuste))}`)
  }
  partes.push(`*Total: ${q(v.total)}*`, '', '¡Gracias por tu compra! 👟')
  return partes.join('\n')
}
