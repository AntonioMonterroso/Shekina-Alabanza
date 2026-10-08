import assert from 'node:assert/strict'
import { test } from 'node:test'
import { estadoNiveles, nivelActual, ultimoCompletado } from '../src/lib/camino.ts'

const niveles = [{ id: 'c', orden: 3 }, { id: 'a', orden: 1 }, { id: 'b', orden: 2 }]

test('sin completar nada, el primero es el actual', () => {
  const e = estadoNiveles(niveles, new Set())
  assert.deepEqual([e.get('a'), e.get('b'), e.get('c')], ['actual', 'pendiente', 'pendiente'])
  assert.equal(nivelActual(niveles, new Set())?.id, 'a')
})

test('avanza al completar y termina cuando están todos', () => {
  assert.equal(nivelActual(niveles, new Set(['a']))?.id, 'b')
  const e = estadoNiveles(niveles, new Set(['a', 'b']))
  assert.deepEqual([e.get('a'), e.get('b'), e.get('c')], ['hecho', 'hecho', 'actual'])
  assert.equal(nivelActual(niveles, new Set(['a', 'b', 'c'])), null)
})

test('un nivel saltado sigue siendo el actual', () => {
  assert.equal(nivelActual(niveles, new Set(['b']))?.id, 'a')
})

test('el último completado sirve para deshacer', () => {
  assert.equal(ultimoCompletado(niveles, new Set(['a', 'b']))?.id, 'b')
  assert.equal(ultimoCompletado(niveles, new Set()), null)
  assert.equal(nivelActual([], new Set()), null)
})
