-- =====================================================================
-- ZAPATOS · Funciones de negocio.
-- Cada función es una sola transacción: o se guarda todo, o nada.
-- Todas exigen que el usuario esté en public.miembros.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Núcleo: mueve existencia de una talla y deja registro en el kardex.
-- ---------------------------------------------------------------------
create or replace function private.mover_existencia(
  p_producto_talla_id bigint,
  p_delta             integer,
  p_tipo              text,
  p_venta_id          bigint default null,
  p_nota              text   default null
) returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_actual integer;
  v_codigo text;
  v_talla  numeric;
begin
  if p_delta = 0 then
    select existencia into v_actual from public.producto_tallas where id = p_producto_talla_id;
    return v_actual;
  end if;

  select t.existencia, p.codigo, t.talla
    into v_actual, v_codigo, v_talla
    from public.producto_tallas t
    join public.productos p on p.id = t.producto_id
   where t.id = p_producto_talla_id
     for update of t;

  if not found then
    raise exception 'La talla % no existe', p_producto_talla_id using errcode = 'P0002';
  end if;

  if v_actual + p_delta < 0 then
    raise exception 'Existencia insuficiente para % talla %: hay %, se necesitan %',
      v_codigo, v_talla, v_actual, -p_delta using errcode = 'P0001';
  end if;

  update public.producto_tallas
     set existencia = v_actual + p_delta
   where id = p_producto_talla_id;

  insert into public.movimientos_inventario
    (producto_talla_id, tipo, cantidad, existencia_resultante, venta_id, nota)
  values
    (p_producto_talla_id, p_tipo, p_delta, v_actual + p_delta, p_venta_id, p_nota);

  return v_actual + p_delta;
end;
$$;

-- Convierte el JSON de artículos en filas agrupadas por talla.
-- Formato: [{"producto_talla_id": 1, "cantidad": 2, "precio_unitario": 545}]  (precio opcional)
create or replace function private.leer_items(p_items jsonb)
returns table (producto_talla_id bigint, cantidad integer, precio_unitario numeric)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La venta no tiene productos' using errcode = '22023';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_items) e
     where (e->>'producto_talla_id') is null
        or (e->>'cantidad') is null
        or (e->>'cantidad')::integer <= 0
        or ((e->>'precio_unitario') is not null and (e->>'precio_unitario')::numeric < 0)
  ) then
    raise exception 'Hay productos con cantidad o precio inválido' using errcode = '22023';
  end if;

  return query
  select (e->>'producto_talla_id')::bigint,
         sum((e->>'cantidad')::integer)::integer,
         max((e->>'precio_unitario')::numeric)
    from jsonb_array_elements(p_items) e
   group by 1
   order by 1;   -- orden fijo para bloquear filas siempre igual (evita bloqueos cruzados)
end;
$$;

-- ---------------------------------------------------------------------
-- Marcas
-- ---------------------------------------------------------------------
create or replace function public.obtener_marca(p_nombre text)
returns bigint
language plpgsql security definer
set search_path = ''
as $$
declare
  v_id bigint;
  v_nombre text := upper(btrim(p_nombre));
begin
  perform private.exigir_miembro();
  if v_nombre is null or v_nombre = '' then
    raise exception 'La marca es obligatoria' using errcode = '22023';
  end if;
  insert into public.marcas (nombre) values (v_nombre)
  on conflict (nombre) do nothing
  returning id into v_id;
  if v_id is null then
    select id into v_id from public.marcas where nombre = v_nombre;
  end if;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Productos
-- ---------------------------------------------------------------------
-- p_tallas: [{"talla": 22, "existencia": 1}, ...]. Si es null crea 22 a 25.5 en 0.
create or replace function public.crear_producto(
  p_codigo      text,
  p_nombre      text,
  p_marca       text,
  p_precio      numeric,
  p_tallas      jsonb   default null,
  p_costo       numeric default null,
  p_descripcion text    default null,
  p_imagen_url  text    default null
) returns bigint
language plpgsql security definer
set search_path = ''
as $$
declare
  v_id      bigint;
  v_talla   record;
  v_talla_id bigint;
