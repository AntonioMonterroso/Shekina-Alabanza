// Prueba: la Escuela es del propietario; un líder solo entra si el propietario le da acceso.
// Uso: node scripts/probar-migraciones.mjs scripts/prueba-acceso-escuela.mjs
import assert from 'node:assert/strict'

const U = {
  prop: '00000000-0000-0000-0000-000000000001', lider: '00000000-0000-0000-0000-000000000002',
  liderAcc: '00000000-0000-0000-0000-000000000003', musico: '00000000-0000-0000-0000-000000000004',
  alumno: '00000000-0000-0000-0000-000000000005', maestro: '00000000-0000-0000-0000-000000000006',
}
const G = '10000000-0000-0000-0000-000000000000'
const M = (n) => `20000000-0000-0000-0000-00000000000${n}`

export default async function (db, como) {
  await db.exec(`
    insert into auth.users (id) select unnest(array['${Object.values(U).join("','")}']::uuid[]);
    insert into grupos (id, nombre, slug) values ('${G}', 'Shekina', 'shekina');
    insert into miembros (id, grupo_id, user_id, rol, coordina_escuela) values
      ('${M(1)}','${G}','${U.prop}','propietario',false),
      ('${M(2)}','${G}','${U.lider}','lider',false),
      ('${M(3)}','${G}','${U.liderAcc}','lider',true),
      ('${M(4)}','${G}','${U.musico}','musico',false),
      ('${M(5)}','${G}','${U.alumno}','alumno',false),
      ('${M(6)}','${G}','${U.maestro}','maestro',false);
    insert into escuela_cursos (id, grupo_id, nombre) values ('30000000-0000-0000-0000-000000000000','${G}','Piano');
    insert into escuela_clases (id, grupo_id, curso_id, nombre, maestro_id) values
      ('40000000-0000-0000-0000-000000000000','${G}','30000000-0000-0000-0000-000000000000','Piano 1','${M(6)}');
    insert into escuela_inscripciones (clase_id, alumno_id) values ('40000000-0000-0000-0000-000000000000','${M(5)}');
    insert into escuela_alumnos (miembro_id, objetivo) values ('${M(5)}','Tocar en el grupo');
  `)
  const n = async (uid, sql) => (await como(db, uid, sql)).rows.length
  const falla = async (uid, sql, patron) => { await assert.rejects(() => como(db, uid, sql), patron ? new RegExp(patron) : undefined, sql) }
  const TABLAS = ['escuela_cursos', 'escuela_clases', 'escuela_inscripciones', 'escuela_alumnos']

  // 1) Lectura: el propietario y el líder con acceso ven; el líder sin acceso y el músico no ven nada
  for (const t of TABLAS) {
    assert.equal(await n(U.prop, `select 1 from ${t}`), 1, `propietario ve ${t}`)
    assert.equal(await n(U.liderAcc, `select 1 from ${t}`), 1, `líder con acceso ve ${t}`)
    assert.equal(await n(U.lider, `select 1 from ${t}`), 0, `líder SIN acceso no ve ${t}`)
    assert.equal(await n(U.musico, `select 1 from ${t}`), 0, `músico no ve ${t}`)
  }

  // 2) Escritura: el líder sin acceso no crea cursos ni clases ni inscribe
  await falla(U.lider, `insert into escuela_cursos (grupo_id, nombre) values ('${G}','Guitarra')`)
  await falla(U.lider, `insert into escuela_clases (grupo_id, curso_id, nombre) values ('${G}','30000000-0000-0000-0000-000000000000','Otra')`)
  await falla(U.lider, `insert into escuela_inscripciones (clase_id, alumno_id) values ('40000000-0000-0000-0000-000000000000','${M(4)}')`)
  await como(db, U.liderAcc, `insert into escuela_cursos (grupo_id, nombre) values ('${G}','Guitarra')`)
  await como(db, U.prop, `insert into escuela_cursos (grupo_id, nombre) values ('${G}','Batería')`)

  // 3) La marca de acceso solo la da o quita el propietario
  await falla(U.lider, `update miembros set coordina_escuela = true where id = '${M(2)}'`, 'Solo el propietario')
  await falla(U.lider, `update miembros set coordina_escuela = true where id = '${M(4)}'`, 'Solo el propietario')
  await falla(U.liderAcc, `update miembros set coordina_escuela = true where id = '${M(4)}'`, 'Solo el propietario')
  await falla(U.liderAcc, `update miembros set coordina_escuela = false where id = '${M(3)}'`, 'Solo el propietario')
  await como(db, U.prop, `update miembros set coordina_escuela = true where id = '${M(4)}'`)
  assert.equal(await n(U.musico, 'select 1 from escuela_cursos'), 3, 'el músico con marca ya ve los cursos')
  await como(db, U.prop, `update miembros set coordina_escuela = false where id = '${M(4)}'`)
  assert.equal(await n(U.musico, 'select 1 from escuela_cursos'), 0, 'al quitar la marca deja de ver')
  await falla(U.prop, `update miembros set coordina_escuela = true where id = '${M(5)}'`, 'no puede coordinar')

  // 4) Integrantes de la Escuela: el líder sin acceso no los edita, desactiva, quita ni les cambia el rol
  await falla(U.lider, `update miembros set descripcion = 'x' where id = '${M(5)}'`, 'coordina la Escuela')
  await falla(U.lider, `update miembros set activo = false where id = '${M(6)}'`, 'coordina la Escuela')
  await falla(U.lider, `update miembros set rol = 'musico' where id = '${M(5)}'`, 'coordina la Escuela')
  await falla(U.lider, `delete from miembros where id = '${M(5)}'`, 'coordina la Escuela')
  // ...ni convierte a un músico en alumno
  await falla(U.lider, `update miembros set rol = 'alumno' where id = '${M(4)}'`, 'coordina la Escuela')
  // El resto del equipo sigue como siempre
  await como(db, U.lider, `update miembros set descripcion = 'Teclado' where id = '${M(4)}'`)

  // 5) Quien sí coordina (propietario o líder con acceso) puede pasar un alumno al equipo
  await como(db, U.liderAcc, `update miembros set rol = 'musico' where id = '${M(5)}'`)
  assert.equal((await como(db, U.prop, `select rol from miembros where id = '${M(5)}'`)).rows[0].rol, 'musico')
  await como(db, U.prop, `update miembros set coordina_escuela = true where id = '${M(5)}'`)   // ya es músico: se le puede dar acceso
  await como(db, U.prop, `update miembros set rol = 'alumno' where id = '${M(5)}'`)            // al volver a alumno pierde la marca
  assert.equal((await como(db, U.prop, `select coordina_escuela from miembros where id = '${M(5)}'`)).rows[0].coordina_escuela, false, 'un alumno no conserva la marca')

  // 6) El propietario sigue protegido
  await falla(U.liderAcc, `update miembros set rol = 'musico' where id = '${M(1)}'`)
  await falla(U.prop, `update miembros set rol = 'lider' where id = '${M(1)}'`)

  // 7) El alumno y el maestro siguen viendo lo suyo
  assert.equal(await n(U.alumno, 'select 1 from escuela_clases'), 1, 'el alumno ve su clase')
  assert.equal(await n(U.maestro, 'select 1 from escuela_clases'), 1, 'el maestro ve su clase')
}
