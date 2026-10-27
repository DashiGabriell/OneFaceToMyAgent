# TODO — Rosto SVG para agentes de IA

Plano de execução derivado de [`SPEC.md`](./SPEC.md). Cada fase termina com algo **verificável** (demo, screenshot ou teste). Marque os itens conforme forem concluídos.

Legenda: `[ ]` pendente · `[~]` em andamento · `[x]` concluído

> **Ambiente:** o projeto foi migrado de `E:\rosto-svg` (volume removível FAT32 que corrompeu arquivos) para `C:\Users\Gabriell\Projetos\rosto-svg` (NTFS). O `E:` não deve mais ser usado. A chave `API_KEY_FISHAUDIO` foi perdida na corrupção e precisa ser reinserida no `.env`.

## Status geral

| Fase | Entrega | Status |
|---|---|---|
| 0 | Fundação do projeto | `[x]` |
| 1 | Rosto SVG riggável | `[ ]` |
| 2 | Canais, solver e painel de debug | `[ ]` |
| 3 | Lip-sync determinístico | `[ ]` |
| 4 | Emoções e blending | `[ ]` |
| 5 | Integração FishAudio | `[ ]` |
| 6 | Naturalidade, performance e acessibilidade | `[ ]` |

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

**Objetivo:** cabeça de homem negro, corte social, estática, com todas as camadas nomeadas que o rig vai manipular.

- [ ] Definir `viewBox` e proporções (cabeça ~1000×1200 unidades), fundo transparente.
- [ ] Criar paleta de pele com 3–4 tons em gradientes suaves (luz principal no alto-esquerda).
- [ ] Desenhar silhueta da cabeça e orelhas.
- [ ] Desenhar pescoço truncado com fade suave (sem corte reto).
- [ ] Desenhar cabelo corte social: laterais curtas + topo levemente maior, com 3–4 camadas de volume.
- [ ] Desenhar sobrancelhas densas (esquerda e direita como paths separados).
- [ ] Desenhar olhos: esclera, íris, pupila, brilho especular, pálpebra superior e inferior separadas.
- [ ] Desenhar nariz com narinas e sombra lateral.
- [ ] Desenhar boca completa: cavidade, dentes superiores, dentes inferiores, língua, lábio superior e inferior em tons distintos.
- [ ] Aplicar convenção de nomes `data-part="..."` para cada elemento riggável.
- [ ] Documentar o mapa de camadas em `docs/RIG-MAP.md` (part → canal(is) que a move).
- [ ] Garantir que cada `data-part` tem `transform-box: fill-box` e origem definida.
- [ ] Medir tamanho do SVG inline (meta: < 80 KB).

**Verificação:** screenshot do rosto neutro em `tests/snapshots/face-neutral.png`; mapa de camadas revisado.

---

## Fase 2 — Canais, solver e painel de debug

**Objetivo:** o rosto se move sem áudio, por sliders, com movimento suave e limitado.

- [ ] Definir `RigParams` com os 22 canais em `src/core/params.ts` (tipo + range + default).
- [ ] Implementar `clampParams` e `mergeParams` (aditivo com clamp por canal).
- [ ] Implementar solver spring/damper por canal (stiffness, damping, dt fixo).
- [ ] Definir interface `RigBackend` (`apply(params)`, `reset()`, `getBounds()`).
- [ ] Implementar `SvgRigBackend`: mapear cada canal para transform/atributo do `data-part`.
- [ ] Implementar loop único com `requestAnimationFrame` (um só para todo o app).
- [ ] Criar painel `?debug=1`: sliders para todos os canais, valor atual e alvo.
- [ ] Criar botão "reset" e presets de debug (neutral, extremes).
- [ ] Rodar script Playwright que gera grade de screenshots dos extremos de cada canal.
- [ ] Medir frame time com painel aberto (meta: < 6 ms por frame em 1000×1200).

**Verificação:** todos os 22 canais movem visivelmente a parte correta; grade de screenshots gerada; sem jank.

---

## Fase 3 — Lip-sync determinístico

**Objetivo:** dada uma timeline fixa (mock), a boca fala de forma convincente e suave, sem Fish.

- [ ] Definir os 12 visemas como combinações de canais em `src/lipsync/visemes.ts`.
- [ ] Criar tabela grafema→visema para pt-BR (vogais, consoantes, dígrafos `ão`, `em`, `ch`, `lh`, `nh`, `rr`, `ss`, `qu`, `gu`).
- [ ] Criar dicionário de exceções para palavras frequentes.
- [ ] Implementar tokenização de palavra em unidades faladas + pesos por classe (vogal longa, oclusiva curta, nasal alongada, sibilante).
- [ ] Implementar `buildWordTimeline(word, start, end)` com distribuição ponderada.
- [ ] Implementar montagem de timeline global (`WordSegment[] → VisemeEvent[]`).
- [ ] Implementar coarticulação: janela ±120 ms misturando visemas vizinhos.
- [ ] Implementar prévia `?debug=1`: loop automático de visemas + loop de frase mock.
- [ ] Escrever testes unitários (`node:test`) para tokenização, dígrafos, pesos e não-sobreposição de tempos.
- [ ] Validar visualmente: gravar 10 s de loop de visemas e revisar quadro a quadro.

