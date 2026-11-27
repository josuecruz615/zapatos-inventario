import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BUCKET_FOTOS, supabase } from './supabase'
import type {
  Cliente, Conteo, ConteoLinea, ConteoTalla, ItemCarrito, Movimiento, PreviaConteo, Producto, ResumenConteo, ResumenMes, Venta, VentaItem, VentasPorProducto,
} from './types'

/** PostgREST devuelve máximo 1000 filas por consulta: esta función pagina hasta traer todo. */
async function traerTodo<T>(
  construir: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const pagina = 1000
  const todo: T[] = []
  for (let desde = 0; ; desde += pagina) {
    const { data, error } = await construir(desde, desde + pagina - 1)
    if (error) throw error
    todo.push(...(data ?? []))
    if (!data || data.length < pagina) return todo
  }
}

const n = (v: unknown) => Number(v ?? 0)

// ---------------------------------------------------------------- Claves de caché
export const claves = {
  inventario: ['inventario'] as const,
  marcas: ['marcas'] as const,
  clientes: ['clientes'] as const,
  ventas: (desde?: string, hasta?: string) => ['ventas', desde ?? null, hasta ?? null] as const,
  venta: (id: number) => ['venta', id] as const,
  ventaItems: (id: number) => ['venta-items', id] as const,
  resumen: ['resumen-mensual'] as const,
  porProducto: ['ventas-por-producto'] as const,
  movimientos: (productoId: number) => ['movimientos', productoId] as const,
  ventasProducto: (productoId: number) => ['ventas-producto', productoId] as const,
  ventasCliente: (clienteId: number) => ['ventas-cliente', clienteId] as const,
}

// ---------------------------------------------------------------- Inventario
export function useInventario() {
  return useQuery({
    queryKey: claves.inventario,
    queryFn: async (): Promise<Producto[]> => {
      const filas = await traerTodo<Producto>((a, b) =>
        supabase.from('v_inventario').select('*').order('nombre').range(a, b) as never)
      return filas.map((p) => ({
        ...p,
        precio: n(p.precio),
        costo: p.costo == null ? null : n(p.costo),
        existencia_total: n(p.existencia_total),
        tallas: (p.tallas ?? []).map((t) => ({ ...t, talla: n(t.talla), existencia: n(t.existencia) })),
      }))
    },
  })
}

export function useMarcas() {
  return useQuery({
    queryKey: claves.marcas,
    queryFn: async () => {
      const { data, error } = await supabase.from('marcas').select('id, nombre').order('nombre')
      if (error) throw error
      return data as { id: number; nombre: string }[]
    },
    staleTime: 5 * 60_000,
  })
}

export function useMovimientos(productoId: number | null) {
  return useQuery({
    queryKey: claves.movimientos(productoId ?? 0),
    enabled: !!productoId,
    queryFn: async (): Promise<Movimiento[]> => {
      const { data, error } = await supabase.from('v_movimientos').select('*')
        .eq('producto_id', productoId!).order('created_at', { ascending: false }).limit(200)
      if (error) throw error
      return (data ?? []).map((m) => ({ ...m, talla: n(m.talla) })) as Movimiento[]
    },
  })
}

export function useVentasDeProducto(productoId: number | null) {
  return useQuery({
    queryKey: claves.ventasProducto(productoId ?? 0),
    enabled: !!productoId,
    queryFn: async () => {
      const { data, error } = await supabase.from('v_venta_items')
        .select('venta_id, cantidad, precio_unitario, talla, ventas:venta_id(fecha, clientes:cliente_id(nombre))')
        .eq('producto_id', productoId!).order('venta_id', { ascending: false }).limit(100)
      if (error) throw error
      return (data ?? []) as unknown as {
        venta_id: number; cantidad: number; precio_unitario: number; talla: number
        ventas: { fecha: string; clientes: { nombre: string } | null } | null
      }[]
    },
  })
}

export type DatosProducto = {
  codigo: string
  nombre: string
  marca: string
  precio: number
  costo: number | null
  descripcion: string | null
  imagen_url: string | null
}

export function useCrearProducto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (d: DatosProducto & { tallas: { talla: number; existencia: number }[] }) => {
      const { data, error } = await supabase.rpc('crear_producto', {
        p_codigo: d.codigo, p_nombre: d.nombre, p_marca: d.marca, p_precio: d.precio,
        p_tallas: d.tallas, p_costo: d.costo ?? undefined, p_descripcion: d.descripcion ?? undefined,
        p_imagen_url: d.imagen_url ?? undefined,
      })
      if (error) throw error
      return data as number
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: claves.inventario })
      qc.invalidateQueries({ queryKey: claves.marcas })
      qc.invalidateQueries({ queryKey: claves.porProducto })
    },
  })
}

