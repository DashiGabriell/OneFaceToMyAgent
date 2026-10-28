# RIG MAP — rosto SVG

Contrato de camadas da Fase 1. Todo elemento que o rig vai mover tem `data-part`.
Cada `data-part` declara `transform-box: fill-box` e uma `transform-origin` própria
no `<style>` embutido no SVG.

- `viewBox`: `0 0 1000 1200`
- Cabeça com boné e orelhas: `x 124..876`, `y 32..1170`
- Rosto: `x ~184..816`, `y 416..1147`
- Boné: copa `y 32..502`; aba `y 446..570`; logo centralizado na copa
- Óculos: armação `y ~638..830`; lentes sobre os olhos, hastes até as orelhas
- Barba: bigode acima do lábio superior e cavanhaque até `y ~1170`
- Pescoço: fade escuro até `y 1200` com `stop-opacity: 0`
- Fundo: transparente
- 37 `data-part`, com pares L/R separados
- Lado direito: geometria espelhada de forma explícita (sem `scale(-1 1)` em
  ancestral animável), então eixos de translação/rotação são os mesmos nos dois lados.

## Partes animáveis

| `data-part` | Origem | Canais | Movimento previsto |
|---|---|---|---|
| `head` | `50% 88%` | `headYaw`, `headPitch`, `headRoll`, `headX`, `headY`, `breath` | rotação/translação do conjunto cabeça + elevação sutil na respiração |
| `neck` | `50% 100%` | `breath` | escala vertical sutil + respiração no fade |
| `earL` / `earR` | `50% 50%` | `head` (herdado) | estático dentro da cabeça |
| `cap` | `50% 92%` | `head` (herdado) | copa fixa na cabeça |
| `capBrim` | `50% 100%` | `head` (herdado) | aba + sombra projetada no rosto |
| `capLogo` | `50% 50%` | `head` (herdado) | bola e lettering dos Lakers |
| `glasses` | `50% 50%` | `head` (herdado) | armação, ponte e hastes |
| `lensL` / `lensR` | `50% 50%` | `head` (herdado) | lente e reflexos |
| `browL` / `browR` | `50% 50%` | `browRaiseL/R`, `browAngleL/R` | subir/baixar e inclinar |
| `eyeL` / `eyeR` | `50% 50%` | `head` (herdado) | conjunto esclera + íris |
| `irisL` / `irisR` | `50% 50%` | `gazeX`, `gazeY` | deslocamento da íris dentro da esclera |
| `pupilL` / `pupilR` | `50% 50%` | `pupilDilate` | escala da pupila |
| `eyelidUpperL/R` | `50% 0%` | `eyelidOpenL/R`, `squintL/R` | pálpebra superior desce ao fechar |
| `eyelidLowerL/R` | `50% 100%` | `eyelidOpenL/R`, `squintL/R` | pálpebra inferior sobe no squint |
| `cheekL` / `cheekR` | `50% 50%` | `cheekRaise` | elevação e leve escala da maçã do rosto |
| `nose` | `50% 90%` | `noseFlare` | dilatação da base do nariz |
| `nostrilL` / `nostrilR` | `50% 50%` | `noseFlare` | abertura das narinas |
| `jaw` | `50% 0%` | `jawOpen` | sombra e volume do maxilar |
| `mouth` | `50% 50%` | `mouthWidth`, `mouthCornerL/R` | largura, elevação e inclinação dos cantos |
| `mouthCavity` | `50% 50%` | `jawOpen` | abertura da cavidade |
| `teethUpper` / `teethLower` | `50% 0%` / `50% 100%` | `teethVisible`, `jawOpen` | exposição dos dentes |
| `tongue` | `50% 100%` | `tongueTip` | ponta da língua (com apoio dos lábios) |
| `lipUpper` | `50% 100%` | `jawOpen`, `lipUpperRaise`, `lipPress`, `lipPucker`, `teethVisible`, `tongueTip` | elevação, pressão, bico e abertura |
| `lipLower` | `50% 0%` | `jawOpen`, `lipLowerDrop`, `lipPress`, `lipPucker`, `teethVisible`, `tongueTip` | abaixamento, pressão, bico e abertura |
| `beard` | `50% 0%` | `head` (herdado) | cavanhaque fixo no queixo |
| `mustache` | `50% 100%` | `head` (herdado) | bigode fixo sobre o lábio |

