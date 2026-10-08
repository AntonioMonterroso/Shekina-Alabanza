// El acceso es con usuario y contraseña. Supabase pide un correo, así que cada usuario
// tiene uno interno que nunca se muestra y nunca recibe mensajes (TLD .invalid).
export const DOMINIO_USUARIOS = 'usuarios.alabanza.invalid'

export const normalizarUsuario = (u: string) => u.trim().toLowerCase()
export const usuarioValido = (u: string) => /^[a-z0-9._-]{3,30}$/.test(u)
export const correoDeUsuario = (u: string) => `${normalizarUsuario(u)}@${DOMINIO_USUARIOS}`
