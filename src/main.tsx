import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { createFirestoreRepository } from './data/firebase'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App createRepository={createFirestoreRepository} />
  </StrictMode>,
)
