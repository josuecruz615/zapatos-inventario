import { AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, Boxes, CalendarDays, PackagePlus, Receipt, ShoppingBag, UserPlus, Wallet } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Button } from '@/components/ui/button'
import { Badge, Card, FotoProducto, Segmented, Skeleton, Stat } from '@/components/ui/misc'
import { useInventario, useResumenMensual, useVentas, useVentasPorProducto } from '@/lib/api'
import { useAuth } from '@/auth/AuthProvider'
import { capitalizar, fechaHora, hoyGT, inicioDiaGT, mesCorto, mesLargo, num, q, qCorto, sumarDias, sumarMeses, talla } from '@/lib/utils'

function saludo() {
  const h = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Guatemala', hour: 'numeric', hour12: false }).format(new Date()))
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'
}

export default function Inicio() {
  const { sesion } = useAuth()
  const hoy = hoyGT()
  const mesActual = hoy.slice(0, 7)
  const resumen = useResumenMensual()
  const inventario = useInventario()
  const porProducto = useVentasPorProducto()
  const ventasHoy = useVentas(inicioDiaGT(hoy), inicioDiaGT(sumarDias(hoy, 1)))
  const recientes = useVentas(inicioDiaGT(`${sumarMeses(mesActual, -6)}-01`))
  const [metrica, setMetrica] = useState<'total' | 'unidades'>('total')

  const meses = useMemo(() => {
    const mapa = new Map((resumen.data ?? []).map((r) => [r.mes.slice(0, 7), r]))
    return Array.from({ length: 12 }, (_, i) => {
      const m = sumarMeses(mesActual, i - 11)
      const r = mapa.get(m)
      return { mes: `${m}-01`, etiqueta: mesCorto(`${m}-01`), total: r?.total ?? 0, unidades: r?.unidades ?? 0, ventas: r?.ventas ?? 0 }
    })
  }, [resumen.data, mesActual])

  const esteMes = meses[11]
  const mesPasado = meses[10]
  const variacion = mesPasado.total > 0 ? ((esteMes.total - mesPasado.total) / mesPasado.total) * 100 : null

  const stock = useMemo(() => {
    const activos = (inventario.data ?? []).filter((p) => p.activo)
    const pares = activos.reduce((s, p) => s + p.existencia_total, 0)
    const valor = activos.reduce((s, p) => s + p.existencia_total * p.precio, 0)
    const conExistencia = activos.filter((p) => p.existencia_total > 0).length
    const bajos = activos.filter((p) => p.existencia_total > 0 && p.existencia_total <= 2)
      .sort((a, b) => a.existencia_total - b.existencia_total)
    const porMarca = Object.entries(activos.reduce<Record<string, number>>((acc, p) => {
      acc[p.marca] = (acc[p.marca] ?? 0) + p.existencia_total
      return acc
    }, {})).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
    return { pares, valor, conExistencia, bajos, porMarca }
  }, [inventario.data])

  const nombre = sesion?.user.email?.split('@')[0] ?? ''
  const totalHoy = (ventasHoy.data ?? []).reduce((s, v) => s + v.total, 0)
  const cargandoTodo = resumen.isLoading || inventario.isLoading

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <p className="text-sm text-muted-foreground">
            {capitalizar(new Intl.DateTimeFormat('es-GT', { timeZone: 'America/Guatemala', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date()))}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{saludo()}{nombre ? `, ${nombre}` : ''}</h1>
        </div>
        <div className="hidden gap-2 sm:flex">
          <Link to="/clientes?nuevo=1"><Button variant="outline"><UserPlus /> Cliente</Button></Link>
          <Link to="/inventario?nuevo=1"><Button variant="outline"><PackagePlus /> Producto</Button></Link>
          <Link to="/ventas/nueva"><Button variant="accent"><ShoppingBag /> Nueva venta</Button></Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cargandoTodo ? Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />) : <>
          <Stat label="Vendido hoy" icon={Wallet} tone="accent" value={q(totalHoy)}
            hint={`${ventasHoy.data?.length ?? 0} ${ventasHoy.data?.length === 1 ? 'venta' : 'ventas'}`} />
          <Stat label={`${mesLargo(esteMes.mes).split(' ')[0]}`} icon={CalendarDays} value={qCorto(esteMes.total)}
            hint={variacion === null ? `${esteMes.ventas} ventas` : (
              <span className="flex items-center gap-1">
                <Badge tone={variacion >= 0 ? 'success' : 'danger'}>
                  {variacion >= 0 ? <ArrowUpRight /> : <ArrowDownRight />}{Math.abs(variacion).toFixed(0)}%
                </Badge>
                vs. {mesCorto(mesPasado.mes).toLowerCase()}
              </span>
            )} />
          <Stat label="Pares en existencia" icon={Boxes} value={num(stock.pares)}
            hint={`${stock.conExistencia} modelos · ${qCorto(stock.valor)} a precio de venta`} />
          <Stat label="Por agotarse" icon={AlertTriangle} tone={stock.bajos.length ? 'warning' : undefined} value={stock.bajos.length}
            hint="Modelos con 1 o 2 pares" />
        </>}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="grid gap-4 p-5 xl:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Ventas de los últimos 12 meses</h2>
              <p className="text-sm text-muted-foreground">
                {q(meses.reduce((s, m) => s + m.total, 0))} · {num(meses.reduce((s, m) => s + m.unidades, 0))} pares
              </p>
            </div>
            <Segmented value={metrica} onChange={setMetrica} options={[{ value: 'total', label: 'Quetzales' }, { value: 'unidades', label: 'Pares' }]} />
          </div>
          <div className="h-64">
            {resumen.isLoading ? <Skeleton className="h-full" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={meses} margin={{ left: -12, right: 4, top: 8 }}>
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="etiqueta" tickLine={false} axisLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} />
                  <YAxis tickLine={false} axisLine={false} width={56} tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                    tickFormatter={(v: number) => metrica === 'total' ? (v >= 1000 ? `Q${Math.round(v / 1000)}k` : `Q${v}`) : String(v)} />
                  <Tooltip cursor={{ fill: 'var(--muted)' }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const d = payload[0].payload as (typeof meses)[number]
                      return (
                        <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-lg">
                          <p className="font-medium">{mesLargo(d.mes)}</p>
                          <p className="tabular text-muted-foreground">{q(d.total)} · {d.unidades} pares · {d.ventas} ventas</p>
                        </div>
                      )
                    }} />
                  <Bar dataKey={metrica} fill="var(--accent)" radius={[6, 6, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="grid content-start gap-4 p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Más vendidos</h2>
            <Badge tone="outline">Histórico</Badge>
          </div>
          <ol className="grid gap-3">
            {porProducto.isLoading ? Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-12" />)
              : porProducto.data?.filter((p) => p.unidades_vendidas > 0).slice(0, 5).map((p, i) => (
                <li key={p.producto_id}>
                  <Link to={`/inventario?producto=${p.producto_id}`} className="flex items-center gap-3 rounded-lg hover:bg-muted/60">
                    <span className="w-4 text-center text-sm font-semibold text-muted-foreground">{i + 1}</span>
                    <FotoProducto src={p.imagen_url} alt={p.nombre} className="size-11 shrink-0 rounded-lg" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p.nombre}</p>
                      <p className="truncate text-xs text-muted-foreground">{p.marca} · {p.codigo}</p>
                    </div>
                    <div className="text-right">
                      <p className="tabular text-sm font-semibold">{p.unidades_vendidas}</p>
                      <p className="text-xs text-muted-foreground">pares</p>
                    </div>
                  </Link>
                </li>
              ))}
          </ol>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="grid content-start gap-3 p-5 xl:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Últimas ventas</h2>
            <Link to="/ventas" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">Ver todas <ArrowRight className="size-4" /></Link>
          </div>
          {recientes.isLoading ? <Skeleton className="h-40" /> : !recientes.data?.length ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No hay ventas en los últimos 6 meses.</p>
          ) : (
            <ul className="divide-y divide-border">
              {recientes.data.slice(0, 6).map((v) => (
                <li key={v.id}>
                  <Link to={`/ventas?venta=${v.id}`} className="flex items-center gap-3 py-2.5 hover:bg-muted/40">
                    <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground"><Receipt className="size-4" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{v.cliente}</p>
                      <p className="text-xs text-muted-foreground">{fechaHora(v.fecha)} · {v.unidades} {v.unidades === 1 ? 'par' : 'pares'}</p>
                    </div>
                    <p className="tabular text-sm font-semibold">{q(v.total)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="grid content-start gap-4 p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Por agotarse</h2>
            <Link to="/inventario?estado=bajo" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">Ver <ArrowRight className="size-4" /></Link>
          </div>
          {inventario.isLoading ? <Skeleton className="h-40" /> : !stock.bajos.length ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Ningún modelo con existencia baja.</p>
          ) : (
            <ul className="grid gap-3">
              {stock.bajos.slice(0, 5).map((p) => (
                <li key={p.id}>
                  <Link to={`/inventario?producto=${p.id}`} className="flex items-center gap-3 rounded-lg hover:bg-muted/60">
                    <FotoProducto src={p.imagen_url} alt={p.nombre} className="size-10 shrink-0 rounded-lg" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p.nombre}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        Talla {p.tallas.filter((t) => t.existencia > 0).map((t) => talla(t.talla)).join(', ')}
                      </p>
                    </div>
                    <Badge tone="warning">{p.existencia_total} {p.existencia_total === 1 ? 'par' : 'pares'}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {stock.porMarca.length > 0 && (
            <div className="grid gap-2 border-t border-border pt-4">
              <p className="text-sm font-medium">Existencia por marca</p>
              {stock.porMarca.slice(0, 6).map(([marca, pares]) => (
                <div key={marca} className="grid gap-1">
                  <div className="flex justify-between text-xs"><span>{marca}</span><span className="tabular text-muted-foreground">{pares}</span></div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${(pares / stock.porMarca[0][1]) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
