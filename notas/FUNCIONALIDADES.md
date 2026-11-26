# ZAPATONGT – Inventario de funcionalidades del sistema original

Fuente: repositorio `zapatos-inventario` (último commit 1cd7d47). Describe **qué hacía** el sistema, no si estaba bien hecho.

## 1. Acceso y navegación

- **Inicio (`index.html`)**: redirige a Inventario si hay sesión, o a Acceso si no.
- **Acceso (`login.html`)**: correo y contraseña (usuarios creados en Supabase). Mensajes de error / "Validando..." / "Acceso concedido". Si llegaste a una página sin sesión, al entrar te devuelve a esa página.
- **Protección**: todas las páginas exigen sesión; si se cierra o vence, te manda a Acceso.
- **Encabezado** (en todas las páginas): muestra el correo del usuario y botón **Cerrar sesión**.
- **Menú** (desplegable al pasar el mouse):
  - Ventas → Registrar Venta · Ver Ventas · Modificar Ventas
  - Inventario → Inventario · Agregar · Modificación · Eliminar
  - Clientes → Crear Cliente · Modificar Cliente
- **Pie**: "© 2025 ZAPATONGT - Sistema de Inventario".

## 2. Inventario (consulta) – `inventario.html`

Al abrir carga todo el inventario y muestra de una vez los productos disponibles.

**Filtros**
| Filtro | Tipo | Comportamiento |
|---|---|---|
| Cantidad total | número | Muestra solo modelos cuya suma de unidades (entre las tallas que pasan los demás filtros) es **exactamente** ese número. Ej. 1 = modelos con una sola unidad. |
| Marca | botones (selección múltiple) | Se generan solos con las marcas existentes, en orden alfabético; sin distinguir mayúsculas. Filtra al instante. |
| Talla | botones (selección múltiple) | Se generan con las tallas existentes, de menor a mayor. Filtra al instante. |
| Estado | lista | **Disponibles** (por defecto, oculta tallas en 0) / **Todos**. |

Botones: **Buscar** (aplica cantidad/estado), **Limpiar** (vuelve todo a inicio), **Descargar imágenes**.

**Resultados**
- Contador: "Mostrando N productos distintos" (agrupa por código).
- Tarjeta por modelo: al frente la foto; al pasar el mouse gira y muestra nombre – código, marca, precio en Q y tabla Talla / Disponible con indicador: ✔️ más de 5 · ⚠️ de 1 a 5 · ❌ 0.

**Descargar imágenes**: arma un ZIP con las fotos de los productos que están en pantalla (respeta los filtros), con barra de progreso; archivo `imagenes_FECHA.zip`. (Útil para mandar catálogo por WhatsApp/redes.)

## 3. Agregar artículo – `agregar.html`

- Campos: Nombre, Código, Marca, Imagen (obligatoria), Precio.
- Tallas fijas **22, 22.5, 23, 23.5, 24, 24.5, 25, 25.5**, cada una con su cantidad (vacía = 0).
- Sube la foto y crea **un registro por cada talla** (las 8, aunque tengan 0), todos con mismo nombre, código, marca, precio y foto.
- Mensaje de éxito y limpia el formulario.

## 4. Modificación – `modificar.html`

**Filtros**: Código (con autocompletado, búsqueda parcial) · Nombre (autocompletado, parcial) · Marca (botones múltiples) · Talla (botones múltiples) · Estado **Todos** (por defecto) / Disponibles · Buscar · Limpiar.

**Tarjeta editable** por modelo (en el reverso): Nombre, Código, Marca, Precio, cambiar foto, y tabla con cada Talla (editable) y su Disponible (editable). Botón **ACTUALIZAR** guarda todo el modelo.
- Validaciones: campos llenos, talla > 0, disponible no negativo.
- Solo se actualizan las tallas que se ven en la tarjeta (si filtraste por talla, el cambio de precio/nombre solo aplica a esas).

## 5. "Eliminar" – `eliminar.html`

No borraba nada: **pone existencias en 0**.
- Lista todos los modelos con existencias: foto, nombre, código, marca.
- Por talla: talla, disponible, precio y botón **Marcar como 0**.
- Por modelo: **Marcar artículo completo como 0**.
- Pide confirmación. Sin filtros.

## 6. Registrar venta – `registrar_venta.html`

1. **Cliente**: lista de clientes en orden alfabético (obligatorio).
2. **Buscar producto**: Código y Nombre (autocompletado), Marca y Talla (botones múltiples), Buscar, Limpiar. Solo aparecen tallas con existencia. Contador "Mostrando N tallas".
3. **Tarjeta**: nombre – código, marca, precio, selector de talla (muestra cuántas hay), cantidad y **Agregar a venta**. No deja agregar más de lo disponible (cuenta lo que ya está en el carrito); si agregas la misma talla otra vez, suma.
4. **Carrito**: Código, Nombre, Talla, Cantidad, Precio, Subtotal, quitar 🗑️; "Total productos: Q ...".
5. **Fecha de la venta**: hoy por defecto, se puede cambiar (registrar ventas atrasadas).
6. **Total final (Q)**: se llena solo con el total; si lo cambias a mano, la diferencia se guarda como **ajuste** (descuento si es menor, recargo/envío si es mayor). Si lo borras vuelve al total automático.
7. **Registrar Venta**: guarda la venta (cliente, total final, ajuste, fecha), su detalle por talla y **descuenta las existencias**. Recarga la página.