Pares L/R usam canais próprios. Os canais direcionais (`gazeX`, `gazeY`) usam o
mesmo sinal nos dois olhos porque a geometria direita já está espelhada.

## Camadas estáticas (sem `data-part`)

- Sombra e luz do rosto (têmporas, maçãs, testa, mandíbula, queixo).
- Esclera, cílios, lágrima interna e sombra intraocular (dentro de `eyeL/R` e
  `eyelidUpperL/R`).
- Brilho do nariz, sombra lateral, filtro e sulcos do lábio superior.
- Costuras, botão da copa e sombra da aba sob a testa/olhos.
- Fios e textura do bigode e do cavanhaque (dentro de `mustache` e `beard`).
- Sombra sob o maxilar e músculos do pescoço.

Essas camadas herdam o movimento da parte que as contém.

## Regras para o backend (Fase 2)

1. Aplicar animação via propriedade CSS `transform` (não pelo atributo `transform`).
2. Não remover o `data-part` nem sobrescrever `transform-box`.
3. O solver escreve apenas a parte dinâmica; a origem estática fica no `<style>`.
4. `pupilDilate` usa `scale`; `eyelidOpen` usa translação vertical em `fill-box`.
5. Para interpolar entre visemas, compor `translate`/`rotate`/`scale` em uma única
   string de `transform` por parte.
6. Boné, óculos, lentes, barba e bigode não têm canais próprios: acompanham `head`.

## Implementação da Fase 2

O contrato tem **29 canais escalares**, não 22: o número anterior era uma contagem
desatualizada da lista. A fonte de verdade é `src/core/params.ts`, com range,
default, rótulo, grupo, stiffness e damping por canal.

- `src/face/mapping.ts` traduz canais em transforms CSS puros por parte.
- `SvgRigBackend` aplica e faz cache por parte; `computePartStyles` é testável sem DOM.
- `RigEngine` mantém alvo e solver, roda **um** `requestAnimationFrame` e expõe
  `setTarget` (absoluto), `addTarget` (aditivo), `setParams` (snap imediato),
  `reset`, `getBounds` e `subscribe`.
- `SpringSolver` usa dt fixo de `1/60 s`, até 8 subpassos por frame e clamp por canal.
- O painel `?debug=1` lista os 29 canais agrupados, mostra atual/alvo, reset e
  extremos. `?grid=1` renderiza os 58 estados (mín/máx de cada canal).

### Tradução resumida

| Canal | Transform aplicado |
|---|---|
| `headYaw/Pitch/Roll/X/Y` | `perspective(1600px) translate(...) rotateZ/rotateY/rotateX` |
| `breath` | eleva `head` em 4 unidades e escala `neck` em até 4% |
| `browRaise*` / `browAngle*` | `translateY` até 10 unidades + `rotate` até 6° |
| `eyelidOpen*` / `squint*` | pálpebra superior desce até 46/56; inferior sobe até 16/24 |
| `gazeX/Y` | íris desloca até 10/7 unidades |
| `pupilDilate` | `scale` da pupila até 1.5× |
| `noseFlare` | `scale` do nariz e das narinas |
| `cheekRaise` | maçã sobe 8 unidades + `scale` 1.05× |
| `jawOpen` | maxilar desce, cavidade abre, dentes e lábios separam |
| `mouthWidth` | `scaleX` da boca entre 0.86× e 1.14× |
| `mouthCornerL/R` | elevação de até 6 unidades + inclinação de até 3.2° |
| `lipUpperRaise` / `lipLowerDrop` | lábios sobem/descem até 12 unidades |
| `lipPress` / `lipPucker` | lábios se aproximam / `scaleX` até 0.88× |
| `tongueTip` | língua sobe 16 unidades, abre espaço entre os lábios |
| `teethVisible` | dentes avançam e lábios abrem até 5 unidades |

