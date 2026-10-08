// Crea el usuario propietario de un grupo (una sola vez). Usa la llave service_role: córrelo en tu Mac, nunca en el navegador.
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/crear-propietario.mjs <slug> <usuario> "<Nombre>" <contraseña>
import { createClient } from '@supabase/supabase-js'

const [slug, usuario, nombre, password] = process.argv.slice(2)
if (!slug || !usuario || !nombre || !password) {
  console.error('Uso: node scripts/crear-propietario.mjs <slug> <usuario> "<Nombre>" <contraseña>')
  process.exit(1)
}
if (!/^[a-z0-9._-]{3,30}$/.test(usuario)) throw new Error('Usuario inválido')
if (password.length < 8) throw new Error('La contraseña necesita al menos 8 caracteres')

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})
const { data: grupo, error: eg } = await admin.from('grupos').select('id').eq('slug', slug).single()
if (eg) throw new Error('No existe el grupo ' + slug + ' (¿corriste seed.sql?)')

const { data: u, error: ea } = await admin.auth.admin.createUser({
  email: `${usuario}@usuarios.alabanza.invalid`, password, email_confirm: true, user_metadata: { usuario },
})
if (ea) throw ea
await admin.from('perfiles').insert({ id: u.user.id, usuario, nombre }).throwOnError()
await admin.from('miembros').insert({ grupo_id: grupo.id, user_id: u.user.id, rol: 'propietario' }).throwOnError()
console.log(`Propietario creado: ${usuario} en ${slug}`)
