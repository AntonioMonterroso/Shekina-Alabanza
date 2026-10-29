import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'

const memoria = new Map<string, string>()
;(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => memoria.get(k) ?? null, setItem: (k: string, v: string) => void memoria.set(k, v),
  removeItem: (k: string) => void memoria.delete(k), clear: () => memoria.clear(), key: () => null, length: 0,
}
const { anotarRespaldo, hayQueRespaldar, ultimoRespaldo } = await import('../src/lib/respaldo.ts')
const DIA = 86_400_000
beforeEach(() => memoria.clear())

test('la primera vez no molesta y durante la primera semana tampoco', () => {
  const t0 = Date.parse('2026-10-01T12:00:00Z')
  assert.equal(hayQueRespaldar(t0), false)
  assert.equal(hayQueRespaldar(t0 + 6 * DIA), false)
})

test('pasada la semana, si nunca descargó, recuerda', () => {
  const t0 = Date.parse('2026-10-01T12:00:00Z')
  hayQueRespaldar(t0)
  assert.equal(hayQueRespaldar(t0 + 8 * DIA), true)
})

test('después de descargar una copia, no vuelve a molestar hasta pasados 30 días', () => {
  const t0 = Date.parse('2026-10-01T12:00:00Z')
  hayQueRespaldar(t0)
  const ahora = t0 + 20 * DIA
  memoria.set('shekina.respaldo.ultimo', new Date(ahora).toISOString())
  assert.equal(hayQueRespaldar(ahora + 10 * DIA), false)
  assert.equal(hayQueRespaldar(ahora + 31 * DIA), true)
})

test('anotarRespaldo guarda la fecha', () => {
  assert.equal(ultimoRespaldo(), null)
  anotarRespaldo()
  assert.ok(Date.parse(ultimoRespaldo()!) <= Date.now())
})
