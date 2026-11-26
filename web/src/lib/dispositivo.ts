/** iPhone / iPad (incluye iPad que se presenta como Mac). */
export function esIOS() {
  const ua = navigator.userAgent
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)
}

/** La app se abrió desde la pantalla de inicio (modo app). */
export function esInstalada() {
  return matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

/** ¿El teléfono puede compartir archivos con el menú nativo (Fotos, WhatsApp, etc.)? */
export function puedeCompartirArchivos() {
  try {
    const prueba = new File([new Blob(['x'], { type: 'image/jpeg' })], 'x.jpg', { type: 'image/jpeg' })
    return typeof navigator.canShare === 'function' && navigator.canShare({ files: [prueba] })
  } catch {
    return false
  }
}

/** Abre el menú de compartir del teléfono. Devuelve false si no hay o el usuario lo canceló. */
export async function compartir(datos: ShareData): Promise<boolean> {
  if (typeof navigator.share !== 'function') return false
  if (datos.files && !navigator.canShare?.(datos)) return false
  try {
    await navigator.share(datos)
    return true
  } catch {
    return false
  }
}

/** Descarga una foto y la convierte en archivo para compartir. */
export async function fotoComoArchivo(url: string, nombre: string): Promise<File | null> {
  try {
    const r = await fetch(url)
    if (!r.ok) return null
    const blob = await r.blob()
    const tipo = blob.type || 'image/jpeg'
    const ext = (tipo.split('/')[1] || 'jpg').replace('jpeg', 'jpg')
    return new File([blob], `${nombre.replace(/[\\/:*?"<>|]/g, '').trim()}.${ext}`, { type: tipo })
  } catch {
    return null
  }
}
