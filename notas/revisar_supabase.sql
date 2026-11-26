-- Pegar en Supabase > SQL Editor > New query, ejecutar (Run) y copiar el resultado (una sola celda JSON).
-- Solo LEE información; no modifica nada.
select jsonb_pretty(jsonb_build_object(
  'columnas', (
    select jsonb_agg(jsonb_build_object(
      'tabla', table_name, 'columna', column_name, 'tipo', data_type,
      'nulo', is_nullable, 'defecto', column_default) order by table_name, ordinal_position)
    from information_schema.columns where table_schema = 'public'),
  'llaves', (
    select jsonb_agg(jsonb_build_object(
      'tabla', conrelid::regclass::text, 'nombre', conname, 'definicion', pg_get_constraintdef(oid)))
    from pg_constraint where connamespace = 'public'::regnamespace),
  'rls_activo', (
    select jsonb_agg(jsonb_build_object('tabla', relname, 'rls', relrowsecurity))
    from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r'),
  'politicas', (
    select jsonb_agg(jsonb_build_object(
      'esquema', schemaname, 'tabla', tablename, 'politica', policyname, 'operacion', cmd,
      'roles', roles, 'usando', qual, 'verificar', with_check))
    from pg_policies where schemaname in ('public', 'storage')),
  'funciones', (
    select jsonb_agg(jsonb_build_object('nombre', p.proname, 'argumentos', pg_get_function_arguments(p.oid)))
    from pg_proc p where p.pronamespace = 'public'::regnamespace),
  'triggers', (
    select jsonb_agg(jsonb_build_object('tabla', event_object_table, 'trigger', trigger_name, 'accion', action_statement))
    from information_schema.triggers where trigger_schema = 'public'),
  'filas', (
    select jsonb_agg(jsonb_build_object('tabla', relname, 'filas_aprox', n_live_tup))
    from pg_stat_user_tables where schemaname = 'public'),
  'buckets', (
    select jsonb_agg(jsonb_build_object('nombre', name, 'publico', public)) from storage.buckets),
  'usuarios', (select count(*) from auth.users)
)) as resultado;
