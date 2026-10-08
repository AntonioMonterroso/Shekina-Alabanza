import assert from 'node:assert/strict'
import { test } from 'node:test'
import { aTexto, diapositivasDe } from '../src/lib/diapositivas.ts'

const letra = `{start_of_verse}
[D]Abre las [G]puertas
que [D]entre la luz
{end_of_verse}

{start_of_chorus}
[G]Santo es tu [D]nombre
[A]fiel es tu a[Bm]mor
[G]todo lo que [D]soy
te lo [A]doy, Se[D]ñor
[G]Santo es tu [D]nombre
{end_of_chorus}`

test('una sección corta es una diapositiva y se quitan los acordes', () => {
  const d = diapositivasDe(letra)
  assert.deepEqual(d[0], { etiqueta: 'Verso', lineas: ['Abre las puertas', 'que entre la luz'] })
})

test('una sección larga se reparte en partes parejas y solo la primera lleva etiqueta', () => {
  const d = diapositivasDe(letra)
  assert.equal(d.length, 3)
  assert.deepEqual(d.slice(1).map((x) => x.lineas.length), [3, 2])
  assert.equal(d[1]!.etiqueta, 'Coro')
  assert.equal(d[2]!.etiqueta, null)
})

test('sin letra no hay diapositivas', () => {
  assert.deepEqual(diapositivasDe(''), [])
  assert.deepEqual(diapositivasDe('{title: Algo}'), [])
})

test('exportación: título, línea en blanco entre diapositivas y etiquetas opcionales', () => {
  const t = aTexto([{ titulo: 'Abre las puertas', letra }])
  assert.ok(t.startsWith('Abre las puertas\n\nAbre las puertas\nque entre la luz\n\nSanto es tu nombre'))
  assert.ok(!t.includes('Coro'))
  assert.ok(aTexto([{ titulo: 'X', letra }], true).includes('Coro\nSanto es tu nombre'))
})
