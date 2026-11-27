-- La validación compara "cuándo se contó" contra "cuándo se movió el inventario".
-- Se usa la hora exacta del reloj (clock_timestamp) en vez de la hora de inicio de la transacción.
alter table public.movimientos_inventario alter column created_at set default clock_timestamp();
alter table public.conteo_lineas alter column updated_at set default clock_timestamp();

create or replace function private.conteo_abierto(p_conteo_id bigint)
returns public.conteos language plpgsql stable security definer set search_path = '' as $$
declare v public.conteos;
begin
  select * into v from public.conteos where id = p_conteo_id;
  if not found then raise exception 'La validación % no existe', p_conteo_id using errcode = 'P0002'; end if;
  if v.estado <> 'abierto' then
    raise exception 'Esta validación ya fue %', case v.estado when 'cerrado' then 'cerrada' else 'cancelada' end using errcode = '22023';
  end if;
  return v;
end; $$;
revoke all on function private.conteo_abierto(bigint) from public, anon, authenticated;

create or replace function public.registrar_conteo(p_conteo_id bigint, p_producto_talla_id bigint, p_contado integer)
returns void language plpgsql security definer set search_path = '' as $$
declare v public.conteos; v_talla numeric;
begin
  perform private.exigir_miembro();
  v := private.conteo_abierto(p_conteo_id);
  if p_contado is null or p_contado < 0 then raise exception 'Cantidad inválida' using errcode = '22023'; end if;
  select t.talla into v_talla from public.producto_tallas t join public.productos p on p.id = t.producto_id
   where t.id = p_producto_talla_id and p.marca_id = v.marca_id;
  if not found then raise exception 'Ese producto no es de la marca que se está validando' using errcode = '22023'; end if;
  insert into public.conteo_lineas (conteo_id, producto_talla_id, contado)
  values (p_conteo_id, p_producto_talla_id, p_contado)
  on conflict (conteo_id, producto_talla_id)
  do update set contado = excluded.contado, contado_por = auth.uid(), updated_at = clock_timestamp();
  insert into public.conteo_tallas (conteo_id, talla) values (p_conteo_id, v_talla) on conflict do nothing;
end; $$;

create or replace function public.marcar_talla_conteo(p_conteo_id bigint, p_talla numeric, p_terminada boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.exigir_miembro();
  perform private.conteo_abierto(p_conteo_id);
  insert into public.conteo_tallas (conteo_id, talla, terminada, terminado_por, terminado_at)
  values (p_conteo_id, p_talla, p_terminada, case when p_terminada then auth.uid() end, case when p_terminada then clock_timestamp() end)
  on conflict (conteo_id, talla) do update
    set terminada = excluded.terminada, terminado_por = excluded.terminado_por, terminado_at = excluded.terminado_at;
end; $$;
