import type { Fase } from '../../lib/tipos'

export interface InfoFase {
  id: Fase
  nombre: string
  bg: string // color de la píldora
  fg: string
  barra: string // color en la barra de progreso
  pendientes: string[] // lista inicial de pendientes al entrar en la fase
}

export const FASES: InfoFase[] = [
  { id: 'nueva', nombre: 'Nueva', bg: 'var(--c-ambar-bg)', fg: 'var(--c-ambar-fg)', barra: 'var(--c-ambar-fg)', pendientes: ['Letra y acordes cargados', 'Tono elegido para quien dirige', 'Audio de referencia'] },
  { id: 'aprendiendo', nombre: 'Aprendiendo', bg: 'var(--c-lila-bg)', fg: 'var(--c-lila-fg)', barra: 'var(--c-lila-fg)', pendientes: ['Cada músico sabe su parte', 'Voces repartidas', 'Estructura definida'] },
  { id: 'ensayada', nombre: 'Ensayada', bg: 'var(--c-azul-bg)', fg: 'var(--c-azul-fg)', barra: 'var(--c-azul-fg)', pendientes: ['Ensayada con todo el grupo', 'Transiciones claras', 'Visto bueno del líder'] },
  { id: 'lista', nombre: 'Lista', bg: 'var(--primary)', fg: 'var(--on-primary)', barra: 'var(--primary)', pendientes: ['Disponible para servicios'] },
]

export const indiceFase = (f: Fase) => FASES.findIndex((x) => x.id === f)
export const infoFase = (f: Fase) => FASES[indiceFase(f)]!
