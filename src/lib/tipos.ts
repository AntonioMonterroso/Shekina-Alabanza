export type Rol = 'propietario' | 'lider' | 'musico' | 'voz' | 'sonido' | 'multimedia' | 'alumno'
export type Tema = 'salvia' | 'rosa' | 'cielo' | 'ambar' | 'lavanda' | 'turquesa'
export type Modo = 'claro' | 'oscuro' | 'auto'
export type Fase = 'nueva' | 'aprendiendo' | 'ensayada' | 'lista'

export const TEMAS: { id: Tema; nombre: string; color: string }[] = [
  { id: 'salvia', nombre: 'Salvia', color: '#3d6b4a' },
  { id: 'rosa', nombre: 'Rosa', color: '#a3485a' },
  { id: 'cielo', nombre: 'Cielo', color: '#2f6690' },
  { id: 'ambar', nombre: 'Ámbar', color: '#9a6412' },
  { id: 'lavanda', nombre: 'Lavanda', color: '#6b4fa3' },
  { id: 'turquesa', nombre: 'Turquesa', color: '#1f7a78' },
]

export interface Perfil {
  id: string
  usuario: string
  nombre: string
  avatar_url: string | null
  tema: Tema
  modo: Modo
  debe_cambiar_password: boolean
}

export interface Grupo {
  id: string
  nombre: string
  slug: string
  activo: boolean
}

export interface Membresia {
  id: string
  grupo_id: string
  rol: Rol
  descripcion: string | null
  grupo: Grupo
}

export const ROL_LABEL: Record<Rol, string> = {
  propietario: 'Propietario',
  lider: 'Líder',
  musico: 'Músico',
  voz: 'Voz',
  sonido: 'Sonido',
  multimedia: 'Multimedia',
  alumno: 'Alumno',
}
