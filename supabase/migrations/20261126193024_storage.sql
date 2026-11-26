-- =====================================================================
-- ZAPATOS · Fotos: lectura pública (catálogo), escritura solo miembros.
-- Antes cualquiera, incluso sin sesión, podía subir archivos al bucket.
-- =====================================================================

drop policy if exists "Permitir subida pública zy8j8m_0" on storage.objects;

create policy "Miembros suben fotos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'zapatongt-imagenes' and (select public.es_miembro()));

create policy "Miembros reemplazan fotos" on storage.objects
  for update to authenticated
  using (bucket_id = 'zapatongt-imagenes' and (select public.es_miembro()))
  with check (bucket_id = 'zapatongt-imagenes' and (select public.es_miembro()));

create policy "Miembros borran fotos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'zapatongt-imagenes' and (select public.es_miembro()));
