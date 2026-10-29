// Prueba de permisos del registro de errores. Uso: node scripts/probar-migraciones.mjs scripts/prueba-errores.mjs
import assert from 'node:assert/strict'

const U = { prop: '00000000-0000-0000-0000-000000000001', lider: '00000000-0000-0000-0000-000000000002', musico: '00000000-0000-0000-0000-000000000003', fuera: '00000000-0000-0000-0000-000000000004' }
const G = '10000000-0000-0000-0000-000000000000'

export default async function (db, como) {
  await db.exec(`
    insert into auth.users (id) select unnest(array['${Object.values(U).join("','")}']::uuid[]);
    insert into grupos (id, nombre, slug) values ('${G}', 'Shekina', 'shekina'), ('10000000-0000-0000-0000-0000000000ff', 'Otro', 'otro');
    insert into miembros (grupo_id, user_id, rol) values ('${G}','${U.prop}','propietario'), ('${G}','${U.lider}','lider'), ('${G}','${U.musico}','musico');
  `)
  const n = async (uid, sql) => (await como(db, uid, sql)).rows.length
  const falla = async (uid, sql) => { await assert.rejects(() => como(db, uid, sql), undefined, sql) }
  const ins = (uid, extra = '') => `insert into errores_app (grupo_id, user_id, mensaje, ruta ${extra ? ', ' + extra.split('=')[0] : ''}) values ('${G}', '${uid}', 'boom', '/cancionero' ${extra ? ", " + extra.split('=')[1] : ''})`

  // Cualquiera con sesión en el grupo reporta lo suyo
  for (const u of [U.prop, U.lider, U.musico]) await como(db, u, ins(u))
  // ...pero no a nombre de otro, ni en un grupo que no es suyo, ni sin ser del grupo
  await falla(U.musico, ins(U.lider))
  await falla(U.musico, `insert into errores_app (grupo_id, user_id, mensaje) values ('10000000-0000-0000-0000-0000000000ff', '${U.musico}', 'x')`)
  await falla(U.fuera, ins(U.fuera))
  // Un visitante sin sesión no puede
  await db.exec('set role anon')
  await assert.rejects(() => db.query(`insert into errores_app (grupo_id, mensaje) values ('${G}', 'x')`))
  await db.exec('reset role')

  // Solo el propietario ve, marca y borra
  assert.equal(await n(U.prop, 'select 1 from errores_app'), 3, 'el propietario ve todos')
  assert.equal(await n(U.lider, 'select 1 from errores_app'), 0, 'el líder no ve nada')
  assert.equal(await n(U.musico, 'select 1 from errores_app'), 0, 'el músico no ve ni lo suyo')
  assert.equal((await como(db, U.lider, `update errores_app set resuelto = true returning id`)).rows.length, 0, 'el líder no marca')
  assert.equal((await como(db, U.musico, `delete from errores_app returning id`)).rows.length, 0, 'el músico no borra')
  assert.equal((await como(db, U.prop, `update errores_app set resuelto = true where user_id = '${U.musico}' returning id`)).rows.length, 1)
  assert.equal((await como(db, U.prop, `delete from errores_app where resuelto returning id`)).rows.length, 1)

  // Límites de tamaño y tope por hora
  await falla(U.musico, `insert into errores_app (grupo_id, user_id, mensaje) values ('${G}', '${U.musico}', '${'x'.repeat(401)}')`)
  await falla(U.musico, `insert into errores_app (grupo_id, user_id, mensaje) values ('${G}', '${U.musico}', '')`)
  for (let i = 0; i < 28; i++) await como(db, U.musico, ins(U.musico))   // 1 (arriba) borrado + 28 = 28 en la última hora
  await como(db, U.musico, ins(U.musico))
  await como(db, U.musico, ins(U.musico))
  await falla(U.musico, ins(U.musico))                                    // el 31.º en una hora se rechaza
}
