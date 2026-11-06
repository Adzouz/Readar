import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/geist'
import '@fontsource-variable/newsreader'
import '@fontsource-variable/bricolage-grotesque'
import './styles.css'
import { App } from './App'
import { connectDeckToSetup } from './onboarding/connectDeck'

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root element')

connectDeckToSetup()

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
