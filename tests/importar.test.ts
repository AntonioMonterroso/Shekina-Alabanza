import assert from 'node:assert/strict'
import { test } from 'node:test'
import { estados, leerBloque, normalizarTitulo, separarBloques, separarCanciones, tonoDelPrimerAcorde, tonoValido } from '../src/lib/importar.ts'

const DOS = `Cuán grande es Él - Carl Boberg
Tono: G

G        C        G
Señor mi Dios, al contemplar los cielos
       D
El firmamento y las estrellas mil


Santo, santo, santo
Autor: Reginald Heber

D       G     D
Santo, santo, santo
`

test('dos canciones separadas por dos líneas en blanco, con acordes encima', () => {
  const r = separarCanciones(DOS)
  assert.equal(r.length, 2)
  assert.equal(r[0]!.titulo, 'Cuán grande es Él')
  assert.equal(r[0]!.autor, 'Carl Boberg')
  assert.equal(r[0]!.tono, 'G')
  assert.equal(r[0]!.tonoEstimado, false, 'el tono venía escrito')
  assert.match(r[0]!.letra, /^\[G\]Señor mi \[C\]Dios, al \[G\]contemplar/)
  assert.equal(r[0]!.conAcordes, true)
  assert.equal(r[1]!.titulo, 'Santo, santo, santo')
  assert.equal(r[1]!.autor, 'Reginald Heber')
  assert.equal(r[1]!.tono, 'D', 'sin tono escrito se adivina por el primer acorde')
  assert.equal(r[1]!.tonoEstimado, true)
})

test('separadores explícitos (---, ***, {new_song}) y etiquetas ChordPro', () => {
  const t = '{title: Firmes y adelante}\n{key: E}\n[E]Firmes y adelante\n---\n{title: Dulce oración}\n{artist: Walford}\n[D]Dulce oración'
  const r = separarCanciones(t)
  assert.deepEqual(r.map((x) => x.titulo), ['Firmes y adelante', 'Dulce oración'])
  assert.equal(r[0]!.tono, 'E')
  assert.equal(r[1]!.autor, 'Walford')
  assert.equal(separarBloques('a1 a1 a1 a1\n{new_song}\nb1 b1 b1 b1').length, 2)
  assert.equal(separarBloques('uno\n\n\n\n\ndos').length, 2, 'varias líneas en blanco seguidas cuentan como un solo corte')
  assert.equal(separarBloques('uno\n\ndos').length, 1, 'una línea en blanco es solo el espacio entre estrofas')
})

test('una sola canción con estrofas no se parte', () => {
  const r = separarCanciones('Gloria\n\nGloria a Dios en las alturas\nPaz en la tierra\n\nCoro:\nAleluya aleluya\n')
  assert.equal(r.length, 1)
  assert.equal(r[0]!.titulo, 'Gloria')
  assert.match(r[0]!.letra, /\[Coro\]\nAleluya/)
  assert.equal(r[0]!.conAcordes, false)
  assert.equal(r[0]!.tono, null)
})

test('si la primera línea es letra (no título) el título queda vacío para que lo escriban', () => {
  const b = leerBloque('[G]Santo [D]santo\n[Em]Digno es el Cordero')
  assert.equal(b.titulo, '')
  assert.match(b.letra, /^\[G\]Santo/)
  const c = leerBloque('Señor mi Dios, al contemplar los cielos que tus manos hicieron con poder.\nSegunda línea de la letra')
  assert.equal(c.titulo, '', 'una línea larga con punto no es un título')
})

test('limpia numeración, comillas y ruido (capo, bpm)', () => {
  const b = leerBloque('12. "Gloria a Dios"\nCapo 2\nBPM: 76\nTono: Gb\nLetra uno de la canción\nLetra dos de la canción')
  assert.equal(b.titulo, 'Gloria a Dios')
  assert.equal(b.tono, 'F#', 'Gb se guarda como F#')
  assert.doesNotMatch(b.letra, /capo|bpm/i)
  assert.equal(b.bpm, 76, 'el tempo escrito se conserva')
})

test('tonos: equivalencias y rechazo de lo inválido', () => {
  assert.equal(tonoValido('Gb'), 'F#')
  assert.equal(tonoValido('ebm'), 'D#m')
  assert.equal(tonoValido('D#'), 'Eb')
  assert.equal(tonoValido('am'), 'Am')
  assert.equal(tonoValido('H'), null)
  assert.equal(tonoValido(''), null)
  assert.equal(tonoDelPrimerAcorde('[Em7]Hola'), 'Em')
  assert.equal(tonoDelPrimerAcorde('[Gmaj7]Hola'), 'G')
  assert.equal(tonoDelPrimerAcorde('[F#m]Hola'), 'F#m')
  assert.equal(tonoDelPrimerAcorde('sin acordes'), null)
})

test('duplicadas: contra el cancionero y dentro del mismo texto', () => {
  assert.equal(normalizarTitulo('¡Cuán GRANDE es Él!'), 'cuan grande es el')
  const e = estados(['Cuán grande es Él', 'Nueva canción', 'nueva  canción!', ''], ['cuan grande es el'])
  assert.deepEqual(e, ['existe', 'ok', 'repetida', 'sin-titulo'])
})

test('bloques casi vacíos no cuentan como canciones', () => {
  assert.equal(separarCanciones('Título\n\n\n\nOtra\n').length, 0)
  assert.equal(separarCanciones('').length, 0)
})
