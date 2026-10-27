import { mountAvatar, renderRigGrid, renderVisemeGrid } from '@/avatar/index.ts'
import type { FaceAvatar } from '@/avatar/index.ts'

const app = document.querySelector<HTMLDivElement>('#app')

if (!app) {
  throw new Error('missing #app container')
}

app.innerHTML = `
  <header>
    <p class="eyebrow">Fase 3</p>
    <h1>Rosto SVG</h1>
    <p class="subtitle">Visemas, coarticulação e prévia de fala</p>
  </header>
  <div id="face-stage"></div>
  <p class="hint">?debug=1 abre os controles · ?grid=1 extremos · ?visemes=1 visemas</p>
`

const stage = app.querySelector<HTMLDivElement>('#face-stage')

if (!stage) {
  throw new Error('missing #face-stage container')
}

const search = new URLSearchParams(window.location.search)
const avatar = mountAvatar({
  container: stage,
  id: 'face',
  debug: search.get('debug') === '1',
})

if (search.get('grid') === '1') {
  renderRigGrid(document.body)
}

if (search.get('visemes') === '1') {
  renderVisemeGrid(document.body)
}

;(window as Window & { __avatar?: FaceAvatar }).__avatar = avatar

document.documentElement.dataset.ready = 'true'
document.documentElement.dataset.phase = '3'
