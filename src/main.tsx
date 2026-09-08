import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import './desk.css'
import { App } from './web/App'

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
