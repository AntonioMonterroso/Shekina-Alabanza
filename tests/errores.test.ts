import assert from 'node:assert/strict'
import { test } from 'node:test'
import { crearLimitador, debeIgnorar, esRecargable, limpiar, mensajeDe, rutaSinBase } from '../src/lib/erroresPuro.ts'

test('no se reportan los fallos por falta de internet ni ruidos del navegador', () => {
  for (const m of ['TypeError: Failed to fetch', 'NetworkError when attempting to fetch resource.', 'Load failed', 'ResizeObserver loop completed with undelivered notifications.', 'The operation was aborted.', 'Script error.'])
    assert.equal(debeIgnorar(m), true, m)
  for (const m of ["Cannot read properties of undefined (reading 'titulo')", 'x is not a function', 'Minified React error #310'])
    assert.equal(debeIgnorar(m), false, m)
})

test('una versión nueva publicada se resuelve recargando, no reportando', () => {
  assert.equal(esRecargable('Failed to fetch dynamically imported module: https://x/assets/Escenario-abc.js'), true)
  assert.equal(esRecargable('error loading dynamically imported module'), true)
  assert.equal(esRecargable('Importing a module script failed.'), true)
  assert.equal(esRecargable("Cannot read properties of undefined"), false)
})

test('mensajeDe entiende errores, textos y objetos', () => {
  assert.equal(mensajeDe(new Error('boom')), 'boom')
  assert.equal(mensajeDe('texto'), 'texto')
  assert.equal(mensajeDe({ message: 'del servidor' }), 'del servidor')
  assert.equal(mensajeDe({ a: 1 }), '{"a":1}')
})

test('limpiar quita correos y llaves y recorta', () => {
  assert.equal(limpiar('falló para jose@ejemplo.com ahora', 100), 'falló para [correo] ahora')
  assert.match(limpiar('token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcDEF_ghi-jk fin', 200), /\[token\]/)
  assert.equal(limpiar('x'.repeat(500), 400).length, 400)
})

test('la ruta se guarda sin la base ni parámetros', () => {
  assert.equal(rutaSinBase('/Shekina-Alabanza/cancionero/abc', '/Shekina-Alabanza/'), '/cancionero/abc')
  assert.equal(rutaSinBase('/Shekina-Alabanza/', '/Shekina-Alabanza/'), '/')
  assert.equal(rutaSinBase('/cancionero', '/'), '/cancionero')
})

test('el limitador no deja repetir un mensaje ni pasarse de la cuota de la sesión', () => {
  const ok = crearLimitador({ ventanaMs: 1000, maxSesion: 3 })
  assert.equal(ok('a', 0), true)
  assert.equal(ok('a', 500), false, 'mismo mensaje dentro de la ventana')
  assert.equal(ok('a', 1500), true, 'pasada la ventana se vuelve a aceptar')
  assert.equal(ok('b', 1600), true)
  assert.equal(ok('c', 1700), false, 'se acabó la cuota de la sesión (3)')
})
