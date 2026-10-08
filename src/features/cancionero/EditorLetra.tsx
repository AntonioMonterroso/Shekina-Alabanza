import { useRef, useState } from 'react'
import Hoja from '../../components/Hoja'
import Icon from '../../components/Icon'
import { esAcorde } from '../../lib/chordpro'
import { acordesDelTono, deAcordesArriba, insertarEn, insertarParte, PARTES, type Edicion } from '../../lib/escritura'

interface Props {
  valor: string
  tono: string
  onCambio: (texto: string) => void
}

const EJEMPLO_PEGAR = `Verso 1
D          G
Abre las puertas, Señor
Em         A
Entra en este lugar`

// Los botones no le quitan el foco al cuadro de texto, para que el cursor siga donde estaba
const sinFoco = { onPointerDown: (e: React.PointerEvent) => e.preventDefault() }

export default function EditorLetra({ valor, tono, onCambio }: Props) {
  const area = useRef<HTMLTextAreaElement>(null)
  const [pegar, setPegar] = useState(false)
  const [origen, setOrigen] = useState('')
  const [otro, setOtro] = useState('')
  const [ayuda, setAyuda] = useState(false)
  const acordes = acordesDelTono(tono)

  function aplicar(fn: (ini: number, fin: number) => Edicion) {
    const a = area.current
    const e = fn(a?.selectionStart ?? valor.length, a?.selectionEnd ?? valor.length)
    onCambio(e.texto)
    requestAnimationFrame(() => { a?.focus(); a?.setSelectionRange(e.cursor, e.cursor) })
  }
  const poner = (acorde: string) => aplicar((i, f) => insertarEn(valor, i, f, `[${acorde}]`))
  const parte = (nombre: string) => aplicar((i) => insertarParte(valor, i, nombre))

  function ponerOtro() {
    const a = otro.trim()
    if (!esAcorde(a)) return
    poner(a)
    setOtro('')
  }

  const convertido = deAcordesArriba(origen)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end justify-between px-1">
        <label htmlFor="letra" className="text-[15px] font-extrabold">Letra y acordes</label>
        <button type="button" className="undo" style={{ height: 32, padding: '0 8px' }} aria-expanded={ayuda} onClick={() => setAyuda(!ayuda)}>¿Cómo se escribe?</button>
      </div>

      {ayuda && (
        <ol className="m-0 flex flex-col gap-1.5 rounded-2xl p-3.5 pl-8 text-[14px] leading-snug" style={{ background: 'var(--soft)' }}>
          <li>Escribe la letra normal, una línea por frase.</li>
          <li>Toca el botón de la parte (<b>Verso</b>, <b>Coro</b>…) donde empieza cada una.</li>
          <li>Pon el cursor justo antes de la sílaba donde cambia el acorde y toca el acorde.</li>
          <li>¿Ya la tienes en otra página con los acordes encima? Usa <b>Pegar de otra página</b> y se convierte sola.</li>
        </ol>
      )}

      <div className="scrollx" role="toolbar" aria-label="Partes de la canción">
        {PARTES.map((p) => <button key={p} type="button" className="more" {...sinFoco} onClick={() => parte(p)}>{p}</button>)}
      </div>

      <div className="flex flex-col gap-1.5" role="group" aria-label="Acordes">
        <span className="px-1 text-[13px] font-bold" style={{ color: 'var(--muted)' }}>
          {acordes.length ? `Acordes en ${tono} (se ponen donde está el cursor)` : 'Elige el tono de la canción arriba para ver sus acordes. También puedes escribir uno:'}
        </span>
        <div className="scrollx">
          {acordes.map((a) => <button key={a} type="button" className="more !min-w-[52px] justify-center" {...sinFoco} onClick={() => poner(a)}>{a}</button>)}
          <span className="flex shrink-0 items-center gap-1.5">
            <input aria-label="Otro acorde" placeholder="Otro" value={otro} maxLength={8} autoCapitalize="characters" autoCorrect="off"
              onChange={(e) => setOtro(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); ponerOtro() } }}
              className="h-11 w-[84px] rounded-[14px] border-[1.5px] px-3 text-center text-[15px] font-bold outline-none" style={{ borderColor: otro && !esAcorde(otro.trim()) ? 'var(--danger)' : 'var(--line)', background: 'var(--surface)', color: 'var(--ink)' }} />
            <button type="button" className="more" {...sinFoco} disabled={!esAcorde(otro.trim())} onClick={ponerOtro} aria-label="Insertar este acorde"><Icon name="mas" size={16} strokeWidth={2.4} /></button>
          </span>
        </div>
      </div>

      <textarea id="letra" ref={area} className="letra-editor" rows={14} spellCheck={false} value={valor} onChange={(e) => onCambio(e.target.value)}
        placeholder={'Abre las puertas, Señor\nEntra en este lugar'} />

      <button type="button" className="ghost-link" onClick={() => setPegar(true)}><Icon name="editar" size={18} strokeWidth={2} />Pegar de otra página (acordes encima)</button>
      <p className="m-0 px-1 text-[13px]" style={{ color: 'var(--muted)' }}>Los acordes quedan entre corchetes antes de la sílaba: <code>[D]Abre las [G]puertas</code>. Una línea vacía separa las estrofas.</p>

      <Hoja titulo="Pegar de otra página" abierta={pegar} onCerrar={() => setPegar(false)}>
        <h2 className="display m-0 mx-1 text-2xl font-semibold">Pegar de otra página</h2>
        <p className="m-0 mx-1 text-[15px]" style={{ color: 'var(--muted)' }}>Copia la canción con los acordes encima de la letra y pégala aquí. La app los coloca en su lugar.</p>
        <textarea className="letra-editor" rows={7} spellCheck={false} value={origen} onChange={(e) => setOrigen(e.target.value)} placeholder={EJEMPLO_PEGAR} aria-label="Letra con acordes encima" />
        {origen.trim() && (
          <>
            <span className="px-1 text-sm font-extrabold">Así quedará:</span>
            <pre className="m-0 max-h-[24dvh] overflow-auto rounded-2xl p-3 text-[13px] leading-snug whitespace-pre-wrap" style={{ background: 'var(--soft)' }}>{convertido}</pre>
          </>
        )}
        <button type="button" className="cta" disabled={!origen.trim()} onClick={() => { onCambio(valor.trim() ? `${valor.trimEnd()}\n\n${convertido}` : convertido); setOrigen(''); setPegar(false) }}>
          {valor.trim() ? 'Agregar al final de la letra' : 'Usar esta letra'}
        </button>
      </Hoja>
    </div>
  )
}
