window.addEventListener('error', (event) => {
  document.body.innerHTML = '<pre style="white-space:pre-wrap;padding:20px;color:red;background:white;font-size:16px;">RUNTIME ERROR:\n\n' + String(event.error?.stack || event.message || event.error) + '</pre>'
})

window.addEventListener('unhandledrejection', (event) => {
  document.body.innerHTML = '<pre style="white-space:pre-wrap;padding:20px;color:red;background:white;font-size:16px;">PROMISE ERROR:\n\n' + String(event.reason?.stack || event.reason) + '</pre>'
})

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
