-- Prueba de funciones sobre la base ya migrada. Todo se deshace al final:
-- el resultado llega como mensaje de error "RESULTADO {...}".
do $$
declare r jsonb := '{}'; v_miembro uuid; v_cliente bigint; v_talla bigint; v_talla2 bigint; v_antes int; v_antes2 int; v_venta bigint; v_prod bigint; v_n bigint; v_t numeric;
begin
  select user_id into v_miembro from public.miembros limit 1;
  select id into v_cliente from public.clientes order by id limit 1;
  select id, existencia into v_talla, v_antes from public.producto_tallas where existencia >= 2 order by id limit 1;
  select id, existencia into v_talla2, v_antes2 from public.producto_tallas where existencia >= 1 and id <> v_talla order by id desc limit 1;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_miembro, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  r := r || jsonb_build_object('vistas_miembro', jsonb_build_object(
    'v_inventario', (select count(*) from public.v_inventario), 'v_ventas', (select count(*) from public.v_ventas),
    'v_venta_items', (select count(*) from public.v_venta_items), 'v_resumen_mensual', (select count(*) from public.v_resumen_mensual),
    'v_ventas_por_producto', (select count(*) from public.v_ventas_por_producto), 'v_movimientos', (select count(*) from public.v_movimientos)));

  v_venta := public.registrar_venta(v_cliente, jsonb_build_array(jsonb_build_object('producto_talla_id', v_talla, 'cantidad', 2)), now(), 900, 'prueba');
  select total into v_t from public.ventas where id = v_venta;
  r := r || jsonb_build_object('registrar_total_900', v_t = 900, 'registrar_resta_2', (select existencia from public.producto_tallas where id=v_talla) = v_antes - 2);

  perform public.actualizar_venta(v_venta, jsonb_build_array(jsonb_build_object('producto_talla_id', v_talla, 'cantidad', 1), jsonb_build_object('producto_talla_id', v_talla2, 'cantidad', 1)), null, null, 1000);
  r := r || jsonb_build_object('actualizar_ok', (select existencia from public.producto_tallas where id=v_talla) = v_antes - 1 and (select existencia from public.producto_tallas where id=v_talla2) = v_antes2 - 1,
     'actualizar_total_1000', (select total from public.ventas where id = v_venta) = 1000);

  begin perform public.registrar_venta(v_cliente, jsonb_build_array(jsonb_build_object('producto_talla_id', v_talla, 'cantidad', 1)), null, -5);
    r := r || jsonb_build_object('total_negativo', 'NO bloqueado');
  exception when others then r := r || jsonb_build_object('total_negativo', sqlerrm); end;
  begin perform public.registrar_venta(v_cliente, jsonb_build_array(jsonb_build_object('producto_talla_id', v_talla, 'cantidad', 9999)));
    r := r || jsonb_build_object('sobreventa', 'NO bloqueada');
  exception when others then r := r || jsonb_build_object('sobreventa', sqlerrm); end;
  begin perform public.registrar_venta(v_cliente, '[]'::jsonb);
    r := r || jsonb_build_object('venta_vacia', 'NO bloqueada');
  exception when others then r := r || jsonb_build_object('venta_vacia', sqlerrm); end;

  perform public.eliminar_venta(v_venta);
  r := r || jsonb_build_object('eliminar_restaura', (select existencia from public.producto_tallas where id=v_talla) = v_antes and (select existencia from public.producto_tallas where id=v_talla2) = v_antes2);

  v_prod := public.crear_producto('zz-prueba', 'Prueba', 'Puma', 550);
  perform public.guardar_tallas(v_prod, '[{"talla":24,"existencia":3},{"talla":27,"existencia":1}]'::jsonb, 'conteo');
  r := r || jsonb_build_object('producto_nuevo', (select jsonb_build_object('marca', marca, 'tallas', jsonb_array_length(tallas), 'total', existencia_total) from public.v_inventario where id = v_prod));
  begin update public.producto_tallas set existencia = 50 where id = v_talla; r := r || jsonb_build_object('editar_existencia_directo', 'NO bloqueado');
  exception when others then r := r || jsonb_build_object('editar_existencia_directo', 'bloqueado'); end;
  begin delete from public.ventas where id = (select min(id) from public.ventas); r := r || jsonb_build_object('borrar_venta_directo', 'NO bloqueado');
  exception when others then r := r || jsonb_build_object('borrar_venta_directo', 'bloqueado'); end;

  r := r || jsonb_build_object('kardex_cuadra', not exists (select 1 from public.producto_tallas t where t.existencia <> coalesce((select sum(cantidad) from public.movimientos_inventario m where m.producto_talla_id=t.id),0)));

  execute 'reset role';
  begin perform private.migrar_desde_legacy(); r := r || jsonb_build_object('recopia_protegida', 'NO');
  exception when others then r := r || jsonb_build_object('recopia_protegida', 'sí'); end;

  perform set_config('role', 'anon', true);
  begin select count(*) into v_n from public.v_inventario; r := r || jsonb_build_object('anon_vistas', v_n);
  exception when others then r := r || jsonb_build_object('anon_vistas', 'denegado'); end;
  raise exception 'RESULTADO %', r::text;
end $$;
