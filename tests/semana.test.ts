import assert from 'node:assert/strict'
import { test } from 'node:test'
import { diasDeSemana, lunesDe, sumarDias } from '../src/lib/semana.ts'

test('el lunes de cualquier día de la semana', () => {
  // 12 oct 2026 es lunes
  for (const d of ['2026-10-12', '2026-10-14', '2026-10-18']) assert.equal(lunesDe(d), '2026-10-12')
  assert.equal(lunesDe('2026-10-19'), '2026-10-19')
  assert.equal(lunesDe('2026-10-11'), '2026-10-05') // el domingo cuenta para la semana anterior
})

test('sumar días cruza el fin de mes y de año', () => {
  assert.equal(sumarDias('2026-10-30', 3), '2026-11-02')
  assert.equal(sumarDias('2026-12-30', 3), '2027-01-02')
  assert.equal(sumarDias('2026-03-01', -1), '2026-02-28')
})

test('los siete días de la semana', () => {
  const d = diasDeSemana('2026-12-28')
  assert.equal(d.length, 7)
  assert.equal(d[0], '2026-12-28')
  assert.equal(d[6], '2027-01-03')
})
