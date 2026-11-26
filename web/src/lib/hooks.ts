import { useSyncExternalStore } from 'react'

export function useMediaQuery(consulta: string) {
  return useSyncExternalStore(
    (avisar) => {
      const m = matchMedia(consulta)
      m.addEventListener('change', avisar)
      return () => m.removeEventListener('change', avisar)
    },
    () => matchMedia(consulta).matches,
    () => false,
  )
}