begin
  perform private.exigir_miembro();

  if exists (select 1 from public.productos where codigo = upper(btrim(p_codigo))) then
    raise exception 'Ya existe un producto con el código %', upper(btrim(p_codigo)) using errcode = '23505';
  end if;

  insert into public.productos (codigo, nombre, marca_id, precio, costo, descripcion, imagen_url)
  values (p_codigo, p_nombre, public.obtener_marca(p_marca), p_precio, p_costo, p_descripcion, p_imagen_url)
  returning id into v_id;

  for v_talla in
    select (e->>'talla')::numeric as talla, coalesce((e->>'existencia')::integer, 0) as existencia
      from jsonb_array_elements(
             coalesce(p_tallas, '[{"talla":22},{"talla":22.5},{"talla":23},{"talla":23.5},
                                  {"talla":24},{"talla":24.5},{"talla":25},{"talla":25.5}]'::jsonb)) e
     order by 1
  loop
    if v_talla.existencia < 0 then
      raise exception 'La existencia de la talla % no puede ser negativa', v_talla.talla using errcode = '22023';
    end if;
    insert into public.producto_tallas (producto_id, talla) values (v_id, v_talla.talla)
    returning id into v_talla_id;
    perform private.mover_existencia(v_talla_id, v_talla.existencia, 'entrada', null, 'Alta de producto');
  end loop;

  return v_id;
end;
$$;

-- Fija la existencia de varias tallas (crea las que no existan).
-- Sirve para: reabastecer, corregir conteos, agregar tallas nuevas y "poner en 0".
-- p_tallas: [{"talla": 23, "existencia": 4}, ...]
create or replace function public.guardar_tallas(
  p_producto_id bigint,
  p_tallas      jsonb,
  p_nota        text default null
) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_item     record;
  v_talla_id bigint;
  v_actual   integer;
begin
  perform private.exigir_miembro();

  if not exists (select 1 from public.productos where id = p_producto_id) then
    raise exception 'El producto % no existe', p_producto_id using errcode = 'P0002';
  end if;
  if p_tallas is null or jsonb_typeof(p_tallas) <> 'array' then
    raise exception 'Formato de tallas inválido' using errcode = '22023';
  end if;

  for v_item in
    select (e->>'talla')::numeric as talla, (e->>'existencia')::integer as existencia
      from jsonb_array_elements(p_tallas) e
     order by 1
  loop
    if v_item.talla is null or v_item.talla <= 0 or v_item.existencia is null or v_item.existencia < 0 then
      raise exception 'Talla o existencia inválida (talla %, existencia %)', v_item.talla, v_item.existencia
        using errcode = '22023';
    end if;

    select id, existencia into v_talla_id, v_actual
      from public.producto_tallas
     where producto_id = p_producto_id and talla = v_item.talla
       for update;

    if not found then
      insert into public.producto_tallas (producto_id, talla) values (p_producto_id, v_item.talla)
      returning id, existencia into v_talla_id, v_actual;
    end if;

    perform private.mover_existencia(
      v_talla_id,
      v_item.existencia - v_actual,
      case when v_item.existencia > v_actual then 'entrada' else 'ajuste' end,
      null,
      p_nota);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- Ventas
-- ---------------------------------------------------------------------
-- p_total_final: si se manda, la diferencia con la suma de productos queda como ajuste.
create or replace function public.registrar_venta(
  p_cliente_id  bigint,
  p_items       jsonb,
  p_fecha       timestamptz default null,
  p_total_final numeric     default null,
  p_nota        text        default null
) returns bigint
language plpgsql security definer
set search_path = ''
as $$
declare
  v_venta_id bigint;
  v_item     record;
  v_precio   numeric;
  v_subtotal numeric := 0;
begin
  perform private.exigir_miembro();

  if not exists (select 1 from public.clientes where id = p_cliente_id) then
    raise exception 'Selecciona un cliente válido' using errcode = '22023';
  end if;

  insert into public.ventas (cliente_id, fecha, nota)
  values (p_cliente_id, coalesce(p_fecha, now()), nullif(btrim(p_nota), ''))
  returning id into v_venta_id;

  for v_item in select * from private.leer_items(p_items) loop
    select coalesce(v_item.precio_unitario, p.precio) into v_precio
      from public.producto_tallas t join public.productos p on p.id = t.producto_id
     where t.id = v_item.producto_talla_id;

    perform private.mover_existencia(v_item.producto_talla_id, -v_item.cantidad, 'venta', v_venta_id, null);

    insert into public.venta_items (venta_id, producto_talla_id, cantidad, precio_unitario)
    values (v_venta_id, v_item.producto_talla_id, v_item.cantidad, v_precio);

    v_subtotal := v_subtotal + v_item.cantidad * v_precio;
  end loop;

  update public.ventas
     set subtotal = v_subtotal,
         ajuste   = coalesce(p_total_final - v_subtotal, 0)
   where id = v_venta_id;

  return v_venta_id;
end;
$$;

-- Reemplaza el contenido de una venta. p_items es la lista COMPLETA nueva.
-- Solo mueve inventario por la diferencia de cada talla.
-- p_total_final null = conserva el ajuste anterior.
create or replace function public.actualizar_venta(
  p_venta_id    bigint,
  p_items       jsonb,
  p_cliente_id  bigint      default null,
  p_fecha       timestamptz default null,
  p_total_final numeric     default null,
  p_nota        text        default null
) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_venta    public.ventas;
  v_cambio   record;
  v_subtotal numeric;
begin
  perform private.exigir_miembro();

  select * into v_venta from public.ventas where id = p_venta_id for update;
  if not found then
    raise exception 'La venta % no existe', p_venta_id using errcode = 'P0002';
  end if;

  if p_cliente_id is not null and not exists (select 1 from public.clientes where id = p_cliente_id) then
    raise exception 'Selecciona un cliente válido' using errcode = '22023';
  end if;

  create temp table pg_temp._nuevos on commit drop as select * from private.leer_items(p_items);

  -- Diferencias por talla (antes vs. ahora), en orden fijo.
  for v_cambio in
    select coalesce(a.producto_talla_id, n.producto_talla_id) as producto_talla_id,
           coalesce(a.cantidad, 0) - coalesce(n.cantidad, 0) as devolver
      from (select producto_talla_id, sum(cantidad)::integer as cantidad
              from public.venta_items where venta_id = p_venta_id group by 1) a
      full join pg_temp._nuevos n on n.producto_talla_id = a.producto_talla_id
     order by 1
  loop
    if v_cambio.devolver > 0 then
      perform private.mover_existencia(v_cambio.producto_talla_id, v_cambio.devolver, 'devolucion', p_venta_id,
                                       'Modificación de venta');
    elsif v_cambio.devolver < 0 then
      perform private.mover_existencia(v_cambio.producto_talla_id, v_cambio.devolver, 'venta', p_venta_id,
                                       'Modificación de venta');
    end if;
  end loop;

  -- Precio: el enviado; si no, el que ya tenía en esta venta; si es nueva, el del producto.
  create temp table pg_temp._precios on commit drop as
  select n.producto_talla_id, n.cantidad,
         coalesce(n.precio_unitario,
                  (select max(vi.precio_unitario) from public.venta_items vi
                    where vi.venta_id = p_venta_id and vi.producto_talla_id = n.producto_talla_id),
                  p.precio) as precio_unitario
    from pg_temp._nuevos n
    join public.producto_tallas t on t.id = n.producto_talla_id
    join public.productos p on p.id = t.producto_id;

  delete from public.venta_items where venta_id = p_venta_id;

  insert into public.venta_items (venta_id, producto_talla_id, cantidad, precio_unitario)
  select p_venta_id, producto_talla_id, cantidad, precio_unitario from pg_temp._precios;

  select coalesce(sum(cantidad * precio_unitario), 0) into v_subtotal from pg_temp._precios;

  update public.ventas
     set subtotal   = v_subtotal,
         ajuste     = case when p_total_final is null then v_venta.ajuste else p_total_final - v_subtotal end,
         cliente_id = coalesce(p_cliente_id, v_venta.cliente_id),
         fecha      = coalesce(p_fecha, v_venta.fecha),
         nota       = coalesce(nullif(btrim(p_nota), ''), v_venta.nota)
   where id = p_venta_id;

  drop table pg_temp._nuevos;
  drop table pg_temp._precios;
end;
$$;

-- Elimina una venta y devuelve todo al inventario.
create or replace function public.eliminar_venta(p_venta_id bigint)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_item record;
begin
  perform private.exigir_miembro();

  perform 1 from public.ventas where id = p_venta_id for update;
  if not found then
    raise exception 'La venta % no existe', p_venta_id using errcode = 'P0002';
  end if;

  for v_item in
    select producto_talla_id, sum(cantidad)::integer as cantidad
      from public.venta_items where venta_id = p_venta_id
     group by 1 order by 1
  loop
    perform private.mover_existencia(v_item.producto_talla_id, v_item.cantidad, 'devolucion', p_venta_id,
                                     format('Venta #%s eliminada', p_venta_id));
  end loop;

  delete from public.ventas where id = p_venta_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Permisos de ejecución
-- ---------------------------------------------------------------------
revoke all on all functions in schema private from public, anon, authenticated;

revoke execute on function
  public.obtener_marca(text),
  public.crear_producto(text, text, text, numeric, jsonb, numeric, text, text),
  public.guardar_tallas(bigint, jsonb, text),
  public.registrar_venta(bigint, jsonb, timestamptz, numeric, text),
  public.actualizar_venta(bigint, jsonb, bigint, timestamptz, numeric, text),
  public.eliminar_venta(bigint)
from public, anon;

grant execute on function
  public.obtener_marca(text),
  public.crear_producto(text, text, text, numeric, jsonb, numeric, text, text),
  public.guardar_tallas(bigint, jsonb, text),
  public.registrar_venta(bigint, jsonb, timestamptz, numeric, text),
  public.actualizar_venta(bigint, jsonb, bigint, timestamptz, numeric, text),
  public.eliminar_venta(bigint)
to authenticated;
