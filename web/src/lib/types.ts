export type Talla = { id: number; talla: number; existencia: number }

export type Producto = {
  id: number
  codigo: string
  nombre: string
  marca_id: number
  marca: string
  descripcion: string | null
  precio: number
  costo: number | null
  imagen_url: string | null
  activo: boolean
  created_at: string
  updated_at: string
  existencia_total: number
  tallas: Talla[]
}

export type Cliente = {
  id: number
  nombre: string
  telefono: string | null
  direccion: string | null
  notas: string | null
  problemas: boolean
  created_at: string
  updated_at: string
}

export type Venta = {
  id: number
  fecha: string
  cliente_id: number
  cliente: string
  cliente_telefono: string | null
  cliente_problemas: boolean
  subtotal: number
  ajuste: number
  total: number
  nota: string | null
  lineas: number
  unidades: number
  created_at: string
}

export type VentaItem = {
  id: number
  venta_id: number
  producto_talla_id: number
  cantidad: number
  precio_unitario: number
  subtotal: number
  talla: number
  producto_id: number
  codigo: string
  nombre: string
  marca: string
  imagen_url: string | null
}

export type ResumenMes = {
  mes: string
  ventas: number
  unidades: number
  subtotal: number
  ajustes: number
  total: number
}

export type VentasPorProducto = {
  producto_id: number
  codigo: string
  nombre: string
  marca: string
  imagen_url: string | null
  precio: number
  unidades_vendidas: number
  monto_vendido: number
  ultima_venta: string | null
  existencia_total: number
}

export type Movimiento = {
  id: number
  created_at: string
  tipo: 'migracion' | 'entrada' | 'ajuste' | 'venta' | 'devolucion' | 'conteo'
  cantidad: number
  existencia_resultante: number
  venta_id: number | null
  nota: string | null
  producto_talla_id: number
  talla: number
  producto_id: number
  codigo: string
  nombre: string
  marca: string
}

/** Artículo del carrito al vender o editar una venta. */
export type ItemCarrito = {
  producto_talla_id: number
  producto_id: number
  codigo: string
  nombre: string
  marca: string
  imagen_url: string | null
  talla: number
  precio_unitario: number
  cantidad: number
  /** Máximo vendible: existencia actual + lo que ya tenía la venta (al editar). */
  maximo: number
}

export type ResumenConteo = {
  tallas_revisadas: number; con_mas: number; con_menos: number; correctas: number; pares_antes: number; pares_despues: number
}

export type Conteo = {
  id: number
  marca_id: number
  marca: string
  estado: 'abierto' | 'cerrado' | 'cancelado'
  nota: string | null
  resumen: ResumenConteo | null
  created_at: string
  cerrado_at: string | null
  tallas_total: number
  tallas_terminadas: number
  lineas_contadas: number
}

export type ConteoTalla = { talla: number; terminada: boolean; terminado_at: string | null }
export type ConteoLinea = { producto_talla_id: number; contado: number; updated_at: string }

export type PreviaConteo = {
  producto_talla_id: number; producto_id: number; codigo: string; nombre: string; imagen_url: string | null
  talla: number; sistema: number; contado: number; movido_despues: number; final: number
}
