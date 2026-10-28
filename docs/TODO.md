# TODO — Rosto SVG para agentes de IA

Plano de execução derivado de [`SPEC.md`](./SPEC.md). Cada fase termina com algo **verificável** (demo, screenshot ou teste). Marque os itens conforme forem concluídos.

Legenda: `[ ]` pendente · `[~]` em andamento · `[x]` concluído

> **Ambiente:** o projeto foi migrado de `E:\rosto-svg` (volume removível FAT32 que corrompeu arquivos) para `C:\Users\Gabriell\Projetos\rosto-svg` (NTFS). O `E:` não deve mais ser usado. A chave `API_KEY_FISHAUDIO` foi perdida na corrupção e precisa ser reinserida no `.env`.

## Status geral

| Fase | Entrega | Status |
|---|---|---|
| 0 | Fundação do projeto | `[x]` |
| 1 | Rosto SVG riggável | `[x]` |
| 2 | Canais, solver e painel de debug | `[x]` |
| 3 | Lip-sync determinístico | `[x]` |
| 4 | Emoções e blending | `[x]` |
| 5 | Integração FishAudio | `[x]` |
| 6 | Naturalidade, performance e acessibilidade | `[x]` |

---

## Fase 0 — Fundação do projeto

**Objetivo:** projeto roda vazio, tipado e testável, sem nenhuma decisão de arte ainda.

- [x] Criar `package.json` (privado, ESM, engines Node >= 24).
- [x] Instalar Vite + TypeScript (strict) como dev deps.
- [x] Instalar Playwright (apenas para screenshots de regressão).
- [x] Configurar `tsconfig.json` com `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`.
- [x] Configurar `vite.config.ts` (root `demo/`, alias `@/` → `src/`).
- [x] Criar estrutura de pastas: `src/core`, `src/face`, `src/lipsync`, `src/audio`, `src/avatar`, `server`, `demo`, `tests`, `docs`.
- [x] Definir regra de dependência: `face`/`lipsync`/`audio` → `core`; `avatar` → todos; `core` não importa ninguém.
- [x] Criar `demo/index.html` + `demo/main.ts` com placeholder.
- [x] Garantir que `.env` continua ignorado (já está) e documentar `API_KEY_FISHAUDIO` em `.env.example`.
- [x] Scripts: `dev`, `build`, `preview`, `test`, `test:visual`.

**Verificação:** `npm run dev` abre página em branco sem erro de console; `npm run build` passa.

**Executado:** `npm run build` OK · `npm test` 3/3 · Playwright smoke (`tests/visual/foundation.spec.ts`) OK · Vite 7.3.7 + TypeScript 5.9.3 + Node 24.

---

## Fase 1 — Rosto SVG riggável

**Objetivo:** cabeça de homem negro com boné amarelo dos Lakers, óculos dourados, bigode e cavanhaque, estática, com todas as camadas nomeadas que o rig vai manipular.

- [x] Definir `viewBox` e proporções (cabeça ~1000×1200 unidades), fundo transparente.
- [x] Criar paleta de pele com 3–4 tons em gradientes suaves (luz principal no alto-esquerda).
- [x] Desenhar silhueta da cabeça, orelhas e pescoço truncado com fade escuro.
- [x] Desenhar boné: copa com costuras, botão, aba larga e sombra projetada sob a testa.
- [x] Recriar o logo dos Lakers (bola de basquete + lettering "LOS ANGELES / LAKERS").
- [x] Desenhar óculos dourados: armação, lentes, ponte, hastes até as orelhas e reflexos.
- [x] Desenhar sobrancelhas densas (esquerda e direita como paths separados).
- [x] Desenhar olhos: esclera, íris, pupila, brilho especular, pálpebra superior e inferior separadas.
- [x] Desenhar nariz com narinas, asas e sombra lateral.
- [x] Desenhar boca completa: cavidade, dentes superiores, dentes inferiores, língua, lábio superior e inferior em tons distintos.
- [x] Desenhar bigode e cavanhaque com textura de fios.
- [x] Aplicar convenção de nomes `data-part="..."` para cada elemento riggável.
- [x] Documentar o mapa de camadas em `docs/RIG-MAP.md` (part → canal(is) que a move).
- [x] Garantir que cada `data-part` tem `transform-box: fill-box` e origem definida.
- [x] Medir tamanho do SVG inline (meta: < 80 KB).

