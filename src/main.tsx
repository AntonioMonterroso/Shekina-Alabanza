import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './app/App'
import { instalarCapturaDeErrores } from './lib/errores'
// Tipografías incluidas en la app (funcionan sin internet). Fraunces con el eje SOFT que pide el diseño.
import '@fontsource-variable/fraunces/soft.css'
import '@fontsource-variable/nunito/index.css'
import './styles/index.css'

instalarCapturaDeErrores()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
