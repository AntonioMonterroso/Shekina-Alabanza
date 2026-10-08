import assert from 'node:assert/strict'
import { test } from 'node:test'
import { bpmPorToques, limitarBpm, planificar } from '../src/lib/metronomo.ts'

test('programa los golpes que caen dentro de la ventana, con acento al inicio del compás', () => {
  // 120 BPM = un golpe cada 0.5 s
  const r = planificar({ siguiente: 10, paso: 0 }, 11.2, 120, 4)
  assert.deepEqual(r.golpes.map((g) => g.tiempo), [10, 10.5, 11])
  assert.deepEqual(r.golpes.map((g) => g.compas), [0, 1, 2])
  assert.deepEqual(r.estado, { siguiente: 11.5, paso: 3 })
})

test('sigue donde se quedó y el compás da la vuelta', () => {
  const a = planificar({ siguiente: 0, paso: 0 }, 1.6, 60, 3)
  assert.deepEqual(a.golpes.map((g) => g.compas), [0, 1])
  const b = planificar(a.estado, 4.1, 60, 3)
  assert.deepEqual(b.golpes.map((g) => g.compas), [2, 0, 1, 2].slice(0, b.golpes.length))
  assert.equal(b.estado.paso, 5)
})

test('si la ventana no alcanza el siguiente golpe, no programa nada', () => {
  const r = planificar({ siguiente: 5, paso: 2 }, 4.9, 90, 4)
  assert.equal(r.golpes.length, 0)
  assert.deepEqual(r.estado, { siguiente: 5, paso: 2 })
})

test('los BPM se mantienen entre 30 y 240', () => {
  assert.equal(limitarBpm(10), 30)
  assert.equal(limitarBpm(999), 240)
  assert.equal(limitarBpm(92.4), 92)
})

test('tempo por toques: promedia, ignora toques viejos y pide al menos tres', () => {
  assert.equal(bpmPorToques([0, 500]), null)
  assert.equal(bpmPorToques([0, 500, 1000, 1500]), 120)
  assert.equal(bpmPorToques([0, 600, 1200]), 100)
  // una pausa larga reinicia la cuenta: solo cuentan los 3 últimos toques
  assert.equal(bpmPorToques([0, 100, 10_000, 10_500, 11_000]), 120)
})