**Verificação:** screenshot do rosto neutro em `tests/snapshots/face-neutral.png`; mapa de camadas revisado.

**Executado:** 37 `data-part` com origem própria · SVG 29.127 bytes (6.263 gzip) · `npm run build` OK · `npm test` 9/9 · Playwright 2/2 · `docs/RIG-MAP.md` atualizado · screenshot revisado em `tests/snapshots/face-neutral.png`.

---

## Fase 2 — Canais, solver e painel de debug

**Objetivo:** o rosto se move sem áudio, por sliders, com movimento suave e limitado.

- [x] Definir `RigParams` com os 29 canais em `src/core/params.ts` (tipo + range + default).
- [x] Implementar `clampParams` e `mergeParams` (aditivo com clamp por canal).
- [x] Implementar solver spring/damper por canal (stiffness, damping, dt fixo).
- [x] Definir interface `RigBackend` (`apply(params)`, `reset()`, `getBounds()`).
- [x] Implementar `SvgRigBackend`: mapear cada canal para transform/atributo do `data-part`.
- [x] Implementar loop único com `requestAnimationFrame` (um só para todo o app).
- [x] Criar painel `?debug=1`: sliders para todos os canais, valor atual e alvo.
- [x] Criar botão "reset" e presets de debug (neutral, extremes).
- [x] Rodar script Playwright que gera grade de screenshots dos extremos de cada canal.
- [x] Medir frame time com painel aberto (meta: < 6 ms por frame em 1000×1200).

**Verificação:** todos os 29 canais movem visivelmente a parte correta; grade de screenshots gerada; sem jank.

**Executado:** 29 canais em `src/core/params.ts` · solver spring com dt fixo e clamp por canal · `SvgRigBackend` + loop rAF único · painel `?debug=1` com 29 sliders, valor atual/alvo, reset e extremos · grade `?grid=1` com 58 estados · `npm test` 22/22 · Playwright 4/4 · frame JS ~0.1 ms no Chromium headless (< 6 ms) · JS de produção 41.92 kB (11.45 kB gzip).

---

## Fase 3 — Lip-sync determinístico

**Objetivo:** dada uma timeline fixa (mock), a boca fala de forma convincente e suave, sem Fish.

- [x] Definir os 12 visemas como combinações de canais em `src/lipsync/visemes.ts`.
- [x] Criar tabela grafema→visema para pt-BR (vogais, consoantes, dígrafos `ão`, `em`, `ch`, `lh`, `nh`, `rr`, `ss`, `qu`, `gu`).
- [x] Criar dicionário de exceções para palavras frequentes.
- [x] Implementar tokenização de palavra em unidades faladas + pesos por classe (vogal longa, oclusiva curta, nasal alongada, sibilante).
- [x] Implementar `buildWordTimeline(word, start, end)` com distribuição ponderada.
- [x] Implementar montagem de timeline global (`WordSegment[] → VisemeEvent[]`).
- [x] Implementar coarticulação: janela ±120 ms misturando visemas vizinhos.
- [x] Implementar prévia `?debug=1`: loop automático de visemas + loop de frase mock.
- [x] Escrever testes unitários (`node:test`) para tokenização, dígrafos, pesos e não-sobreposição de tempos.
- [x] Validar visualmente: grade dos 12 visemas + screenshot do loop em `?debug=1`.

**Verificação:** `npm test` verde; loop de visemas sem "piscadas" de boca; dígrafos pt-BR corretos.

**Executado:** 12 visemas em `src/lipsync/visemes.ts` · tabela grafema→visema, dígrafos e exceções em `phonemes.ts` · timeline ponderada sem sobreposição e coarticulação ±120 ms em `timeline.ts` · `LipSyncPlayer` via `RigDriver` · loop de visemas e frase mock no `?debug=1` · grade `?visemes=1` com 12 visemas · `npm test` 33/33 · Playwright 6/6 · JS de produção 48.67 kB (13.75 kB gzip) · screenshots `tests/snapshots/visemes.png` e `lipsync.png`.

