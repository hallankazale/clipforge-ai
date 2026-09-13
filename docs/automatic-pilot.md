# ClipForge AI — Piloto Automático

## Objetivo

O Piloto IA transforma uma configuração de nicho em uma fila de produção contínua. O usuário escolhe nicho, duração, plataformas e nota mínima; o sistema gera roteiro, storyboard, cenas, narração, legendas e vídeo vertical, mede a qualidade final e decide se o material pode seguir para publicação.

A regra central é: **automação não substitui qualidade**. Um vídeo não recebe o status `ready-to-publish` apenas porque foi renderizado com sucesso.

## Fluxo implementado na versão 0.6.0

```text
Perfil do canal
  ↓
Roteiro + hook
  ↓
Storyboard cena a cena
  ↓
Imagens geradas por cena
  ↓
Narração
  ↓
Legendas SRT
  ↓
FFmpeg → 1080x1920 / H.264 / AAC
  ↓
Transcrição de validação
  ↓
Quality Gate (8 métricas)
  ├─ aprovado → ready-to-publish
  ├─ reprovado + tentativa disponível → correção seletiva
  └─ limite atingido → manual-review
  ↓
Fila persistente
```

## Quality Gate

O Quality Gate mede oito dimensões em escala de 0 a 100:

| Métrica | Peso |
| --- | ---: |
| Hook | 20% |
| Storytelling/roteiro | 17% |
| Consistência visual | 13% |
| Ritmo | 13% |
| Clareza da voz | 10% |
| Legibilidade das legendas | 10% |
| Originalidade | 10% |
| Adaptação à plataforma | 7% |

Além da média ponderada existem limites críticos. Falhas graves em hook, voz, legibilidade, originalidade ou consistência visual reprovam o vídeo mesmo se a média geral estiver alta.

A meta padrão é 82/100 e pode ser configurada entre 75 e 95.

## Correção seletiva

O motor usa a causa da reprovação para decidir o que deve ser gerado novamente. As ações possíveis são:

- `rewrite-hook`
- `rewrite-script`
- `regenerate-visuals`
- `retime-edit`
- `regenerate-voice`
- `regenerate-captions`
- `diversify-concept`
- `adjust-platform-format`

O limite é de até três tentativas por vídeo para impedir loops infinitos e consumo desnecessário de API.

## Qualidade técnica alvo

Para Shorts/TikTok o renderizador produz:

- 1080 × 1920
- H.264 / yuv420p
- AAC
- 30 fps
- áudio normalizado
- MP4 com `faststart`
- legendas dentro da área segura

O arquivo final é validado novamente com FFprobe antes da decisão do Quality Gate.

## Segurança

A chave da OpenAI é armazenada usando `Electron.safeStorage`. Se a criptografia segura do sistema operacional não estiver disponível, o ClipForge se recusa a persistir a chave em texto puro.

A chave salva nunca é devolvida ao renderer. O renderer recebe apenas o estado `configured/not configured`.

Os IPCs validam duração, plataformas, quantidade diária, limite de tentativas e nota mínima antes de iniciar uma produção.

## Fila e agendamento

A fila fica persistida no diretório de dados do aplicativo. Ela suporta os estados:

- `queued`
- `processing`
- `ready-to-publish`
- `manual-review`
- `failed`
- `canceled`
- `published`

O desktop verifica itens vencidos periodicamente enquanto o ClipForge estiver aberto. Também existe geração imediata e cancelamento do job ativo.

Os artefatos de cada tentativa ficam em `Vídeos/ClipForge AI/Pilot/<job>/attempt-XX`, incluindo plano, cenas, narração, legendas, métricas, metadados de publicação e MP4 final.

## Contas e publicação

A versão 0.6.0 **não simula** OAuth ou postagem. YouTube e TikTok permanecem visualmente separados da produção até existirem credenciais oficiais de aplicativo e autorização do usuário.

O vídeo aprovado recebe `ready-to-publish`. A próxima camada usa adaptadores independentes:

```text
Publisher
├── YouTubePublisher
└── TikTokPublisher
```

A separação é intencional: produção de mídia não deve depender da disponibilidade das APIs sociais.

## Estado da versão 0.6.0

Implementado:

- interface real do Piloto IA
- presets de nicho
- configuração de frequência e duração
- seleção YouTube Shorts/TikTok
- chave OpenAI criptografada localmente
- roteiro e storyboard estruturados por IA
- geração de imagens por cena
- narração em português
- legendas SRT
- composição vertical via FFmpeg
- validação técnica via FFprobe
- transcrição para medir clareza da voz
- Quality Gate com oito métricas
- retry seletivo
- fila persistente de sete dias
- geração imediata
- progresso e cancelamento em tempo real
- testes unitários de Quality Gate, retry, agenda e métricas locais
- build desktop validado no CI do Windows

Dependências externas ainda necessárias para publicação pública automática:

- app OAuth registrado no Google/YouTube
- app registrado no TikTok for Developers
- escopos e auditorias exigidos pelas plataformas

Essas dependências não devem ser contornadas nem substituídas por armazenamento de senha do usuário.
