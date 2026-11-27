/**
 * Lee mensajes de WhatsApp con datos de clientes (nombre, teléfono, dirección)
 * escritos de formas distintas, sin usar IA externa: solo reglas.
 */

export type ClienteLeido = {
  nombre: string
  telefono: string
  direccion: string
  notas: string
  /** Texto original del mensaje, para revisar. */
  original: string
}

// Encabezado que agrega WhatsApp al copiar: "[6:59 PM, 11/26/2026] Josue Cruz 😎: "
const ENCABEZADO = /^\s*\[\d{1,2}:\d{2}(?:\s?[ap]\.?\s?m\.?)?,\s*\d{1,2}\/\d{1,2}\/\d{2,4}\]\s*[^:]{1,60}:\s?/im
const ENCABEZADO_G = new RegExp(ENCABEZADO.source, 'gim')

const DIAS = /^(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\b[\s.:!]*$/i
const PAGADO = /^(pagad[oa]s?|cancelad[oa]s?|ya pag[oó]|pago completo)\b[\s.!]*$/i
const DEPARTAMENTAL = /^(departamentales?|env[ií]o departamental|por forza|forza|cargo expreso|guatex)\b[\s.:!]*$/i
const MONTO = /\bQ\s?\d/i
const PALABRAS_DIRECCION = /\b(calle|avenida|av\.?|ave\.?|zona|z\.|colonia|col\.|lote|casa|aldea|km|kil[oó]metro|sector|residencial|res\.|municipio|departamento|barrio|cant[oó]n|entrada|frente|esquina|condominio|apartamento|apto|edificio|local|centro comercial|carretera|interior|manzana|mz|lt|caser[ií]o|villa|finca|parcelamiento|iglesia|vuelta|calzada|boulevard|blvd|diagonal|callej[oó]n|pasaje|nivel|torre|bodega|mercado|terminal|dep[oó]sito|f[aá]brica|cerca|atr[aá]s|detr[aá]s|a la par|despu[eé]s|antes|ciudad|guatemala|mixco|villa nueva|amatitl[aá]n|antigua|xela|quetzaltenango|cob[aá]n|solol[aá]|pet[eé]n|escuintla|chimaltenango|sacatep[eé]quez|totonicap[aá]n|huehuetenango|retalhuleu|jutiapa|jalapa|zacapa|chiquimula|izabal|baja verapaz|alta verapaz|quich[eé]|san marcos|santa rosa|suchitep[eé]quez|el progreso)\b/i

const ETQ_NOMBRE = /^\s*(nombre(?:\s+y\s+apellidos?)?(?:\s+completo)?|cliente|recibe|para)\s*[:\-–]\s*/i
const ETQ_TEL = /^\s*(tel(?:[eé]fono)?\.?|cel(?:ular)?\.?|n[uú]mero|whats?app|contacto|tel\/cel)\s*[:\-–.]?\s*/i
const ETQ_DIR = /^\s*(direcci[oó]n(?:\s+exacta)?(?:\s+de\s+entrega)?|dir\.?|entregar en|domicilio)\s*[:\-–]\s*/i

// 8 dígitos de Guatemala, con o sin +502, con espacios o guiones: 5282-0002, 3040 3194, +502 52820002
const TELEFONO = /(?:\+?\s?502[\s-]?)?(?<!\d)([2-7]\d{3})[\s.-]?(\d{4})(?!\d)/

const limpiar = (s: string) => s.replace(/[⭐️✨✅☑️👟❤️💕🙏🏻😊😎📍📞☎️🏠]/gu, '').replace(/\s+/g, ' ').trim()

function pareceNombre(linea: string) {
  const l = limpiar(linea)
  if (!l || /\d/.test(l) || l.length > 60) return false
  if (PALABRAS_DIRECCION.test(l) || DIAS.test(l) || PAGADO.test(l) || DEPARTAMENTAL.test(l)) return false
  const palabras = l.split(' ')
  return palabras.length >= 1 && palabras.length <= 6 && palabras.every((p) => /^[\p{L}'.]+$/u.test(p))
}

export function nombrePropio(s: string) {
  return limpiar(s).toLowerCase().replace(/(^|\s)(\p{L})/gu, (_, a, b) => a + b.toUpperCase())
}

/** Separa un texto pegado en mensajes (si viene con encabezados de WhatsApp). */
export function separarMensajes(texto: string): string[] {
  const t = texto.replace(/\r/g, '')
  if (!ENCABEZADO.test(t)) {
    // Sin encabezados: un mensaje. (Si pegan varios separados por "---", también se respeta.)
    return t.split(/\n\s*-{3,}\s*\n/).map((x) => x.trim()).filter(Boolean)
  }
  return t.split(ENCABEZADO_G).map((x) => x.trim()).filter(Boolean)
}

export function leerCliente(mensaje: string): ClienteLeido {
  const original = mensaje.replace(ENCABEZADO_G, '').trim()
  const lineas = original.split('\n').map((l) => l.trim()).filter(Boolean)
  let nombre = ''
  let telefono = ''
  const direccion: string[] = []
  const notas: string[] = []

  const pendientes: string[] = []
  for (const bruta of lineas) {
    let linea = limpiar(bruta)
    if (!linea) continue

    // Notas: día de entrega, montos, pagado, envío departamental
    if (DIAS.test(linea)) { notas.push(`Entrega: ${nombrePropio(linea.replace(/[.:!]/g, ''))}`); continue }
    if (PAGADO.test(linea)) { notas.push('Pagado'); continue }
    if (DEPARTAMENTAL.test(linea)) { notas.push('Envío departamental'); continue }
    if (MONTO.test(linea) && !PALABRAS_DIRECCION.test(linea)) { notas.push(linea); continue }

    // Etiquetas explícitas
    if (ETQ_NOMBRE.test(linea)) { nombre ||= linea.replace(ETQ_NOMBRE, ''); continue }
    if (ETQ_DIR.test(linea)) { direccion.push(linea.replace(ETQ_DIR, '')); continue }

    // Teléfono (puede venir solo, con etiqueta o dentro de otra línea)
    const m = linea.match(TELEFONO)
    if (m && !telefono) {
      telefono = m[1] + m[2]
      linea = limpiar(linea.replace(m[0], ' ').replace(ETQ_TEL, '').replace(/\b(tel(?:[eé]fono)?|cel(?:ular)?|whats?app)\b[:.]?/gi, ''))
      if (!linea || /^[\s:.\-–,]*$/.test(linea)) continue
    }
    pendientes.push(linea)
  }

  // Nombre: primera línea que parezca nombre (si no venía con etiqueta)
  if (!nombre) {
    const i = pendientes.findIndex(pareceNombre)
    if (i >= 0) nombre = pendientes.splice(i, 1)[0]
  }
  direccion.push(...pendientes)

  return {
    nombre: nombre ? nombrePropio(nombre) : '',
    telefono,
    direccion: direccion.map(limpiar).filter(Boolean).join(', ').replace(/\s+,/g, ',').replace(/,{2,}/g, ','),
    notas: notas.join(' · '),
    original,
  }
}

export function leerClientes(texto: string): ClienteLeido[] {
  return separarMensajes(texto).map(leerCliente).filter((c) => c.nombre || c.telefono || c.direccion)
}
