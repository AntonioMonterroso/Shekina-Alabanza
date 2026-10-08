import type { Rol } from './tipos'

// Espejo de la tabla de permisos de CLAUDE.md para decidir qué se muestra.
// La seguridad real vive en RLS; esto solo evita mostrar botones que no sirven.
const es = (rol: Rol | null, ...roles: Rol[]) => (rol ? roles.includes(rol) : false)

export const permisos = (rol: Rol | null) => ({
  esLider: es(rol, 'propietario', 'lider'),
  esAlumno: rol === 'alumno',
  verOrdenDelServicio: !es(rol, 'alumno') && rol !== null,
  verServicios: !es(rol, 'alumno') && rol !== null,
  verCancionero: es(rol, 'propietario', 'lider', 'musico', 'voz'),
  verTurnos: !es(rol, 'alumno') && rol !== null,
  verEnsayos: !es(rol, 'alumno') && rol !== null,
  verEquipo: !es(rol, 'alumno') && rol !== null,
  verEscenario: es(rol, 'propietario', 'lider', 'musico', 'voz'),
  escenarioEnBarra: es(rol, 'musico', 'voz'),
  verProyeccion: es(rol, 'propietario', 'lider', 'multimedia'),
})
