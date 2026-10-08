// Prueba de permisos (RLS) de la Escuela con usuarios simulados.
// Uso: node scripts/probar-migraciones.mjs scripts/prueba-escuela.mjs
import assert from 'node:assert/strict'

const U = { prop: '00000000-0000-0000-0000-000000000001', coord: '00000000-0000-0000-0000-000000000002', musico: '00000000-0000-0000-0000-000000000003',
  maestro: '00000000-0000-0000-0000-000000000004', a1: '00000000-0000-0000-0000-000000000005', a2: '00000000-0000-0000-0000-000000000006', tutor: '00000000-0000-0000-0000-000000000007' }

export default async function (db, como) {
  await db.exec(`
    insert into auth.users (id) select unnest(array['${Object.values(U).join("','")}']::uuid[]);
    insert into grupos (id, nombre, slug) values ('10000000-0000-0000-0000-000000000000', 'Shekina', 'shekina');
    insert into miembros (id, grupo_id, user_id, rol, coordina_escuela) values
      ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000000','${U.prop}','propietario',false),
      ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000000','${U.coord}','musico',true),
      ('20000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000000','${U.musico}','musico',false),
      ('20000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000000','${U.maestro}','maestro',false),
      ('20000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000000','${U.a1}','alumno',false),
      ('20000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000000','${U.a2}','alumno',false),
      ('20000000-0000-0000-0000-000000000007','10000000-0000-0000-0000-000000000000','${U.tutor}','tutor',false);
    insert into escuela_cursos (id, grupo_id, nombre) values ('30000000-0000-0000-0000-000000000000','10000000-0000-0000-0000-000000000000','Curso de prueba');
    insert into escuela_clases (id, grupo_id, curso_id, nombre, maestro_id) values
      ('40000000-0000-0000-0000-000000000000','10000000-0000-0000-0000-000000000000','30000000-0000-0000-0000-000000000000','Piano 1','20000000-0000-0000-0000-000000000004');
    insert into escuela_inscripciones (clase_id, alumno_id) values
      ('40000000-0000-0000-0000-000000000000','20000000-0000-0000-0000-000000000005'),
      ('40000000-0000-0000-0000-000000000000','20000000-0000-0000-0000-000000000006');
    insert into escuela_tutores (tutor_id, alumno_id) values ('20000000-0000-0000-0000-000000000007','20000000-0000-0000-0000-000000000005');
    insert into escuela_practicas (id, clase_id, semana, titulo) values ('50000000-0000-0000-0000-000000000000','40000000-0000-0000-0000-000000000000','2026-10-12','Escala de Do');
    insert into escuela_practicas (id, clase_id, alumno_id, semana, titulo) values ('50000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000000','20000000-0000-0000-0000-000000000006','2026-10-12','Solo para A2');
  `)
  const n = async (uid, sql) => (await como(db, uid, sql)).rows.length
  const falla = async (uid, sql) => { await assert.rejects(() => como(db, uid, sql), undefined, sql); }
  const A1 = '20000000-0000-0000-0000-000000000005', A2 = '20000000-0000-0000-0000-000000000006'
  const C = '40000000-0000-0000-0000-000000000000'

  // Quién ve la clase
  for (const [quien, esperado] of [['coord', 1], ['prop', 1], ['maestro', 1], ['a1', 1], ['tutor', 1], ['musico', 0]])
    assert.equal(await n(U[quien], 'select 1 from escuela_clases'), esperado, `ve clase: ${quien}`)

  // Un alumno solo ve su inscripción; el tutor la de su hijo; el maestro y la coordinación todas
  assert.equal(await n(U.a1, 'select 1 from escuela_inscripciones'), 1)
  assert.equal(await n(U.tutor, 'select 1 from escuela_inscripciones'), 1)
  assert.equal(await n(U.maestro, 'select 1 from escuela_inscripciones'), 2)
  assert.equal(await n(U.musico, 'select 1 from escuela_inscripciones'), 0)

  // Prácticas: A1 ve la de toda la clase pero no la dirigida a A2; el tutor igual que su hijo
  assert.equal(await n(U.a1, 'select 1 from escuela_practicas'), 1)
  assert.equal(await n(U.a2, 'select 1 from escuela_practicas'), 2)
  assert.equal(await n(U.tutor, 'select 1 from escuela_practicas'), 1)
  assert.equal(await n(U.maestro, 'select 1 from escuela_practicas'), 2)

  // Registro de práctica: A1 anota la suya; no puede anotar por A2 ni sobre la práctica de A2
  await como(db, U.a1, `insert into escuela_registro (practica_id, alumno_id, minutos) values ('50000000-0000-0000-0000-000000000000','${A1}',20)`)
  await falla(U.a1, `insert into escuela_registro (practica_id, alumno_id, minutos) values ('50000000-0000-0000-0000-000000000000','${A2}',20)`)
  await falla(U.a1, `insert into escuela_registro (practica_id, alumno_id, minutos) values ('50000000-0000-0000-0000-000000000001','${A1}',20)`)
  // El tutor anota por su hijo
  await como(db, U.tutor, `insert into escuela_registro (practica_id, alumno_id, minutos, fecha) values ('50000000-0000-0000-0000-000000000000','${A1}',15,'2026-10-14')`)
  // Quién lo lee
  assert.equal(await n(U.a1, 'select 1 from escuela_registro'), 2)
  assert.equal(await n(U.a2, 'select 1 from escuela_registro'), 0)
  assert.equal(await n(U.tutor, 'select 1 from escuela_registro'), 2)
  assert.equal(await n(U.maestro, 'select 1 from escuela_registro'), 2)
  assert.equal(await n(U.musico, 'select 1 from escuela_registro'), 0)

  // Quién gestiona: maestro pasa lista y deja tareas; no crea clases. Coordinación (músico con marca) sí.
  const sesion = '60000000-0000-0000-0000-000000000000'
  await como(db, U.maestro, `insert into escuela_sesiones (id, clase_id, fecha, tema) values ('${sesion}','${C}', now(), 'Escalas')`)
  await como(db, U.maestro, `insert into escuela_asistencia (sesion_id, alumno_id, estado) values ('${sesion}','${A1}','presente')`)
  await como(db, U.maestro, `insert into escuela_practicas (clase_id, semana, titulo) values ('${C}','2026-10-19','Arpegios')`)
  await falla(U.maestro, `insert into escuela_clases (grupo_id, curso_id, nombre) values ('10000000-0000-0000-0000-000000000000','30000000-0000-0000-0000-000000000000','Otra')`)
  await falla(U.a1, `insert into escuela_sesiones (clase_id, fecha) values ('${C}', now())`)
  await falla(U.tutor, `insert into escuela_practicas (clase_id, semana, titulo) values ('${C}','2026-10-19','Intento')`)
  await como(db, U.coord, `insert into escuela_clases (grupo_id, curso_id, nombre) values ('10000000-0000-0000-0000-000000000000','30000000-0000-0000-0000-000000000000','Guitarra 1')`)
  await falla(U.musico, `insert into escuela_clases (grupo_id, curso_id, nombre) values ('10000000-0000-0000-0000-000000000000','30000000-0000-0000-0000-000000000000','Colada')`)

  // Asistencia: cada quien la suya; el tutor la de su hijo
  assert.equal(await n(U.a1, 'select 1 from escuela_asistencia'), 1)
  assert.equal(await n(U.a2, 'select 1 from escuela_asistencia'), 0)
  assert.equal(await n(U.tutor, 'select 1 from escuela_asistencia'), 1)

  // Perfil de alumno: se ve a sí mismo; el maestro ve a sus alumnos; el músico raso a nadie
  await db.exec(`insert into escuela_alumnos (miembro_id, objetivo) values ('${A1}','Tocar en el grupo'), ('${A2}', null)`)
  assert.equal(await n(U.a1, 'select 1 from escuela_alumnos'), 1)
  assert.equal(await n(U.maestro, 'select 1 from escuela_alumnos'), 2)
  assert.equal(await n(U.tutor, 'select 1 from escuela_alumnos'), 1)
  assert.equal(await n(U.musico, 'select 1 from escuela_alumnos'), 0)

  // Cursos editables solo por coordinación; todos los del grupo los leen
  assert.equal(await n(U.a1, 'select 1 from escuela_cursos'), 1)
  assert.equal((await como(db, U.maestro, `update escuela_cursos set nombre = 'x'`)).affectedRows, 0, 'maestro no edita cursos')
  await como(db, U.coord, `update escuela_cursos set descripcion = 'Para principiantes' where nombre = 'Curso de prueba'`)
  assert.equal(await n(U.a1, "select 1 from escuela_cursos where descripcion = 'Para principiantes'"), 1)

  // Sin sesión no hay nada
  await db.exec(`set role anon`)
  assert.equal((await db.query('select 1 from escuela_clases')).rows.length, 0, 'sin sesión no se ve nada')
  await db.exec('reset role')

  console.log('Escuela: permisos correctos ')
}
