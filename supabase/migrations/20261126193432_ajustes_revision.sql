-- =====================================================================
-- Ajustes tras la revisión del esquema.
-- =====================================================================

-- 1) Las vistas son solo de lectura.
revoke all on public.v_inventario, public.v_ventas, public.v_venta_items, public.v_resumen_mensual from authenticated;
grant select on public.v_inventario, public.v_ventas, public.v_venta_items, public.v_resumen_mensual to authenticated;

-- 2) La copia desde el sistema viejo ya no puede borrar trabajo hecho en el sistema nuevo
--    salvo que se fuerce a propósito.
drop function if exists private.migrar_desde_legacy();
create or replace function private.migrar_desde_legacy(p_forzar boolean default false)
returns jsonb language plpgsql set search_path = '' as $$
declare v_resultado jsonb;
begin
  if not p_forzar and exists (select 1 from public.movimientos_inventario where tipo <> 'migracion') then
    raise exception 'El sistema nuevo ya tiene movimientos propios; volver a copiar los borraría. Usa p_forzar => true solo si estás seguro.';
  end if;

  truncate public.movimientos_inventario, public.venta_items, public.ventas, public.producto_tallas, public.productos, public.marcas, public.clientes restart identity cascade;
  insert into public.marcas (nombre) select distinct case upper(btrim(marca)) when 'MICHEAL KORS' then 'MICHAEL KORS' else upper(btrim(marca)) end from public."INVENTARIO";
  create temp table pg_temp._prod on commit drop as
  select g.*, case when g.rn = 1 then g.codigo_orig else g.codigo_orig || '-' || chr(64 + g.rn::int) end as codigo
    from (select upper(btrim(codigo)) as codigo_orig, btrim(nombre) as nombre, min(created_at) as creado,
             mode() within group (order by upper(btrim(marca))) as marca, mode() within group (order by precio) as precio,
             (array_agg(imagen_url order by created_at desc, id desc))[1] as imagen_url,
             row_number() over (partition by upper(btrim(codigo)) order by min(created_at), min(id)) as rn
        from public."INVENTARIO" group by 1, 2) g;
  insert into public.productos (codigo, nombre, marca_id, precio, imagen_url, created_at)
  select p.codigo, p.nombre, m.id, p.precio, p.imagen_url, p.creado from pg_temp._prod p
    join public.marcas m on m.nombre = case p.marca when 'MICHEAL KORS' then 'MICHAEL KORS' else p.marca end;
  create temp table pg_temp._map on commit drop as
  select i.id as old_id, np.id as producto_id, i.talla, min(i.id) over (partition by np.id, i.talla) as talla_id
    from public."INVENTARIO" i join pg_temp._prod p on p.codigo_orig = upper(btrim(i.codigo)) and p.nombre = btrim(i.nombre)
    join public.productos np on np.codigo = p.codigo;
  insert into public.producto_tallas (id, producto_id, talla, existencia, created_at)
  select m.talla_id, m.producto_id, m.talla, sum(i.disponible)::integer, min(i.created_at) from pg_temp._map m join public."INVENTARIO" i on i.id = m.old_id group by m.talla_id, m.producto_id, m.talla;
  insert into public.clientes (id, nombre, telefono, direccion, problemas, created_at)
  select id, nombre, trunc(telefono)::bigint::text, direccion, coalesce(problemas, false), created_at from public."CLIENTE";
  insert into public.ventas (id, cliente_id, fecha, subtotal, ajuste, created_at, creado_por)
  select v.id, v.cliente_id, v.created_at, coalesce(d.subtotal, 0), v.total - coalesce(d.subtotal, 0), v.created_at, null
    from public."VENTAS" v left join (select venta_id, sum(subtotal) as subtotal from public."DETALLE_VENTAS" group by 1) d on d.venta_id = v.id;
  insert into public.venta_items (id, venta_id, producto_talla_id, cantidad, precio_unitario, created_at)
  select d.id, d.venta_id, m.talla_id, d.cantidad::integer, d.precio_unitario, d.created_at from public."DETALLE_VENTAS" d join pg_temp._map m on m.old_id = d.producto_id;
  insert into public.movimientos_inventario (producto_talla_id, tipo, cantidad, existencia_resultante, nota, creado_por)
  select id, 'migracion', existencia, existencia, 'Saldo al migrar desde el sistema anterior', null from public.producto_tallas where existencia > 0;
  perform setval(pg_get_serial_sequence('public.producto_tallas', 'id'), coalesce((select max(id) from public.producto_tallas), 1));
  perform setval(pg_get_serial_sequence('public.clientes', 'id'), coalesce((select max(id) from public.clientes), 1));
  perform setval(pg_get_serial_sequence('public.ventas', 'id'), coalesce((select max(id) from public.ventas), 1));
  perform setval(pg_get_serial_sequence('public.venta_items', 'id'), coalesce((select max(id) from public.venta_items), 1));
  select jsonb_build_object('marcas', (select count(*) from public.marcas), 'productos', (select count(*) from public.productos),
    'codigos_renombrados', (select coalesce(jsonb_agg(codigo), '[]') from pg_temp._prod where rn > 1),
    'tallas_viejas', (select count(*) from public."INVENTARIO"), 'tallas_nuevas', (select count(*) from public.producto_tallas),
    'existencia_vieja', (select sum(disponible) from public."INVENTARIO"), 'existencia_nueva', (select sum(existencia) from public.producto_tallas),
    'clientes_viejos', (select count(*) from public."CLIENTE"), 'clientes_nuevos', (select count(*) from public.clientes),
    'ventas_viejas', (select count(*) from public."VENTAS"), 'ventas_nuevas', (select count(*) from public.ventas),
    'total_vendido_viejo', (select sum(total) from public."VENTAS"), 'total_vendido_nuevo', (select sum(total) from public.ventas),
    'items_viejos', (select count(*) from public."DETALLE_VENTAS"), 'items_nuevos', (select count(*) from public.venta_items),
    'unidades_vendidas_viejas', (select sum(cantidad) from public."DETALLE_VENTAS"), 'unidades_vendidas_nuevas', (select sum(cantidad) from public.venta_items)
  ) into v_resultado;
  drop table pg_temp._map; drop table pg_temp._prod;
  return v_resultado;
