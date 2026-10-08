import assert from 'node:assert/strict'
import { test } from 'node:test'
import { etiquetaDeSeccion, parse } from '../src/lib/chordpro.ts'
import { acordesDelTono, deAcordesArriba, esLineaDeAcordes, insertarEn, insertarParte } from '../src/lib/escritura.ts'

test('acordes encima de la letra pasan a ChordPro, en la sílaba correcta', () => {
  const t = deAcordesArriba('D        G\nAbre las puertas\n')
  assert.equal(t, '[D]Abre las [G]puertas')
})

test('conserva partes, líneas instrumentales y acordes pasados del final', () => {
  const t = deAcordesArriba('CORO:\nG   D\nSanto\n\nD  A  G\n\nVerso 2\nEm\nHola mundo')
  assert.equal(t, '[Coro]\n[G]Sant[D]o\n\n[D] [A] [G]\n\n[Verso 2]\n[Em]Hola mundo')
  assert.equal(deAcordesArriba('G         D\nSanto'), '[G]Santo[D]')
})

test('una línea de letra normal no se toma por acordes', () => {
  assert.equal(esLineaDeAcordes('Amor eterno'), false)
  assert.equal(esLineaDeAcordes('G  D/F#  Em7  Cadd9'), true)
  assert.equal(deAcordesArriba('Dios es bueno\nsiempre'), 'Dios es bueno\nsiempre')
})

test('nombres de parte escritos a mano se entienden', () => {
  assert.equal(etiquetaDeSeccion('CORO:'), 'Coro')
  assert.equal(etiquetaDeSeccion('verso 2'), 'Verso 2')
  assert.equal(etiquetaDeSeccion('[Pre-coro]'), 'Pre-coro')
  assert.equal(etiquetaDeSeccion('Coro del Rey'), null)
  const s = parse('Coro:\n[G]Santo es\n\nVerso 1\nHola')
  assert.deepEqual(s.map((x) => x.etiqueta), ['Coro', 'Verso 1'])
  assert.equal(s[0]!.tipo, 'coro')
})

test('acordes que más se usan en cada tono', () => {
  assert.deepEqual(acordesDelTono('G'), ['G', 'Am', 'Bm', 'C', 'D', 'Em'])
  assert.deepEqual(acordesDelTono('C'), ['C', 'Dm', 'Em', 'F', 'G', 'Am'])
  assert.deepEqual(acordesDelTono('F'), ['F', 'Gm', 'Am', 'Bb', 'C', 'Dm'])
  assert.deepEqual(acordesDelTono('Am').slice(0, 4), ['Am', 'C', 'Dm', 'E'])
  assert.deepEqual(acordesDelTono(''), [])
})

test('insertar acorde y parte donde está el cursor', () => {
  assert.deepEqual(insertarEn('Abre las puertas', 9, 9, '[G]'), { texto: 'Abre las [G]puertas', cursor: 12 })
  assert.deepEqual(insertarParte('', 0, 'Verso'), { texto: '[Verso]\n', cursor: 8 })
  const e = insertarParte('Primera línea', 13, 'Coro')
  assert.equal(e.texto, 'Primera línea\n\n[Coro]\n')
  assert.equal(insertarParte('Uno\n\nDos', 5, 'Coro').texto, 'Uno\n\n[Coro]\nDos')
})
