import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, Link, RouterProvider, useRouteError } from 'react-router'
import { Toaster } from 'sonner'
import { AuthProvider } from './auth/AuthProvider'
import { RequireAuth } from './auth/RequireAuth'
import { AppShell } from './components/layout/AppShell'
import { Button } from './components/ui/button'
import { ConfirmProvider } from './components/ui/dialog'
import { Spinner } from './components/ui/misc'
import './index.css'

const Inicio = lazy(() => import('./features/inicio/Inicio'))
const Inventario = lazy(() => import('./features/inventario/Inventario'))
const Ventas = lazy(() => import('./features/ventas/Ventas'))
const NuevaVenta = lazy(() => import('./features/ventas/NuevaVenta'))
const EditarVenta = lazy(() => import('./features/ventas/EditarVenta'))
const Clientes = lazy(() => import('./features/clientes/Clientes'))
const ValidarMarcas = lazy(() => import('./features/validacion/ValidarMarcas'))
const Conteo = lazy(() => import('./features/validacion/Conteo'))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: true, retry: 1 },
  },
})

function Cargando() {
  return <div className="grid min-h-[50vh] place-items-center"><Spinner className="size-7" /></div>
}

function ErrorPagina() {
  const error = useRouteError() as { status?: number; message?: string } | undefined
  const noExiste = !error || error.status === 404
  return (
    <div className="grid min-h-[60vh] place-items-center px-6 text-center">
      <div className="grid max-w-md justify-items-center gap-3">
        <p className="text-5xl font-bold text-muted-foreground/40">{noExiste ? '404' : '¡Ups!'}</p>
        <h1 className="text-xl font-semibold">{noExiste ? 'Esta página no existe' : 'Algo salió mal'}</h1>
        {!noExiste && <p className="text-sm text-muted-foreground">{error?.message}</p>}
        <div className="flex gap-2">
          <Link to="/"><Button variant="outline">Ir al inicio</Button></Link>
          {!noExiste && <Button onClick={() => location.reload()}>Recargar</Button>}
        </div>
      </div>
    </div>
  )
}

const conSuspense = (el: React.ReactNode) => <Suspense fallback={<Cargando />}>{el}</Suspense>

const router = createBrowserRouter([
  {
    element: <RequireAuth><AppShell /></RequireAuth>,
    errorElement: <ErrorPagina />,
    children: [
      { errorElement: <ErrorPagina />, children: [
        { index: true, element: conSuspense(<Inicio />) },
        { path: 'inventario', element: conSuspense(<Inventario />) },
        { path: 'inventario/validar', element: conSuspense(<ValidarMarcas />) },
        { path: 'inventario/validar/:id', element: conSuspense(<Conteo />) },
        { path: 'ventas', element: conSuspense(<Ventas />) },
        { path: 'ventas/nueva', element: conSuspense(<NuevaVenta />) },
        { path: 'ventas/:id/editar', element: conSuspense(<EditarVenta />) },
        { path: 'clientes', element: conSuspense(<Clientes />) },
        { path: '*', element: <ErrorPagina /> },
      ] },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ConfirmProvider>
          <RouterProvider router={router} />
          <Toaster position="top-center" richColors closeButton toastOptions={{ className: 'font-sans' }}
            mobileOffset={{ top: 'calc(env(safe-area-inset-top) + 8px)' }} />
        </ConfirmProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
