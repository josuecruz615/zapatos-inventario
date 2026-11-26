-- Se ejecuta DESPUÉS de las migraciones 0001-0004 en la MISMA transacción.
-- Termina con un error a propósito para que TODO se deshaga; el mensaje trae los resultados.
do $$
declare
  r          jsonb := '{}';
  v_mig      jsonb;
  v_miembro  uuid;
  v_cliente  bigint;
  v_talla    bigint;
  v_talla2   bigint;
  v_antes    int;
  v_antes2   int;
  v_venta    bigint;
  v_prod     bigint;
  v_n        bigint;
begin
  v_mig := private.migrar_desde_legacy();
  r := r || jsonb_build_object('migracion', v_mig);

  -- Segunda ejecución debe dar lo mismo (re-ejecutable).
  r := r || jsonb_build_object('migracion_repetida_igual', private.migrar_desde_legacy() = v_mig);

  select user_id into v_miembro from public.miembros limit 1;
  select id into v_cliente from public.clientes order by id limit 1;
  select id, existencia into v_talla, v_antes from public.producto_tallas where existencia >= 2 order by id limit 1;
  select id, existencia into v_talla2, v_antes2 from public.producto_tallas where existencia >= 1 and id <> v_talla order by id limit 1;

  -- ===== Como usuario MIEMBRO =====
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_miembro, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  select count(*) into v_n from public.v_inventario;
  r := r || jsonb_build_object('miembro_ve_productos', v_n);
  select count(*) into v_n from public.v_ventas;
  r := r || jsonb_build_object('miembro_ve_ventas', v_n);
  r := r || jsonb_build_object('resumen_meses', (select count(*) from public.v_resumen_mensual));

  v_venta := public.registrar_venta(v_cliente,
    jsonb_build_array(jsonb_build_object('producto_talla_id', v_talla, 'cantidad', 1),
                      jsonb_build_object('producto_talla_id', v_talla, 'cantidad', 1)),
    null, 1000, 'prueba');
  r := r || jsonb_build_object('venta_creada', v_venta,
    'existencia_tras_venta_ok', (select existencia from public.producto_tallas where id = v_talla) = v_antes - 2,
    'venta', (select to_jsonb(v) - 'creado_por' - 'created_at' - 'updated_at' from public.ventas v where id = v_venta));

  perform public.actualizar_venta(v_venta,
    jsonb_build_array(jsonb_build_object('producto_talla_id', v_talla, 'cantidad', 1),
                      jsonb_build_object('producto_talla_id', v_talla2, 'cantidad', 1)));
  r := r || jsonb_build_object(
    'actualizar_talla1_ok', (select existencia from public.producto_tallas where id = v_talla) = v_antes - 1,
    'actualizar_talla2_ok', (select existencia from public.producto_tallas where id = v_talla2) = v_antes2 - 1,
    'venta_actualizada', (select jsonb_build_object('subtotal', subtotal, 'ajuste', ajuste, 'total', total) from public.ventas where id = v_venta));

  begin
    perform public.registrar_venta(v_cliente, jsonb_build_array(jsonb_build_object('producto_talla_id', v_talla, 'cantidad', 9999)));
    r := r || jsonb_build_object('sobreventa_bloqueada', false);
  exception when others then
    r := r || jsonb_build_object('sobreventa_bloqueada', true, 'sobreventa_mensaje', sqlerrm);
  end;

  perform public.eliminar_venta(v_venta);
  r := r || jsonb_build_object(
    'eliminar_devuelve_talla1', (select existencia from public.producto_tallas where id = v_talla) = v_antes,
    'eliminar_devuelve_talla2', (select existencia from public.producto_tallas where id = v_talla2) = v_antes2);

  v_prod := public.crear_producto('prueba-001', 'Modelo Prueba', 'marca nueva', 500,
    '[{"talla":23,"existencia":2},{"talla":24}]'::jsonb);
  perform public.guardar_tallas(v_prod, '[{"talla":23,"existencia":0},{"talla":26,"existencia":3}]'::jsonb, 'conteo');
  r := r || jsonb_build_object('producto_nuevo',
    (select jsonb_build_object('codigo', codigo, 'marca', marca, 'total', existencia_total, 'tallas', tallas)
       from public.v_inventario where id = v_prod),
    'movimientos_producto_nuevo', (select count(*) from public.movimientos_inventario m
       join public.producto_tallas t on t.id = m.producto_talla_id where t.producto_id = v_prod));

  begin
    perform public.crear_producto('PRUEBA-001', 'Otro', 'X', 1);
    r := r || jsonb_build_object('codigo_duplicado_bloqueado', false);
  exception when others then
    r := r || jsonb_build_object('codigo_duplicado_bloqueado', true);
  end;

  begin
    update public.producto_tallas set existencia = 100 where id = v_talla;
    r := r || jsonb_build_object('edicion_directa_existencia_bloqueada', false);
  exception when others then
    r := r || jsonb_build_object('edicion_directa_existencia_bloqueada', true);
  end;

  insert into public.clientes (nombre, telefono) values ('  juan   pérez ', '5555-1234') returning id into v_n;
  r := r || jsonb_build_object('cliente_normalizado', (select jsonb_build_object('nombre', nombre, 'telefono', telefono) from public.clientes where id = v_n));

  -- ===== Como usuario NO miembro =====
  perform set_config('request.jwt.claims', jsonb_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
  select count(*) into v_n from public.v_inventario;
  r := r || jsonb_build_object('no_miembro_ve_productos', v_n);
  begin
    perform public.registrar_venta(v_cliente, jsonb_build_array(jsonb_build_object('producto_talla_id', v_talla, 'cantidad', 1)));
    r := r || jsonb_build_object('no_miembro_vende', true);
  exception when others then
    r := r || jsonb_build_object('no_miembro_vende', false);
  end;

  -- ===== Como anónimo =====
  execute 'reset role';
  perform set_config('role', 'anon', true);
  begin
    select count(*) into v_n from public.productos;
    r := r || jsonb_build_object('anon_lee_productos', v_n);
  exception when others then
    r := r || jsonb_build_object('anon_lee_productos', 'denegado');
  end;
  begin
    perform public.registrar_venta(v_cliente, '[]'::jsonb);
    r := r || jsonb_build_object('anon_ejecuta_funciones', true);
  exception when others then
    r := r || jsonb_build_object('anon_ejecuta_funciones', false);
  end;

  raise exception 'RESULTADO_PRUEBA %', r::text;
end;
$$;
