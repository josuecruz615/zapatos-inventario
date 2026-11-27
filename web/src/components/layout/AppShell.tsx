import * as DM from '@radix-ui/react-dropdown-menu'
import {
  ChartNoAxesCombined, Footprints, LogOut, Moon, Package, Plus, Receipt, ShoppingBag, Sun, Users,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { useAuth } from '@/auth/AuthProvider'
import { cn } from '@/lib/utils'
import { AvisoInstalar } from './AvisoInstalar'

const enlaces = [
  { to: '/', label: 'Inicio', icon: ChartNoAxesCombined, end: true },
  { to: '/ventas/nueva', label: 'Vender', icon: ShoppingBag },
  { to: '/ventas', label: 'Ventas', icon: Receipt, end: true },
  { to: '/inventario', label: 'Inventario', icon: Package },
  { to: '/clientes', label: 'Clientes', icon: Users },
]

function useTema() {
  const [oscuro, setOscuro] = useState(() => document.documentElement.classList.contains('dark'))
  useEffect(() => {
    document.documentElement.classList.toggle('dark', oscuro)
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', oscuro ? '#1c1c22' : '#fafafa'))
  }, [oscuro])
  return {
    oscuro,
    alternar: () => setOscuro((v) => {
      localStorage.setItem('tema', v ? 'claro' : 'oscuro')
      return !v
    }),
  }
}

function Marca() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
        <Footprints className="size-5" />
      </div>
      <div className="leading-tight">
        <p className="text-sm font-bold tracking-tight">ZAPATONGT</p>
        <p className="text-xs text-muted-foreground">Inventario y ventas</p>
      </div>
    </div>
  )
}

function MenuUsuario({ compacto }: { compacto?: boolean }) {
  const { sesion, salir } = useAuth()
  const { oscuro, alternar } = useTema()
  const correo = sesion?.user.email ?? ''
  const inicial = correo.charAt(0).toUpperCase() || '?'
  const item = 'flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm outline-none data-highlighted:bg-muted [&_svg]:size-4 [&_svg]:text-muted-foreground'
  return (
    <DM.Root>
      <DM.Trigger className={cn('flex cursor-pointer items-center gap-2.5 rounded-xl text-left outline-none hover:bg-muted', compacto ? 'p-1' : 'w-full p-2')}>
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent/15 text-sm font-semibold text-accent">{inicial}</span>
        {!compacto && <span className="min-w-0 flex-1 truncate text-sm">{correo}</span>}
      </DM.Trigger>
      <DM.Portal>
        <DM.Content align="end" sideOffset={6} className="z-50 min-w-56 animate-in rounded-xl border border-border bg-card p-1 shadow-lg">
          <DM.Label className="truncate px-2 py-1.5 text-xs text-muted-foreground">{correo}</DM.Label>
          <DM.Item className={item} onSelect={(e) => { e.preventDefault(); alternar() }}>
            {oscuro ? <Sun /> : <Moon />} {oscuro ? 'Tema claro' : 'Tema oscuro'}
          </DM.Item>
          <DM.Separator className="my-1 h-px bg-border" />
          <DM.Item className={cn(item, 'text-danger [&_svg]:text-danger')} onSelect={() => salir()}>
            <LogOut /> Cerrar sesión
          </DM.Item>
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  )
}

export function AppShell() {
  const { pathname } = useLocation()
  const navegar = useNavigate()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  const enConteo = /\/inventario\/validar\/\d+/.test(pathname)
  const enVenta = pathname.startsWith('/ventas/nueva') || /\/ventas\/\d+\/editar/.test(pathname) || /\/inventario\/validar\/\d+/.test(pathname)

  return (
    <div className="min-h-dvh lg:pl-64">
      {/* Menú lateral (computadora) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-card/60 px-3 py-4 backdrop-blur lg:flex">
        <div className="px-2 pb-6"><Marca /></div>
        <nav className="grid gap-1" aria-label="Principal">
          {enlaces.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) => cn('flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                isActive && 'bg-muted text-foreground')}>
              <Icon className="size-4.5" /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto border-t border-border pt-3"><MenuUsuario /></div>
      </aside>

      {/* Barra superior (celular) */}
      <header className="pt-safe sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-xl lg:hidden">
        <div className="px-safe flex h-14 items-center justify-between">
          <Marca />
          <MenuUsuario compacto />
        </div>
      </header>
      <AvisoInstalar />

      <main className={cn('mx-auto w-full max-w-7xl px-4 pt-5 sm:px-6 lg:px-8 lg:pt-8', enConteo ? 'pb-40' : enVenta ? 'pb-40 lg:pb-10' : 'pb-28 lg:pb-10')}>
        <Outlet />
      </main>

      {/* Navegación inferior (celular) */}
      {!enVenta && (
        <nav aria-label="Principal" className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/90 backdrop-blur lg:hidden">
          <div className="px-safe grid h-16 grid-cols-5">
            {enlaces.map(({ to, label, icon: Icon, end }) => to === '/ventas/nueva' ? (
              <button key={to} type="button" onClick={() => navegar(to)} aria-label="Nueva venta" className="grid cursor-pointer place-items-center">
                <span className="grid size-12 -translate-y-3 place-items-center rounded-2xl bg-accent text-accent-foreground shadow-lg shadow-accent/30">
                  <Plus className="size-6" />
                </span>
              </button>
            ) : (
              <NavLink key={to} to={to} end={end}
                className={({ isActive }) => cn('grid place-content-center justify-items-center gap-1 text-[11px] font-medium text-muted-foreground active:scale-95 transition-transform', isActive && 'text-foreground')}>
                <Icon className="size-5" /> {label}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </div>
  )
}
