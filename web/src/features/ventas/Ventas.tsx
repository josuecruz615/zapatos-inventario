import { AlertTriangle, ChevronLeft, ChevronRight, FileDown, Receipt, ShoppingBag } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/form'
import { Badge, Card, Empty, PageHeader, Segmented, Skeleton, Stat } from '@/components/ui/misc'
import { useVentas } from '@/lib/api'
import type { Venta } from '@/lib/types'
import { capitalizar, diaGT, hoyGT, inicioDiaGT, mesLargo, normalizar, num, q, sumarDias, sumarMeses } from '@/lib/utils'
import { VentaDetalle } from './VentaDetalle'

type Periodo = 'hoy' | 'mes' | 'anio' | 'todo'

function rango(periodo: Periodo, mes: string): { desde?: string; hasta?: string; titulo: string } {
  const hoy = hoyGT()
  if (periodo === 'hoy') return { desde: inicioDiaGT(hoy), hasta: inicioDiaGT(sumarDias(hoy, 1)), titulo: 'Hoy' }
  if (periodo === 'mes') return { desde: inicioDiaGT(`${mes}-01`), hasta: inicioDiaGT(`${sumarMeses(mes, 1)}-01`), titulo: mesLargo(`${mes}-01`) }
  if (periodo === 'anio') {
    const a = mes.slice(0, 4)
    return { desde: inicioDiaGT(`${a}-01-01`), hasta: inicioDiaGT(`${Number(a) + 1}-01-01`), titulo: `Año ${a}` }
  }
  return { titulo: 'Todo el historial' }
}

