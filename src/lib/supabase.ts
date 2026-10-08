import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabaseConfigurado = Boolean(url && anon)

// Si faltan las variables la app muestra un aviso en vez de romperse.
export const supabase = createClient(url ?? 'http://localhost:54321', anon ?? 'sin-configurar', {
  auth: { persistSession: true, autoRefreshToken: true },
})