**Verificado:** 29 canais mapeados para partes existentes; cada canal altera ao menos
um transform alvo; solver converge e respeita range; painel move `jaw` e `head`;
grade com 58 células; frame JS ~0.1 ms no Chromium headless.

## Lip-sync (Fase 3)

- `VISEME_CHANNELS`: `jawOpen`, `mouthWidth`, `mouthCornerL/R`, `lipUpperRaise`,
  `lipLowerDrop`, `lipPress`, `lipPucker`, `tongueTip`, `teethVisible`.
- `VISEMES`: `rest`, `mbp`, `fv`, `l`, `a`, `e`, `i`, `o`, `u`, `nasal`,
  `sibilant`, `dtn`. Cada visema é um `Partial<RigParams>`; canais ausentes viram 0.
- `phonemes.ts` normaliza a palavra, trata dígrafos (`ch`, `lh`, `nh`, `rr`, `ss`,
  `qu`, `gu`, `ão/ãe/õe`), nasal final (`m`/`n`) e exceções frequentes.
- Pesos relativos: vogal 0.90–1.00, nasal 1.35, sibilante 1.15, oclusiva/lateral 0.55–0.65.
- `buildWordTimeline` distribui a duração da palavra pelo peso e nunca sobrepõe
  eventos; `buildTimeline` monta a timeline global mantendo os gaps entre palavras.
- `sampleTimeline` mistura visemas vizinhos numa janela de ±120 ms; fora da janela,
  retorna `REST_VISEME_PARAMS`.
- `LipSyncPlayer` usa `RigEngine.setDriver`: o driver devolve o partial do instante,
  o engine resolve sobre o alvo atual e o solver suaviza. `stop()` volta ao rest.
- `?debug=1` tem `Loop de visemes`, `Frase mock` e `Parar`; `?visemes=1` renderiza
  a grade dos 12 visemas.

**Verificado:** testes de dígrafos, exceções, pesos, timeline sem sobreposição,
blend de fronteira e fallback de rest; loop e frase mock movem a boca; grade com
12 visemas; screenshot do player em `tests/snapshots/lipsync.png`.

## Emoções e blending (Fase 4)

- `src/core/emotion.ts`: presets `neutral`, `happy`, `sad`, `surprised`, `thinking`
  como `Partial<RigParams>` aditivos (delta) e versões de flash para a
  micro-expressão. Nenhum canal novo: a emoção é sempre um delta sobre os 29 canais.
- `src/core/emotion-mixer.ts`: duas camadas temporais.
  - `mood`: transição de 300–600 ms (default 450), pesos normalizados
    (`1 / max(1, soma)`) para misturar presets; `neutral` zera o mood.
  - `reaction`: impulso com ataque curto e decaimento de 1–3 s (default 1,8 s).
  - `flash`: pulso de 80–150 ms (default 110) derivado do preset, somado ao mood
    enquanto ele ainda está assentando.
- `RigEngine.setModifier` mantém `baseTarget` (visema, sliders, idle) separado do
  `target` composto: `mergeParams(baseTarget, delta)` aplica o delta e faz clamp
  por canal a cada frame. Trocar de emoção não reinicia a fala: só o delta muda.
- `[EMO:x]` (`src/core/emotion-tags.ts`) é opt-in; `buildEmotionTimeline` transforma
  os trechos em cues de tempo sobre a timeline mock, e `LipSyncPlayer.playMock` só
  aplica quando `emotionTags: true`.
- `?debug=1`: 5 presets, peso, aplicar como mood, disparar reação, limpar, status
  com pesos, camada e TTL, além de uma frase editável com tag.
