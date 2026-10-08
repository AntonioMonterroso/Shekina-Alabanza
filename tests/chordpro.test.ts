import assert from 'node:assert/strict'
import { test } from 'node:test'
import { distancia, esAcorde, parse, parseLinea, quitarAcordes, transponerAcorde, transponerTono, usaBemoles } from '../src/lib/chordpro.ts'

test('reconoce acordes y rechaza etiquetas', () => {
  for (const a of ['C', 'D#', 'Bb', 'Am', 'F#m7', 'Bbmaj7', 'Dsus4', 'Gadd9', 'C/E', 'A/C#', 'Em7b5', 'D2'])
    assert.equal(esAcorde(a), true, a)
  for (const a of ['Coro', 'Final', 'Verso 1', 'Puente', 'Intro', 'Bridge', 'H', 'x'])
    assert.equal(esAcorde(a), false, a)
})

test('parseLinea separa acordes y texto', () => {
  assert.deepEqual(parseLinea('[D]Abre las [G]puertas'), [
    { acorde: 'D', texto: 'Abre las ' },
    { acorde: 'G', texto: 'puertas' },
  ])
  assert.deepEqual(parseLinea('Sin acordes'), [{ acorde: null, texto: 'Sin acordes' }])
  assert.deepEqual(parseLinea('Antes [Am]después'), [
    { acorde: null, texto: 'Antes ' },
    { acorde: 'Am', texto: 'después' },
  ])
  assert.deepEqual(parseLinea('[D] [G]'), [{ acorde: 'D', texto: ' ' }, { acorde: 'G', texto: '' }])
})

test('parse arma secciones con [Etiqueta], directivas y párrafos', () => {
  const s = parse('[Verso 1]\n[D]Uno\n[G]Dos\n\n[Coro]\n[A]Tres\n\n{start_of_chorus}\nCuatro\n{end_of_chorus}\n\nSuelta\n{title: X}')
  assert.deepEqual(s.map((x) => [x.etiqueta, x.tipo, x.lineas.length]), [
    ['Verso 1', 'verso', 2], ['Coro', 'coro', 1], ['Coro', 'coro', 1], [null, 'verso', 1],
  ])
})

test('quitarAcordes deja las etiquetas', () => {
  assert.equal(quitarAcordes('[Coro]\n[D]Abre [G/B]hoy [Bbmaj7]ya'), '[Coro]\nAbre hoy ya')
})

test('transposición de acordes', () => {
  assert.equal(transponerAcorde('D', 2), 'E')
  assert.equal(transponerAcorde('D', 3), 'F')
  assert.equal(transponerAcorde('G/B', 2), 'A/C#')
  assert.equal(transponerAcorde('F#m7', 1), 'Gm7')
  assert.equal(transponerAcorde('Bbmaj7', 2, true), 'Cmaj7')
  assert.equal(transponerAcorde('C', -1), 'B')
  assert.equal(transponerAcorde('C', 12), 'C')
  assert.equal(transponerAcorde('C', 1, true), 'Db')
  assert.equal(transponerAcorde('C', 1, false), 'C#')
  assert.equal(transponerAcorde('D', 0), 'D')
})

test('tonos con bemoles o sostenidos según convenga', () => {
  assert.equal(transponerTono('D', 3), 'F')
  assert.equal(transponerTono('G', 3), 'Bb')
  assert.equal(transponerTono('C', 6), 'F#')
  assert.equal(transponerTono('Am', 3), 'Cm')
  assert.equal(usaBemoles('Bb'), true)
  assert.equal(usaBemoles('E'), false)
})

test('distancia entre tonos', () => {
  assert.equal(distancia('D', 'F'), 3)
  assert.equal(distancia('F', 'D'), 9)
  assert.equal(distancia('G', 'Bb'), 3)
  assert.equal(distancia('C', 'C'), 0)
})
