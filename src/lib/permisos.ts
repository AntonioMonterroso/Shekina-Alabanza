import type { Rol } from './tipos'

// Espejo de la tabla de permisos de CLAUDE.md para decidir qué se muestra.
// La seguridad real vive en RLS; esto solo evita mostrar botones que no sirven.
const es = (rol: Rol | null, ...roles: Rol[]) => (rol ? roles.includes(rol) : false)

export const permisos = (rol: Rol | null) => {
  // Equipo de alabanza: lo demás (alumno, maestro externo, tutor) solo ve la Escuela
  const eq = es(rol, 'propietario', 'lider', 'musico', 'voz', 'sonido', 'multimedia')
  return {
    esLider: es(rol, 'propietario', 'lider'),
    esAlumno: rol === 'alumno',
    verOrdenDelServicio: eq,
    verServicios: eq,
    verCancionero: es(rol, 'propietario', 'lider', 'musico', 'voz'),
    verTurnos: eq,
    verEnsayos: eq,
    verEquipo: eq,
    verEscenario: es(rol, 'propietario', 'lider', 'musico', 'voz'),
    escenarioEnBarra: es(rol, 'musico', 'voz'),
    verProyeccion: es(rol, 'propietario', 'lider', 'multimedia'),
    esEquipo: eq,
    esExterno: es(rol, 'alumno', 'maestro', 'tutor'),
  }
}
