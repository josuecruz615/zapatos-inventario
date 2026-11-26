import { Eye, EyeOff, Footprints } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/form'
import { mensajeError } from '@/lib/utils'
import { useAuth } from './AuthProvider'

export function Login() {
  const { ingresar } = useAuth()
  const [correo, setCorreo] = useState('')
  const [clave, setClave] = useState('')
  const [ver, setVer] = useState(false)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setError('')
    setEnviando(true)
    try {
      await ingresar(correo, clave)
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-primary p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="grid size-10 place-items-center rounded-xl bg-primary-foreground/10"><Footprints className="size-5" /></div>
          <span className="text-lg font-bold tracking-tight">ZAPATONGT</span>
        </div>
        <div className="relative z-10 grid max-w-md gap-4">
          <h1 className="text-4xl font-semibold tracking-tight text-balance">Tu inventario, tus ventas y tus clientes en un solo lugar.</h1>
          <p className="text-primary-foreground/70">Vende desde el celular, controla existencias por talla y mira cómo va el mes en segundos.</p>
        </div>
        <p className="text-sm text-primary-foreground/50">© {new Date().getFullYear()} ZAPATONGT</p>
        <div aria-hidden className="absolute -right-24 -bottom-24 size-96 rounded-full bg-accent/30 blur-3xl" />
      </div>

      <div className="pt-safe pb-safe flex items-center justify-center px-6 py-12">
        <form onSubmit={enviar} className="grid w-full max-w-sm gap-6">
          <div className="grid gap-2">
            <div className="mb-4 grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground lg:hidden"><Footprints className="size-5" /></div>
            <h2 className="text-2xl font-semibold tracking-tight">Inicia sesión</h2>
            <p className="text-sm text-muted-foreground">Ingresa con el correo y la contraseña de tu cuenta.</p>
          </div>
          <div className="grid gap-4">
            <Field label="Correo electrónico" htmlFor="correo">
              <Input id="correo" name="email" type="email" inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="email" required autoFocus value={correo}
                onChange={(e) => setCorreo(e.target.value)} placeholder="tucorreo@ejemplo.com" />
            </Field>
            <Field label="Contraseña" htmlFor="clave">
              <div className="relative">
                <Input id="clave" name="password" type={ver ? 'text' : 'password'} autoComplete="current-password" required value={clave}
                  onChange={(e) => setClave(e.target.value)} className="pr-10" />
                <button type="button" onClick={() => setVer((v) => !v)} aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="absolute top-1/2 right-1.5 grid size-7 -translate-y-1/2 cursor-pointer place-items-center rounded-md text-muted-foreground hover:bg-muted">
                  {ver ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </Field>
            {error && <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
          </div>
          <Button type="submit" size="lg" loading={enviando}>Entrar</Button>
        </form>
      </div>
    </div>
  )
}
