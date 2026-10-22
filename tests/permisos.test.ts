import assert from 'node:assert/strict'
import { test } from 'node:test'
import { coordinaLaEscuela } from '../src/lib/permisos.ts'
import { esDeEquipo, esRolEscuela } from '../src/lib/tipos.ts'

test('la Escuela: solo el propietario o quien él marcó', () => {
  assert.equal(coordinaLaEscuela('propietario', false), true)
  assert.equal(coordinaLaEscuela('propietario', undefined), true)
  assert.equal(coordinaLaEscuela('lider', false), false, 'un líder sin marca NO coordina')
  assert.equal(coordinaLaEscuela('lider', undefined), false)
  assert.equal(coordinaLaEscuela('lider', true), true, 'un líder con la marca del propietario sí')
  assert.equal(coordinaLaEscuela('musico', true), true)
  assert.equal(coordinaLaEscuela('musico', false), false)
  assert.equal(coordinaLaEscuela(null, null), false)
})

test('roles del equipo y de la Escuela no se mezclan', () => {
  for (const r of ['propietario', 'lider', 'musico', 'voz', 'sonido', 'multimedia'] as const) {
    assert.equal(esDeEquipo(r), true, r)
    assert.equal(esRolEscuela(r), false, r)
  }
  for (const r of ['alumno', 'maestro', 'tutor'] as const) {
    assert.equal(esDeEquipo(r), false, r)
    assert.equal(esRolEscuela(r), true, r)
  }
})