export function useActualizarProducto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...d }: Partial<DatosProducto> & { id: number; activo?: boolean }) => {
      const cambios: Record<string, unknown> = { ...d }
      if (d.marca !== undefined) {
        const { data, error } = await supabase.rpc('obtener_marca', { p_nombre: d.marca })
        if (error) throw error
        cambios.marca_id = data
        delete cambios.marca
      }
      const { error } = await supabase.from('productos').update(cambios).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: claves.inventario })
      qc.invalidateQueries({ queryKey: claves.marcas })
      qc.invalidateQueries({ queryKey: claves.porProducto })
    },
  })
}

export function useEliminarProducto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from('productos').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: claves.inventario }),
  })
}

export function useGuardarTallas() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { productoId: number; tallas: { talla: number; existencia: number }[]; nota?: string }) => {
      const { error } = await supabase.rpc('guardar_tallas', {
        p_producto_id: v.productoId, p_tallas: v.tallas, p_nota: v.nota || undefined,
      })
      if (error) throw error
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: claves.inventario })
      qc.invalidateQueries({ queryKey: claves.movimientos(v.productoId) })
      qc.invalidateQueries({ queryKey: claves.porProducto })
    },
  })
}

/** Reduce la foto en el navegador (máx. 1600 px, WebP) antes de subirla. */
async function comprimirImagen(archivo: File): Promise<Blob> {
  if (!archivo.type.startsWith('image/') || archivo.type === 'image/gif') return archivo
  try {
    const bitmap = await createImageBitmap(archivo)
    const escala = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * escala)
    canvas.height = Math.round(bitmap.height * escala)
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/webp', 0.85))
    return blob && blob.size < archivo.size ? blob : archivo
  } catch {
    return archivo
  }
}

export async function subirFoto(archivo: File, codigo: string): Promise<string> {
  const blob = await comprimirImagen(archivo)
  const ext = blob.type === 'image/webp' ? 'webp' : (archivo.name.split('.').pop() || 'jpg').toLowerCase()
  const limpio = codigo.toUpperCase().replace(/[^A-Z0-9-]/g, '_') || 'PRODUCTO'
  const ruta = `productos/${limpio}-${Date.now()}.${ext}`
  const { error } = await supabase.storage.from(BUCKET_FOTOS).upload(ruta, blob, {
    cacheControl: '31536000', upsert: false, contentType: blob.type || archivo.type,
  })
  if (error) throw error
  return supabase.storage.from(BUCKET_FOTOS).getPublicUrl(ruta).data.publicUrl
}

// ---------------------------------------------------------------- Clientes
export function useClientes() {
  return useQuery({
    queryKey: claves.clientes,
    queryFn: () => traerTodo<Cliente>((a, b) =>
      supabase.from('clientes').select('*').order('nombre').range(a, b) as never),
  })
}

export type DatosCliente = Pick<Cliente, 'nombre' | 'telefono' | 'direccion' | 'notas' | 'problemas'>

export function useGuardarCliente() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...d }: DatosCliente & { id?: number }): Promise<Cliente> => {
      const consulta = id
        ? supabase.from('clientes').update(d).eq('id', id).select().single()
        : supabase.from('clientes').insert(d).select().single()
      const { data, error } = await consulta
      if (error) throw error
      return data as Cliente
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: claves.clientes })
      qc.invalidateQueries({ queryKey: ['ventas'] })
    },
  })
}

export function useEliminarCliente() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from('clientes').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: claves.clientes }),
  })
}

// ---------------------------------------------------------------- Ventas
const normalizarVenta = (v: Venta): Venta => ({
  ...v, subtotal: n(v.subtotal), ajuste: n(v.ajuste), total: n(v.total), lineas: n(v.lineas), unidades: n(v.unidades),
})

/** Ventas entre dos instantes ISO (hasta excluido). Sin rango = todas. */
export function useVentas(desde?: string, hasta?: string) {
  return useQuery({
    queryKey: claves.ventas(desde, hasta),
    queryFn: async () => {
      const filas = await traerTodo<Venta>((a, b) => {
        let c = supabase.from('v_ventas').select('*').order('fecha', { ascending: false })
        if (desde) c = c.gte('fecha', desde)
        if (hasta) c = c.lt('fecha', hasta)
        return c.range(a, b) as never
      })
      return filas.map(normalizarVenta)
    },
  })
}