## 7. Ver ventas – `ver_ventas.html`

- Selector de **mes** (por defecto el actual; al cambiarlo recarga solo).
- Botones: **Ver mes** · **Ver año completo** (año del mes elegido) · **Ver historial completo**.
- Tabla: Fecha · Cliente · Total (Q) · **Ver** detalle. Ordenadas de más reciente a más antigua.
- Pie: **Total General** del período.
- Detalle (ventana emergente): por producto foto, cantidad × nombre, talla, precio unitario y subtotal. (El ajuste no se mostraba.)

## 8. Modificar venta – `modificar_venta.html`

- Selector de venta: "número – cliente – fecha", todas, más recientes primero.
- Muestra el **Total de Venta** y el campo **Descuento o Recargo (Q)** (de 5 en 5).
- Detalle actual: foto + nombre, talla, **cantidad editable**, precio, subtotal y **Quitar** (queda en gris hasta guardar).
- **Agregar producto**: lista de todo lo que tiene existencia ("nombre – T talla (n disp) – Q precio") con vista previa de la foto y cantidad; al dar **Agregar** se guarda de inmediato y descuenta existencias.
- **Guardar cambios**: quita los productos marcados (devuelve existencias), aplica cambios de cantidad (ajusta existencias según la diferencia, valida stock) y recalcula total = suma + ajuste.
- **Eliminar venta**: con confirmación, devuelve todas las unidades al inventario y borra la venta.
- No permitía cambiar cliente ni fecha.

## 9. Clientes

**Crear cliente – `crear_cliente.html`**
- Nombre, Teléfono, Dirección (obligatorios) y casilla **Problemas** (marcar clientes conflictivos/morosos).
- Lista desplegable de clientes registrados en orden alfabético, solo para consultar si ya existe.
- Al guardar te lleva directo a **Registrar Venta**.

**Modificar cliente – `modificar_cliente.html`**
- Seleccionar cliente → carga sus datos → editar nombre, teléfono, dirección, Problemas → Guardar.
- Al guardar te lleva a **Registrar Venta**.
- No había eliminar cliente ni buscador.

## 10. Datos que manejaba

- **INVENTARIO** (una fila por modelo + talla): código, nombre, marca, talla, disponible, precio, foto.
- **CLIENTE**: nombre, teléfono, dirección, problemas.
- **VENTAS**: cliente, total, ajuste, fecha.
- **DETALLE_VENTAS**: venta, producto/talla, cantidad, precio unitario, descuento (siempre 0), subtotal.
- **Fotos**: almacenamiento `zapatongt-imagenes` (las nuevas en la raíz; las cambiadas en `FOTOS2/`).
- Moneda: quetzales (Q).

### Lo que confirmó la base real (2026-11-26)

- Columnas iguales a las que usa el código. Extra sin usar: `INVENTARIO.descripcion`. Todas las tablas tienen `created_at`.
- Tipos: `talla`, `precio`, `disponible`, `cantidad`, `telefono` son `numeric`.
- `CLIENTE.telefono` es **único**: no deja registrar dos clientes con el mismo teléfono.
- Trigger `nombre_to_uppercase`: el nombre del cliente se guarda **siempre en MAYÚSCULAS** (al crear y al modificar).
- Relaciones: VENTAS → CLIENTE, DETALLE_VENTAS → VENTAS y → INVENTARIO (sin borrado en cascada).
- Sin regla de unicidad código + talla (se podían duplicar tallas de un modelo).
- Función vieja `validar_codigo_acceso(p_hash)` sigue en la base, ya no se usa.
- RLS activo en las 4 tablas; cualquier usuario con sesión puede leer, crear, modificar y borrar (CLIENTE no tiene regla de borrado).
- Fotos: bucket público `zapatongt-imagenes`; lectura y **subida permitidas incluso sin sesión**.
- 2 usuarios registrados.
- Datos conservados tras la restauración: INVENTARIO 2000 filas (≈250 modelos × 8 tallas), CLIENTE 265, VENTAS 343, DETALLE_VENTAS 365.
- Consecuencia: las páginas que no leen por partes (Registrar venta, Modificar venta, Eliminar) solo veían las primeras 1000 filas que devuelve Supabase.

## 11. Lo que el sistema NO hacía

- Agregar una talla nueva a un modelo ya existente, ni tallas fuera de 22–25.5.
- Borrar productos o clientes.
- Cambiar cliente o fecha de una venta.
- Usar el indicador "Problemas" en otro lado (no avisaba al vender).
- Mostrar el ajuste en Ver Ventas.
- Reportes por producto/marca/talla, más vendidos, costo o ganancia.
- Alertas de existencias bajas, historial de entradas/salidas.
- Comprobante o recibo de venta.
