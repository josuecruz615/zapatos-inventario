# ZAPATONGT · Inventario, ventas y clientes

| Carpeta | Contenido |
|---|---|
| [`web/`](web/README.md) | Aplicación actual (React + Vite + Tailwind). Es lo que publica Netlify. Optimizada para iPhone y se instala como app. |
| [`supabase/`](supabase/README.md) | Esquema de la base de datos: migraciones, funciones, seguridad y pruebas. |
| `notas/` | Análisis de lo que hacía el sistema anterior. |
| `sitio-anterior/` | Páginas HTML del sistema original (ya no se publican; se conservan como referencia). |

Publicación: Netlify lee `netlify.toml` (carpeta base `web`, comando `npm run build`, publica `web/dist`).
