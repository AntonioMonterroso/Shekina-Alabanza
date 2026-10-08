// Mensajes de las notificaciones push. Sin dependencias: se prueba con `npm test`.
export type TipoPush = 'aviso' | 'ensayo' | 'turno' | 'no_puede' | 'practica' | 'comentario' | 'nivel' | 'recomendado'
export interface DatosPush { texto?: string; fecha?: string; lugar?: string | null; puesto?: string; servicio?: string; nombre?: string; titulo?: string; clase?: string; nivel?: string; curso?: string; alumno?: string }
export interface MensajePush { title: string; body: string; url: string }

const TZ = 'America/Guatemala'
const fmt = (d: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('es-GT', { timeZone: TZ, ...o }).format(new Date(d)).replace(/[\u00a0\u202f]/g, ' ')
/** "dom 11 oct" */
export const fechaCorta = (d: string) => `${fmt(d, { weekday: 'short' }).replace('.', '')} ${fmt(d, { day: 'numeric' })} ${fmt(d, { month: 'short' }).replace('.', '')}`
export const hora = (d: string) => fmt(d, { hour: 'numeric', minute: '2-digit', hour12: true })

const recortar = (t: string, max: number) => (t.length > max ? t.slice(0, max - 1).trimEnd() + '…' : t)

export function armarMensaje(tipo: TipoPush, d: DatosPush, appUrl: string): MensajePush {
  const base = appUrl.endsWith('/') ? appUrl : appUrl + '/'
  switch (tipo) {
    case 'aviso':
      return { title: 'Aviso del equipo', body: recortar((d.texto ?? '').replace(/\s+/g, ' ').trim(), 140), url: base + 'avisos' }
    case 'ensayo':
      return { title: 'Nuevo ensayo', body: [d.fecha ? `${fechaCorta(d.fecha)} · ${hora(d.fecha)}` : null, d.lugar].filter(Boolean).join(' · '), url: base + 'ensayos' }
    case 'turno':
      return { title: 'Te asignaron un turno', body: [d.puesto, d.servicio, d.fecha ? fechaCorta(d.fecha) : null].filter(Boolean).join(' · '), url: base + 'turnos' }
    case 'practica':
      return { title: 'Práctica nueva', body: [d.titulo, d.clase].filter(Boolean).join(' · '), url: base + 'escuela' }
    case 'comentario':
      return { title: d.nombre ? `${d.nombre} te escribió` : 'Mensaje de tu maestro', body: recortar((d.texto ?? '').replace(/\s+/g, ' ').trim(), 140), url: base + 'escuela' }
    case 'nivel':
      return { title: '¡Nivel completado!', body: `${d.alumno ?? 'Un alumno'} completó «${d.nivel ?? 'un nivel'}»${d.curso ? ` en ${d.curso}` : ''}`, url: base + 'escuela' }
    case 'recomendado':
      return { title: 'Alumno listo para el equipo', body: `${d.alumno ?? 'Un alumno'} fue recomendado para tocar con el grupo`, url: base + 'escuela' }
    case 'no_puede':
      return { title: 'Falta reemplazo', body: `${d.nombre ?? 'Un integrante'} no puede${d.puesto ? ` ${d.puesto}` : ''}${d.fecha ? ` el ${fechaCorta(d.fecha)}` : ''}`, url: base + 'turnos' }
  }
}
