import { ShieldX } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/misc'
import { useAuth } from './AuthProvider'
import { Login } from './Login'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { cargando, sesion, esMiembro, salir } = useAuth()

  if (cargando || (sesion && esMiembro === null)) {
    return <div className="grid min-h-dvh place-items-center"><Spinner className="size-7" /></div>
  }
  if (!sesion) return <Login />
  if (!esMiembro) {
    return (
      <div className="grid min-h-dvh place-items-center px-6">
        <div className="grid max-w-sm justify-items-center gap-4 text-center">
          <div className="grid size-12 place-items-center rounded-full bg-danger/10 text-danger"><ShieldX className="size-6" /></div>
          <h1 className="text-xl font-semibold">Tu cuenta no tiene acceso</h1>
          <p className="text-sm text-muted-foreground">
            Iniciaste sesión como <strong>{sesion.user.email}</strong>, pero esta cuenta no está autorizada. Pide al administrador que la agregue.
          </p>
          <Button variant="outline" onClick={() => salir()}>Cerrar sesión</Button>
        </div>
      </div>
    )
  }
  return children
}
