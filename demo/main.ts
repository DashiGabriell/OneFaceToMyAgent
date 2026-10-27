const app = document.querySelector<HTMLDivElement>('#app')

if (!app) {
  throw new Error('missing #app container')
}

app.innerHTML = '<strong>Rosto SVG</strong><small>Fase 0 — fundação</small>'
document.documentElement.dataset.ready = 'true'
