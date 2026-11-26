import { createClient } from '@supabase/supabase-js'

// Valores públicos por diseño (la seguridad la dan las reglas RLS de la base).
// Se pueden reemplazar con variables de entorno en Netlify.
const url = import.meta.env.VITE_SUPABASE_URL ?? 'https://pmdnbjorfimihsyxmfzh.supabase.co'
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_iEmlKYIF5_gEpacomrr-hA_Loc-g6Uy'

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

export const BUCKET_FOTOS = 'zapatongt-imagenes'
