import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon, { type IconName } from '../../components/Icon'
import { useToast } from '../../components/Toast'
import { useAuth } from '../../hooks/authContext'
import { jsonDeCopia, nombreDeCopia, todoEnUnTexto, zipDeChordPro } from '../../lib/exportar'
import { relativo } from '../../lib/tiempo'
import { anotarRespaldo, ultimoRespaldo } from '../../lib/respaldo'
import { armarCopia, cargarCanciones, entregar } from './exportarDatos'

type Trabajo = 'zip' | 'json' | 'txt'

const kb = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`)

export default function Exportar() {
  const { membresia } = useAuth()
  const toast = useToast()
  const [total, setTotal] = useState<number | null>(null)
  const [ocupado, setOcupado] = useState<Trabajo | null>(null)
  const [ultimo, setUltimo] = useState<string | null>(ultimoRespaldo())
  const grupo = membresia?.grupo

  useEffect(() => {
    if (!grupo) return
    void cargarCanciones(grupo.id).then((r) => setTotal(r.canciones.length))
  }, [grupo])

  async function hacer(t: Trabajo) {
    if (!grupo || ocupado) return
    setOcupado(t)
    try {
      const { canciones, desdeCopia } = await cargarCanciones(grupo.id)
      if (canciones.length === 0 && t !== 'json') return void toast('Aún no hay canciones que exportar')
      let nombre: string, blob: Blob, aviso = ''
      if (t === 'zip') {
        nombre = nombreDeCopia('cancionero-chordpro', 'zip')
        blob = new Blob([zipDeChordPro(canciones) as BlobPart], { type: 'application/zip' })
      } else if (t === 'txt') {
        nombre = nombreDeCopia('letras', 'txt')
        blob = new Blob([todoEnUnTexto(canciones)], { type: 'text/plain;charset=utf-8' })
      } else {
        if (!navigator.onLine) return void toast('La copia completa necesita internet')
        const copia = await armarCopia(grupo)
        nombre = nombreDeCopia('copia-completa', 'json')
        blob = new Blob([jsonDeCopia(copia)], { type: 'application/json' })
        if (copia.incompleto.length) aviso = ` (faltó: ${copia.incompleto.join(', ')})`
      }
      await entregar(nombre, blob)
      if (t !== 'txt') { anotarRespaldo(); setUltimo(new Date().toISOString()) }
      toast(`Listo: ${nombre} · ${kb(blob.size)}${desdeCopia ? ' · desde la copia del teléfono' : ''}${aviso}`)
    } catch {
      toast('No se pudo preparar el archivo. Intenta de nuevo.')
    } finally {
      setOcupado(null)
    }
  }

  const Opcion = ({ icono, titulo, texto, boton, trabajo, to }: { icono: IconName; titulo: string; texto: string; boton: string; trabajo?: Trabajo; to?: string }) => (
    <section className="tcard" style={{ padding: 14, gap: 10 }}>
      <div className="flex items-start gap-3">
        <span className="chip" style={{ background: 'var(--c-lila-bg)', color: 'var(--c-lila-fg)' }}><Icon name={icono} size={22} /></span>
        <span className="flex min-w-0 grow flex-col gap-0.5"><span className="text-base font-extrabold">{titulo}</span><span className="text-[13.5px] leading-snug" style={{ color: 'var(--muted)' }}>{texto}</span></span>
      </div>
      {to ? (
        <Link to={to} className="ghost-link">{boton}</Link>
      ) : (
        <button type="button" className="ghost-link" disabled={ocupado !== null} onClick={() => void hacer(trabajo!)}>
          {ocupado === trabajo ? <span className="spinner" style={{ borderColor: 'var(--line)', borderTopColor: 'var(--primary)', width: 18, height: 18 }} aria-label="Preparando" /> : <><Icon name="descarga" size={17} strokeWidth={2.2} />{boton}</>}
        </button>
      )}
    </section>
  )

  return (
    <div className="px-5 pt-[54px] pb-6">
      <header className="flex items-center gap-3.5">
        <Link to="/cancionero" className="iconbtn" aria-label="Volver al cancionero"><Icon name="atras" size={20} strokeWidth={2.2} /></Link>
        <div className="flex min-w-0 grow flex-col gap-0.5">
          <h1 className="display m-0 text-[28px] leading-[1.1] font-semibold tracking-[-0.02em]">Exportar</h1>
          <span className="text-[15px]" style={{ color: 'var(--muted)' }}>{total === null ? 'Cargando…' : `${total} ${total === 1 ? 'canción' : 'canciones'}`}</span>
        </div>
      </header>

      <p className="mt-4 mb-0 text-[14.5px] leading-snug" style={{ color: 'var(--muted)' }}>
        El cancionero es del ministerio: descárgalo cuando quieras. El archivo se arma en este teléfono y no se envía a ningún lado.
      </p>
      <p className="mt-2 mb-0 rounded-2xl px-3.5 py-2.5 text-[13.5px] font-bold" style={{ background: ultimo ? 'var(--soft)' : 'var(--c-ambar-bg)', color: ultimo ? 'var(--muted)' : 'var(--c-ambar-fg)' }}>
        {ultimo ? `Último respaldo en este dispositivo: ${relativo(ultimo)}` : 'Aún no has descargado un respaldo en este dispositivo.'} Guarda el archivo en un lugar seguro (Archivos, tu correo o tu computadora).
      </p>

      <div className="mt-4 flex flex-col gap-3">
        <Opcion icono="cancionero" titulo="Copia completa (JSON)" texto="Cancionero con fases y tonos, servicios, turnos, ensayos, avisos y equipo. Es la que sirve para restaurar si algo se pierde. No incluye la Escuela, contraseñas ni los audios." boton="Descargar copia completa" trabajo="json" />
        <Opcion icono="servicios" titulo="Archivos ChordPro (ZIP)" texto="Una letra con acordes por archivo (.pro). Sirve para abrirlas en otros programas o volver a cargarlas aquí en Cargar varias canciones." boton="Descargar ZIP" trabajo="zip" />
        <Opcion icono="ensayos" titulo="Solo letras (texto)" texto="Todas las letras sin acordes en un solo archivo de texto, para proyectar o compartir por mensaje." boton="Descargar texto" trabajo="txt" />
        <Opcion icono="inicio" titulo="Página para imprimir" texto="Las letras con acordes en una página limpia. La imprimes o la guardas como PDF para el ensayo." boton="Abrir la página" to="/cancionero/imprimir" />
      </div>
    </div>
  )
}
