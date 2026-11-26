import { Download, LayoutGrid, List, PackagePlus, PackageSearch, SlidersHorizontal, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input, SearchInput, Select } from '@/components/ui/form'
import { Badge, Card, Chip, Empty, FotoProducto, PageHeader, Segmented, Skeleton, tonoExistencia } from '@/components/ui/misc'
import { useInventario } from '@/lib/api'
import type { Producto } from '@/lib/types'
import { cn, normalizar, num, q, talla } from '@/lib/utils'
import { compartir, fotoComoArchivo, puedeCompartirArchivos } from '@/lib/dispositivo'
import { descargarFotos } from './descargarFotos'

const MAX_COMPARTIR = 30
import { ProductoDetalle } from './ProductoDetalle'
import { ProductoForm } from './ProductoForm'

type Estado = 'disponibles' | 'todos' | 'bajo' | 'agotados' | 'inactivos'
type Orden = 'nombre' | 'codigo' | 'existencia' | 'precio-asc' | 'precio-desc' | 'recientes'

const estados: { value: Estado; label: string }[] = [
  { value: 'disponibles', label: 'Con existencia' },
  { value: 'bajo', label: 'Por agotarse' },
  { value: 'agotados', label: 'Agotados' },
  { value: 'todos', label: 'Todos' },
  { value: 'inactivos', label: 'Archivados' },
]

const lista = (v: string | null) => (v ? v.split(',').filter(Boolean) : [])

