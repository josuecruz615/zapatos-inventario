import { ArrowLeft, CheckCircle2, ChevronRight, ClipboardCheck, History, PlayCircle } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge, Card, Empty, PageHeader, Skeleton } from '@/components/ui/misc'
import { useConteos, useIniciarConteo, useInventario, useMarcas } from '@/lib/api'
import { fecha, mensajeError, num } from '@/lib/utils'

export default function ValidarMarcas() {
  const marcas = useMarcas()
  const inventario = useInventario()
  const conteos = useConteos()
  const iniciar = useIniciarConteo()
  const navegar = useNavigate()

  const filas = useMemo(() => {
    return (marcas.data ?? []).map((m) => {
      const productos = (inventario.data ?? []).filter((p) => p.marca_id === m.id && p.activo)
      const delaMarca = (conteos.data ?? []).filter((c) => c.marca_id === m.id)
      return {
        ...m,
        modelos: productos.length,
        pares: productos.reduce((s, p) => s + p.existencia_total, 0),
        abierta: delaMarca.find((c) => c.estado === 'abierto') ?? null,
        ultima: delaMarca.find((c) => c.estado === 'cerrado') ?? null,
      }
    }).filter((m) => m.modelos > 0)
  }, [marcas.data, inventario.data, conteos.data])

  async function empezar(marcaId: number) {
    try {
      const id = await iniciar.mutateAsync(marcaId)
      navegar(`/inventario/validar/${id}`)
    } catch (e) { toast.error(mensajeError(e)) }
  }

  const cargando = marcas.isLoading || inventario.isLoading || conteos.isLoading
  const historial = (conteos.data ?? []).filter((c) => c.estado !== 'abierto').slice(0, 10)

  return (
    <div className="grid gap-5">
      <PageHeader title="Validar inventario"
        description="Elige una marca y cuenta talla por talla. El avance se guarda: puedes seguir otro día o desde otro teléfono."
        actions={<Link to="/inventario"><Button variant="ghost"><ArrowLeft /> Inventario</Button></Link>} />

      {cargando ? <Skeleton className="h-96 rounded-2xl" /> : !filas.length ? (
        <Empty icon={ClipboardCheck} title="No hay marcas con productos activos" />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-border">
            {filas.map((m) => (
              <li key={m.id}>
                <button type="button" disabled={iniciar.isPending}
                  onClick={() => (m.abierta ? navegar(`/inventario/validar/${m.abierta.id}`) : empezar(m.id))}
                  className="flex w-full cursor-pointer items-center gap-3 px-4 py-3.5 text-left hover:bg-muted/50 disabled:opacity-60">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 font-semibold">
                      {m.nombre}
                      {m.abierta && <Badge tone="accent">En curso · {m.abierta.tallas_terminadas}/{m.abierta.tallas_total} tallas</Badge>}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {m.modelos} {m.modelos === 1 ? 'modelo' : 'modelos'} · {num(m.pares)} {m.pares === 1 ? 'par' : 'pares'} en sistema
                      {m.ultima?.cerrado_at ? ` · validada ${fecha(m.ultima.cerrado_at)}` : ' · nunca validada'}
                    </p>
                    {m.abierta && m.abierta.tallas_total > 0 && (
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${(m.abierta.tallas_terminadas / m.abierta.tallas_total) * 100}%` }} />
                      </div>
                    )}
                  </div>
                  <span className="flex items-center gap-1 text-sm font-medium text-accent">
                    {m.abierta ? <>Continuar <ChevronRight className="size-4" /></> : <><PlayCircle className="size-4" /> Validar</>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {historial.length > 0 && (
        <section className="grid gap-2">
          <h2 className="flex items-center gap-2 px-1 text-sm font-semibold"><History className="size-4" /> Validaciones anteriores</h2>
          <Card className="overflow-hidden">
            <ul className="divide-y divide-border">
              {historial.map((c) => (
                <li key={c.id}>
                  <Link to={`/inventario/validar/${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50">
                    {c.estado === 'cerrado' ? <CheckCircle2 className="size-5 shrink-0 text-success" /> : <span className="size-5 shrink-0 rounded-full border-2 border-muted-foreground/40" />}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{c.marca} <span className="text-muted-foreground">#{c.id}</span></p>
                      <p className="text-sm text-muted-foreground">
                        {c.estado === 'cerrado' ? `Cerrada ${fecha(c.cerrado_at!)}` : `Cancelada ${fecha(c.cerrado_at ?? c.created_at)}`}
                        {c.resumen ? ` · ${c.resumen.pares_antes} → ${c.resumen.pares_despues} pares` : ''}
                      </p>
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}
    </div>
  )
}
