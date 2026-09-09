# ClipForge AI

Aplicativo desktop para transformar vídeos longos em cortes inteligentes prontos para Instagram, TikTok, Reels e YouTube.

## Objetivo

O ClipForge AI recebe um arquivo de vídeo ou link, analisa conteúdo, áudio, fala e mudanças de cena, identifica trechos relevantes e gera cortes configuráveis de 1, 5 ou 10 minutos.

## Princípios do projeto

- Desktop-first para Windows
- Interface moderna e orientada a feedback em tempo real
- Processamento de vídeo desacoplado da interface
- Arquivos pesados e saída preferencialmente no HDD escolhido pelo usuário
- IA isolada por contratos para permitir troca de modelo sem quebrar o app
- Segurança por padrão: sem chaves embutidas, validação de entradas e IPC restrito
- Processos externos executados sem shell
- Testes unitários, integração e E2E

## Stack

- Electron
- React
- TypeScript
- Vite
- pnpm workspaces
- Vitest
- FFmpeg static 5.3.0
- FFprobe static 3.1.0
- Whisper/ASR via serviço local desacoplado (próxima fase)

## O que já funciona

- Interface inicial baseada nos mockups aprovados
- Escolha de cortes de 1, 5 e 10 minutos
- Seleção de Instagram, TikTok, Reels e YouTube
- Seleção nativa da pasta de destino no Windows
- Seleção nativa de um vídeo local
- Validação de extensões de vídeo suportadas
- Leitura real do arquivo com FFprobe
- Exibição de duração, resolução, FPS, codec e tamanho
- Botão **Iniciar análise** ligado a um job real
- Pipeline FFmpeg assíncrono sem travar a interface
- Extração de áudio WAV mono 16 kHz para futura transcrição
- Extração de quadros reduzidos a cada 10 segundos para futura análise visual
- Tela **Processamento** com barra de progresso e log em tempo real
- Cancelamento do job com limpeza dos arquivos parciais
- Workspace de análise criado dentro da pasta escolhida pelo usuário
- Comunicação segura entre React e Electron via preload/IPC
- Testes unitários de metadados e progresso do FFmpeg
- Workflow de CI para Windows

## Estrutura

```text
clipforge-ai/
├── apps/
│   └── desktop/
│       ├── electron/
│       │   ├── services/
│       │   │   ├── analysis-pipeline.ts
│       │   │   └── video-engine.ts
│       │   ├── main.ts
│       │   └── preload.ts
│       └── src/
│           ├── components/
│           │   ├── AppSidebar.tsx
│           │   └── ProcessingScreen.tsx
│           └── App.tsx
├── docs/
├── tests/
└── scripts/
```

## Pipeline atual

```text
Arquivo local
   ↓
Validação da origem
   ↓
FFprobe: metadados
   ↓
Criar workspace no HDD escolhido
   ↓
FFmpeg: áudio WAV mono 16 kHz
   ↓
FFmpeg: quadro 640px a cada 10 segundos
   ↓
Arquivos prontos para transcrição e análise inteligente
```

Os arquivos temporários desta fase ficam em:

```text
<PASTA_ESCOLHIDA>\_ClipForge\analises\<JOB_ID>\
├── audio-16khz.wav
└── frames\
    ├── frame-000001.jpg
    ├── frame-000002.jpg
    └── ...
```

## Fluxo alvo do produto

```text
Arquivo ou link
   ↓
Validação da origem
   ↓
Pré-processamento FFmpeg/FFprobe
   ↓
Transcrição + análise de cenas
   ↓
Ranking de momentos relevantes
   ↓
Cortes de 1 / 5 / 10 minutos
   ↓
Revisão pelo usuário
   ↓
Preset Instagram / TikTok / Reels / YouTube
   ↓
Exportação para HDD
```

## Rodar no Windows

Requer Node.js 20+.

Como o PowerShell de alguns computadores bloqueia `pnpm.ps1`, os exemplos abaixo usam `pnpm.cmd`.

```powershell
git clone https://github.com/hallankazale/clipforge-ai.git
cd clipforge-ai
npm.cmd install -g pnpm@9.15.4
pnpm.cmd install
pnpm.cmd dev
```

Se o repositório já estiver no computador:

```powershell
cd clipforge-ai
git pull
pnpm.cmd install
pnpm.cmd dev
```

## Validação

```powershell
pnpm.cmd typecheck
pnpm.cmd test
pnpm.cmd build
```

## Próxima fase

Adicionar **transcrição local**, detecção de mudanças de cena e a primeira camada de ranking inteligente. Só depois dessa camada o sistema começará a sugerir os melhores trechos e gerar cortes automaticamente.
