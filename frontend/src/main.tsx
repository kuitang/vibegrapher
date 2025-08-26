import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import useAppStore from './store/useAppStore'
import './test-diff-review'

// Expose store for testing in development
declare global {
  interface Window {
    __appStore: typeof useAppStore
    testDiffReview: () => void
  }
}

if (import.meta.env.DEV) {
  window.__appStore = useAppStore
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
