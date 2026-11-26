-- =====================================================================
-- ZAPATOS · Copia los datos del sistema anterior (tablas en MAYÚSCULAS)
-- al esquema nuevo. Se puede volver a ejecutar: vacía las tablas nuevas
-- y copia otra vez. Usar el día del cambio a la nueva interfaz:
--     select private.migrar_desde_legacy();
-- No modifica las tablas viejas.
-- =====================================================================

create or replace function private.migrar_desde_legacy()
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_resultado jsonb;
begin
  truncate public.movimientos_inventario, public.venta_items, public.ventas,
           public.producto_tallas, public.productos, public.marcas, public.clientes
           restart identity cascade;

  -- Marcas (corrige el error de dedo "MICHEAL KORS").
  insert into public.marcas (nombre)
  select distinct case upper(btrim(marca)) when 'MICHEAL KORS' then 'MICHAEL KORS' else upper(btrim(marca)) end
    from public."INVENTARIO";

  -- Un producto = un código + nombre. Si dos modelos distintos usaban el mismo
  -- código, el más reciente recibe sufijo -B, -C...
  create temp table pg_temp._prod on commit drop as
  select g.*,
         case when g.rn = 1 then g.codigo_orig else g.codigo_orig || '-' || chr(64 + g.rn::int) end as codigo
    from (
      select upper(btrim(codigo)) as codigo_orig,
             btrim(nombre) as nombre,
             min(created_at) as creado,
             mode() within group (order by upper(btrim(marca))) as marca,
             mode() within group (order by precio) as precio,
             (array_agg(imagen_url order by created_at desc, id desc))[1] as imagen_url,
             row_number() over (partition by upper(btrim(codigo)) order by min(created_at), min(id)) as rn
        from public."INVENTARIO"
       group by 1, 2
    ) g;

  insert into public.productos (codigo, nombre, marca_id, precio, imagen_url, created_at)
  select p.codigo, p.nombre, m.id, p.precio, p.imagen_url, p.creado
    from pg_temp._prod p
    join public.marcas m
      on m.nombre = case p.marca when 'MICHEAL KORS' then 'MICHAEL KORS' else p.marca end;

  -- Relación fila vieja -> producto nuevo -> talla nueva (las tallas repetidas se fusionan).
  create temp table pg_temp._map on commit drop as
  select i.id as old_id, np.id as producto_id, i.talla,
         min(i.id) over (partition by np.id, i.talla) as talla_id
    from public."INVENTARIO" i
    join pg_temp._prod p on p.codigo_orig = upper(btrim(i.codigo)) and p.nombre = btrim(i.nombre)
    join public.productos np on np.codigo = p.codigo;

  insert into public.producto_tallas (id, producto_id, talla, existencia, created_at)
  select m.talla_id, m.producto_id, m.talla, sum(i.disponible)::integer, min(i.created_at)
    from pg_temp._map m
    join public."INVENTARIO" i on i.id = m.old_id
   group by m.talla_id, m.producto_id, m.talla;

  -- Clientes (mismo id).
  insert into public.clientes (id, nombre, telefono, direccion, problemas, created_at)
  select id, nombre, trunc(telefono)::bigint::text, direccion, coalesce(problemas, false), created_at
    from public."CLIENTE";

  -- Ventas (mismo id). El ajuste se recalcula para que el total quede idéntico.
  insert into public.ventas (id, cliente_id, fecha, subtotal, ajuste, created_at, creado_por)
  select v.id, v.cliente_id, v.created_at,
         coalesce(d.subtotal, 0),
         v.total - coalesce(d.subtotal, 0),
         v.created_at, null
    from public."VENTAS" v
    left join (select venta_id, sum(subtotal) as subtotal from public."DETALLE_VENTAS" group by 1) d
      on d.venta_id = v.id;

  insert into public.venta_items (id, venta_id, producto_talla_id, cantidad, precio_unitario, created_at)
  select d.id, d.venta_id, m.talla_id, d.cantidad::integer, d.precio_unitario, d.created_at
    from public."DETALLE_VENTAS" d
    join pg_temp._map m on m.old_id = d.producto_id;

  -- Saldo inicial del kardex.
  insert into public.movimientos_inventario (producto_talla_id, tipo, cantidad, existencia_resultante, nota, creado_por)
  select id, 'migracion', existencia, existencia, 'Saldo al migrar desde el sistema anterior', null
    from public.producto_tallas
   where existencia > 0;

  -- Los contadores siguen después del último id copiado.
  perform setval(pg_get_serial_sequence('public.producto_tallas', 'id'), coalesce((select max(id) from public.producto_tallas), 1));
  perform setval(pg_get_serial_sequence('public.clientes', 'id'),        coalesce((select max(id) from public.clientes), 1));
  perform setval(pg_get_serial_sequence('public.ventas', 'id'),          coalesce((select max(id) from public.ventas), 1));
  perform setval(pg_get_serial_sequence('public.venta_items', 'id'),     coalesce((select max(id) from public.venta_items), 1));

  -- Verificación: viejo vs. nuevo.
  select jsonb_build_object(
    'marcas',            (select count(*) from public.marcas),
    'productos',         (select count(*) from public.productos),
    'codigos_renombrados', (select coalesce(jsonb_agg(codigo), '[]') from pg_temp._prod where rn > 1),
    'tallas_viejas',     (select count(*) from public."INVENTARIO"),
    'tallas_nuevas',     (select count(*) from public.producto_tallas),
    'existencia_vieja',  (select sum(disponible) from public."INVENTARIO"),
    'existencia_nueva',  (select sum(existencia) from public.producto_tallas),
    'clientes_viejos',   (select count(*) from public."CLIENTE"),
    'clientes_nuevos',   (select count(*) from public.clientes),
    'ventas_viejas',     (select count(*) from public."VENTAS"),
    'ventas_nuevas',     (select count(*) from public.ventas),
    'total_vendido_viejo', (select sum(total) from public."VENTAS"),
    'total_vendido_nuevo', (select sum(total) from public.ventas),
    'items_viejos',      (select count(*) from public."DETALLE_VENTAS"),
    'items_nuevos',      (select count(*) from public.venta_items),
    'unidades_vendidas_viejas', (select sum(cantidad) from public."DETALLE_VENTAS"),
    'unidades_vendidas_nuevas', (select sum(cantidad) from public.venta_items)
  ) into v_resultado;

  drop table pg_temp._map;
  drop table pg_temp._prod;
  return v_resultado;
end;
$$;

revoke all on function private.migrar_desde_legacy() from public, anon, authenticated;