export function useVentasDeCliente(clienteId: number | null) {
  return useQuery({
    queryKey: claves.ventasCliente(clienteId ?? 0),
    enabled: !!clienteId,
    queryFn: async () => {
      const { data, error } = await supabase.from('v_ventas').select('*').eq('cliente_id', clienteId!)
        .order('fecha', { ascending: false })
      if (error) throw error
      return (data as Venta[]).map(normalizarVenta)
    },
  })
}

export function useVenta(id: number | null) {
  return useQuery({
    queryKey: claves.venta(id ?? 0),
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('v_ventas').select('*').eq('id', id!).maybeSingle()
      if (error) throw error
      return data ? normalizarVenta(data as Venta) : null
    },
  })
}

export function useVentaItems(id: number | null) {
  return useQuery({
    queryKey: claves.ventaItems(id ?? 0),
    enabled: !!id,
    queryFn: async (): Promise<VentaItem[]> => {
      const { data, error } = await supabase.from('v_venta_items').select('*').eq('venta_id', id!).order('id')
      if (error) throw error
      return (data ?? []).map((i) => ({
        ...i, cantidad: n(i.cantidad), precio_unitario: n(i.precio_unitario), subtotal: n(i.subtotal), talla: n(i.talla),
      })) as VentaItem[]
    },
  })
}

export function useResumenMensual() {
  return useQuery({
    queryKey: claves.resumen,
    queryFn: async (): Promise<ResumenMes[]> => {
      const { data, error } = await supabase.from('v_resumen_mensual').select('*').order('mes')
      if (error) throw error
      return (data ?? []).map((r) => ({
        mes: r.mes, ventas: n(r.ventas), unidades: n(r.unidades), subtotal: n(r.subtotal), ajustes: n(r.ajustes), total: n(r.total),
      }))
    },
  })
}

export function useVentasPorProducto() {
  return useQuery({
    queryKey: claves.porProducto,
    queryFn: async (): Promise<VentasPorProducto[]> => {
      const filas = await traerTodo<VentasPorProducto>((a, b) =>
        supabase.from('v_ventas_por_producto').select('*').order('unidades_vendidas', { ascending: false }).range(a, b) as never)
      return filas.map((p) => ({
        ...p, unidades_vendidas: n(p.unidades_vendidas), monto_vendido: n(p.monto_vendido),
        precio: n(p.precio), existencia_total: n(p.existencia_total),
      }))
    },
  })
}

function invalidarTrasVenta(qc: ReturnType<typeof useQueryClient>) {
  for (const k of [['ventas'], ['venta'], ['venta-items'], claves.inventario, claves.resumen, claves.porProducto, ['movimientos'], ['ventas-producto'], ['ventas-cliente']]) {
    qc.invalidateQueries({ queryKey: k })
  }
}

const aItems = (items: ItemCarrito[]) =>
  items.map((i) => ({ producto_talla_id: i.producto_talla_id, cantidad: i.cantidad, precio_unitario: i.precio_unitario }))

export type DatosVenta = {
  clienteId: number
  items: ItemCarrito[]
  fecha: string
  totalFinal: number | null
  nota: string
}

export function useRegistrarVenta() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: DatosVenta) => {
      const { data, error } = await supabase.rpc('registrar_venta', {
        p_cliente_id: v.clienteId, p_items: aItems(v.items), p_fecha: v.fecha,
        p_total_final: v.totalFinal ?? undefined, p_nota: v.nota || undefined,
      })
      if (error) throw error
      return data as number
    },
    onSuccess: () => invalidarTrasVenta(qc),
  })
}

export function useActualizarVenta() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: DatosVenta & { ventaId: number }) => {
      const { error } = await supabase.rpc('actualizar_venta', {
        p_venta_id: v.ventaId, p_items: aItems(v.items), p_cliente_id: v.clienteId, p_fecha: v.fecha,
        p_total_final: v.totalFinal ?? undefined, p_nota: v.nota || undefined,
      })
      if (error) throw error
    },
    onSuccess: () => invalidarTrasVenta(qc),
  })
}

export function useEliminarVenta() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.rpc('eliminar_venta', { p_venta_id: id })
      if (error) throw error
    },
    onSuccess: () => invalidarTrasVenta(qc),
  })
}

