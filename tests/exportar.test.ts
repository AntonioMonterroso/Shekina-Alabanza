import { execFileSync } from 'node:child_process'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { aChordPro, aTexto, crc32, crearZip, nombreSeguro, nombresUnicos, todoEnUnTexto, zipDeChordPro, type CancionExportable } from '../src/lib/exportar.ts'
import { leerBloque, separarCanciones } from '../src/lib/importar.ts'

const c = (titulo: string, letra: string, extra: Partial<CancionExportable> = {}): CancionExportable => ({ titulo, autor: null, tono_original: null, bpm: null, letra_chordpro: letra, ...extra })
const CUAN: CancionExportable = c('Cuán grande es Él', '[Verso 1]\n[G]Señor mi [C]Dios, al [G]contemplar\n\n[Coro]\n[G]Cuán grande [C]es Él', { autor: 'Carl Boberg', tono_original: 'G', bpm: 68 })

test('nombres de archivo válidos y sin repetir', () => {
  assert.equal(nombreSeguro('¿Quién como Tú?'), '¿Quién como Tú')
  assert.equal(nombreSeguro('Dios/Padre: "amor"'), 'DiosPadre amor')
  assert.equal(nombreSeguro('   ...   '), 'Sin título')
  assert.equal(nombreSeguro('x'.repeat(200)).length, 80)
  assert.deepEqual(nombresUnicos(['Gloria', 'gloria', 'Santo', 'Gloria'], 'pro'), ['Gloria.pro', 'gloria (2).pro', 'Santo.pro', 'Gloria (3).pro'])
})

test('ChordPro exportado se puede volver a cargar igual (ida y vuelta con la importación)', () => {
  const texto = aChordPro(CUAN)
  assert.match(texto, /^\{title: Cuán grande es Él\}\n\{artist: Carl Boberg\}\n\{key: G\}\n\{tempo: 68\}\n\n\[Verso 1\]/)
  const b = leerBloque(texto)
  assert.equal(b.titulo, 'Cuán grande es Él')
  assert.equal(b.autor, 'Carl Boberg')
  assert.equal(b.tono, 'G')
  assert.equal(b.tonoEstimado, false)
  assert.equal(b.bpm, 68)
  assert.equal(b.letra, CUAN.letra_chordpro)
  // varias canciones pegadas juntas (con la línea --- ) también se separan bien
  const dos = separarCanciones(`${aChordPro(CUAN)}\n---\n${aChordPro(c('Santo', '[D]Santo [G]santo'))}`)
  assert.deepEqual(dos.map((x) => x.titulo), ['Cuán grande es Él', 'Santo'])
})

test('texto plano: sin acordes y con las partes como "Coro:"', () => {
  const t = aTexto(CUAN)
  assert.match(t, /^Cuán grande es Él\nCarl Boberg · Tono G\n\nVerso 1:\nSeñor mi Dios, al contemplar\n\nCoro:\nCuán grande es Él\n$/)
  assert.doesNotMatch(t, /\[/)
  assert.match(todoEnUnTexto([CUAN, c('Santo', '[D]Santo')]), /\n-{32}\n\nSanto\n/)
})

test('CRC32 correcto (valor de referencia de "123456789")', () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926)
})

test('el ZIP es válido: lo lee el programa unzip y trae lo que debe (con tildes en los nombres)', () => {
  const zip = zipDeChordPro([CUAN, c('¿Quién como Tú?', '[D]Nadie como Tú'), c('Cuán grande es Él', '[A]otra')], new Date('2026-10-29T12:00:00'))
  const dir = mkdtempSync(join(tmpdir(), 'zip-'))
  const ruta = join(dir, 'cancionero.zip')
  writeFileSync(ruta, zip)
  let salida = ''
  try { salida = execFileSync('unzip', ['-t', ruta], { encoding: 'utf8' }) } catch (e) { assert.fail(`unzip rechazó el archivo: ${(e as Error).message}`) }
  assert.match(salida, /No errors detected/)
  // Los nombres van marcados como UTF-8 (estándar); Python y los programas modernos los leen con tildes y ñ
  const py = 'import sys,json,zipfile\nz=zipfile.ZipFile(sys.argv[1])\nprint(json.dumps({n:z.read(n).decode("utf-8") for n in z.namelist()}, ensure_ascii=False))'
  const dentro = JSON.parse(execFileSync('python3', ['-c', py, ruta], { encoding: 'utf8' })) as Record<string, string>
  assert.deepEqual(Object.keys(dentro).sort(), ['Cuán grande es Él (2).pro', 'Cuán grande es Él.pro', 'LEEME.txt', '¿Quién como Tú.pro'].sort())
  assert.equal(dentro['Cuán grande es Él.pro'], aChordPro(CUAN))
  assert.equal(dentro['¿Quién como Tú.pro'], aChordPro(c('¿Quién como Tú?', '[D]Nadie como Tú')))
  assert.equal(readFileSync(ruta).length, zip.length)
})

test('un ZIP vacío también es válido', () => {
  const zip = crearZip([])
  assert.equal(zip.length, 22)
  assert.equal(new DataView(zip.buffer).getUint32(0, true), 0x06054b50)
})
