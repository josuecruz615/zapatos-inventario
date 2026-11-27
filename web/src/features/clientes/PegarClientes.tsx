import { AlertTriangle, ClipboardPaste, Info, Trash2, UserPlus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field, Input, Textarea } from '@/components/ui/form'
import { Badge, Card, Segmented } from '@/components/ui/misc'
import { useClientes, useGuardarCliente } from '@/lib/api'
import { leerClientes, type ClienteLeido } from '@/lib/parsearCliente'
import type { Cliente } from '@/lib/types'
import { mensajeError, normalizar, telefonoBonito } from '@/lib/utils'

type Accion = 'crear' | 'actualizar' | 'omitir'
type Ficha = ClienteLeido & { clave: number; accion: Accion; pedido: string }

const EJEMPLO = `María López
5555-1234
4ta calle 5-20 zona 1, Mixco`

export function PegarClientes({ open, onClose }: { open: boolean; onClose: (creado?: Cliente) => void }) {
  const clientes = useClientes()
  const guardar = useGuardarCliente()
  const [texto, setTexto] = useState('')
  const [fichas, setFichas] = useState<Ficha[] | null>(null)
  const [guardando, setGuardando] = useState(false)

  const porTelefono = useMemo(() => new Map((clientes.data ?? []).filter((c) => c.telefono).map((c) => [c.telefono!, c])), [clientes.data])
  const porNombre = useMemo(() => new Map((clientes.data ?? []).map((c) => [normalizar(c.nombre), c])), [clientes.data])

  function leer(t: string) {
    const leidos = leerClientes(t)
    if (!leidos.length) return toast.error('No encontré datos de clientes en el texto')
    setFichas(leidos.map((c, i) => ({
      ...c, clave: i, pedido: c.notas, notas: '',
      accion: c.telefono && porTelefono.has(c.telefono) ? 'omitir' : 'crear',
    })))
  }

  async function pegarPortapapeles() {
    try {
      const t = await navigator.clipboard.readText()
      if (!t.trim()) return toast.error('El portapapeles está vacío')
      setTexto(t)
      leer(t)
    } catch {
      toast.info('Pega el texto en el cuadro (mantén presionado → Pegar)')
    }
  }

  const cambiar = (clave: number, cambios: Partial<Ficha>) =>
    setFichas((fs) => fs?.map((f) => (f.clave === clave ? { ...f, ...cambios } : f)) ?? null)

  const aGuardar = (fichas ?? []).filter((f) => f.accion !== 'omitir')
  const invalidas = aGuardar.filter((f) => f.nombre.trim().length < 2)

  async function guardarTodo() {
    if (invalidas.length) return toast.error('Hay clientes sin nombre')
    setGuardando(true)
    let ok = 0
    let ultimo: Cliente | undefined
    const fallidas: number[] = []
    for (const f of aGuardar) {
      const existente = f.telefono ? porTelefono.get(f.telefono) : undefined
      try {
        ultimo = await guardar.mutateAsync({
          id: f.accion === 'actualizar' ? existente?.id : undefined,
          nombre: f.nombre.trim(),
          telefono: f.telefono || null,
          direccion: f.direccion.trim() || (f.accion === 'actualizar' ? existente?.direccion ?? null : null),
          notas: f.notas.trim() || (f.accion === 'actualizar' ? existente?.notas ?? null : null),
          problemas: f.accion === 'actualizar' ? existente?.problemas ?? false : false,
        })
        ok++
      } catch (e) {
        fallidas.push(f.clave)
        toast.error(`${f.nombre || 'Cliente'}: ${mensajeError(e)}`)
      }
    }
    setGuardando(false)
    if (ok) toast.success(ok === 1 ? `Cliente ${ultimo?.nombre} guardado` : `${ok} clientes guardados`)
    if (fallidas.length) {
      setFichas((fs) => fs?.filter((f) => fallidas.includes(f.clave)) ?? null)
      return
    }
    cerrar(ok === 1 ? ultimo : undefined)
  }

  function cerrar(creado?: Cliente) {
    setTexto('')
    setFichas(null)
    onClose(creado)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && cerrar()} className="sm:max-w-2xl"
      title="Crear clientes desde WhatsApp"
      description={fichas ? 'Revisa los datos antes de guardar. Puedes corregir cualquier campo.' : 'Copia el mensaje del cliente (o varios) y pégalo aquí. Se detectan nombre, teléfono y dirección.'}
      footer={fichas ? <>
        <Button variant="outline" onClick={() => setFichas(null)}>Volver al texto</Button>
        <Button variant="accent" onClick={guardarTodo} loading={guardando} disabled={!aGuardar.length}>
          <UserPlus /> {aGuardar.length === 1 ? 'Guardar cliente' : `Guardar ${aGuardar.length} clientes`}
        </Button>
      </> : <>
        <Button variant="outline" onClick={() => cerrar()}>Cancelar</Button>
        <Button onClick={() => leer(texto)} disabled={!texto.trim()}>Leer datos</Button>
      </>}>
      {!fichas ? (
        <div className="grid gap-3">
          <Button variant="outline" size="lg" onClick={pegarPortapapeles}><ClipboardPaste /> Pegar lo que copié</Button>
          <Textarea rows={9} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={`O pega aquí el mensaje, por ejemplo:\n\n${EJEMPLO}`}
            onPaste={(e) => { const t = e.clipboardData.getData('text'); if (t) setTimeout(() => leer(t), 0) }} />
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            Puedes copiar varios mensajes juntos desde WhatsApp (mantén presionado → Seleccionar → Copiar) y se crea un cliente por mensaje.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {fichas.map((f, i) => {
            const existente = f.telefono ? porTelefono.get(f.telefono) : undefined
            const mismoNombre = !existente && f.nombre ? porNombre.get(normalizar(f.nombre)) : undefined
            return (
              <Card key={f.clave} className={f.accion === 'omitir' ? 'p-4 opacity-60' : 'p-4'}>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{fichas.length > 1 ? `Cliente ${i + 1} de ${fichas.length}` : 'Cliente'}</p>
                  {fichas.length > 1 && (
                    <Button variant="ghost" size="icon-sm" aria-label="Quitar" onClick={() => setFichas((fs) => fs!.filter((x) => x.clave !== f.clave))}><Trash2 /></Button>
                  )}
                </div>

                {existente && (
                  <div className="mb-3 grid gap-2 rounded-xl bg-warning/15 p-3 text-sm">
                    <p className="flex items-start gap-2"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
                      <span>Ese teléfono ya es de <strong>{existente.nombre}</strong>{existente.direccion ? ` (${existente.direccion})` : ''}.</span></p>
                    <Segmented value={f.accion === 'crear' ? 'omitir' : f.accion} onChange={(v) => cambiar(f.clave, { accion: v })} className="w-full [&>button]:flex-1"
                      options={[{ value: 'omitir', label: 'No guardar' }, { value: 'actualizar', label: 'Actualizar sus datos' }]} />
                  </div>
                )}
                {mismoNombre && (
                  <p className="mb-3 flex items-start gap-2 rounded-xl bg-muted p-3 text-sm">
                    <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    Ya hay un cliente llamado {mismoNombre.nombre} con otro teléfono ({telefonoBonito(mismoNombre.telefono) || 'sin teléfono'}). Revisa que no sea la misma persona.
                  </p>
                )}

                {f.accion !== 'omitir' && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Nombre" error={f.nombre.trim().length < 2 ? 'Escribe el nombre' : undefined}>
                      <Input value={f.nombre} onChange={(e) => cambiar(f.clave, { nombre: e.target.value })} />
                    </Field>
                    <Field label="Teléfono" error={f.telefono && f.telefono.replace(/\D/g, '').length < 8 ? 'Revisa el teléfono' : undefined}>
                      <Input type="tel" inputMode="tel" value={telefonoBonito(f.telefono)} onChange={(e) => cambiar(f.clave, { telefono: e.target.value.replace(/\D/g, '') })} />
                    </Field>
                    <Field label="Dirección" className="sm:col-span-2">
                      <Textarea rows={3} value={f.direccion} onChange={(e) => cambiar(f.clave, { direccion: e.target.value })} />
                    </Field>
                    <Field label="Notas del cliente (opcional)" className="sm:col-span-2"
                      hint={f.pedido ? <span className="flex flex-wrap items-center gap-1.5">Del pedido: <Badge tone="outline">{f.pedido}</Badge>
                        <button type="button" className="cursor-pointer text-accent underline-offset-2 hover:underline" onClick={() => cambiar(f.clave, { notas: f.notas ? `${f.notas} · ${f.pedido}` : f.pedido })}>Agregar a notas</button></span> : undefined}>
                      <Input value={f.notas} onChange={(e) => cambiar(f.clave, { notas: e.target.value })} placeholder="Talla que usa, referencias…" />
                    </Field>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </Dialog>
  )
}
