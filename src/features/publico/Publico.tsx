import { useMemo, useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import Icon from '../../components/Icon'
import { diaNum, diaSemana, fechaLarga, hora, mesCorto } from '../../lib/fechas'
import { usePublico } from './usePublico'

type Filtro = 'todas' | 'alabanza' | 'adoracion'
const FILTROS: [Filtro, string][] = [['todas', 'Todas'], ['alabanza', 'Alabanza'], ['adoracion', 'Adoración']]
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export default function Publico() {
  const { slug } = useParams()
  const p = usePublico(slug)
  const [sel, setSel] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todas')
  const [aviso, setAviso] = useState('')

  const [titulo, setTitulo] = useState('')
  const [autor, setAutor] = useState('')
  const [nombreProp, setNombreProp] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [enviada, setEnviada] = useState('')

  const actual = p.servicios.find((s) => s.id === sel) ?? p.servicios[0] ?? null
  const lista = useMemo(() => {
    const t = norm(q.trim())
    return p.repertorio.filter((c) => (filtro === 'todas' || c.categoria === filtro) && (!t || norm(c.titulo).includes(t) || norm(c.autor ?? '').includes(t)))
  }, [p.repertorio, q, filtro])

  async function votar(id: string) {
    setAviso('')
    if (!(await p.alternarVoto(id))) setAviso('No se pudo guardar tu voto. Intenta de nuevo.')
  }

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (!titulo.trim()) return setError('Escribe el nombre de la canción.')
    setEnviando(true)
    setError('')
    const fallo = await p.proponer(titulo, autor, nombreProp)
    setEnviando(false)
    if (fallo) return setError(fallo)
    setEnviada(titulo.trim())
    setTitulo(''); setAutor(''); setNombreProp('')
  }

  if (p.cargando) return <div className="pantalla grid place-items-center"><span className="spinner" style={{ borderColor: 'var(--line)', borderTopColor: 'var(--primary)' }} aria-label="Cargando" /></div>
  if (p.error) return (
    <main className="pantalla grid place-items-center px-7 text-center">
      <div><h1 className="display m-0 text-[28px] font-semibold">No pudimos cargar la página</h1><p className="mt-2" style={{ color: 'var(--muted)' }}>Revisa tu conexión e intenta de nuevo.</p></div>
    </main>
  )

  const campo = 'h-[52px] w-full rounded-2xl border-[1.5px] px-4 text-base outline-none focus:shadow-[0_0_0_5px_var(--ring)]'
  const estiloCampo = { borderColor: 'var(--line)', background: 'var(--surface)', color: 'var(--ink)' }

  return (
    <main className="pantalla relative overflow-hidden">
      <div aria-hidden className="blob" style={{ width: 420, height: 380, right: -160, top: -160, background: 'var(--blob1)' }} />
      <div className="relative mx-auto flex w-full max-w-[1080px] flex-col gap-10 px-5 pt-6 pb-14">
        <header className="rise flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl" style={{ background: 'var(--surface)' }}>
              <span className="eq" aria-hidden style={{ height: 22 }}><span style={{ background: 'var(--leaf)', height: 22, width: 4 }} /><span style={{ background: 'var(--primary)', height: 22, width: 4 }} /><span style={{ background: 'var(--leaf)', height: 22, width: 4 }} /><span style={{ background: 'var(--primary)', height: 22, width: 4 }} /></span>
            </span>
            <span className="flex min-w-0 flex-col"><span className="truncate text-[17px] font-extrabold">{p.nombre}</span><span className="text-[13px] font-bold" style={{ color: 'var(--muted)' }}>Ministerio de alabanza</span></span>
          </div>
          <a href="#proponer" className="cta !h-12 !w-auto shrink-0 px-5 !text-[15px] no-underline" style={{ color: 'var(--on-primary)' }}><Icon name="mas" size={18} strokeWidth={2.4} />Proponer</a>
        </header>

        <section className="rise grid gap-7 md:grid-cols-[.9fr_1.25fr] md:gap-12" style={{ animationDelay: '80ms' }}>
          <div className="flex flex-col gap-4">
            <span className="eyebrow">{actual?.tipo ?? 'Próximo servicio'}</span>
            <h1 className="display m-0 text-[clamp(36px,6vw,60px)] leading-[1.02] font-semibold tracking-[-0.025em]">Lo que cantaremos</h1>
            {actual ? (
              <p className="m-0 text-lg leading-normal" style={{ color: 'var(--muted)' }}><b style={{ color: 'var(--ink)' }}>{fechaLarga(actual.fecha)}</b> · {hora(actual.fecha)}<br />Escúchalas antes y llega listo para cantar.</p>
            ) : (
              <p className="m-0 text-lg leading-normal" style={{ color: 'var(--muted)' }}>Todavía no se publica el orden del próximo servicio. Mientras tanto, mira el repertorio.</p>
            )}
            {p.servicios.length > 1 && (
              <div className="flex flex-wrap gap-2" role="tablist" aria-label="Servicios">
                {p.servicios.map((s) => (
                  <button key={s.id} type="button" role="tab" aria-selected={s.id === actual?.id} className={'schip' + (s.id === actual?.id ? ' on' : '')} onClick={() => setSel(s.id)}>
                    <small>{diaSemana(s.fecha)}</small><b>{diaNum(s.fecha)} {mesCorto(s.fecha)}</b>
                  </button>
                ))}
              </div>
            )}
          </div>

          {actual && (
            <div className="order" style={{ padding: 10, borderRadius: 28 }}>
              <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5">
                <span className="text-[15px] font-extrabold">Orden del servicio</span>
                <span className="text-[13px] font-bold" style={{ color: 'var(--muted)' }}>{actual.canciones.length} {actual.canciones.length === 1 ? 'canción' : 'canciones'}</span>
              </div>
              <ol className="m-0 flex list-none flex-col p-0">
                {actual.canciones.map((c, i) => (
                  <li key={c.orden} className="orow !gap-3.5 !p-3">
                    <span className="onum !h-9 !w-9 !text-[15px]">{i + 1}</span>
                    <span className="flex min-w-0 grow flex-col gap-0.5">
                      <span className="truncate text-[17px] font-extrabold">{c.titulo}</span>
                      <span className="truncate text-sm" style={{ color: 'var(--muted)' }}>{[c.autor, c.momento].filter(Boolean).join(' · ')}</span>
                    </span>
                    {c.tono && <span className="key shrink-0">Tono {c.tono}</span>}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </section>

        <section className="flex flex-col gap-5" aria-label="Repertorio">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="display m-0 text-[clamp(28px,4vw,38px)] font-semibold tracking-[-0.02em]">Repertorio</h2>
            <span className="text-[15px]" style={{ color: 'var(--muted)' }}>¿Quieres cantar alguna? Proponla con un toque.</span>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative min-w-0 flex-[1_1_260px]">
              <span className="pointer-events-none absolute top-[15px] left-4" style={{ color: 'var(--muted)' }}><Icon name="buscar" size={20} strokeWidth={2.2} /></span>
              <label htmlFor="q" className="sr-only">Buscar canción</label>
              <input id="q" type="search" className={campo + ' !h-[50px] !pl-12'} style={estiloCampo} placeholder="Buscar por canción o autor" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Tipo">
              {FILTROS.map(([id, texto]) => (
                <button key={id} type="button" role="tab" aria-selected={filtro === id} className={'more !h-11' + (filtro === id ? ' !text-[var(--on-primary)] !bg-[var(--primary)] !border-[var(--primary)]' : '')} onClick={() => setFiltro(id)}>{texto}</button>
              ))}
            </div>
          </div>
          {aviso && <p role="alert" className="m-0 text-sm font-bold" style={{ color: 'var(--danger)' }}>{aviso}</p>}
          <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(240px,1fr))]">
            {lista.map((c) => {
              const voto = p.mios.has(c.cancion_id)
              return (
                <article key={c.cancion_id} className="flex flex-col gap-3 rounded-3xl border-[1.5px] p-[18px]" style={{ background: 'var(--surface)', borderColor: 'var(--line)' }}>
                  <div className="flex flex-col gap-0.5"><h3 className="m-0 text-lg font-extrabold">{c.titulo}</h3><span className="text-sm" style={{ color: 'var(--muted)' }}>{c.autor ?? ' '}</span></div>
                  <div className="flex flex-wrap gap-1.5">
                    {c.categoria && <span className="key" style={{ background: c.categoria === 'alabanza' ? 'var(--c-ambar-bg)' : 'var(--c-lila-bg)', color: c.categoria === 'alabanza' ? 'var(--c-ambar-fg)' : 'var(--c-lila-fg)' }}>{c.categoria === 'alabanza' ? 'Alabanza' : 'Adoración'}</span>}
                    {c.tono && <span className="key">Tono {c.tono}</span>}
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-2">
                    <button type="button" aria-pressed={voto} className="more" style={voto ? { background: 'var(--primary)', borderColor: 'var(--primary)', color: 'var(--on-primary)' } : undefined} onClick={() => votar(c.cancion_id)}>
                      <Icon name="corazon" size={18} strokeWidth={2} fill={voto ? 'currentColor' : 'none'} />{voto ? 'Propuesta' : 'Proponer'}
                    </button>
                    <span className="text-[13px] font-bold" style={{ color: 'var(--muted)' }}>{c.votos === 0 ? 'Sé el primero' : c.votos === 1 ? '1 voto' : `${c.votos} votos`}</span>
                  </div>
                </article>
              )
            })}
          </div>
          {lista.length === 0 && (
            <p className="m-0 p-6 text-center text-base" style={{ color: 'var(--muted)' }}>
              {p.repertorio.length === 0 ? 'Aún no hay canciones públicas.' : 'No la encontramos en el repertorio. Puedes sugerirla abajo.'}
            </p>
          )}
        </section>

        <section id="proponer" className="relative overflow-hidden rounded-[32px] p-[clamp(24px,5vw,48px)]" style={{ background: 'var(--card)' }}>
          {enviada ? (
            <div role="status" className="flex flex-col items-start gap-3.5">
              <span className="grid h-16 w-16 place-items-center rounded-[22px]" style={{ background: 'var(--primary)', color: 'var(--on-primary)' }}><Icon name="check" size={30} strokeWidth={2.6} /></span>
              <h2 className="display m-0 text-[clamp(26px,4vw,36px)] font-semibold">¡Gracias por tu sugerencia!</h2>
              <p className="m-0 text-base" style={{ color: 'var(--muted)' }}>Recibimos «{enviada}». El equipo de alabanza la revisará.</p>
              <button type="button" className="more" onClick={() => setEnviada('')}>Sugerir otra</button>
            </div>
          ) : (
            <form onSubmit={enviar} className="relative flex flex-col gap-5">
              <div className="flex max-w-[560px] flex-col gap-1.5">
                <h2 className="display m-0 text-[clamp(26px,4vw,36px)] font-semibold tracking-[-0.02em]">¿Falta una canción?</h2>
                <p className="m-0 text-base leading-normal" style={{ color: 'var(--muted)' }}>Sugiérela y el equipo de alabanza la revisará para un próximo servicio.</p>
              </div>
              <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
                <div className="flex flex-col gap-1.5"><label htmlFor="f1" className="text-sm font-extrabold">Canción</label><input id="f1" className={campo} style={estiloCampo} maxLength={120} placeholder="Nombre de la canción" value={titulo} onChange={(e) => setTitulo(e.target.value)} /></div>
                <div className="flex flex-col gap-1.5"><label htmlFor="f2" className="text-sm font-extrabold">Autor o intérprete <span className="font-semibold" style={{ color: 'var(--muted)' }}>(opcional)</span></label><input id="f2" className={campo} style={estiloCampo} maxLength={120} placeholder="¿Quién la canta?" value={autor} onChange={(e) => setAutor(e.target.value)} /></div>
                <div className="flex flex-col gap-1.5"><label htmlFor="f3" className="text-sm font-extrabold">Tu nombre <span className="font-semibold" style={{ color: 'var(--muted)' }}>(opcional)</span></label><input id="f3" className={campo} style={estiloCampo} maxLength={80} placeholder="Para agradecerte" value={nombreProp} onChange={(e) => setNombreProp(e.target.value)} /></div>
              </div>
              <div className="flex flex-wrap items-center gap-3.5">
                <button type="submit" disabled={enviando} className="cta !h-12 !w-auto px-6 !text-[15px]">{enviando ? <span className="spinner" aria-label="Enviando" /> : <>Enviar sugerencia</>}</button>
                {error && <span role="alert" className="text-sm font-bold" style={{ color: 'var(--danger)' }}>{error}</span>}
              </div>
            </form>
          )}
        </section>

        <footer className="flex flex-wrap justify-between gap-2 text-sm" style={{ color: 'var(--muted)' }}>
          <span>{p.nombre} · Ministerio de alabanza</span><span>Actualizado por el equipo cada semana</span>
        </footer>
      </div>
    </main>
  )
}
