# ZAPATONGT · Interfaz web

Aplicación de inventario, ventas y clientes. Usa la base nueva de Supabase (ver `../supabase/README.md`).

## Tecnología
- **React 19 + TypeScript + Vite** — aplicación de una sola página, rápida y tipada.
- **Tailwind CSS 4** — diseño propio con tema claro/oscuro.
- **TanStack Query** — caché de datos, recarga automática al volver a la pestaña.
- **React Router** — los filtros viven en la URL (se pueden compartir y el botón Atrás funciona).
- **Radix UI + cmdk** — ventanas, menús y buscador de clientes accesibles con teclado.
- **PWA** — se puede instalar en el celular ("Agregar a pantalla de inicio"); fotos en caché.

## Módulos
| Ruta | Qué hace |
|---|---|
| `/` | Panel: vendido hoy, mes vs. mes anterior, pares en existencia, por agotarse, gráfica 12 meses, más vendidos, últimas ventas, existencia por marca. |
| `/inventario` | Catálogo con búsqueda, filtros por marca, talla, estado (con existencia / por agotarse / agotados / todos / archivados) y cantidad exacta; orden; vista cuadrícula o lista; descargar fotos en ZIP. Detalle con existencias por talla editables, agregar tallas, historial de movimientos y ventas del producto. Alta y edición con foto (se comprime antes de subir). Archivar o eliminar. |
| `/ventas/nueva` | Punto de venta: buscar, filtrar por marca/talla, tocar la talla para agregar; cliente con buscador (y alta rápida); alerta si el cliente tiene problemas; fecha; total final con atajos de descuento/envío; nota. Al terminar: recibo por WhatsApp. |
| `/ventas` | Ventas de hoy / mes / año / todo, agrupadas por día con totales; buscar por cliente o número; exportar CSV. Detalle con recibo (WhatsApp o copiar), editar y eliminar (devuelve existencias). |
| `/ventas/:id/editar` | Edita productos, cantidades, cliente, fecha, total y nota; el inventario se ajusta solo con la diferencia. |
| `/inventario/validar` | Validar inventario por marca, talla por talla: marcar lo encontrado (botón "Hay n" si coincide), terminar cada talla (lo no contado queda en 0), revisar diferencias y cerrar. El avance se guarda y se puede seguir desde otro teléfono. |
| `/clientes` | Lista con búsqueda por nombre o teléfono, orden por mejores clientes o recientes, filtro "con problemas". Detalle con llamar/WhatsApp, historial y totales. | **Pegar de WhatsApp**: pega uno o varios mensajes y se detectan nombre, teléfono y dirección (reglas propias, sin IA externa; `src/lib/parsearCliente.ts`); avisa si el teléfono o el nombre ya existen. El formulario de cliente (también al vender) tiene "Llenar con un mensaje copiado". |

## Uso local
```powershell
cd web
npm install
npm run dev        # http://localhost:5173
npm run build      # genera dist/
```
Los íconos se regeneran con `node scripts/iconos.mjs` (desde `public/favicon.svg`).

## Publicar en Netlify
En el sitio de Netlify: **Site configuration → Build & deploy → Build settings**
- Base directory: `web`
- Build command: `npm run build`
- Publish directory: `web/dist`

El archivo `netlify.toml` (en la raíz del repositorio) ya define todo esto, más las redirecciones y cabeceras. La URL y la clave pública de Supabase están en `src/lib/supabase.ts` (son públicas por diseño; se pueden cambiar con `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`).

## Día del cambio (sistema viejo → nuevo)
1. Dejar de registrar en la página vieja.
2. En Supabase, copiar lo último: `select private.migrar_desde_legacy();`
3. Cambiar la configuración de Netlify como arriba y publicar.
4. Probar y, cuando todo esté bien, retirar las tablas viejas.
