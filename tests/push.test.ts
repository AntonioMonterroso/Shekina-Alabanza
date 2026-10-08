import assert from 'node:assert/strict'
import { test } from 'node:test'
import { armarMensaje } from '../supabase/functions/_shared/push.ts'

const URL = 'https://x.github.io/App'

test('aviso: texto recortado y enlace a /avisos', () => {
  const m = armarMensaje('aviso', { texto: 'a'.repeat(300) }, URL)
  assert.equal(m.title, 'Aviso del equipo')
  assert.equal(m.body.length, 140)
  assert.ok(m.body.endsWith('…'))
  assert.equal(m.url, 'https://x.github.io/App/avisos')
})

test('ensayo, turno y "no puede" dicen cuándo y dónde, en hora de Guatemala', () => {
  // 2026-10-09 01:00 UTC = jueves 8 oct, 7:00 p. m. en Guatemala
  const f = '2026-10-09T01:00:00Z'
  assert.equal(armarMensaje('ensayo', { fecha: f, lugar: 'Salón' }, URL + '/').body, 'jue 8 oct · 7:00 p. m. · Salón')
  assert.equal(armarMensaje('turno', { puesto: 'Piano', servicio: 'Culto', fecha: f }, URL).body, 'Piano · Culto · jue 8 oct')
  const n = armarMensaje('no_puede', { nombre: 'Ana', puesto: 'Voz 2', fecha: f }, URL)
  assert.equal(n.title, 'Falta reemplazo')
  assert.equal(n.body, 'Ana no puede Voz 2 el jue 8 oct')
  assert.equal(n.url, 'https://x.github.io/App/turnos')
})

test('Escuela: práctica, comentario, nivel y recomendación', () => {
  assert.deepEqual(armarMensaje('practica', { titulo: 'Escala de Do', clase: 'Piano — martes' }, URL), { title: 'Práctica nueva', body: 'Escala de Do · Piano — martes', url: 'https://x.github.io/App/escuela' })
  const c = armarMensaje('comentario', { nombre: 'Pedro', texto: '  Muy bien\nla escala  ' }, URL)
  assert.equal(c.title, 'Pedro te escribió')
  assert.equal(c.body, 'Muy bien la escala')
  assert.equal(armarMensaje('comentario', { texto: 'Hola' }, URL).title, 'Mensaje de tu maestro')
  assert.equal(armarMensaje('nivel', { alumno: 'Ana', nivel: 'Intermedio', curso: 'Piano' }, URL).body, 'Ana completó «Intermedio» en Piano')
  assert.equal(armarMensaje('recomendado', { alumno: 'Ana' }, URL).body, 'Ana fue recomendado para tocar con el grupo')
})