export default function Inventario() {
  const { data, isLoading, error } = useInventario()
  const [params, setParams] = useSearchParams()
  const [verFiltros, setVerFiltros] = useState(false)
  const [descargando, setDescargando] = useState(false)

  const busqueda = params.get('q') ?? ''
  const marcas = lista(params.get('marca'))
  const tallas = lista(params.get('talla')).map(Number)
  const estado = (params.get('estado') as Estado) || 'disponibles'
  const cantidad = params.get('cantidad') ?? ''
  const orden = (params.get('orden') as Orden) || 'nombre'
  const vista = params.get('vista') === 'lista' ? 'lista' : 'grid'
  const productoId = Number(params.get('producto')) || null
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
  const alternar = (clave: string, actual: (string | number)[], valor: string | number) => {
    const s = new Set(actual.map(String))
    if (s.has(String(valor))) s.delete(String(valor))
    else s.add(String(valor))
    set({ [clave]: [...s].join(',') || null })
  }

  const opciones = useMemo(() => {
    const ms = new Set<string>()
    const ts = new Set<number>()
    for (const p of data ?? []) {
      ms.add(p.marca)
      for (const t of p.tallas) ts.add(t.talla)
    }
    return { marcas: [...ms].sort(), tallas: [...ts].sort((a, b) => a - b) }
  }, [data])

  const filtrados = useMemo(() => {
    const texto = normalizar(busqueda)
    const cant = cantidad === '' ? null : Number(cantidad)
    const res = (data ?? []).filter((p) => {
      if (estado === 'inactivos' ? p.activo : !p.activo) return false
      if (texto && !normalizar(`${p.codigo} ${p.nombre} ${p.marca}`).includes(texto)) return false
      if (marcas.length && !marcas.includes(p.marca)) return false
      const relevantes = tallas.length ? p.tallas.filter((t) => tallas.includes(t.talla)) : p.tallas
      if (tallas.length && !relevantes.length) return false
      const total = relevantes.reduce((s, t) => s + t.existencia, 0)
      if (estado === 'disponibles' && total <= 0) return false
      if (estado === 'bajo' && (total <= 0 || total > 2)) return false
      if (estado === 'agotados' && total > 0) return false
      if (cant !== null && !Number.isNaN(cant) && total !== cant) return false
      return true
    })
    const cmp: Record<Orden, (a: Producto, b: Producto) => number> = {
      nombre: (a, b) => a.nombre.localeCompare(b.nombre),
      codigo: (a, b) => a.codigo.localeCompare(b.codigo),
      existencia: (a, b) => b.existencia_total - a.existencia_total,
      'precio-asc': (a, b) => a.precio - b.precio,
      'precio-desc': (a, b) => b.precio - a.precio,
      recientes: (a, b) => b.created_at.localeCompare(a.created_at),
    }
    return res.sort(cmp[orden])
  }, [data, busqueda, marcas, tallas, estado, cantidad, orden])

  const pares = filtrados.reduce((s, p) => s + (tallas.length
    ? p.tallas.filter((t) => tallas.includes(t.talla)).reduce((x, t) => x + t.existencia, 0)
    : p.existencia_total), 0)
  const hayFiltros = !!(busqueda || marcas.length || tallas.length || cantidad || estado !== 'disponibles')
  const activosFiltros = marcas.length + tallas.length + (cantidad ? 1 : 0)

  async function bajarFotos() {
    setDescargando(true)
    const id = toast.loading('Preparando fotos…')
    try {
      // iPhone: se preparan las fotos y luego se abre el menú de compartir (Guardar imágenes, WhatsApp…).
      if (puedeCompartirArchivos()) {
        const lote = filtrados.filter((p) => p.imagen_url).slice(0, MAX_COMPARTIR)
        let hechas = 0
        const archivos = (await Promise.all(lote.map(async (p) => {
          const f = await fotoComoArchivo(p.imagen_url!, `${p.codigo} ${p.nombre}`)
          toast.loading(`Preparando fotos ${++hechas} de ${lote.length}…`, { id })
          return f
        }))).filter((f): f is File => !!f)
        if (!archivos.length) throw new Error('No se pudieron obtener las fotos')
        const extra = filtrados.filter((p) => p.imagen_url).length > MAX_COMPARTIR
          ? ` (las primeras ${MAX_COMPARTIR}; filtra para elegir otras)` : ''
        // Safari exige que compartir salga de un toque: por eso el botón en el aviso.
        toast.success(`${archivos.length} fotos listas${extra}`, {
          id, duration: 60_000,
          action: { label: 'Compartir', onClick: () => { compartir({ files: archivos }) } },
        })
        return
      }
      const n = await descargarFotos(filtrados, (hechas, total) => toast.loading(`Descargando fotos ${hechas} de ${total}…`, { id }))
      toast.success(`Se descargaron ${n} fotos`, { id })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudieron descargar las fotos', { id })
    } finally {
      setDescargando(false)
    }
  }

  const productoAbierto = data?.find((p) => p.id === productoId) ?? null
  const productoEditar = data?.find((p) => p.id === editarId) ?? null

  const panelFiltros = (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <p className="text-sm font-medium">Marca</p>
        <div className="flex flex-wrap gap-2">
          {opciones.marcas.map((m) => <Chip key={m} active={marcas.includes(m)} onClick={() => alternar('marca', marcas, m)}>{m}</Chip>)}
        </div>
      </div>
      <div className="grid gap-2">
        <p className="text-sm font-medium">Talla</p>
        <div className="flex flex-wrap gap-2">
          {opciones.tallas.map((t) => (
            <Chip key={t} active={tallas.includes(t)} onClick={() => alternar('talla', tallas, t)} className="min-w-12 justify-center tabular">{talla(t)}</Chip>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <label className="grid gap-2">
          <span className="text-sm font-medium">Cantidad exacta de pares</span>
          <Input type="number" min={0} inputMode="numeric" placeholder="Ej. 1" value={cantidad}
            onChange={(e) => set({ cantidad: e.target.value })} className="w-40" />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-medium">Ordenar por</span>
          <Select value={orden} onChange={(e) => set({ orden: e.target.value === 'nombre' ? null : e.target.value })} className="w-52">
            <option value="nombre">Nombre (A–Z)</option>
            <option value="codigo">Código</option>
            <option value="existencia">Más existencia</option>
            <option value="precio-asc">Precio: menor a mayor</option>
            <option value="precio-desc">Precio: mayor a menor</option>
            <option value="recientes">Agregados recientemente</option>
          </Select>
        </label>
      </div>
    </div>
  )

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Inventario"
        description={isLoading ? 'Cargando…' : `${num(filtrados.length)} modelos · ${num(pares)} pares`}
        actions={<>
          <Button variant="outline" onClick={bajarFotos} loading={descargando} disabled={!filtrados.length}>
            <Download /> <span className="hidden sm:inline">Descargar fotos</span><span className="sm:hidden">Fotos</span>
          </Button>
          <Button variant="accent" onClick={() => set({ nuevo: '1' }, false)}><PackagePlus /> Nuevo producto</Button>
        </>}
      />

      <div className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput value={busqueda} onChange={(v) => set({ q: v })} placeholder="Buscar por código, nombre o marca" className="min-w-60 flex-1" />
          <Button variant={verFiltros ? 'primary' : 'outline'} onClick={() => setVerFiltros((v) => !v)}>
            <SlidersHorizontal /> Filtros {activosFiltros > 0 && <Badge tone="accent" className="bg-accent text-accent-foreground">{activosFiltros}</Badge>}
          </Button>
          <Segmented value={vista} onChange={(v) => set({ vista: v === 'grid' ? null : v })}
            options={[{ value: 'grid', label: <LayoutGrid className="size-4" aria-label="Cuadrícula" /> }, { value: 'lista', label: <List className="size-4" aria-label="Lista" /> }]} />
        </div>
        <div className="scrollbar-none -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <Segmented value={estado} onChange={(v) => set({ estado: v === 'disponibles' ? null : v })} options={estados} />
        </div>
        {verFiltros && <Card className="animate-in p-4">{panelFiltros}</Card>}
        {hayFiltros && (
          <div className="flex flex-wrap items-center gap-2">
            {marcas.map((m) => <Chip key={m} active onClick={() => alternar('marca', marcas, m)}>{m} <X className="size-3.5" /></Chip>)}
            {tallas.map((t) => <Chip key={t} active onClick={() => alternar('talla', tallas, t)}>Talla {talla(t)} <X className="size-3.5" /></Chip>)}
            {cantidad && <Chip active onClick={() => set({ cantidad: null })}>{cantidad} pares <X className="size-3.5" /></Chip>}
            <button type="button" className="cursor-pointer text-sm text-muted-foreground underline-offset-4 hover:underline"
              onClick={() => setParams(new URLSearchParams(vista === 'lista' ? { vista: 'lista' } : {}), { replace: true })}>
              Limpiar filtros
            </button>
          </div>
        )}
      </div>

      {error ? <Empty icon={PackageSearch} title="No se pudo cargar el inventario" description={String((error as Error).message)} />
        : isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
            {Array.from({ length: 10 }, (_, i) => <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />)}
          </div>
        ) : !filtrados.length ? (
          <Empty icon={PackageSearch} title="No hay productos con esos filtros"
            description="Prueba con otra búsqueda o limpia los filtros."
            action={<Button variant="outline" onClick={() => setParams(new URLSearchParams(), { replace: true })}>Limpiar filtros</Button>} />
        ) : vista === 'grid' ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
            {filtrados.map((p) => <TarjetaProducto key={p.id} p={p} tallasSel={tallas} onClick={() => set({ producto: String(p.id) }, false)} />)}
          </div>
        ) : (
          <Card className="overflow-hidden">
            <ul className="divide-y divide-border">
              {filtrados.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => set({ producto: String(p.id) }, false)} className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left hover:bg-muted/50">
                    <FotoProducto src={p.imagen_url} alt={p.nombre} className="size-14 shrink-0 rounded-lg" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{p.nombre}</p>
                      <p className="truncate text-sm text-muted-foreground">{p.codigo} · {p.marca} · {q(p.precio)}</p>
                      <TallasMini p={p} tallasSel={tallas} className="mt-1.5" />
                    </div>
                    <Badge tone={tonoExistencia(p.existencia_total)} className="hidden sm:inline-flex">{p.existencia_total} pares</Badge>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        )}

      <ProductoDetalle producto={productoAbierto} onClose={() => set({ producto: null })}
        onEditar={(id) => set({ editar: String(id) }, false)} />
      <ProductoForm open={nuevo || !!productoEditar} producto={productoEditar}
        onClose={(creadoId) => set({ nuevo: null, editar: null, ...(creadoId ? { producto: String(creadoId) } : {}) })} />
    </div>
  )
}

