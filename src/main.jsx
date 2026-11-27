import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { markReady } from './utils/webUpdate'

// 예전 버전이 남긴 서비스 워커·캐시를 지운다. 남아 있으면 업데이트 뒤에도 옛 화면이 보인다.
// 서비스 워커가 이 화면을 붙잡고 있었으면 지운 뒤 한 번만 새로고침한다.
async function clearOldServiceWorker() {
  if (!('serviceWorker' in navigator)) return
  try {
    const regs = await navigator.serviceWorker.getRegistrations()
    await Promise.all(regs.map((r) => r.unregister()))
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
    }
    if (navigator.serviceWorker.controller && !sessionStorage.getItem('sw-cleared')) {
      sessionStorage.setItem('sw-cleared', '1')
      location.reload()
    }
  } catch {
    /* 지우지 못해도 앱은 그대로 쓴다 */
  }
}
clearOldServiceWorker()
// 자동 업데이트: 이 버전이 잘 떴다고 알린다(안 알리면 이전 버전으로 되돌림)
markReady()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