end; $$;
revoke all on function private.migrar_desde_legacy(boolean) from public, anon, authenticated;

-- 3) Mensaje claro si el total final queda negativo (antes salía el error técnico del CHECK).
create or replace function private.validar_total_final(p_total_final numeric)
returns void language plpgsql immutable set search_path = '' as $$
begin
  if p_total_final is not null and p_total_final < 0 then
    raise exception 'El total final no puede ser negativo' using errcode = '22023';
  end if;
end; $$;
revoke all on function private.validar_total_final(numeric) from public, anon, authenticated;

create or replace function public.registrar_venta(p_cliente_id bigint, p_items jsonb, p_fecha timestamptz default null, p_total_final numeric default null, p_nota text default null) returns bigint
language plpgsql security definer set search_path = '' as $$
declare v_venta_id bigint; v_item record; v_precio numeric; v_subtotal numeric := 0;
begin
  perform private.exigir_miembro();
  perform private.validar_total_final(p_total_final);
  if not exists (select 1 from public.clientes where id = p_cliente_id) then raise exception 'Selecciona un cliente válido' using errcode = '22023'; end if;
  insert into public.ventas (cliente_id, fecha, nota) values (p_cliente_id, coalesce(p_fecha, now()), nullif(btrim(p_nota), '')) returning id into v_venta_id;
  for v_item in select * from private.leer_items(p_items) loop
    select coalesce(v_item.precio_unitario, p.precio) into v_precio from public.producto_tallas t join public.productos p on p.id = t.producto_id where t.id = v_item.producto_talla_id;
    perform private.mover_existencia(v_item.producto_talla_id, -v_item.cantidad, 'venta', v_venta_id, null);
    insert into public.venta_items (venta_id, producto_talla_id, cantidad, precio_unitario) values (v_venta_id, v_item.producto_talla_id, v_item.cantidad, v_precio);
    v_subtotal := v_subtotal + v_item.cantidad * v_precio;
  end loop;
  update public.ventas set subtotal = v_subtotal, ajuste = coalesce(p_total_final - v_subtotal, 0) where id = v_venta_id;
  return v_venta_id;
end; $$;

