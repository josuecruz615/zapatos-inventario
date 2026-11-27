# Base de datos ZAPATONGT (Supabase)

Proyecto: `pmdnbjorfimihsyxmfzh` (Zapatos).

## Respaldo
- 2026-11-26: copia completa en el esquema `respaldo_20261126` (inventario, cliente, ventas, detalle_ventas y lista de fotos). No es accesible desde la API.

## Esquema nuevo

| Tabla | Qué guarda |
|---|---|
| `miembros` | Usuarios autorizados. Sin estar aquí no se ve ni se toca nada. |
| `marcas` | Marcas únicas, siempre en MAYÚSCULAS. |
| `productos` | Un modelo: código único, nombre, marca, precio, costo (opcional), descripción, foto, activo. |
| `producto_tallas` | Existencia por talla (única por producto; nunca negativa). |
| `clientes` | Nombre (MAYÚSCULAS), teléfono único como texto, dirección, notas, problemas. |
| `ventas` | Cliente, fecha, subtotal, ajuste (descuento/recargo), total calculado, nota, quién la hizo. |
| `venta_items` | Productos de cada venta con precio al momento de vender. |
| `movimientos_inventario` | Historial de cada entrada, venta, devolución y ajuste. |

Vistas para la interfaz (solo lectura): `v_inventario` (un producto por fila con sus tallas en JSON), `v_ventas`, `v_venta_items`, `v_resumen_mensual` (hora de Guatemala), `v_ventas_por_producto` (más vendidos, última venta, existencia) y `v_movimientos` (historial de inventario con datos del producto).

Funciones (RPC, todo o nada):
- `registrar_venta(cliente, items, fecha?, total_final?, nota?)`
- `actualizar_venta(venta, items, cliente?, fecha?, total_final?, nota?)`
- `eliminar_venta(venta)` — devuelve las unidades al inventario
- `crear_producto(codigo, nombre, marca, precio, tallas?, costo?, descripcion?, imagen_url?)`
- `guardar_tallas(producto, tallas, nota?)` — reabastecer, corregir, agregar tallas, poner en 0
- `obtener_marca(nombre)`

Las existencias y las ventas **solo** cambian por estas funciones; la escritura directa está bloqueada.

## Migraciones (`migrations/`)
1. `..._esquema_base.sql` — tablas, triggers, RLS, vistas.
2. `..._funciones.sql` — funciones de negocio.
3. `..._migracion_datos.sql` — `private.migrar_desde_legacy()`: copia los datos de las tablas viejas. Re-ejecutable; correrla otra vez el día del cambio de interfaz.
4. `..._storage.sql` — fotos: lectura pública, escritura solo miembros.
5. `..._cerrar_funcion_legacy.sql` — quita el acceso a la función vieja `validar_codigo_acceso`.
6. `..._ajustes_revision.sql` — vistas solo lectura, vistas de reportes, mensaje claro para total negativo y protección para no volver a copiar los datos viejos encima de trabajo nuevo (`private.migrar_desde_legacy(p_forzar => true)` para forzar).
7. `..._tablas_viejas_solo_lectura.sql` — tras publicar la interfaz nueva, las tablas en MAYÚSCULAS quedan en solo lectura.
8. `..._validacion_inventario.sql` + `..._validacion_hora_exacta.sql` — validación de inventario por marca, talla por talla (`conteos`, `conteo_tallas`, `conteo_lineas`, vista `v_conteos`; funciones `iniciar_conteo`, `registrar_conteo`, `marcar_talla_conteo`, `previa_conteo`, `cerrar_conteo`, `cancelar_conteo`). Al cerrar: existencia = contado + movimientos posteriores al conteo; lo no contado en una talla terminada queda en 0.

Los nombres de archivo coinciden con las versiones registradas en Supabase (aplicadas el 2026-11-26). Datos copiados ese mismo día.

`tests/prueba_en_seco.sql` (antes de aplicar) y `tests/prueba_funciones.sql` (sobre la base ya migrada) corren dentro de una transacción que se deshace al final y reportan los resultados en el mensaje de error.

## Decisiones de la migración
- 2000 filas viejas → 243 productos y 1944 tallas (se fusionaron 56 tallas repetidas de 7 modelos reingresados).
- El código `396316-47` lo usaban dos modelos distintos; el más reciente (Dribble) queda como `396316-47-B`.
- "MICHEAL KORS" se corrige a "MICHAEL KORS".
- Se conservan los ids de clientes, ventas, detalle y tallas.