- `?emotions=1`: grade 5 emoções × 3 visemas (A, MBP, O) = 15 células.
- API: `avatar.setEmotion(name, { weight, layer, transitionMs, flash, decayMs })`,
  `avatar.react`, `avatar.setEmotionMix`, `avatar.clearEmotion`.

**Verificado:** transição parte de zero e assenta no intervalo configurado; troca
no meio não salta; flash expira em ≤150 ms; reação decai e some em ≤3 s; composição
clampada; 3 emoções trocadas ao vivo durante a frase; grade revisada em
`tests/snapshots/emotions.png`; 65 testes unitários e 8 Playwright verdes.

## Idle e naturalidade (Fase 6)

Canais movidos continuamente pelo `IdleSimulator` (delta no modifier, junto com emoção):

| Comportamento | Canais | Notas |
|---|---|---|
| Drift de cabeça | `headYaw`, `headPitch`, `headRoll`, `headX`, `headY` | PRNG + senoides lentas; off em `prefers-reduced-motion` |
| Piscar | `eyelidOpenL/R` | Jitter 2–6 s, assimetria, ~10% dupla, antecipação antes de `say()` |
| Gaze | `gazeX`, `gazeY`, `pupilDilate` | Micro-sacadas + tremor; olhar permanece à frente |
| Respiração | `breath`, `headPitch`, `noseFlare` | ~0,22 Hz; eleva cabeça e fade do pescoço |
| Ênfase prosódica | `headPitch`, `browRaiseL/R`, `browAngleL/R` | Energia do `AnalyserNode`; off em reduced-motion |
| Tensão labial | `lipPress`, `mouthWidth` | Residual entre palavras na timeline de fala |

## Fala com áudio (Fase 5)

- `server/` é Node puro, sem framework: `GET /api/persona`, `GET /api/health`,
  `POST /api/tts` e arquivos estáticos de `dist/`.
- A `API_KEY_FISHAUDIO` só é lida no servidor (`process.loadEnvFile`), nunca vai
  para o bundle do cliente.
- `POST /v1/tts/stream/with-timestamp` com header `model`
  (`s2.1-pro-free` no persona), `format: opus`, `latency: balanced`, `language: pt-BR`
  e `reference_id` apenas quando `voiceId` está preenchido.
- `fish.ts` faz o parse SSE incremental e normaliza `audio_base64`, `chunk_seq`,
  `chunk_audio_offset_sec` e `alignment.segments`; o servidor repassa em NDJSON
  (meta → audio/alignment → done) sem bufferizar a resposta inteira.
- Cache em disco LRU+TTL em `.cache/tts`, chave sha256 de
  `texto+voice+model+format+lang+emoção`; `?nocache=1` ignora a leitura e regrava.
- Cliente: `AudioQueue` usa `AudioContext.currentTime` como relógio mestre, buffer
  de 280 ms, WAV incremental e `decodeAudioData` para opus/mp3; interrupção com
  fade de 150 ms.
- `SpeechController` monta a timeline incremental por `chunk_seq`, emite `syncwarn`
  quando o alignment atrasa mais de 300 ms, `speechstart`/`viseme`/`speechend`/`error`,
  suporta `{ queue: true }` e nunca inventa boca sem alignment.
- `persona.json` (raiz) validado por `src/core/persona.ts` e servido em `/api/persona`.
- A demo principal tem gate "clique para ouvir", frase, emoção, Ouvir/Parar e status;
  `?nocache=1` força nova geração.
- `FISHAUDIO_MOCK=1` gera WAV sintetizado com alignment por palavra, só em dev.

**Verificado:** stream NDJSON, cache hit, `nocache`, erro 502, parser SSE, WAV,
timeline e persona; fala + boca + emoção + cache no Chromium; screenshot
`tests/snapshots/speech.png`. **Na API real com `s2.1-pro-free`:** primeira fala em
1.008 ms, `jawOpen` variando de 0,02 a 0,90 durante a frase e repetição em cache em
198 ms (`falando · cache`), com Opus (`OggS`) decodificado progressivamente.