create or replace function public.actualizar_venta(p_venta_id bigint, p_items jsonb, p_cliente_id bigint default null, p_fecha timestamptz default null, p_total_final numeric default null, p_nota text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare v_venta public.ventas; v_cambio record; v_subtotal numeric;
begin
  perform private.exigir_miembro();
  perform private.validar_total_final(p_total_final);
  select * into v_venta from public.ventas where id = p_venta_id for update;
  if not found then raise exception 'La venta % no existe', p_venta_id using errcode = 'P0002'; end if;
  if p_cliente_id is not null and not exists (select 1 from public.clientes where id = p_cliente_id) then raise exception 'Selecciona un cliente válido' using errcode = '22023'; end if;
  create temp table pg_temp._nuevos on commit drop as select * from private.leer_items(p_items);
  for v_cambio in
    select coalesce(a.producto_talla_id, n.producto_talla_id) as producto_talla_id, coalesce(a.cantidad, 0) - coalesce(n.cantidad, 0) as devolver
      from (select producto_talla_id, sum(cantidad)::integer as cantidad from public.venta_items where venta_id = p_venta_id group by 1) a
      full join pg_temp._nuevos n on n.producto_talla_id = a.producto_talla_id order by 1
  loop
    if v_cambio.devolver > 0 then perform private.mover_existencia(v_cambio.producto_talla_id, v_cambio.devolver, 'devolucion', p_venta_id, 'Modificación de venta');
    elsif v_cambio.devolver < 0 then perform private.mover_existencia(v_cambio.producto_talla_id, v_cambio.devolver, 'venta', p_venta_id, 'Modificación de venta'); end if;
  end loop;
  create temp table pg_temp._precios on commit drop as
  select n.producto_talla_id, n.cantidad, coalesce(n.precio_unitario, (select max(vi.precio_unitario) from public.venta_items vi where vi.venta_id = p_venta_id and vi.producto_talla_id = n.producto_talla_id), p.precio) as precio_unitario
    from pg_temp._nuevos n join public.producto_tallas t on t.id = n.producto_talla_id join public.productos p on p.id = t.producto_id;
  delete from public.venta_items where venta_id = p_venta_id;
  insert into public.venta_items (venta_id, producto_talla_id, cantidad, precio_unitario) select p_venta_id, producto_talla_id, cantidad, precio_unitario from pg_temp._precios;
  select coalesce(sum(cantidad * precio_unitario), 0) into v_subtotal from pg_temp._precios;
  if p_total_final is null and v_subtotal + v_venta.ajuste < 0 then
    raise exception 'Con el descuento actual (Q%) el total quedaría negativo; indica el total final', v_venta.ajuste using errcode = '22023';
  end if;
  update public.ventas set subtotal = v_subtotal, ajuste = case when p_total_final is null then v_venta.ajuste else p_total_final - v_subtotal end, cliente_id = coalesce(p_cliente_id, v_venta.cliente_id), fecha = coalesce(p_fecha, v_venta.fecha), nota = coalesce(nullif(btrim(p_nota), ''), v_venta.nota) where id = p_venta_id;
  drop table pg_temp._nuevos; drop table pg_temp._precios;
end; $$;

-- 4) Vistas para reportes y para el historial de inventario.
create view public.v_ventas_por_producto with (security_invoker = true) as
select p.id as producto_id, p.codigo, p.nombre, m.nombre as marca, p.imagen_url, p.precio,
       coalesce(sum(vi.cantidad), 0)::int as unidades_vendidas,
       coalesce(sum(vi.subtotal), 0) as monto_vendido,
       max(v.fecha) as ultima_venta,
       (select coalesce(sum(t2.existencia), 0)::int from public.producto_tallas t2 where t2.producto_id = p.id) as existencia_total
from public.productos p
join public.marcas m on m.id = p.marca_id
left join public.producto_tallas t on t.producto_id = p.id
left join public.venta_items vi on vi.producto_talla_id = t.id
left join public.ventas v on v.id = vi.venta_id
group by p.id, m.nombre;

create view public.v_movimientos with (security_invoker = true) as
select mo.id, mo.created_at, mo.tipo, mo.cantidad, mo.existencia_resultante, mo.venta_id, mo.nota, mo.creado_por,
       t.id as producto_talla_id, t.talla, p.id as producto_id, p.codigo, p.nombre, m.nombre as marca
from public.movimientos_inventario mo
join public.producto_tallas t on t.id = mo.producto_talla_id
join public.productos p on p.id = t.producto_id
join public.marcas m on m.id = p.marca_id;

revoke all on public.v_ventas_por_producto, public.v_movimientos from anon, authenticated;
grant select on public.v_ventas_por_producto, public.v_movimientos to authenticated;
