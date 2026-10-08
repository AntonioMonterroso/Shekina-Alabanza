import type { SVGProps } from 'react'

const P: Record<string, string[]> = {
  inicio: ['M4 10.5L12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-4v-6h-5v6h-4A1.5 1.5 0 0 1 4 19z'],
  cancionero: ['M9 18V5.5l11-2V16'],
  turnos: ['M3.5 10h17M8 3v4M16 3v4'],
  equipo: ['M2.5 19.5c0-3.3 2.9-5.5 6.5-5.5s6.5 2.2 6.5 5.5', 'M16 4.8a3.5 3.5 0 0 1 0 6.4M18.5 14.4c1.8.8 3 2.6 3 5.1'],
  servicios: ['M8 6h12M8 12h12M8 18h12'],
  ensayos: ['M5 11a7 7 0 0 0 14 0M12 18v3.5'],
  escenario: ['M8 21h8M12 17v4'],
  mas: ['M12 5v14M5 12h14'],
  chevron: ['M6 9l6 6 6-6'],
  derecha: ['M9 6l6 6-6 6'],
  check: ['M4 12.5l5 5L20 6.5'],
  alerta: ['M12 9v4M12 17h.01', 'M10.3 3.9L2.4 17.6A2 2 0 0 0 4.1 20.6h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z'],
  aviso: ['M4 10v4h3l6 4V6L7 10z', 'M17 9a4 4 0 0 1 0 6'],
  mundo: ['M3.5 12h17M12 3.5c2.5 2.6 3.5 5.4 3.5 8.5s-1 5.9-3.5 8.5c-2.5-2.6-3.5-5.4-3.5-8.5s1-5.9 3.5-8.5z'],
  perfil: ['M4.5 20c0-3.6 3.4-6 7.5-6s7.5 2.4 7.5 6'],
  proyeccion: ['M7 20h10M12 16v4'],
  atras: ['M15 6l-6 6 6 6'],
  candado: ['M8 11V8a4 4 0 0 1 8 0v3'],
  editar: ['M4 20h4L19 9l-4-4L4 16z', 'M13.5 6.5l4 4'],
  buscar: ['M20 20l-3.5-3.5'],
  borrar: ['M4 7h16M10 11v6M14 11v6', 'M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12', 'M9 7V4h6v3'],
  menos: ['M5 12h14'],
  audio: ['M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2'],
}

export type IconName = keyof typeof P

export default function Icon({ name, size = 22, ...rest }: { name: IconName; size?: number } & Omit<SVGProps<SVGSVGElement>, 'name'>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...rest}>
      {P[name]!.map((d) => <path key={d} d={d} />)}
      {name === 'cancionero' && (<><circle cx="6.5" cy="18" r="2.5" /><circle cx="17.5" cy="16" r="2.5" /></>)}
      {name === 'turnos' && (<><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M8.5 15l2 2 4-4" /></>)}
      {name === 'equipo' && <circle cx="9" cy="8" r="3.5" />}
      {name === 'servicios' && (<><circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" /></>)}
      {name === 'ensayos' && <rect x="8.5" y="2.5" width="7" height="12" rx="3.5" />}
      {name === 'escenario' && <rect x="3" y="4" width="18" height="13" rx="2.5" />}
      {name === 'mundo' && <circle cx="12" cy="12" r="8.5" />}
      {name === 'perfil' && <circle cx="12" cy="8" r="4" />}
      {name === 'candado' && <rect x="5" y="11" width="14" height="9.5" rx="2.5" />}
      {name === 'buscar' && <circle cx="11" cy="11" r="6.5" />}
      {name === 'proyeccion' && <rect x="3" y="4" width="18" height="12" rx="2" />}
    </svg>
  )
}
