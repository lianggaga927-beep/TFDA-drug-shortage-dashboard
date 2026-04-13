import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
// 👇 這行非常重要！沒有它，Tailwind 就不會啟動
import './index.css' 

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)