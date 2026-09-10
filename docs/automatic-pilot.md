# ClipForge AI — Piloto Automático

## Objetivo

Transformar o ClipForge em um sistema de produção contínua em que o usuário escolhe o nicho, conecta os canais oficiais e define regras. O sistema pesquisa pautas, gera roteiro, produz vídeo, aplica legendas, avalia qualidade, corrige falhas e só então envia o material para a fila de publicação.

A regra central é simples: **automação não substitui qualidade**. Um vídeo não pode ser publicado apenas porque foi gerado com sucesso.

## Arquitetura de produção

```text
Perfil do canal
  ↓
Pesquisa / sinais do nicho
  ↓
Ideia + ângulo original
  ↓
Roteiro com hook
  ↓
Storyboard cena a cena
  ↓
Geração/seleção de visuais
  ↓
Narração
  ↓
Edição e ritmo
  ↓
Legendas
  ↓
Quality Gate
  ├─ aprovado → fila de publicação
  └─ reprovado → corrige o componente fraco → reavalia
  ↓
Publicação oficial
  ↓
Métricas reais do canal
  ↓
Aprendizado para as próximas pautas
```

## Quality Gate

O Quality Gate mede oito dimensões, cada uma em escala de 0 a 100:

- Hook
- Storytelling/roteiro
- Consistência visual
- Ritmo
- Clareza da voz
- Legibilidade das legendas
- Originalidade
- Adaptação à plataforma

Pesos iniciais:

| Métrica | Peso |
| --- | ---: |
| Hook | 20% |
| Storytelling | 17% |
| Consistência visual | 13% |
| Ritmo | 13% |
| Voz | 10% |
| Legendas | 10% |
| Originalidade | 10% |
| Plataforma | 7% |

Existem também limites críticos. Mesmo que a média final seja alta, o vídeo é reprovado se houver falha grave em áreas como hook, voz, legibilidade, originalidade ou consistência visual.

A meta padrão é 82/100 e pode ser elevada pelo usuário até 95/100.

## Correção seletiva

Um vídeo reprovado não deve ser regenerado inteiro sem necessidade. O sistema identifica a causa e corrige somente o componente relevante:

- Hook fraco → reescrever abertura
- Roteiro fraco → reestruturar narrativa
- Visual inconsistente → regenerar cenas específicas
- Ritmo ruim → remontar tempos/cortes
- Voz ruim → regenerar narração
- Legenda ruim → recalcular estilo/timing
- Baixa originalidade → mudar conceito/ângulo
- Formato inadequado → reenquadrar para a plataforma

O número de tentativas automáticas é limitado a 3 para evitar loops infinitos e desperdício de recursos.

## Qualidade técnica mínima

Para Shorts/TikTok o perfil alvo inicial é:

- 1080 × 1920
- H.264 / yuv420p
- AAC
- áudio normalizado
- sem barras pretas quando possível
- legendas dentro de safe areas
- frame rate estável
- duração coerente com a configuração do canal

## Qualidade criativa

Qualidade não será medida apenas por resolução. O sistema deve avaliar:

- força dos primeiros 1–3 segundos
- clareza da promessa do vídeo
- ausência de introdução longa
- progressão narrativa
- densidade de informação
- mudanças visuais suficientes sem excesso
- sincronização entre narração e cena
- legenda curta e legível
- repetição de conceitos recentes no mesmo canal
- coerência entre título, vídeo e descrição

## Contas e publicação

Conexões de YouTube e TikTok devem usar autorização oficial. Senhas não ficam armazenadas no ClipForge.

A camada de publicação será isolada por adaptadores:

```text
Publisher
├── YouTubePublisher
└── TikTokPublisher
```

Isso permite compartilhar o mesmo motor no desktop e, depois, no aplicativo móvel.

## Camadas planejadas

```text
core/
  channel-profile
  niche-profile
  production-plan
  quality-gate
  publication-job

providers/
  research
  script
  image-video
  voice
  transcription

media/
  ffmpeg
  captions
  composition
  thumbnails

publishers/
  youtube
  tiktok

apps/
  desktop
  mobile (fase posterior)
```

## Implementação 0.6.0

A base acima agora está conectada ao processo principal do Electron. Consulte
[pilot-setup.md](pilot-setup.md) para configuração e [pilot-validation.md](pilot-validation.md)
para arquitetura, testes e limitações. YouTube tem upload recuperável e agendamento;
TikTok utiliza envio autorizado à caixa de entrada, com conclusão da postagem no aplicativo.
A execução com credenciais reais e a homologação Windows continuam pendentes.
