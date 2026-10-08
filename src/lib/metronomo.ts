// Metrónomo con Web Audio. Los golpes se programan unos milisegundos antes con el reloj del audio
// (no con setTimeout), por eso no se atrasa ni se acelera aunque el teléfono esté ocupado.

export interface Golpe { tiempo: number; compas: number }
export interface EstadoGolpes { siguiente: number; paso: number }

export const BPM_MIN = 30
export const BPM_MAX = 240
export const limitarBpm = (n: number) => Math.max(BPM_MIN, Math.min(BPM_MAX, Math.round(n)))

/** Golpes que hay que programar hasta `hasta` (en segundos del reloj de audio). El primero de cada compás es el acento. */
export function planificar(estado: EstadoGolpes, hasta: number, bpm: number, tiempos: number): { golpes: Golpe[]; estado: EstadoGolpes } {
  const golpes: Golpe[] = []
  let { siguiente, paso } = estado
  const intervalo = 60 / bpm
  while (siguiente < hasta) {
    golpes.push({ tiempo: siguiente, compas: paso % tiempos })
    siguiente += intervalo
    paso += 1
  }
  return { golpes, estado: { siguiente, paso } }
}

/** BPM a partir de toques seguidos (en ms). Si pasan más de 2 s entre toques, se empieza de nuevo. Null si faltan toques. */
export function bpmPorToques(toques: number[]): number | null {
  const ultimos: number[] = []
  for (let i = toques.length - 1; i >= 0; i--) {
    if (ultimos.length && ultimos[0]! - toques[i]! > 2000) break
    ultimos.unshift(toques[i]!)
  }
  const t = ultimos.slice(-5)
  if (t.length < 3) return null
  const media = (t[t.length - 1]! - t[0]!) / (t.length - 1)
  return limitarBpm(60000 / media)
}

const ANTICIPO = 0.12 // segundos que se programan por adelantado
const CADA_MS = 25

export class Metronomo {
  private ctx: AudioContext | null = null
  private reloj: ReturnType<typeof setInterval> | null = null
  private estado: EstadoGolpes = { siguiente: 0, paso: 0 }
  bpm = 80
  tiempos = 4
  /** Se llama (aprox. en el momento del golpe) con el número de golpe dentro del compás, empezando en 0. */
  alGolpe: ((compas: number) => void) | null = null

  get sonando() { return this.reloj !== null }

  async iniciar() {
    if (this.reloj) return
    this.ctx ??= new AudioContext()
    await this.ctx.resume() // en iPhone solo se permite desde un toque del usuario
    this.estado = { siguiente: this.ctx.currentTime + 0.05, paso: 0 }
    this.reloj = setInterval(() => this.programar(), CADA_MS)
    this.programar()
  }

  detener() {
    if (this.reloj) clearInterval(this.reloj)
    this.reloj = null
  }

  cerrar() {
    this.detener()
    void this.ctx?.close()
    this.ctx = null
  }

  private programar() {
    const ctx = this.ctx
    if (!ctx) return
    const { golpes, estado } = planificar(this.estado, ctx.currentTime + ANTICIPO, this.bpm, this.tiempos)
    this.estado = estado
    for (const g of golpes) {
      const osc = ctx.createOscillator()
      const vol = ctx.createGain()
      osc.frequency.value = g.compas === 0 ? 1200 : 800
      vol.gain.setValueAtTime(0.0001, g.tiempo)
      vol.gain.exponentialRampToValueAtTime(g.compas === 0 ? 0.9 : 0.55, g.tiempo + 0.002)
      vol.gain.exponentialRampToValueAtTime(0.0001, g.tiempo + 0.06)
      osc.connect(vol).connect(ctx.destination)
      osc.start(g.tiempo)
      osc.stop(g.tiempo + 0.07)
      const espera = Math.max(0, (g.tiempo - ctx.currentTime) * 1000)
      setTimeout(() => this.alGolpe?.(g.compas), espera)
    }
  }
}