// ---------------------------------------------------------------- Validación de inventario
export const clavesConteo = {
  lista: ['conteos'] as const,
  uno: (id: number) => ['conteo', id] as const,
  detalle: (id: number) => ['conteo-detalle', id] as const,
  previa: (id: number) => ['conteo-previa', id] as const,
}

const normalizarConteo = (c: Conteo): Conteo => ({
  ...c, tallas_total: n(c.tallas_total), tallas_terminadas: n(c.tallas_terminadas), lineas_contadas: n(c.lineas_contadas),
})

export function useConteos() {
  return useQuery({
    queryKey: clavesConteo.lista,
    queryFn: async () => {
      const { data, error } = await supabase.from('v_conteos').select('*').order('created_at', { ascending: false }).limit(200)
      if (error) throw error
      return (data as Conteo[]).map(normalizarConteo)
    },
  })
}

export function useConteo(id: number | null) {
  return useQuery({
    queryKey: clavesConteo.uno(id ?? 0),
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('v_conteos').select('*').eq('id', id!).maybeSingle()
      if (error) throw error
      return data ? normalizarConteo(data as Conteo) : null
    },
  })
}

/** Tallas y cantidades contadas. Se refresca solo cada 15 s por si cuentan desde dos teléfonos. */
export function useConteoDetalle(id: number | null, activo: boolean) {
  return useQuery({
    queryKey: clavesConteo.detalle(id ?? 0),
    enabled: !!id,
    refetchInterval: activo ? 15_000 : false,
    queryFn: async () => {
      const [tallas, lineas] = await Promise.all([
        supabase.from('conteo_tallas').select('talla, terminada, terminado_at').eq('conteo_id', id!).order('talla'),
        traerTodo<ConteoLinea>((a, b) => supabase.from('conteo_lineas').select('producto_talla_id, contado, updated_at').eq('conteo_id', id!).range(a, b) as never),
      ])
      if (tallas.error) throw tallas.error
      return {
        tallas: (tallas.data ?? []).map((t) => ({ ...t, talla: n(t.talla) })) as ConteoTalla[],
        lineas: new Map(lineas.map((l) => [l.producto_talla_id, n(l.contado)])),
      }
    },
  })
}

export function usePreviaConteo(id: number | null, enabled: boolean) {
  return useQuery({
    queryKey: clavesConteo.previa(id ?? 0),
    enabled: !!id && enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('previa_conteo', { p_conteo_id: id! })
      if (error) throw error
      return (data as PreviaConteo[]).map((r) => ({
        ...r, talla: n(r.talla), sistema: n(r.sistema), contado: n(r.contado), movido_despues: n(r.movido_despues), final: n(r.final),
      }))
    },
  })
}

export function useIniciarConteo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (marcaId: number) => {
      const { data, error } = await supabase.rpc('iniciar_conteo', { p_marca_id: marcaId })
      if (error) throw error
      return data as number
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: clavesConteo.lista }),
  })
}

export async function guardarConteo(conteoId: number, productoTallaId: number, contado: number) {
  const { error } = await supabase.rpc('registrar_conteo', { p_conteo_id: conteoId, p_producto_talla_id: productoTallaId, p_contado: contado })
  if (error) throw error
}

export function useMarcarTalla(conteoId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { talla: number; terminada: boolean }) => {
      const { error } = await supabase.rpc('marcar_talla_conteo', { p_conteo_id: conteoId, p_talla: v.talla, p_terminada: v.terminada })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: clavesConteo.detalle(conteoId) })
      qc.invalidateQueries({ queryKey: clavesConteo.uno(conteoId) })
      qc.invalidateQueries({ queryKey: clavesConteo.lista })
    },
  })
}

export function useCerrarConteo(conteoId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (nota: string) => {
      const { data, error } = await supabase.rpc('cerrar_conteo', { p_conteo_id: conteoId, p_nota: nota || undefined })
      if (error) throw error
      return data as ResumenConteo
    },
    onSuccess: () => {
      for (const k of [clavesConteo.lista, clavesConteo.uno(conteoId), claves.inventario, ['movimientos'], claves.porProducto]) qc.invalidateQueries({ queryKey: k })
    },
  })
}

export function useCancelarConteo(conteoId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('cancelar_conteo', { p_conteo_id: conteoId })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: clavesConteo.lista })
      qc.invalidateQueries({ queryKey: clavesConteo.uno(conteoId) })
    },
  })
}
