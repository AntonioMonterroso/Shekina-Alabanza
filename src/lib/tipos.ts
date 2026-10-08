export type Rol = 'propietario' | 'lider' | 'musico' | 'voz' | 'sonido' | 'multimedia' | 'alumno'
export type Tema = 'salvia' | 'rosa'

export interface Perfil {
  id: string
  usuario: string
  nombre: string
  avatar_url: string | null
  tema: Tema
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
