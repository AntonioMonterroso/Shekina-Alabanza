import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/authContext'
import { permisos } from '../../lib/permisos'
import { supabase } from '../../lib/supabase'

/** Qué parte de la Escuela le toca a cada quien. */
export function useAccesoEscuela() {
  const { membresia, rol } = useAuth()
  const p = permisos(rol)
  const [ensena, setEnsena] = useState(false)
  const [inscrito, setInscrito] = useState(false)
  const miId = membresia?.id

  // ¿Es maestro de alguna clase? (también aplica a músicos y líderes del equipo)
  useEffect(() => {
    if (!miId) return
    void supabase.from('escuela_clases').select('id', { count: 'exact', head: true }).eq('maestro_id', miId).eq('activo', true)
      .then(({ count }) => setEnsena((count ?? 0) > 0))
    // ¿Está inscrito en alguna clase? (un alumno que ya pasó al equipo sigue estudiando)
    void supabase.from('escuela_inscripciones').select('clase_id', { count: 'exact', head: true }).eq('alumno_id', miId).eq('activo', true)
      .then(({ count }) => setInscrito((count ?? 0) > 0))
  }, [miId])

  const coordina = p.esLider || Boolean(membresia?.coordina_escuela)
  const estudia = rol === 'alumno' || inscrito
  const esTutor = rol === 'tutor'
  return { coordina, ensena: ensena || rol === 'maestro', estudia, esTutor, verEscuela: p.esExterno || coordina || ensena || inscrito }
}
