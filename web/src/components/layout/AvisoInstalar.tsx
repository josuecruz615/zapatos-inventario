import { Share, SquarePlus, X } from 'lucide-react'
import { useState } from 'react'
import { esIOS, esInstalada } from '@/lib/dispositivo'

/** En iPhone (Safari) explica cómo agregar la app a la pantalla de inicio. */
export function AvisoInstalar() {
  const [visible, setVisible] = useState(() => esIOS() && !esInstalada() && localStorage.getItem('aviso-instalar') !== 'no')
  if (!visible) return null
  const cerrar = () => { localStorage.setItem('aviso-instalar', 'no'); setVisible(false) }
  return (
    <div className="mx-4 mt-3 flex animate-in items-start gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm lg:hidden">
      <img src="/apple-touch-icon.png" alt="" className="size-10 rounded-xl" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold">Instálala en tu iPhone</p>
        <p className="text-muted-foreground">
          Toca <Share className="inline size-4 -translate-y-0.5 text-accent" aria-label="Compartir" /> y luego
          {' '}<span className="font-medium text-foreground">Agregar a inicio</span> <SquarePlus className="inline size-4 -translate-y-0.5" aria-hidden />.
          Se abrirá como una app, a pantalla completa.
        </p>
      </div>
      <button type="button" onClick={cerrar} aria-label="No mostrar de nuevo" className="grid size-8 cursor-pointer place-items-center rounded-lg text-muted-foreground hover:bg-muted">
        <X className="size-4" />
      </button>
    </div>
  )
}
