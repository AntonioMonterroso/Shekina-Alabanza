import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import Icon from './Icon'

const Ctx = createContext<(msg: string) => void>(() => {})
export const useToast = () => useContext(Ctx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState('')
  const [k, setK] = useState(0)
  const timer = useRef<number | undefined>(undefined)
  const mostrar = useCallback((m: string) => {
    clearTimeout(timer.current)
    setMsg(m)
    setK((n) => n + 1)
    timer.current = window.setTimeout(() => setMsg(''), 2400)
  }, [])
  return (
    <Ctx.Provider value={mostrar}>
      {children}
      {msg && (
        <div key={k} className="toast" role="status">
          <Icon name="check" size={16} strokeWidth={2.6} />
          <span>{msg}</span>
        </div>
      )}
    </Ctx.Provider>
  )
}