function TallasMini({ p, tallasSel, className }: { p: Producto; tallasSel: number[]; className?: string }) {
  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {p.tallas.map((t) => (
        <span key={t.id}
          title={`Talla ${talla(t.talla)}: ${t.existencia}`}
          className={cn('tabular inline-flex h-5 items-center rounded px-1.5 text-[11px] font-medium',
            t.existencia > 0 ? 'bg-muted text-foreground' : 'text-muted-foreground/50 line-through',
            tallasSel.includes(t.talla) && t.existencia > 0 && 'bg-accent/15 text-accent')}>
          {talla(t.talla)}{t.existencia > 1 && <span className="ml-0.5 text-muted-foreground">×{t.existencia}</span>}
        </span>
      ))}
    </div>
  )
}

function TarjetaProducto({ p, tallasSel, onClick }: { p: Producto; tallasSel: number[]; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="group grid cursor-pointer overflow-hidden rounded-2xl border border-border bg-card text-left shadow-xs transition-shadow hover:shadow-md">
      <div className="relative aspect-square overflow-hidden">
        <FotoProducto src={p.imagen_url} alt={p.nombre} className="size-full transition-transform duration-300 group-hover:scale-[1.03]" />
        <Badge tone={tonoExistencia(p.existencia_total)} className="absolute top-2 right-2 bg-card/90 shadow-sm backdrop-blur">
          {p.existencia_total === 0 ? 'Agotado' : `${p.existencia_total} ${p.existencia_total === 1 ? 'par' : 'pares'}`}
        </Badge>
      </div>
      <div className="grid gap-1 p-3">
        <p className="truncate text-sm font-semibold">{p.nombre}</p>
        <p className="truncate text-xs text-muted-foreground">{p.marca} · {p.codigo}</p>
        <p className="tabular text-sm font-semibold">{q(p.precio)}</p>
        <TallasMini p={p} tallasSel={tallasSel} className="mt-1" />
      </div>
    </button>
  )
}
