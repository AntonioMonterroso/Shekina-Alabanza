import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import {
  _reiniciar, borrarAudios, borrarTodo, guardarAudio, guardarTono, kvGuardar, kvLeer, leerAudio, leerCancion, leerCanciones,
  leerAudiosDeCanciones, leerServicios, leerTonos, listarAudios, reemplazarGrupo, type CancionLocal, type ServicioLocal, type TonoLocal,
} from '../src/lib/offline/almacen.ts'

const cancion = (id: string, grupo = 'g1', titulo = id): CancionLocal => ({
  id, grupo_id: grupo, titulo, autor: null, tono_original: 'D', bpm: 70, minutos: 4, categoria: null,
  letra_chordpro: `[D]${titulo}`, audio_ref_url: null, fase: 'lista', publica: true, created_at: '2026-10-01', updated_at: '2026-10-01',
})
const servicio = (id: string, fecha: string, grupo = 'g1'): ServicioLocal => ({ id, grupo_id: grupo, fecha, tipo: 'Dominical', llegada: null, items: [] })
const tono = (c: string, t: string, pendiente = false, grupo = 'g1'): TonoLocal => ({ cancion_id: c, miembro_id: 'm1', grupo_id: grupo, tono: t, pendiente })

beforeEach(async () => { await borrarTodo(); _reiniciar() })

test('guarda y lee canciones por grupo', async () => {
  await reemplazarGrupo('g1', { canciones: [cancion('a'), cancion('b')], servicios: [], tonos: [] })
  await reemplazarGrupo('g2', { canciones: [cancion('z', 'g2')], servicios: [], tonos: [] })
  assert.deepEqual((await leerCanciones('g1')).map((c) => c.id).sort(), ['a', 'b'])
  assert.deepEqual((await leerCanciones('g2')).map((c) => c.id), ['z'])
  assert.equal((await leerCancion('a'))?.letra_chordpro, '[D]a')
  assert.equal(await leerCancion('no-existe'), undefined)
})

test('reemplazar un grupo borra lo que ya no existe en la nube, sin tocar otros grupos', async () => {
  await reemplazarGrupo('g1', { canciones: [cancion('a'), cancion('b')], servicios: [servicio('s1', '2026-10-11')], tonos: [] })
  await reemplazarGrupo('g2', { canciones: [cancion('z', 'g2')], servicios: [], tonos: [] })
  await reemplazarGrupo('g1', { canciones: [cancion('b', 'g1', 'B nuevo')], servicios: [], tonos: [] })
  assert.deepEqual((await leerCanciones('g1')).map((c) => c.titulo), ['B nuevo'])
  assert.equal((await leerServicios('g1')).length, 0)
  assert.equal((await leerCanciones('g2')).length, 1)
})

test('los servicios salen ordenados por fecha', async () => {
  await reemplazarGrupo('g1', { canciones: [], servicios: [servicio('s2', '2026-10-18'), servicio('s1', '2026-10-11'), servicio('s3', '2026-10-25')], tonos: [] })
  assert.deepEqual((await leerServicios('g1')).map((s) => s.id), ['s1', 's2', 's3'])
})

test('un tono cambiado sin conexión (pendiente) sobrevive a la descarga de la nube', async () => {
  await reemplazarGrupo('g1', { canciones: [cancion('a')], servicios: [], tonos: [tono('a', 'D')] })
  await guardarTono(tono('a', 'F', true))                                   // lo cambié sin internet
  await reemplazarGrupo('g1', { canciones: [cancion('a')], servicios: [], tonos: [tono('a', 'D')] }) // la nube aún dice D
  const t = await leerTonos('g1')
  assert.equal(t.length, 1)
  assert.equal(t[0]!.tono, 'F')
  assert.equal(t[0]!.pendiente, true)
  // una vez subido (ya no pendiente) la nube vuelve a mandar
  await guardarTono(tono('a', 'F', false))
  await reemplazarGrupo('g1', { canciones: [], servicios: [], tonos: [tono('a', 'G')] })
  assert.equal((await leerTonos('g1'))[0]!.tono, 'G')
})

test('kv guarda y lee valores', async () => {
  assert.equal(await kvLeer('x'), undefined)
  await kvGuardar('x', { a: 1 })
  assert.deepEqual(await kvLeer('x'), { a: 1 })
})

test('audios: guardar, listar por grupo y borrar', async () => {
  const blob = new Blob(['abc'], { type: 'audio/mpeg' })
  await guardarAudio({ path: 'g1/c1/a.mp3', guia_id: 'gu1', parte: 'Voz 2', duracion_s: 61, grupo_id: 'g1', cancion_id: 'c1', blob, bytes: 3, guardado: '2026-10-21' })
  await guardarAudio({ path: 'g2/c9/b.mp3', guia_id: 'gu2', parte: 'Piano', duracion_s: null, grupo_id: 'g2', cancion_id: 'c9', blob, bytes: 3, guardado: '2026-10-21' })
  assert.equal((await leerAudio('g1/c1/a.mp3'))?.bytes, 3)
  assert.equal((await listarAudios('g1')).length, 1)
  assert.deepEqual((await leerAudiosDeCanciones(['c1', 'c9'])).map((a) => a.parte).sort(), ['Piano', 'Voz 2'])
  assert.equal((await leerAudiosDeCanciones(['zzz'])).length, 0)
  await borrarAudios(['g1/c1/a.mp3'])
  assert.equal(await leerAudio('g1/c1/a.mp3'), undefined)
  assert.equal((await listarAudios('g2')).length, 1)
})

test('borrarTodo deja el almacén vacío (cerrar sesión)', async () => {
  await reemplazarGrupo('g1', { canciones: [cancion('a')], servicios: [servicio('s1', '2026-10-11')], tonos: [tono('a', 'D')] })
  await kvGuardar('k', 1)
  await borrarTodo()
  assert.equal((await leerCanciones('g1')).length, 0)
  assert.equal((await leerServicios('g1')).length, 0)
  assert.equal((await leerTonos('g1')).length, 0)
  assert.equal(await kvLeer('k'), undefined)
})
