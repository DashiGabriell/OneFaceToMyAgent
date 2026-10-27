# Rosto SVG para agentes de IA

Documento de início do projeto. Registra o problema, o objetivo e as decisões já tomadas. A especificação completa está em [`docs/SPEC.md`](./docs/SPEC.md) e o plano de execução em [`docs/TODO.md`](./docs/TODO.md).

## Contexto

Agentes de IA baseados em texto são percebidos como frios e sem presença. A proposta deste projeto é dar a eles um rosto vetorial que fale e expresse emoções na web, com carregamento instantâneo e sem o custo de banda de vídeo ou WebRTC.

A animação é feita sobre SVG: os elementos são organizados em grupos hierárquicos e cada parte do rosto responde a parâmetros contínuos. Não há malha, osso ou captura de movimento — o rig é dirigido por código, em tempo real.

## Objetivo

Construir um avatar de cabeça riggada que:

- exponha emoções dinâmicas e interpoláveis;
- fale pt-BR com sincronia labial baseada nos timestamps da voz gerada;
- rode a 60 fps no navegador, com aparência natural;
- possa ser embutido em qualquer página e dirigido por um agente.

O escopo do v1 é uma demonstração ponta a ponta (texto → voz → rosto falando) e, no mesmo projeto, um componente com API pública.

## Decisões tomadas

### Conceito e escopo

- Visual **pseudo-3D vetorial**: volume e perspectiva simulados por camadas em parallax (yaw, pitch, roll) e proporções semi-realistas.
- Personagem: **homem negro, corte social**, cabeça flutuante com a base do pescoço em fade, fundo transparente, `viewBox` responsivo.
- Boca com cavidade, dentes e língua. Sem rugas, poros ou textura de pele: o realismo vem do movimento, não do detalhe estático.
- Olhar fixo à frente (direção do usuário). Não há rastreamento de mouse.

### Motor de animação

- Implementação **100% em código**, sem Rive, Spine ou GSAP. Interpolação e suavização próprias em um único `requestAnimationFrame`.
- Rig aditivo: os visemas definem a base da boca e as emoções aplicam deltas, com clamp por canal.
- Parâmetros contínuos + presets de emoção interpoláveis. Duas camadas de emoção: `mood` (transição lenta) e `reaction` (momentânea, com decaimento).
- Interface `RigBackend` separa o motor da renderização em SVG.

### Fala e voz

- TTS: **FishAudio**, modelo `s2.1-pro`, pt-BR, via SSE `with-timestamp`.
- O Fish entrega tempo por **palavra**, não por fonema. A conversão palavra → visema é feita por regras de grafema para pt-BR, com dicionário de exceções.
- Distribuição dentro da palavra: ponderada por classe fonética, modulada pela amplitude real do áudio e suavizada.
- 12 visemas (padrão Preston Blair), implementados como combinações dos canais do rig.
- Relógio mestre é o `AudioContext`. Sem timeline, a boca não se move — nunca se inventa fala.
- Streaming com buffer de 250–300 ms; em falha, o rosto permanece vivo em estado "voz indisponível".

### Integração e operação

- Componente Web (Vite + TypeScript), dono do áudio e do relógio, com `unlock()` no primeiro gesto do usuário.
- API de comandos: `say()`, `setEmotion()`, `interrupt()`, `setParams()`, `unlock()`.
- `say()` interrompe a fala atual com fade de 150 ms; fila opcional via `{ queue: true }`.
- Servidor Node único serve o build e faz proxy de `/api/tts`; a chave do Fish nunca chega ao navegador.
- Cache em disco com TTL por hash de texto, voz, modelo e emoção.
- Configuração de persona em `persona.json`, validada e sobrescrevível por instância.

### Naturalidade

Para que o rosto pareça humano, o avatar inclui: spring/damper por canal, coarticulação entre visemas vizinhos, piscar assimétrico com jitter e piscadas duplas ocasionais, micro-sacadas oculares, drift de cabeça por ruído, respiração, ênfase prosódica, micro-expressões antes da emoção assentar, assimetria sistemática e tensão labial residual entre palavras.

### Qualidade

- Validação por grade de screenshots (Playwright) e revisão manual.
- `prefers-reduced-motion` e `aria-live`.
- Orçamentos: 60 fps, SVG abaixo de 80 KB, JavaScript abaixo de 60 KB gzip, nenhuma biblioteca de animação.
- Código em inglês, interface em pt-BR, sem comentários.

## Fora de escopo

Rive, Spine, GSAP/MorphSVG, WebGL/Canvas, mesh warping, malhas de deformação em runtime, animação pré-gravada de expressões, heurística local de sentimento, rastreamento do mouse, tronco e cenário, textura fotorrealista de pele e rugas.

## Arquitetura

```
texto ──> servidor (proxy Fish + cache) ──> SSE: áudio + alinhamento por palavra
                                                   │
                                                   v
                                   timeline de visemas (grafema → visema)
                                                   │
                                                   v
                              parâmetros do rig (base do visema + emoção)
                                                   │
                                                   v
                                  solver (spring) ──> SVG
```

O componente consome a API de comandos, mantém o áudio e o relógio, e emite eventos (`speechstart`, `viseme`, `speechend`, `error`, `syncwarn`) para o host.

## Critérios de sucesso do v1

1. Frase em pt-BR audível em menos de dois segundos após o clique.
2. Transições de boca suaves, sem saltos entre visemas.
3. Três emoções trocáveis ao vivo, sem reiniciar a fala.
4. Piscar e comportamento idle contínuos e não repetitivos em 60 segundos de observação.
5. 60 fps com o painel de debug aberto.
6. Falha de voz não quebra a animação.
7. `prefers-reduced-motion` remove movimentos amplos e mantém a fala.

## Riscos conhecidos

- A precisão do lip-sync é limitada pelos timestamps por palavra; nunca será fonema-exata.
- Streaming com alinhamento incremental pode gerar avisos de sincronia em rede ruim.
- O SVG tem teto de realismo; a sensação de vida depende do movimento.
- Cabelo de corte social em SVG é o item artístico mais difícil de acertar.

## Próximos passos

1. Fundação do projeto: Vite, TypeScript, estrutura de pastas e scripts.
2. Rosto SVG riggável com camadas nomeadas.
3. Canais, solver e painel de debug.
4. Lip-sync determinístico com timeline simulada.
5. Emoções e blending.
6. Integração com o FishAudio.
7. Naturalidade, performance e acessibilidade.

O detalhamento de cada etapa, com itens e critérios de verificação, está em [`docs/TODO.md`](./docs/TODO.md).