**Verificação:** `npm test` verde; loop de visemas sem "piscadas" de boca; dígrafos pt-BR corretos.

---

## Fase 4 — Emoções e blending

**Objetivo:** emoções trocáveis ao vivo, sem resetar a fala, com transições orgânicas.

- [ ] Definir presets: `neutral`, `happy`, `sad`, `surprised`, `thinking`.
- [ ] Implementar camadas `mood` (transição 300–600 ms) e `reaction` (decay 1–3 s).
- [ ] Implementar composição: visema (base) + emoção (delta) + clamp por canal.
- [ ] Implementar normalização de pesos e mistura de múltiplos presets.
- [ ] Implementar micro-expressão de flash (80–150 ms) antes do mood assentar.
- [ ] Implementar parser opt-in de tag `[EMO:x]` no texto.
- [ ] Criar painel de debug para emoções (peso, camada, TTL).
- [ ] Gerar grade de screenshots: 5 presets × 3 visemas (A, MBP, O).
- [ ] Testar troca de emoção durante fala (sem reset de boca, sem salto visual).

**Verificação:** 3 emoções trocadas ao vivo durante uma frase; screenshots revisados.

---

## Fase 5 — Integração FishAudio

**Objetivo:** frase real em pt-BR com áudio do Fish e boca sincronizada ao relógio do áudio.

- [ ] Criar `server/index.ts` (Node) que serve o build e expõe `POST /api/tts`.
- [ ] Ler `API_KEY_FISHAUDIO` do `.env` **somente no servidor**.
- [ ] Implementar chamada SSE `POST /v1/tts/stream/with-timestamp` (`s2.1-pro`, `pt-BR`, `opus`, `balanced`).
- [ ] Parsear eventos: `audio_base64`, `chunk_seq`, `chunk_audio_offset_sec`, `alignment.segments`.
- [ ] Repassar ao cliente via stream (SSE/NDJSON) sem bufferizar tudo.
- [ ] Implementar cache em disco (LRU + TTL) por `hash(texto+voice+model+emoção)`.
- [ ] Implementar `?nocache=1` para forçar geração.
- [ ] Implementar `AudioContext` + fila de chunks + buffer de 250–300 ms.
- [ ] Usar `AudioContext.currentTime` como relógio mestre (sem `setTimeout` para boca).
- [ ] Montar timeline incrementalmente conforme o alignment chega (nunca inventar).
- [ ] Emitir `syncwarn` quando o alignment atrasar além do buffer.
- [ ] Implementar `unlock()` (primeiro gesto) e estado visual "clique para ouvir".
- [ ] Implementar `say()` com interrupção (fade 150 ms) e `{ queue: true }`.
- [ ] Implementar estados de erro: "voz indisponível" + idle (sem mock em produção).
- [ ] Emitir eventos `speechstart`, `viseme`, `speechend`, `error`.
- [ ] Criar `persona.json` + validação (voiceId, model, defaultMood, intensity, blinkRange, headAccentRate).

**Verificação:** frase digitada toca em < 2 s; boca acompanha palavra a palavra; repetir a frase bate no cache.

---

## Fase 6 — Naturalidade, performance e acessibilidade

**Objetivo:** o rosto parece vivo quando calado e continua estável sob carga.

- [ ] Implementar drift de cabeça por ruído (PRNG próprio).
- [ ] Implementar piscar com jitter 2–6 s, assimetria, piscada dupla ocasional e blink de antecipação.
- [ ] Implementar micro-sacadas + tremor de gaze (olhar à frente).
- [ ] Implementar respiração modulando pitch e fade do pescoço.
- [ ] Implementar ênfase prosódica (energia do AnalyserNode → nods + sobrancelha assimétrica).
- [ ] Implementar tensão labial residual entre palavras.
- [ ] Implementar `prefers-reduced-motion` (remove drift/nods, mantém fala e piscar).
- [ ] Implementar `aria-live` com o texto falado.
- [ ] Perfilar: 60 fps com painel aberto; otimizar pontos quentes.
- [ ] Auditar orçamentos: SVG < 80 KB, JS < 60 KB gzip, zero libs de animação.
- [ ] Congelar snapshots de regressão visual (pixel-diff a partir daqui).
- [ ] Escrever `README.md` (instalação, uso do componente, API, debug).
- [ ] Revisão final dos 7 critérios de aceite da spec.

**Verificação:** 60 s de observação sem repetição perceptível; critérios de aceite todos satisfeitos.

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
