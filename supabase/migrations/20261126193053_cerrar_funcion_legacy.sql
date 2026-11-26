-- Función del acceso anterior por código; la página ya no la usa.
revoke execute on function public.validar_codigo_acceso(text) from public, anon, authenticated;
