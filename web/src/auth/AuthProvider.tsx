import type { Session } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'

type Estado = {
  cargando: boolean
  sesion: Session | null
  /** null mientras se verifica. */
  esMiembro: boolean | null
  ingresar: (correo: string, clave: string) => Promise<void>
  salir: () => Promise<void>
}

const Ctx = createContext<Estado | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const [sesion, setSesion] = useState<Session | null>(null)
  const [cargando, setCargando] = useState(true)
  const [esMiembro, setEsMiembro] = useState<boolean | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSesion(data.session)
      setCargando(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_evento, s) => {
      setSesion(s)
      if (!s) qc.clear()
    })
    return () => data.subscription.unsubscribe()
  }, [qc])

  const userId = sesion?.user.id
  useEffect(() => {
    if (!userId) { setEsMiembro(null); return }
    let vigente = true
    // Si ya se verificó antes en este dispositivo, entra de inmediato y se revalida en segundo plano.
    // (Es solo comodidad visual: la seguridad real la aplica la base de datos en cada consulta.)
    const clave = `miembro:${userId}`
    setEsMiembro(localStorage.getItem(clave) === '1' ? true : null)
    supabase.rpc('es_miembro').then(({ data, error }) => {
      if (!vigente) return
      if (error) {
        // Sin conexión: se mantiene lo último conocido.
        if (localStorage.getItem(clave) !== '1') setEsMiembro(false)
        return
      }
      if (data === true) localStorage.setItem(clave, '1')
      else localStorage.removeItem(clave)
      setEsMiembro(data === true)
    })
    return () => { vigente = false }
  }, [userId])

  const valor: Estado = {
    cargando,
    sesion,
    esMiembro,
    ingresar: async (correo, clave) => {
      const { error } = await supabase.auth.signInWithPassword({ email: correo.trim(), password: clave })
      if (error) throw error
    },
    salir: async () => {
      await supabase.auth.signOut()
      qc.clear()
    },
  }
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

export function useAuth() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useAuth fuera de AuthProvider')
  return c
}
