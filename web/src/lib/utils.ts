import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const ZONA = 'America/Guatemala'

const moneda = new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ', minimumFractionDigits: 2 })
const monedaCorta = new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ', maximumFractionDigits: 0 })
const numero = new Intl.NumberFormat('es-GT')

export const q = (n: number | null | undefined) => moneda.format(Number(n ?? 0))
export const qCorto = (n: number | null | undefined) => monedaCorta.format(Number(n ?? 0))
export const num = (n: number | null | undefined) => numero.format(Number(n ?? 0))
export const talla = (t: number) => (Number.isInteger(t) ? String(t) : t.toFixed(1))

const fFecha = new Intl.DateTimeFormat('es-GT', { timeZone: ZONA, day: 'numeric', month: 'short', year: 'numeric' })
const fFechaHora = new Intl.DateTimeFormat('es-GT', {
  timeZone: ZONA, day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
})
const fMes = new Intl.DateTimeFormat('es-GT', { timeZone: 'UTC', month: 'long', year: 'numeric' })
const fMesCorto = new Intl.DateTimeFormat('es-GT', { timeZone: 'UTC', month: 'short' })

export const fecha = (iso: string) => fFecha.format(new Date(iso))
export const fechaHora = (iso: string) => fFechaHora.format(new Date(iso))
/** Para valores tipo "2026-07-01" (fecha sin hora). */
export const mesLargo = (d: string) => capitalizar(fMes.format(new Date(`${d}T00:00:00Z`)))
export const mesCorto = (d: string) => capitalizar(fMesCorto.format(new Date(`${d}T00:00:00Z`)).replace('.', ''))

export const capitalizar = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** Fecha de hoy en Guatemala como "AAAA-MM-DD". */
export function hoyGT(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(new Date())
}

/** Convierte "AAAA-MM-DD" (día en Guatemala) a ISO del inicio del día (UTC-6, sin horario de verano). */
export const inicioDiaGT = (d: string) => `${d}T00:00:00-06:00`

export function sumarDias(d: string, dias: number): string {
  const f = new Date(`${d}T12:00:00Z`)
  f.setUTCDate(f.getUTCDate() + dias)
  return f.toISOString().slice(0, 10)
}

export function sumarMeses(mes: string, n: number): string {
  // mes: "AAAA-MM"
  const [a, m] = mes.split('-').map(Number)
  const f = new Date(Date.UTC(a, m - 1 + n, 1))
  return f.toISOString().slice(0, 7)
}

/** Fecha seleccionada (día GT) + hora actual → ISO, para registrar ventas atrasadas con hora real. */
export function fechaVentaISO(dia: string): string {
  if (dia === hoyGT()) return new Date().toISOString()
  const ahora = new Intl.DateTimeFormat('en-GB', { timeZone: ZONA, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date())
  return new Date(`${dia}T${ahora}-06:00`).toISOString()
}

export function diaGT(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(new Date(iso))
}

export function normalizar(s: string) {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()
}

export function telefonoBonito(t: string | null) {
  if (!t) return ''
  const d = t.replace(/\D/g, '')
  return d.length === 8 ? `${d.slice(0, 4)}-${d.slice(4)}` : t
}

export function enlaceWhatsApp(telefono: string | null, texto: string) {
  const d = (telefono ?? '').replace(/\D/g, '')
  const destino = d.length === 8 ? `502${d}` : d
  return `https://wa.me/${destino}?text=${encodeURIComponent(texto)}`
}

/** Traduce errores de Supabase/Postgres a mensajes entendibles. */
export function mensajeError(e: unknown): string {
  const err = e as { code?: string; message?: string; details?: string } | null
  const code = err?.code
  const msg = err?.message ?? String(e)
  if (code === '23505') {
    if (msg.includes('telefono')) return 'Ya existe un cliente con ese teléfono.'
    if (msg.includes('codigo')) return 'Ya existe un producto con ese código.'
    return msg.startsWith('Ya existe') ? msg : 'Ese registro ya existe.'
  }
  if (code === '23503') return 'No se puede eliminar porque tiene ventas registradas.'
  if (code === '42501') return 'Tu usuario no tiene permiso para esta acción.'
  if (msg.includes('Invalid login credentials')) return 'Correo o contraseña incorrectos.'
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) return 'Sin conexión. Revisa tu internet e intenta de nuevo.'
  return msg
}
