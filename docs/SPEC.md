# SPEC — Rosto SVG para agentes de IA

## Objetivo

Avatar de rosto em SVG, cabeça **flutuante** (base do pescoço com fade), homem negro com **boné amarelo dos Lakers**, **óculos dourados**, **bigode e cavanhaque**, rodando na web, que fala pt-BR com lip-sync por palavra e expressa emoções com o máximo de naturalidade que movimento vetorial permite.

## Decisões fechadas

1. v1 = demo ponta a ponta + componente com API pública.
2. Motor 100% código (SVG + própria interpolação), sem Rive/GSAP, atrás de `RigBackend`.
3. Rosto desenhado pelo projeto, camadas nomeadas, pensado para rig.
4. Parâmetros contínuos + presets de emoção interpoláveis (FACS-lite).
5. Vite + TypeScript + Web Component.
6. API de comandos headless; chave do Fish só no servidor.
7. pt-BR, `s2.1-pro`, SSE `with-timestamp`; mock só em dev.
8. Aceite: <2s até o som, boca palavra a palavra, 3 emoções ao vivo, piscar espontâneo, olhar fixo à frente, 60fps.
9. Grafema→visema por regra (dígrafos pt-BR + dicionário de exceções).
10. Tempo: âncoras do Fish + distribuição ponderada + mandíbula por amplitude + suavização.
11. Arte: ilustração vetorial com gradientes suaves, proporções semi-realistas.
12. Movimento: yaw ±8°, pitch ±5°, roll ±3°, multiplicador de intensidade.
13. Emoção explícita + parser opcional `[EMO:x]`; sem heurística.
14. Boca com cavidade, dentes e língua; sem rugas.
15. Servidor Node único: serve build + `/api/tts`.
16. Demo: textarea + emoções + play + `?debug=1`.
17. Rig aditivo: visema é base, emoção aplica delta com clamp; camadas `mood` e `reaction`.
18. Componente dono do áudio e do relógio; `unlock()` no primeiro gesto.
19. `say()` interrompe com fade ~150ms; `{ queue: true }` opcional.
20. Streaming com buffer ~250–300ms; falha → "voz indisponível" + idle.
21. Cache TTL em disco por `hash(texto+voice+model+emoção)`; `?nocache=1`.
22. `persona.json` validado, sobrescrevível por instância.
23. Só cabeça, boné/óculos/barba estilizados, fundo transparente, `viewBox` responsivo.
24. `prefers-reduced-motion` + `aria-live`.
25. Estrutura: `core` / `face` / `lipsync` / `audio` / `avatar` / `server` / `demo` / `tests`.
26. 29 canais escalares de rig (contrato abaixo).
27. Ordem: SVG → canais+debug → lipsync mock → emoções → Fish → polimento.
28. Validação: grade de screenshots Playwright + revisão manual.
29. Código em inglês, UI em pt-BR, sem comentários.
30. Tetos: 60fps, SVG <80KB, JS <60KB gzip, zero libs de animação.
31. `thinking` como preset opcional (não automático).

## Contrato do rig (29 canais)

```
headYaw ±8° · headPitch ±5° · headRoll ±3° · headX/Y
browRaiseL/R 0..1 · browAngleL/R -1..1
eyelidOpenL/R 0..1 · squintL/R 0..1
gazeX/Y -1..1 · pupilDilate 0..1
noseFlare 0..1 · cheekRaise 0..1
jawOpen 0..1 · mouthWidth -1..1 · mouthCornerL/R 0..1
lipUpperRaise 0..1 · lipLowerDrop 0..1 · lipPress 0..1 · lipPucker 0..1
tongueTip 0..1 · teethVisible 0..1
breath 0..1
```

## Visemas (combinações de canais, não canais novos)

`rest · MBP · FV · L · A · E · I · O · U · nasal(ão/em) · sibilante(s/ch) · D/T/N`

12 formas, alvo Preston Blair.

## Pipeline de fala

```
texto → proxy → Fish SSE (opus, balanced, pt-BR)
      → chunks + alignment
      → timeline (âncoras por palavra)
      → grafema→visema
      → distribuição ponderada
      → alvo de canais
      → solver (spring)
      → SVG
```

Relógio mestre: `AudioContext.currentTime`. Sem timeline = sem boca animada (nunca inventar fala).

### Regra de dependência

`core` não importa nenhum outro módulo do projeto. `face`, `lipsync` e `audio` importam apenas `core`. `avatar` pode importar todos, mas ninguém importa `avatar`. `server` é exclusivo do backend e nunca é importado pelo cliente. `demo` consome apenas a API pública de `avatar`.

## "O mais humano possível" — micro-comportamentos

- Interpolação **spring/damper** por canal (nada de lerp linear).
- **Coarticulação**: visemas vizinhos influenciam o atual (janela ±120ms).
- **Piscar** com jitter 2–6s, assimetria entre olhos, ~10% de piscada dupla e blink de antecipação antes de falar.
- **Micro-sacadas** e tremor de gaze (olhar continua à frente).
- **Drift** de cabeça por ruído (PRNG próprio) — desligado em reduced-motion.
- **Respiração** modulando pitch e leve elevação no fade do pescoço.
- **Ênfase prosódica**: picos de energia viram nods e sobrancelha assimétrica.
- **Micro-expressões** (flash 80–150ms) antes da emoção `mood` assentar.
- **Assimetria** sistemática: sobrancelhas, sorriso e piscar nunca idênticos.
- Tensão labial residual: boca não volta a "rest" morto entre palavras.
- Transições de emoção 300–600ms, reaction decaindo 1–3s.

## Personagem

Homem negro, boné amarelo dos Lakers com logo recriado (bola + lettering), óculos dourados de aro fino, bigode e cavanhaque, pele com 3–4 tons em gradiente (sem rugas/poros), sobrancelha densa, olhos com brilho especular, lábios com dois tons, orelhas visíveis, pescoço truncado em fade escuro.

## API pública (rascunho)

```ts
avatar.say({ text, emotion?, queue? })
avatar.setEmotion(name, { weight?, layer?: 'mood' | 'reaction' })
avatar.interrupt()
avatar.setParams(partial)   // debug
avatar.unlock()

// eventos: speechstart · viseme · speechend · error · syncwarn
```

## Critérios de aceite (v1)

1. Frase pt-BR audível em <2s do clique.
2. Nenhum visema "piscando" — trocas sempre suavizadas.
3. 3 emoções trocáveis ao vivo sem resetar a fala.
4. Piscar e idle contínuos e não repetitivos em 60s de observação.
5. 60fps com painel de debug aberto.
6. Falha do Fish não quebra o rosto.
7. `prefers-reduced-motion` remove drift/nods e mantém a fala.

## Riscos declarados

- Timestamps por palavra exigem mapeador próprio; precisão nunca será fonema-exata.
- Streaming + alinhamento incremental pode gerar `syncwarn` em rede ruim.
- SVG tem teto de realismo; o "humano" vem do movimento.
- Logo dos Lakers, boné e óculos em SVG são os itens artísticos mais difíceis de acertar.
