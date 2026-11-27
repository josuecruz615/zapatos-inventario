import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/form'
import { Badge, FotoProducto, Segmented, Skeleton } from '@/components/ui/misc'
import { useCerrarConteo, usePreviaConteo } from '@/lib/api'
import { cn, mensajeError, talla } from '@/lib/utils'

export function CierreConteo({ conteoId, marca, open, onClose }: {
  conteoId: number; marca: string; open: boolean; onClose: (cerrado: boolean) => void
}) {
  const previa = usePreviaConteo(conteoId, open)
  const cerrar = useCerrarConteo(conteoId)
  const [nota, setNota] = useState('')
  const [ver, setVer] = useState<'diferencias' | 'todo'>('diferencias')

  const filas = previa.data ?? []
  const diferencias = filas.filter((f) => f.final !== f.sistema)
  const sobran = diferencias.filter((f) => f.final > f.sistema)
  const faltan = diferencias.filter((f) => f.final < f.sistema)
  const antes = filas.reduce((s, f) => s + f.sistema, 0)
  const despues = filas.reduce((s, f) => s + f.final, 0)
  const lista = ver === 'diferencias' ? diferencias : filas.filter((f) => f.final > 0 || f.sistema > 0)

  async function aplicar() {
    try {
      const r = await cerrar.mutateAsync(nota.trim())
      toast.success(`Inventario de ${marca} actualizado`, { description: `${r.pares_antes} → ${r.pares_despues} pares · ${r.con_mas + r.con_menos} correcciones` })
      onClose(true)
    } catch (e) { toast.error(mensajeError(e)) }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose(false)} className="sm:max-w-2xl"
      title={`Cerrar validación de ${marca}`}
      description="Así quedará el inventario. Si vendieron algo mientras contaban, ya está descontado."
      footer={<>
        <Button variant="outline" onClick={() => onClose(false)}>Seguir contando</Button>
        <Button variant="accent" onClick={aplicar} loading={cerrar.isPending} disabled={previa.isLoading}><CheckCircle2 /> Aplicar y cerrar</Button>
      </>}>
      {previa.isLoading ? <Skeleton className="h-64" /> : (
        <div className="grid gap-4">
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div className="rounded-xl bg-muted/60 p-3"><p className="text-muted-foreground">Pares</p><p className="tabular text-lg font-semibold">{antes} → {despues}</p></div>
            <div className="rounded-xl bg-success/10 p-3"><p className="text-muted-foreground">Sobraban</p><p className="tabular text-lg font-semibold">{sobran.length}</p></div>
            <div className="rounded-xl bg-danger/10 p-3"><p className="text-muted-foreground">Faltaban</p><p className="tabular text-lg font-semibold">{faltan.length}</p></div>
          </div>

          <Segmented value={ver} onChange={setVer} className="w-full [&>button]:flex-1"
            options={[{ value: 'diferencias', label: `Diferencias (${diferencias.length})` }, { value: 'todo', label: 'Todo lo que queda' }]} />

          {!lista.length ? (
            <p className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
              {ver === 'diferencias' ? '¡Todo coincide con el sistema! 🎉' : 'No queda existencia de esta marca.'}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {lista.map((f) => (
                <li key={f.producto_talla_id} className="flex items-center gap-3 py-2.5">
                  <FotoProducto src={f.imagen_url} alt={f.nombre} className="size-11 shrink-0 rounded-lg" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{f.nombre}</p>
                    <p className="text-xs text-muted-foreground">
                      {f.codigo} · talla {talla(f.talla)}
                      {f.movido_despues !== 0 && ` · ${f.movido_despues < 0 ? `vendidos después: ${-f.movido_despues}` : `entraron después: ${f.movido_despues}`}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm">
                    <span className="tabular text-muted-foreground">{f.sistema}</span>
                    <ArrowRight className="size-3.5 text-muted-foreground" />
                    <Badge tone={f.final > f.sistema ? 'success' : f.final < f.sistema ? 'danger' : 'neutral'} className={cn('tabular min-w-7 justify-center text-sm')}>{f.final}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <Input placeholder="Nota (opcional): quién contó, observaciones…" value={nota} onChange={(e) => setNota(e.target.value)} />
        </div>
      )}
    </Dialog>
  )
}
