# Rosto SVG

Avatar de rosto em SVG para agentes de IA: lip-sync pt-BR, emoções interpoláveis e micro-movimentos naturais, sem bibliotecas de animação.

## Requisitos

- Node.js 24+
- Chave Fish Audio em `.env` (`API_KEY_FISHAUDIO=...`) — opcional em desenvolvimento com mock

Copie `.env.example` para `.env` se ainda não existir.

## Scripts

```bash
npm install
npm run dev          # demo Vite em http://localhost:5173
npm run server       # API + build estático (porta 8787)
npm run build
npm test             # testes unitários
npm run test:visual  # Playwright + snapshots
```

Para desenvolver TTS sem chamar a API real:

```bash
FISHAUDIO_MOCK=1 npm run server
```

O Vite em `npm run dev` faz proxy de `/api/*` para o servidor quando ele estiver no ar.

## Uso do componente

```ts
import { mountAvatar } from './src/avatar/index.ts'
import type { FaceAvatar } from './src/avatar/index.ts'

const avatar: FaceAvatar = mountAvatar({
  container: document.querySelector('#face-stage')!,
  persona: {
    voiceId: '',
    model: 's2.1-pro-free',
    format: 'opus',
    language: 'pt-BR',
    defaultMood: 'neutral',
    intensity: 1,
    blinkRange: [2, 6],
    headAccentRate: 0.35,
  },
})

await avatar.unlock() // primeiro gesto do usuário
await avatar.say({ text: 'Olá! Eu falo português.', emotion: 'happy' })
avatar.setEmotion('thinking', { weight: 0.8 })
avatar.interrupt()
```

### API pública

| Método | Descrição |
|---|---|
| `say({ text, emotion?, queue?, nocache? })` | Gera e sincroniza fala; interrompe a atual salvo `queue: true` |
| `setEmotion(name, { weight?, layer? })` | Mood (300–600 ms) ou reaction (1–3 s) |
| `setEmotionMix(entries)` | Mistura ponderada de presets |
| `react(name)` | Camada de reação com decay |
| `interrupt()` | Fade de áudio ~150 ms e volta ao idle |
| `unlock()` | Resume o `AudioContext` no gesto do usuário |
| `setParams` / `setTarget` | Ajuste direto dos 29 canais (debug) |
| `on(event, handler)` | `speechstart` · `viseme` · `speechend` · `error` · `syncwarn` |
| `destroy()` | Para o loop e limpa o DOM |

`persona.json` na raiz valida voz, modelo, humor padrão, intensidade, intervalo de piscar e taxa de ênfase de cabeça.

Para **pt-BR**, mantenha `"language": "pt-BR"` e um `voiceId` de voz portuguesa da [Voice Library](https://fish.audio) (`reference_id`). O campo `language` só normaliza o texto; o sotaque vem da voz.

## Demo e debug

| Query | Efeito |
|---|---|
| `?debug=1` | Sliders dos 29 canais + emoções + loops de lipsync |
| `?emotions=1` | Grade 5 emoções × 3 visemas |
| `?grid=1` | Extremos de cada canal |
| `?visemes=1` | 12 visemas |
| `?nocache=1` | Força nova geração no Fish |

Acessibilidade: `aria-live` anuncia o texto falado; `prefers-reduced-motion: reduce` remove drift e nods, mantém fala e piscar.

## Arquitetura

```
texto → /api/tts → Fish SSE (ou mock)
      → chunks + alignment
      → timeline grafema→visema (pt-BR)
      → solver spring + emoção + idle
      → SVG (data-part)
```

Relógio mestre: `AudioContext.currentTime`. Sem alignment, a boca não inventa fala.

Pastas: `src/core` · `src/face` · `src/lipsync` · `src/audio` · `src/avatar` · `server` · `demo` · `tests` · `docs`.

## Critérios de aceite

1. Frase pt-BR audível em < 2 s do clique  
2. Visemas suavizados (spring + coarticulação)  
3. Emoções trocáveis ao vivo sem resetar a fala  
4. Idle contínuo (piscar, drift, gaze, respiração)  
5. 60 fps com painel de debug  
6. Falha do Fish → “voz indisponível” + idle  
7. `prefers-reduced-motion` remove drift/nods e mantém a fala  

Detalhes em [`docs/SPEC.md`](./docs/SPEC.md) e progresso em [`docs/TODO.md`](./docs/TODO.md).
