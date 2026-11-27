import * as DM from '@radix-ui/react-dropdown-menu'
import { ArrowLeft, Check, CheckCircle2, CircleSlash, CloudOff, EllipsisVertical, LoaderCircle, Plus, RotateCcw, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useConfirm } from '@/components/ui/dialog'
import { SearchInput, Stepper } from '@/components/ui/form'
import { Badge, Card, Chip, Empty, FotoProducto, Skeleton, Spinner } from '@/components/ui/misc'
import { guardarConteo, useCancelarConteo, useConteo, useConteoDetalle, useInventario, useMarcarTalla } from '@/lib/api'
import { cn, fecha, mensajeError, normalizar, talla as fTalla } from '@/lib/utils'
import { CierreConteo } from './CierreConteo'

type Estado = 'guardando' | 'error'

export default function Conteo() {
  const id = Number(useParams().id)
  const navegar = useNavigate()
  const [params, setParams] = useSearchParams()
  const conteo = useConteo(id)
  const abierto = conteo.data?.estado === 'abierto'
  const detalle = useConteoDetalle(id, abierto)
  const inventario = useInventario()
  const marcar = useMarcarTalla(id)
  const cancelar = useCancelarConteo(id)
  const confirmar = useConfirm()

  const [locales, setLocales] = useState<Map<number, number>>(new Map())
  const [estados, setEstados] = useState<Map<number, Estado>>(new Map())
  const temporizadores = useRef(new Map<number, ReturnType<typeof setTimeout>>())
  const [busqueda, setBusqueda] = useState('')
  // Los agotados casi nunca aparecen físicamente: se buscan aparte para no alargar la lista.
  const [verAgotados, setVerAgotados] = useState(false)
  const [cerrar, setCerrar] = useState(false)

  const productos = useMemo(() => (inventario.data ?? [])
    .filter((p) => p.marca_id === conteo.data?.marca_id && p.activo), [inventario.data, conteo.data?.marca_id])
  const tallas = detalle.data?.tallas ?? []
  const tallaSel = Number(params.get('talla')) || tallas.find((t) => !t.terminada)?.talla || tallas[0]?.talla
  const infoTalla = tallas.find((t) => t.talla === tallaSel)
  const terminadas = tallas.filter((t) => t.terminada).length

  const contado = useCallback((ptId: number) => locales.get(ptId) ?? detalle.data?.lineas.get(ptId), [locales, detalle.data])

  // Guardado automático: espera medio segundo después del último toque.
  const fijar = (ptId: number, valor: number) => {
    setLocales((m) => new Map(m).set(ptId, valor))
    setEstados((m) => new Map(m).set(ptId, 'guardando'))
    clearTimeout(temporizadores.current.get(ptId))
    temporizadores.current.set(ptId, setTimeout(async () => {
      try {
        await guardarConteo(id, ptId, valor)
        setEstados((m) => { const x = new Map(m); x.delete(ptId); return x })
      } catch (e) {
        setEstados((m) => new Map(m).set(ptId, 'error'))
        toast.error(mensajeError(e), { id: 'conteo-error' })
      }
    }, 500))
  }
  useEffect(() => () => temporizadores.current.forEach(clearTimeout), [])
  const pendientes = [...estados.values()].filter((e) => e === 'guardando').length
  const conError = [...estados.entries()].filter(([, e]) => e === 'error').map(([k]) => k)

  // Avisa si intenta salir con conteos sin guardar.
  useEffect(() => {
    if (!pendientes) return
    const aviso = (e: BeforeUnloadEvent) => e.preventDefault()
    addEventListener('beforeunload', aviso)
    return () => removeEventListener('beforeunload', aviso)
  }, [pendientes])

  // Lista principal: lo que el sistema dice que hay en esta talla + lo que ya se contó.
  const { principal, agotados } = useMemo(() => {
    const todas = productos
      .map((p) => ({ p, t: p.tallas.find((x) => x.talla === tallaSel) }))
      .filter((x): x is { p: typeof x.p; t: NonNullable<typeof x.t> } => !!x.t)
      .sort((a, b) => a.p.nombre.localeCompare(b.p.nombre))
    return {
      principal: todas.filter(({ t }) => t.existencia > 0 || contado(t.id) !== undefined),
      agotados: todas.filter(({ t }) => t.existencia <= 0 && contado(t.id) === undefined),
    }
  }, [productos, tallaSel, contado])

  const filas = useMemo(() => {
    const t = normalizar(busqueda)
    return (verAgotados ? agotados : principal).filter(({ p }) => !t || normalizar(`${p.codigo} ${p.nombre}`).includes(t))
  }, [verAgotados, agotados, principal, busqueda])

  const resumenTalla = useMemo(() => {
    let contados = 0, diferencias = 0, pares = 0
    for (const { t } of principal) {
      const c = contado(t.id)
      if (c !== undefined) { contados++; pares += c }
      const efectivo = c ?? (infoTalla?.terminada ? 0 : undefined)
      if (efectivo !== undefined && efectivo !== t.existencia) diferencias++
    }
    return { contados, diferencias, pares }
  }, [principal, contado, infoTalla?.terminada])

  async function terminarTalla() {
    if (pendientes) return toast.info('Esperando que se guarden los últimos conteos…')
    const sinContar = principal.filter(({ t }) => contado(t.id) === undefined && t.existencia > 0)
    if (sinContar.length) {
      const ok = await confirmar({
        titulo: `¿Terminar la talla ${fTalla(tallaSel!)}?`, confirmar: 'Terminar talla',
        mensaje: <>Hay <strong>{sinContar.length}</strong> {sinContar.length === 1 ? 'modelo' : 'modelos'} con existencia en el sistema que no contaste. Al terminar, quedarán en <strong>0</strong>.</>,
      })
      if (!ok) return
    }
    try {
      await marcar.mutateAsync({ talla: tallaSel!, terminada: true })
      const siguiente = tallas.find((t) => !t.terminada && t.talla !== tallaSel)
      toast.success(`Talla ${fTalla(tallaSel!)} terminada`, { description: siguiente ? `Sigue la talla ${fTalla(siguiente.talla)}` : 'Ya puedes revisar y cerrar.' })
      if (siguiente) setParams({ talla: String(siguiente.talla) }, { replace: true })
      setBusqueda('')
      setVerAgotados(false)
      scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e) { toast.error(mensajeError(e)) }
  }

  async function cancelarTodo() {
    const ok = await confirmar({
      titulo: 'Cancelar esta validación', peligro: true, confirmar: 'Cancelar validación',
      mensaje: 'Se descarta todo lo contado de esta marca y el inventario no cambia.',
    })
    if (!ok) return
    try { await cancelar.mutateAsync(); toast.success('Validación cancelada'); navegar('/inventario/validar') }
    catch (e) { toast.error(mensajeError(e)) }
  }

  if (conteo.isLoading || detalle.isLoading || inventario.isLoading) return <div className="grid min-h-[50vh] place-items-center"><Spinner className="size-7" /></div>
  if (!conteo.data) return <Empty icon={CircleSlash} title="No se encontró la validación" action={<Link to="/inventario/validar"><Button variant="outline">Volver</Button></Link>} />
  const c = conteo.data

  if (!abierto) {
    return (
      <div className="grid gap-5">
        <Link to="/inventario/validar" className="flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="size-4" /> Validar inventario</Link>
        <Card className="grid justify-items-center gap-3 p-8 text-center">
          {c.estado === 'cerrado' ? <CheckCircle2 className="size-10 text-success" /> : <CircleSlash className="size-10 text-muted-foreground" />}
          <h1 className="text-xl font-semibold">{c.marca} · validación {c.estado === 'cerrado' ? 'cerrada' : 'cancelada'}</h1>
          <p className="text-sm text-muted-foreground">{fecha(c.cerrado_at ?? c.created_at)}{c.nota ? ` · ${c.nota}` : ''}</p>
          {c.resumen && (
            <div className="mt-2 grid w-full max-w-md grid-cols-3 gap-2 text-sm">
              <div className="rounded-xl bg-muted/60 p-3"><p className="text-muted-foreground">Correctas</p><p className="text-lg font-semibold">{c.resumen.correctas}</p></div>
              <div className="rounded-xl bg-success/10 p-3"><p className="text-muted-foreground">Sobraban</p><p className="text-lg font-semibold">{c.resumen.con_mas}</p></div>
              <div className="rounded-xl bg-danger/10 p-3"><p className="text-muted-foreground">Faltaban</p><p className="text-lg font-semibold">{c.resumen.con_menos}</p></div>
              <p className="col-span-3 text-muted-foreground">Pares: {c.resumen.pares_antes} → <strong className="text-foreground">{c.resumen.pares_despues}</strong></p>
            </div>
          )}
        </Card>
      </div>
    )
  }

  const item = 'flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm outline-none data-highlighted:bg-muted [&_svg]:size-4'

  return (
    <div className="grid gap-4">
      {/* Encabezado */}
      <div className="flex items-start justify-between gap-3">
        <div className="grid gap-1">
          <Link to="/inventario/validar" className="flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="size-4" /> Validar inventario</Link>
          <h1 className="text-2xl font-semibold tracking-tight">Validando {c.marca}</h1>
          <p className="text-sm text-muted-foreground">{terminadas} de {tallas.length} tallas terminadas</p>
        </div>
        <DM.Root>
          <DM.Trigger asChild><Button variant="outline" size="icon" aria-label="Más opciones"><EllipsisVertical /></Button></DM.Trigger>
          <DM.Portal>
            <DM.Content align="end" sideOffset={6} className="z-50 min-w-52 animate-in rounded-xl border border-border bg-card p-1 shadow-lg">
              <DM.Item className={cn(item, 'text-danger')} onSelect={cancelarTodo}><CircleSlash /> Cancelar validación</DM.Item>
            </DM.Content>
          </DM.Portal>
        </DM.Root>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${tallas.length ? (terminadas / tallas.length) * 100 : 0}%` }} />
      </div>

      {/* Selector de talla */}
      <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {tallas.map((t) => (
          <Chip key={t.talla} active={t.talla === tallaSel} onClick={() => { setParams({ talla: String(t.talla) }, { replace: true }); setBusqueda(''); setVerAgotados(false) }}
            className={cn('tabular min-w-16 justify-center', t.terminada && t.talla !== tallaSel && 'border-success/40 bg-success/10 text-success')}>
            {t.terminada && <Check className="size-3.5" />} {fTalla(t.talla)}
          </Chip>
        ))}
      </div>

      {terminadas === tallas.length && tallas.length > 0 && (
        <Card className="flex animate-in flex-wrap items-center justify-between gap-3 border-success/40 bg-success/5 p-4">
          <div>
            <p className="font-semibold">¡Todas las tallas están terminadas!</p>
            <p className="text-sm text-muted-foreground">Revisa las diferencias y cierra para actualizar el inventario.</p>
          </div>
          <Button variant="accent" onClick={() => setCerrar(true)} disabled={pendientes > 0}><CheckCircle2 /> Revisar y cerrar</Button>
        </Card>
      )}

      {verAgotados ? (
        <div className="grid animate-in gap-3 rounded-2xl border border-accent/40 bg-accent/5 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="text-sm">
              <p className="font-semibold">Agregar un modelo que no aparece</p>
              <p className="text-muted-foreground">Modelos de {c.marca} en talla {tallaSel ? fTalla(tallaSel) : ''} que el sistema tiene en 0. Búscalo y marca cuántos encontraste.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => { setVerAgotados(false); setBusqueda('') }}><X /> Cerrar</Button>
          </div>
          <SearchInput value={busqueda} onChange={setBusqueda} placeholder="Código o nombre del modelo" autoFocus />
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {principal.length > 6 && (
            <SearchInput value={busqueda} onChange={setBusqueda} placeholder={`Buscar en talla ${tallaSel ? fTalla(tallaSel) : ''}`} className="min-w-48 flex-1" />
          )}
          {agotados.length > 0 && (
            <Button variant="outline" onClick={() => { setVerAgotados(true); setBusqueda('') }} className={cn(principal.length <= 6 && 'w-full sm:w-auto')}>
              <Plus /> Agregar uno que no aparece
            </Button>
          )}
        </div>
      )}

      {conError.length > 0 && (
        <p className="flex items-center gap-2 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
          <CloudOff className="size-4" /> {conError.length} {conError.length === 1 ? 'conteo no se guardó' : 'conteos no se guardaron'}.
          <button type="button" className="font-semibold underline" onClick={() => conError.forEach((k) => fijar(k, contado(k) ?? 0))}>Reintentar</button>
        </p>
      )}

      {/* Lista de modelos de la talla */}
      {!filas.length ? (
        verAgotados
          ? <Empty icon={CircleSlash} title={busqueda ? `No hay agotados que coincidan con “${busqueda}”` : 'No hay modelos agotados en esta talla'} />
          : <Empty icon={CheckCircle2} title={busqueda ? `Nada coincide con “${busqueda}”` : `Sin existencias en talla ${tallaSel ? fTalla(tallaSel) : ''}`}
              description={busqueda ? undefined : 'Según el sistema no hay pares de esta marca en esta talla. Si encontraste alguno, usa “Agregar uno que no aparece”; si no, termina la talla.'} />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-border">
            {filas.map(({ p, t }) => {
              const valor = contado(t.id)
              const efectivo = valor ?? (infoTalla?.terminada ? 0 : undefined)
              const dif = efectivo === undefined ? null : efectivo - t.existencia
              const estado = estados.get(t.id)
              return (
                <li key={t.id} className={cn('flex items-center gap-3 px-3 py-3 sm:px-4', valor === undefined && !infoTalla?.terminada && 'bg-card', valor !== undefined && 'bg-muted/30')}>
                  <FotoProducto src={p.imagen_url} alt={p.nombre} className="size-14 shrink-0 rounded-lg" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{p.nombre}</p>
                    <p className="truncate text-xs text-muted-foreground">{p.codigo}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="text-muted-foreground">Sistema: <strong className="text-foreground">{t.existencia}</strong></span>
                      {valor === undefined && !infoTalla?.terminada && <Badge tone="outline">Sin contar</Badge>}
                      {dif === 0 && <Badge tone="success"><Check /> Coincide</Badge>}
                      {dif !== null && dif > 0 && <Badge tone="success">+{dif}</Badge>}
                      {dif !== null && dif < 0 && <Badge tone="danger">{dif}</Badge>}
                      {estado === 'guardando' && <LoaderCircle className="size-3.5 animate-spin text-muted-foreground" aria-label="Guardando" />}
                      {estado === 'error' && <CloudOff className="size-3.5 text-danger" aria-label="No se guardó" />}
                    </div>
                  </div>
                  <div className="grid justify-items-end gap-1.5">
                    {valor === undefined && t.existencia > 0 ? (
                      <Button variant="outline" size="sm" onClick={() => fijar(t.id, t.existencia)} aria-label={`Coincide con el sistema: ${t.existencia}`}>
                        <Check /> Hay {t.existencia}
                      </Button>
                    ) : null}
                    <Stepper size="sm" value={valor ?? 0} label={`${p.nombre} talla ${fTalla(t.talla)}`}
                      onChange={(v) => {
                        fijar(t.id, v)
                        if (verAgotados && v > 0) {
                          setVerAgotados(false)
                          setBusqueda('')
                          toast.success(`${p.nombre} agregado a la talla ${fTalla(t.talla)}`)
                        }
                      }} />
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>
      )}

      {/* Barra inferior: terminar talla */}
      {infoTalla && (
        <div className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur lg:left-64">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <div className="min-w-0 text-sm">
              <p className="font-semibold">Talla {fTalla(infoTalla.talla)} {infoTalla.terminada && <Badge tone="success" className="ml-1"><Check /> Terminada</Badge>}</p>
              <p className="truncate text-muted-foreground">{resumenTalla.contados} contados · {resumenTalla.pares} pares · {resumenTalla.diferencias} diferencias</p>
            </div>
            {infoTalla.terminada ? (
              <Button variant="outline" onClick={() => marcar.mutate({ talla: infoTalla.talla, terminada: false })} loading={marcar.isPending}><RotateCcw /> Reabrir</Button>
            ) : (
              <Button variant="accent" onClick={terminarTalla} loading={marcar.isPending}><Check /> Terminar talla</Button>
            )}
          </div>
        </div>
      )}

      <CierreConteo conteoId={id} marca={c.marca} open={cerrar} onClose={(cerrado) => { setCerrar(false); if (cerrado) navegar(`/inventario/validar/${id}`, { replace: true }) }} />
      {(detalle.isFetching && !detalle.isLoading) && <span className="sr-only">Actualizando</span>}
      {detalle.isLoading && <Skeleton className="h-40" />}
    </div>
  )
}