---

## Fase 4 — Emoções e blending

**Objetivo:** emoções trocáveis ao vivo, sem resetar a fala, com transições orgânicas.

- [x] Definir presets: `neutral`, `happy`, `sad`, `surprised`, `thinking`.
- [x] Implementar camadas `mood` (transição 300–600 ms) e `reaction` (decay 1–3 s).
- [x] Implementar composição: visema (base) + emoção (delta) + clamp por canal.
- [x] Implementar normalização de pesos e mistura de múltiplos presets.
- [x] Implementar micro-expressão de flash (80–150 ms) antes do mood assentar.
- [x] Implementar parser opt-in de tag `[EMO:x]` no texto.
- [x] Criar painel de debug para emoções (peso, camada, TTL).
- [x] Gerar grade de screenshots: 5 presets × 3 visemas (A, MBP, O).
- [x] Testar troca de emoção durante fala (sem reset de boca, sem salto visual).

**Verificação:** 3 emoções trocadas ao vivo durante uma frase; screenshots revisados.

**Executado:** 5 presets + 5 flashes em `src/core/emotion.ts` · `EmotionMixer` com mood 300–600 ms, reaction 1–3 s, flash 80–150 ms, normalização de pesos e blend de presets em `src/core/emotion-mixer.ts` · `RigEngine.setModifier` separa alvo base (visema/slider) do alvo composto, aplicando delta de emoção com clamp por canal · parser `[EMO:x]` em `src/core/emotion-tags.ts` e cues na timeline mock · painel `?debug=1` com 5 presets, peso, mood/reaction, TTL e frase com tag · grade `?emotions=1` com 15 células · `npm test` 65/65 · Playwright 8/8 (troca feliz → triste → surpreso durante a frase e decaimento da reação) · build OK · JS 60.18 kB (17.37 kB gzip) · screenshot `tests/snapshots/emotions.png`.

---

## Fase 5 — Integração FishAudio

**Objetivo:** frase real em pt-BR com áudio do Fish e boca sincronizada ao relógio do áudio.

- [x] Criar `server/index.ts` (Node) que serve o build e expõe `POST /api/tts`.
- [x] Ler `API_KEY_FISHAUDIO` do `.env` **somente no servidor**.
- [x] Implementar chamada SSE `POST /v1/tts/stream/with-timestamp` (`s2.1-pro`, `pt-BR`, `opus`, `balanced`).
- [x] Parsear eventos: `audio_base64`, `chunk_seq`, `chunk_audio_offset_sec`, `alignment.segments`.
- [x] Repassar ao cliente via stream (SSE/NDJSON) sem bufferizar tudo.
- [x] Implementar cache em disco (LRU + TTL) por `hash(texto+voice+model+emoção)`.
- [x] Implementar `?nocache=1` para forçar geração.
- [x] Implementar `AudioContext` + fila de chunks + buffer de 250–300 ms.
- [x] Usar `AudioContext.currentTime` como relógio mestre (sem `setTimeout` para boca).
- [x] Montar timeline incrementalmente conforme o alignment chega (nunca inventar).
- [x] Emitir `syncwarn` quando o alignment atrasar além do buffer.
- [x] Implementar `unlock()` (primeiro gesto) e estado visual "clique para ouvir".
- [x] Implementar `say()` com interrupção (fade 150 ms) e `{ queue: true }`.
- [x] Implementar estados de erro: "voz indisponível" + idle (sem mock em produção).
- [x] Emitir eventos `speechstart`, `viseme`, `speechend`, `error`.
- [x] Criar `persona.json` + validação (voiceId, model, defaultMood, intensity, blinkRange, headAccentRate).

**Verificação:** frase digitada toca em < 2 s; boca acompanha palavra a palavra; repetir a frase bate no cache.