const fDia = new Intl.DateTimeFormat('es-GT', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const fHora = new Intl.DateTimeFormat('es-GT', { timeZone: 'America/Guatemala', hour: 'numeric', minute: '2-digit' })

function exportarCSV(ventas: Venta[], titulo: string) {
  const filas = [['Venta', 'Fecha', 'Cliente', 'Teléfono', 'Pares', 'Subtotal', 'Ajuste', 'Total', 'Nota']]
  for (const v of ventas) {
    filas.push([String(v.id), new Date(v.fecha).toLocaleString('es-GT', { timeZone: 'America/Guatemala' }), v.cliente, v.cliente_telefono ?? '',
      String(v.unidades), v.subtotal.toFixed(2), v.ajuste.toFixed(2), v.total.toFixed(2), v.nota ?? ''])
  }
  const csv = filas.map((f) => f.map((c) => `"${c.replaceAll('"', '""')}"`).join(',')).join('\r\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
  a.download = `ventas ${titulo}.csv`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
}

export default function Ventas() {
  const [params, setParams] = useSearchParams()
  const periodo = (params.get('periodo') as Periodo) || 'mes'
  const mes = params.get('mes') ?? hoyGT().slice(0, 7)
  const busqueda = params.get('q') ?? ''
  const ventaId = Number(params.get('venta')) || null
  const r = rango(periodo, mes)
  const { data, isLoading, error } = useVentas(r.desde, r.hasta)

  const set = (cambios: Record<string, string | null>, reemplazar = true) => {
    const p = new URLSearchParams(params)
    for (const [k, v] of Object.entries(cambios)) {
      if (v === null || v === '') p.delete(k)
      else p.set(k, v)
    }
    setParams(p, { replace: reemplazar })
  }

  const filtradas = useMemo(() => {
    const t = normalizar(busqueda)
    return (data ?? []).filter((v) => !t || normalizar(`${v.cliente} ${v.cliente_telefono ?? ''} #${v.id}`).includes(t))
  }, [data, busqueda])

  const totales = filtradas.reduce((a, v) => ({ total: a.total + v.total, pares: a.pares + v.unidades, ajuste: a.ajuste + v.ajuste }), { total: 0, pares: 0, ajuste: 0 })

  const porDia = useMemo(() => {
    const grupos = new Map<string, Venta[]>()
    for (const v of filtradas) {
      const d = diaGT(v.fecha)
      grupos.set(d, [...(grupos.get(d) ?? []), v])
    }
    return [...grupos.entries()]
  }, [filtradas])

  const mesActual = hoyGT().slice(0, 7)

  return (
    <div className="grid gap-5">
      <PageHeader title="Ventas" description={r.titulo}
        actions={<>
          <Button variant="outline" disabled={!filtradas.length} onClick={() => exportarCSV(filtradas, r.titulo)}><FileDown /> <span className="hidden sm:inline">Exportar</span></Button>
          <Link to="/ventas/nueva"><Button variant="accent"><ShoppingBag /> Nueva venta</Button></Link>
        </>} />

      <div className="flex flex-wrap items-center gap-3">
        <Segmented value={periodo} onChange={(v) => set({ periodo: v === 'mes' ? null : v })}
          options={[{ value: 'hoy', label: 'Hoy' }, { value: 'mes', label: 'Mes' }, { value: 'anio', label: 'Año' }, { value: 'todo', label: 'Todo' }]} />
        {(periodo === 'mes' || periodo === 'anio') && (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" aria-label="Anterior" onClick={() => set({ mes: sumarMeses(mes, periodo === 'mes' ? -1 : -12) })}><ChevronLeft /></Button>
            <input type="month" value={mes} max={mesActual} onChange={(e) => e.target.value && set({ mes: e.target.value })}
              className="h-10 cursor-pointer appearance-none rounded-lg border border-input bg-card px-2 text-base sm:h-8 sm:text-sm" aria-label="Mes" />
            <Button variant="ghost" size="icon-sm" aria-label="Siguiente" disabled={mes >= mesActual}
              onClick={() => set({ mes: sumarMeses(mes, periodo === 'mes' ? 1 : 12) > mesActual ? mesActual : sumarMeses(mes, periodo === 'mes' ? 1 : 12) })}><ChevronRight /></Button>
          </div>
        )}
        <SearchInput value={busqueda} onChange={(v) => set({ q: v })} placeholder="Buscar cliente o número" className="min-w-56 flex-1" />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {isLoading ? Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />) : <>
          <Stat label="Total vendido" value={q(totales.total)} />
          <Stat label="Ventas" value={num(filtradas.length)} hint={filtradas.length ? `Promedio ${q(totales.total / filtradas.length)}` : undefined} />
          <Stat label="Pares vendidos" value={num(totales.pares)} />
          <Stat label="Descuentos y recargos" value={q(totales.ajuste)} hint="Diferencia frente al precio de lista" />
        </>}
      </div>

      {error ? <Empty icon={Receipt} title="No se pudieron cargar las ventas" description={(error as Error).message} />
        : isLoading ? <Skeleton className="h-96 rounded-2xl" />
        : !filtradas.length ? (
          <Empty icon={Receipt} title="No hay ventas en este periodo"
            action={<Link to="/ventas/nueva"><Button variant="accent"><ShoppingBag /> Registrar una venta</Button></Link>} />
        ) : (
          <div className="grid gap-5">
            {porDia.map(([dia, ventas]) => (
              <section key={dia} className="grid gap-2">
                <div className="flex items-baseline justify-between px-1">
                  <h2 className="text-sm font-semibold">{capitalizar(fDia.format(new Date(`${dia}T12:00:00Z`)))}</h2>
                  <p className="tabular text-sm text-muted-foreground">{q(ventas.reduce((s, v) => s + v.total, 0))}</p>
                </div>
                <Card className="overflow-hidden">
                  <ul className="divide-y divide-border">
                    {ventas.map((v) => (
                      <li key={v.id}>
                        <button type="button" onClick={() => set({ venta: String(v.id) }, false)}
                          className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left hover:bg-muted/50">
                          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-xs font-semibold text-muted-foreground">#{v.id}</div>
                          <div className="min-w-0 flex-1">
                            <p className="flex items-center gap-2 truncate font-medium">
                              {v.cliente}
                              {v.cliente_problemas && <AlertTriangle className="size-4 shrink-0 text-warning" aria-label="Cliente con problemas" />}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {fHora.format(new Date(v.fecha))} · {v.unidades} {v.unidades === 1 ? 'par' : 'pares'}{v.nota ? ` · ${v.nota}` : ''}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="tabular font-semibold">{q(v.total)}</p>
                            {v.ajuste !== 0 && <Badge tone={v.ajuste < 0 ? 'success' : 'warning'}>{v.ajuste < 0 ? '−' : '+'}{q(Math.abs(v.ajuste))}</Badge>}
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                </Card>
              </section>
            ))}
          </div>
        )}

      <VentaDetalle id={ventaId} onClose={() => set({ venta: null })} />
    </div>
  )
}
