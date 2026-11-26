import type { Producto } from '@/lib/types'
import { hoyGT } from '@/lib/utils'

/** Arma un ZIP con las fotos de los productos indicados (nombre = código y modelo). */
export async function descargarFotos(productos: Producto[], progreso: (hechas: number, total: number) => void) {
  const conFoto = productos.filter((p) => p.imagen_url)
  if (!conFoto.length) throw new Error('Estos productos no tienen fotos')
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  let hechas = 0
  let ok = 0
  const cola = [...conFoto]
  // Descarga 6 a la vez para que sea rápido sin saturar la conexión.
  await Promise.all(Array.from({ length: 6 }, async () => {
    for (let p = cola.shift(); p; p = cola.shift()) {
      try {
        const r = await fetch(p.imagen_url!)
        if (r.ok) {
          const blob = await r.blob()
          const ext = (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg')
          const nombre = `${p.codigo} ${p.nombre}`.replace(/[\\/:*?"<>|]/g, '').trim()
          zip.file(`${nombre}.${ext}`, blob)
          ok++
        }
      } catch { /* se omite la foto que falle */ }
      progreso(++hechas, conFoto.length)
    }
  }))
  const contenido = await zip.generateAsync({ type: 'blob' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(contenido)
  a.download = `fotos-zapatongt-${hoyGT()}.zip`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
  return ok
}