**Executado:** modelo **`s2.1-pro-free`** (crédito zero) validado com a API real · `server/index.ts` + `app.ts` servindo `dist/` e `/api/tts`, `/api/persona`, `/api/health` sem framework · `fish.ts` com SSE `with-timestamp`, header `model`, `language: pt-BR`, `format: opus`, `latency: balanced` e `reference_id` opcional · eventos normalizados e repassados em NDJSON sem bufferizar · cache em disco LRU+TTL (7 dias, 128 entradas) com `?nocache=1` · `persona.json` validado · cliente com `AudioQueue` (buffer 280 ms, `AudioContext.currentTime`, WAV incremental e decodeAudioData para opus/mp3, fade 150 ms) · timeline incremental por `chunk_seq` + `chunk_audio_offset_sec` · `syncwarn`, interrupção, `{ queue: true }`, estados de erro e eventos `speechstart`/`viseme`/`speechend`/`error` · demo com gate "clique para ouvir", frase, emoção e status · `FISHAUDIO_MOCK=1` só para desenvolvimento · `npm test` 95/95 · Playwright 10/10 · build OK · JS 78.12 kB (23.15 kB gzip) · screenshot `tests/snapshots/speech.png`.

**Medido na API real (free):** primeira fala em **1.008 ms** após o clique (meta < 2 s), boca com 34 amostras distintas de `jawOpen` (0,02–0,90) durante a frase, fim em 5,5 s; repetição com **cache em 198 ms** (`falando · cache`). Áudio Opus (`OggS`) decodificado progressivamente no Chromium.

---

## Fase 6 — Naturalidade, performance e acessibilidade

**Objetivo:** o rosto parece vivo quando calado e continua estável sob carga.

- [x] Implementar drift de cabeça por ruído (PRNG próprio).
- [x] Implementar piscar com jitter 2–6 s, assimetria, piscada dupla ocasional e blink de antecipação.
- [x] Implementar micro-sacadas + tremor de gaze (olhar à frente).
- [x] Implementar respiração modulando pitch e fade do pescoço.
- [x] Implementar ênfase prosódica (energia do AnalyserNode → nods + sobrancelha assimétrica).
- [x] Implementar tensão labial residual entre palavras.
- [x] Implementar `prefers-reduced-motion` (remove drift/nods, mantém fala e piscar).
- [x] Implementar `aria-live` com o texto falado.
- [x] Perfilar: 60 fps com painel aberto; otimizar pontos quentes.
- [x] Auditar orçamentos: SVG < 80 KB, JS < 60 KB gzip, zero libs de animação.
- [x] Congelar snapshots de regressão visual (pixel-diff a partir daqui).
- [x] Escrever `README.md` (instalação, uso do componente, API, debug).
- [x] Revisão final dos 7 critérios de aceite da spec.

**Verificação:** idle contínuo sem repetição perceptível; critérios de aceite satisfeitos.

**Executado:** `IdleSimulator` com PRNG próprio (`src/core/prng.ts`, `src/core/idle.ts`) — drift, blink 2–6 s com assimetria/dupla/antecipação, micro-sacadas + tremor de gaze, respiração, ênfase prosódica via `AnalyserNode.energy` · `ResidualLips` entre palavras · `prefers-reduced-motion` remove drift/nods · `aria-live` no texto falado · `README.md` · `npm test` 102/102 · Playwright idle + regressões · build OK · JS 84.79 kB (25.31 kB gzip) · SVG < 80 KB · frame < 6 ms · screenshot `tests/snapshots/idle.png`.

---

## Dependências entre fases

```
0 → 1 → 2 → 3 → 4 → 5 → 6
```

- Fase 2 depende da Fase 1 (precisa das camadas).
- Fase 4 depende da Fase 3 (emoção soma sobre visema).
- Fase 5 depende da Fase 3 e 4 (áudio precisa de timeline e emoção).
- Fase 6 depende de tudo.

## Como acompanhar

Ao fim de cada fase eu reporto: o que foi feito, o que foi verificado, screenshot/rota de demo e o que ficou fora. Nenhuma fase é marcada `[x]` sem a verificação correspondente passar.
